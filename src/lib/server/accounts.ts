import "server-only";
/**
 * Account-level operations shared by the API routes and account pages:
 * sending sign-in links, the saved-diagnostic history, and profile updates.
 */
import { CONSENT_TEXT, POLICY_VERSION } from "@/config/privacy";
import type { DiagnosticReport } from "@/lib/diagnostic/types";
import { findAccountByEmail, issueLinkToken, LINK_TTL_MINUTES, normalizeEmail, recentLinkCount, type Account } from "./auth";
import { dataDeletedEmail, noAccountEmail, reportReadyEmail, sendEmail, signInEmail } from "./email";
import { eq, ieq, inList, insert, remove, select, selectOne, update } from "./store";

/** Per-address cap on sign-in emails, so the form can't be used to flood an inbox. */
export const MAX_LINKS_PER_15_MIN = 5;

/**
 * Sends the right email for a login or signup request without revealing, to
 * the requester, whether an account exists:
 *   login  + account    → login link
 *   login  + no account → "no account yet" email (no token)
 *   signup + account    → login link (details unchanged)
 *   signup + no account → confirmation link that creates the account
 */
export async function sendSignInLink(input: {
  mode: "login" | "signup";
  email: string;
  name?: string;
  company?: string;
  next?: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  if ((await recentLinkCount(email, 15)) >= MAX_LINKS_PER_15_MIN) return;
  const account = await findAccountByEmail(email);
  if (account) {
    const token = await issueLinkToken({ email, purpose: "login", accountId: account.id, redirectTo: input.next });
    await sendEmail(email, signInEmail(account.name, token, LINK_TTL_MINUTES.login, false), { tag: "login" });
    return;
  }
  if (input.mode === "login") {
    await sendEmail(email, noAccountEmail(), { tag: "no-account" });
    return;
  }
  const token = await issueLinkToken({
    email,
    purpose: "signup",
    pending: { name: input.name!, company: input.company! },
    redirectTo: input.next,
  });
  await sendEmail(email, signInEmail(input.name ?? null, token, LINK_TTL_MINUTES.signup, true), { tag: "signup" });
}

/**
 * After the report form: emails "your report is ready" with a one-time link that
 * signs in (creating the account if needed) and attaches this diagnostic.
 */
export async function sendReportReady(input: {
  email: string;
  name: string;
  company: string;
  report: DiagnosticReport;
  diagnosticSessionId: string;
}): Promise<boolean> {
  const email = normalizeEmail(input.email);
  if ((await recentLinkCount(email, 15)) >= MAX_LINKS_PER_15_MIN) return false;
  const account = await findAccountByEmail(email);
  const token = await issueLinkToken({
    email,
    purpose: "report",
    accountId: account?.id ?? null,
    pending: account ? null : { name: input.name, company: input.company },
    diagnosticSessionId: input.diagnosticSessionId,
  });
  return sendEmail(email, reportReadyEmail(account?.name ?? input.name, input.report, token, LINK_TTL_MINUTES.report), { tag: "report" });
}

export async function recordSignupConsent(accountId: string) {
  try {
    await insert("consent_records", {
      purpose: "processing",
      granted: true,
      policy_version: POLICY_VERSION,
      wording: CONSENT_TEXT.account,
      source: "signup",
      lead_id: null,
      anonymous_id: null,
      created_at: new Date().toISOString(),
      account_id: accountId,
    });
  } catch (err) {
    console.error("[accounts] consent record failed", err);
  }
}

// ── Diagnostic history ──────────────────────────────────────────────────────

export interface DiagnosticSummary {
  id: string;
  completed_at: string;
  overall_score: number;
  stage: string;
  bottleneck: string;
  scoring_version: string;
  context: { label?: string } | null;
}

export async function listDiagnostics(accountId: string): Promise<DiagnosticSummary[]> {
  return select<DiagnosticSummary>("diagnostic_sessions", [eq("account_id", accountId)], {
    columns: "id,completed_at,overall_score,stage,bottleneck,scoring_version,context",
    order: { col: "completed_at", ascending: false },
    limit: 100,
  });
}

/** A saved report, only if it belongs to this account. */
export async function getDiagnostic(accountId: string, id: string): Promise<{ id: string; completed_at: string; report: DiagnosticReport } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return selectOne("diagnostic_sessions", [eq("id", id.toLowerCase()), eq("account_id", accountId)], { columns: "id,completed_at,report" });
}

export async function updateProfile(account: Account, patch: { name: string; company: string; jobTitle?: string; phone?: string; website?: string }) {
  await update("accounts", [eq("id", account.id)], {
    name: patch.name,
    company: patch.company,
    job_title: patch.jobTitle || null,
    phone: patch.phone || null,
    website: patch.website || null,
  });
}

// ── Deleting data ───────────────────────────────────────────────────────────

export type EraseScope = "data" | "account";

/**
 * Self-service erasure, confirmed twice by the signed-in person.
 *   "data":    deletes every saved diagnostic, report request and advisor
 *              request linked to the account or its email; the account stays.
 *   "account": all of the above, then the account itself, its sessions and
 *              sign-in links.
 * Anonymous analytics events hold no contact details and are not linked to the account.
 */
export async function eraseAccountData(account: Account, scope: EraseScope): Promise<{ diagnostics: number }> {
  const email = account.email;
  const leadIds = [
    ...new Set([
      ...(await select<{ id: string }>("leads", [ieq("email", email)], { columns: "id" })),
      ...(await select<{ id: string }>("leads", [eq("account_id", account.id)], { columns: "id" })),
    ].map((l) => l.id)),
  ];

  let diagnostics = await remove("diagnostic_sessions", [eq("account_id", account.id)]);
  if (leadIds.length) {
    diagnostics += await remove("diagnostic_sessions", [inList("lead_id", leadIds)]);
    await remove("consent_records", [inList("lead_id", leadIds)]);
    await remove("leads", [inList("id", leadIds)]);
  }
  await remove("advisor_requests", [eq("account_id", account.id)]);
  await remove("advisor_requests", [ieq("email", email)]);

  if (scope === "account") {
    await remove("consent_records", [eq("account_id", account.id)]);
    await remove("auth_sessions", [eq("account_id", account.id)]);
    await remove("auth_tokens", [ieq("email", email)]);
    await remove("accounts", [eq("id", account.id)]);
  }

  // A receipt, so the person knows it happened (and can tell us if it wasn't them).
  await sendEmail(email, dataDeletedEmail(account.name, scope), { tag: "data-deleted" }).catch((err) =>
    console.error("[accounts] deletion receipt failed", err),
  );
  return { diagnostics };
}
