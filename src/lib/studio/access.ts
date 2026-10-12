import "server-only";
/**
 * The studio's own sign-in, separate from the website's accounts:
 * email + password + a 6-digit code from an authenticator app (TOTP).
 *
 * - Setup: a one-time link (24 h) sets the password and pairs the authenticator. The code
 *   must be confirmed before anything is saved. The same kind of link resets both.
 * - Sign-in: an address (IP) with 5 failed attempts in 15 minutes is refused for 15 minutes. If
 *   50 attempts fail across all addresses within an hour (a distributed guess), sign-in is refused
 *   for everyone until the hour passes; the owner can still recover with a setup link. A code
 *   can't be used twice.
 * - Session: random token in an httpOnly, Secure, SameSite=Lax cookie that belongs to the
 *   studio's address only (__Host- prefix). Only its SHA-256 is stored. 7 days.
 * - The email must equal STUDIO_OWNER_EMAIL.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { studioDataBlocked } from "@/lib/server/deployment";
import { eq, gt, insert, isNull, select, selectOne, storageMode, update } from "@/lib/server/store";
import { hashPassword, newTotpSecret, open, randomToken, seal, serverSecret, sha256, verifyPassword, verifyTotp } from "./crypto";
import { isStudioHost } from "./host";
import { ownerEmail } from "./owner-email";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-gx_studio" : "gx_studio";
const SESSION_DAYS = 7;
export const SETUP_HOURS = 24;
export const LOCK_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES = 5;
export const GLOBAL_WINDOW_MS = 60 * 60_000;
export const GLOBAL_MAX_FAILURES = 50;
export const MIN_PASSWORD = 12;

export class AccessError extends Error {}

interface CredentialRow {
  id: string;
  email: string;
  password_hash: string;
  totp_secret_enc: string;
  totp_last_step: number;
}

interface SessionRow {
  id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

const now = () => new Date().toISOString();
const norm = (e: string) => e.trim().toLowerCase();

function secretOrThrow(): string {
  const s = serverSecret();
  if (!s) throw new AccessError("The studio's storage isn't configured.");
  return s;
}

// ── Setup links ─────────────────────────────────────────────────────────────

/** Creates a one-time setup link token (the raw value is returned once, only its hash is stored). */
export async function createSetupToken(): Promise<string> {
  const token = randomToken();
  await insert("li_access_setup_tokens", {
    id: crypto.randomUUID(),
    created_at: now(),
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + SETUP_HOURS * 3_600_000).toISOString(),
    used_at: null,
  });
  return token;
}

async function validSetupToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const row = await selectOne<{ id: string; expires_at: string; used_at: string | null }>("li_access_setup_tokens", [eq("token_hash", sha256(token))]);
  return row && !row.used_at && new Date(row.expires_at).getTime() > Date.now() ? row : null;
}

/** For the setup page: a fresh authenticator secret, sealed and bound to this link. */
export async function startSetup(token: string): Promise<{ email: string; secret: string; sealed: string } | null> {
  const owner = ownerEmail();
  if (!owner || !(await validSetupToken(token))) return null;
  const secret = newTotpSecret();
  const sealed = seal(JSON.stringify({ secret, t: sha256(token) }), secretOrThrow(), "studio-totp-setup");
  return { email: owner, secret, sealed };
}

/** Saves the password and authenticator after the code is confirmed. Returns a session token. */
export async function completeSetup(input: { token: string; sealed: string; password: string; confirm: string; code: string; userAgent: string | null }): Promise<string> {
  const owner = ownerEmail();
  if (!owner) throw new AccessError("The studio owner isn't configured.");
  const row = await validSetupToken(input.token);
  if (!row) throw new AccessError("This setup link has expired or was already used. Ask for a new one.");
  const unsealed = open(input.sealed, secretOrThrow(), "studio-totp-setup");
  const data = unsealed ? (JSON.parse(unsealed) as { secret: string; t: string }) : null;
  if (!data || data.t !== sha256(input.token)) throw new AccessError("The setup page expired. Reload it and scan the new code.");
  if (input.password.length < MIN_PASSWORD) throw new AccessError(`Use at least ${MIN_PASSWORD} characters for the password.`);
  if (input.password !== input.confirm) throw new AccessError("The two passwords don't match.");
  const step = verifyTotp(data.secret, input.code.trim());
  if (step === null) throw new AccessError("That code isn't right. Check the authenticator app's time and try the new code.");

  // Use the link (conditional, so it can't be used twice even by parallel requests).
  const [used] = await update<{ id: string }>("li_access_setup_tokens", [eq("id", row.id), isNull("used_at")], { used_at: now() });
  if (!used) throw new AccessError("This setup link was already used.");

  const fields = {
    updated_at: now(),
    email: owner,
    password_hash: hashPassword(input.password),
    totp_secret_enc: seal(data.secret, secretOrThrow(), "studio-totp"),
    totp_last_step: step,
  };
  const existing = await selectOne<CredentialRow>("li_access_credentials", []);
  if (existing) await update("li_access_credentials", [eq("id", existing.id)], fields);
  else await insert("li_access_credentials", { id: crypto.randomUUID(), created_at: now(), ...fields });
  // A reset signs out every other session.
  for (const s of await select<SessionRow>("li_access_sessions", [isNull("revoked_at")])) {
    await update("li_access_sessions", [eq("id", s.id)], { revoked_at: now() });
  }
  return createSession(input.userAgent);
}

