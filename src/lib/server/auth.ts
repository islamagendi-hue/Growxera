import "server-only";
/**
 * Passwordless authentication: one-time sign-in links and cookie sessions.
 *
 * - Link tokens are 32 random bytes (256 bits) from the platform CSPRNG, sent
 *   only by email. The database stores a SHA-256 hash, never the token.
 * - A link expires (LINK_TTL) and works once: it is consumed with a single
 *   conditional UPDATE (used_at IS NULL AND expires_at > now), so two clicks
 *   racing each other can't both sign in.
 * - Sessions are another random token in an HttpOnly, Secure, SameSite=Lax
 *   cookie, also stored hashed, revocable server-side, and expire after
 *   SESSION_TTL_DAYS.
 * - Responses never reveal whether an email has an account (see /api/auth/request).
 */
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq, gt, insert, isNull, select, selectOne, update } from "./store";

export const SESSION_COOKIE = "gx_session";
/** Readable by the page, holds no secret: only tells the menu to show "My account". */
export const SIGNED_IN_HINT_COOKIE = "gx_signed_in";
export const SESSION_TTL_DAYS = 30;
/** Minutes a link stays valid, by purpose. Report links are opened later from the inbox, so they live longer. */
export const LINK_TTL_MINUTES: Record<TokenPurpose, number> = { login: 20, signup: 20, report: 60 * 48 };

export type TokenPurpose = "login" | "signup" | "report";

export interface Account {
  id: string;
  created_at: string;
  email: string;
  name: string;
  company: string;
  job_title: string | null;
  phone: string | null;
  website: string | null;
  verified_at: string | null;
  last_login_at: string | null;
  deleted_at: string | null;
}

export interface PendingSignup {
  name: string;
  company: string;
}