// ── Sign-in ─────────────────────────────────────────────────────────────────

async function locked(ipHash: string): Promise<boolean> {
  const sinceIp = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const fromIp = await select<{ id: string }>("li_access_attempts", [gt("created_at", sinceIp), eq("ip_hash", ipHash), eq("ok", false)], { columns: "id", limit: MAX_FAILURES });
  if (fromIp.length >= MAX_FAILURES) return true;
  const sinceAll = new Date(Date.now() - GLOBAL_WINDOW_MS).toISOString();
  const all = await select<{ id: string }>("li_access_attempts", [gt("created_at", sinceAll), eq("ok", false)], { columns: "id", limit: GLOBAL_MAX_FAILURES });
  return all.length >= GLOBAL_MAX_FAILURES;
}

/** Checks email, password and code. Returns a session token. Messages never say which part was wrong. */
export async function signIn(input: { email: string; password: string; code: string; ip: string; userAgent: string | null }): Promise<string> {
  const ipHash = sha256(`studio-ip:${input.ip}`);
  if (await locked(ipHash)) throw new AccessError("Too many attempts. Try again later.");
  const fail = async (): Promise<never> => {
    await insert("li_access_attempts", { id: crypto.randomUUID(), created_at: now(), ok: false, ip_hash: ipHash });
    throw new AccessError("Those details aren't right.");
  };
  const cred = await selectOne<CredentialRow>("li_access_credentials", []);
  const owner = ownerEmail();
  // Always run the password hash, so timing doesn't reveal whether the email matched.
  const passwordOk = verifyPassword(input.password, cred?.password_hash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!cred || !owner || norm(input.email) !== norm(cred.email) || norm(cred.email) !== owner || !passwordOk) return fail();
  const secret = open(cred.totp_secret_enc, secretOrThrow(), "studio-totp");
  const step = secret ? verifyTotp(secret, input.code.trim()) : null;
  if (step === null || step <= cred.totp_last_step) return fail();
  // Record the code as used (conditional: the same code can't win twice in parallel).
  const [claimed] = await update<{ id: string }>("li_access_credentials", [eq("id", cred.id), eq("totp_last_step", cred.totp_last_step)], { totp_last_step: step });
  if (!claimed) return fail();
  await insert("li_access_attempts", { id: crypto.randomUUID(), created_at: now(), ok: true, ip_hash: ipHash });
  return createSession(input.userAgent);
}

async function createSession(userAgent: string | null): Promise<string> {
  const token = randomToken();
  await insert("li_access_sessions", {
    id: crypto.randomUUID(),
    created_at: now(),
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString(),
    revoked_at: null,
    user_agent: userAgent?.slice(0, 200) ?? null,
  });
  return token;
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: LinkedIn's sign-in sends the owner back with a top-level navigation.
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

/** The signed-in studio owner for this request, or null. */
export const studioOwner = cache(async (): Promise<{ email: string } | null> => {
  const owner = ownerEmail();
  if (!owner) return null;
  // Never on a deployment that may not touch studio data (a preview sharing the production database).
  if (storageMode === "supabase" && studioDataBlocked()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  // Server actions can be invoked through any page URL on any host, not only studio paths, so the
  // proxy's 404 alone doesn't keep them on the studio's address. The session counts only there.
  if (!isStudioHost((await headers()).get("host"))) return null;
  const s = await selectOne<SessionRow>("li_access_sessions", [eq("token_hash", sha256(token))]);
  if (!s || s.revoked_at || new Date(s.expires_at).getTime() <= Date.now()) return null;
  return { email: owner };
});

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await update("li_access_sessions", [eq("token_hash", sha256(token))], { revoked_at: now() });
  jar.delete({ name: SESSION_COOKIE, path: "/" });
}

/** Ends every studio session (all devices), for example after a suspected leak. */
export async function signOutEverywhere(): Promise<number> {
  const active = await select<SessionRow>("li_access_sessions", [isNull("revoked_at")]);
  for (const s of active) await update("li_access_sessions", [eq("id", s.id)], { revoked_at: now() });
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/" });
  return active.length;
}

export interface SessionOverview {
  sessions: { created_at: string; expires_at: string; device: string; current: boolean }[];
  passwordChangedAt: string | null;
  failedAttempts24h: number;
}

/** For the settings page: active sessions (no tokens), when the password was set, recent failed sign-ins. */
export async function sessionOverview(): Promise<SessionOverview> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const mine = token ? sha256(token) : null;
  const nowMs = Date.now();
  const rows = await select<SessionRow & { created_at: string; user_agent: string | null }>("li_access_sessions", [isNull("revoked_at")]);
  const cred = await selectOne<CredentialRow & { updated_at: string | null }>("li_access_credentials", []);
  const since = new Date(nowMs - 86_400_000).toISOString();
  const failed = await select<{ id: string }>("li_access_attempts", [gt("created_at", since), eq("ok", false)], { columns: "id", limit: 1000 });
  return {
    sessions: rows
      .filter((r) => new Date(r.expires_at).getTime() > nowMs)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({ created_at: r.created_at, expires_at: r.expires_at, device: deviceName(r.user_agent), current: r.token_hash === mine })),
    passwordChangedAt: cred?.updated_at ?? null,
    failedAttempts24h: failed.length,
  };
}

/** "Chrome on macOS"-style label from a user agent; never the raw string. */
export function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

export async function credentialsExist(): Promise<boolean> {
  return !!(await selectOne("li_access_credentials", [], { columns: "id" }));
}