interface TokenRow {
  id: string;
  email: string;
  account_id: string | null;
  purpose: TokenPurpose;
  pending: PendingSignup | null;
  diagnostic_session_id: string | null;
  redirect_to: string | null;
  expires_at: string;
  used_at: string | null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Only same-site paths are allowed as post-login destinations (no open redirects). */
export function safeRedirect(path: string | null | undefined, fallback = "/account"): string {
  if (!path || typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return fallback;
  return path.length > 300 ? fallback : path;
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  return selectOne<Account>("accounts", [eq("email", normalizeEmail(email)), isNull("deleted_at")]);
}

export async function findAccountById(id: string): Promise<Account | null> {
  return selectOne<Account>("accounts", [eq("id", id), isNull("deleted_at")]);
}

/** Issues a one-time link token and returns the raw token (to be emailed, never logged or returned to the browser). */
export async function issueLinkToken(input: {
  email: string;
  purpose: TokenPurpose;
  accountId?: string | null;
  pending?: PendingSignup | null;
  diagnosticSessionId?: string | null;
  redirectTo?: string | null;
  now?: Date;
}): Promise<string> {
  const token = newToken();
  const now = input.now ?? new Date();
  await insert("auth_tokens", {
    id: crypto.randomUUID(),
    created_at: now.toISOString(),
    token_hash: hashToken(token),
    email: normalizeEmail(input.email),
    account_id: input.accountId ?? null,
    purpose: input.purpose,
    pending: input.pending ?? null,
    diagnostic_session_id: input.diagnosticSessionId ?? null,
    redirect_to: input.redirectTo ? safeRedirect(input.redirectTo) : null,
    expires_at: new Date(now.getTime() + LINK_TTL_MINUTES[input.purpose] * 60_000).toISOString(),
    used_at: null,
  });
  return token;
}

export type ConsumeResult =
  | { ok: true; account: Account; redirectTo: string; diagnosticSessionId: string | null; isNew: boolean; purpose: TokenPurpose }
  | { ok: false; reason: "invalid" | "expired" | "used"; email?: string };

/**
 * Uses a link token: marks it used (atomically), finds or creates the account,
 * and attaches the diagnostic the link was issued for. Does not set the cookie.
 */
export async function consumeLinkToken(token: string, now = new Date()): Promise<ConsumeResult> {
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(token)) return { ok: false, reason: "invalid" };
  const hash = hashToken(token);
  const [row] = await update<TokenRow>(
    "auth_tokens",
    [eq("token_hash", hash), isNull("used_at"), gt("expires_at", now.toISOString())],
    { used_at: now.toISOString() },
  );
  if (!row) {
    const existing = await selectOne<TokenRow>("auth_tokens", [eq("token_hash", hash)]);
    if (!existing) return { ok: false, reason: "invalid" };
    return { ok: false, reason: existing.used_at ? "used" : "expired", email: existing.email };
  }

  let account = row.account_id ? await findAccountById(row.account_id) : await findAccountByEmail(row.email);
  let isNew = false;
  if (!account) {
    if (!row.pending) return { ok: false, reason: "invalid" };
    const created: Account = {
      id: crypto.randomUUID(),
      created_at: now.toISOString(),
      email: row.email,
      name: row.pending.name,
      company: row.pending.company,
      job_title: null,
      phone: null,
      website: null,
      verified_at: now.toISOString(),
      last_login_at: now.toISOString(),
      deleted_at: null,
    };
    try {
      await insert("accounts", created as unknown as Record<string, unknown>);
      account = created;
      isNew = true;
    } catch {
      // Two signup links for the same email used at once: the unique index wins, use that account.
      account = await findAccountByEmail(row.email);
      if (!account) return { ok: false, reason: "invalid" };
    }
  } else {
    await update("accounts", [eq("id", account.id)], {
      last_login_at: now.toISOString(),
      ...(account.verified_at ? {} : { verified_at: now.toISOString() }),
    });
  }

  if (row.diagnostic_session_id) await attachDiagnostic(row.diagnostic_session_id, account.id);

  const fallback = row.diagnostic_session_id ? `/account/reports/${row.diagnostic_session_id}` : "/account";
  return {
    ok: true,
    account,
    redirectTo: safeRedirect(row.redirect_to, fallback),
    diagnosticSessionId: row.diagnostic_session_id,
    isNew,
    purpose: row.purpose,
  };
}

/**
 * Links a completed diagnostic to an account. Only an unclaimed diagnostic can be
 * attached, so nobody can pull someone else's saved report into their account.
 */
export async function attachDiagnostic(sessionId: string, accountId: string): Promise<boolean> {
  const rows = await update<{ id: string; lead_id: string | null }>(
    "diagnostic_sessions",
    [eq("id", sessionId), isNull("account_id")],
    { account_id: accountId },
  );
  const leadId = rows[0]?.lead_id;
  if (leadId) await update("leads", [eq("id", leadId)], { account_id: accountId });
  return rows.length > 0;
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(accountId: string, userAgent?: string | null): Promise<{ token: string; expires: Date }> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await insert("auth_sessions", {
    id: crypto.randomUUID(),
    account_id: accountId,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
    revoked_at: null,
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
  return { token, expires };
}

export function sessionCookie(token: string, expires: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export function signedInHintCookie(expires: Date) {
  return { name: SIGNED_IN_HINT_COOKIE, value: "1", httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires };
}

export async function accountForSessionToken(token: string | undefined): Promise<Account | null> {
  if (!token || token.length > 100) return null;
  const session = await selectOne<{ account_id: string }>(
    "auth_sessions",
    [eq("token_hash", hashToken(token)), isNull("revoked_at"), gt("expires_at", new Date().toISOString())],
    { columns: "account_id" },
  );
  return session ? findAccountById(session.account_id) : null;
}

/** The signed-in account for this request, or null. Cached per request. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  try {
    const jar = await cookies();
    return await accountForSessionToken(jar.get(SESSION_COOKIE)?.value);
  } catch (err) {
    console.error("[auth] session lookup failed", err);
    return null;
  }
});

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await update("auth_sessions", [eq("token_hash", hashToken(token))], { revoked_at: new Date().toISOString() });
}

/** Recent link requests for an email, for per-address throttling. */
export async function recentLinkCount(email: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const rows = await select("auth_tokens", [eq("email", normalizeEmail(email)), gt("created_at", since)], { columns: "id" });
  return rows.length;
}
