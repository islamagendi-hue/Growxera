import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { eraseAccountData, MAX_LINKS_PER_15_MIN, sendSignInLink } from "./accounts";
import {
  accountForSessionToken,
  attachDiagnostic,
  consumeLinkToken,
  createSession,
  findAccountByEmail,
  hashToken,
  issueLinkToken,
  newToken,
  revokeSession,
  safeRedirect,
} from "./auth";
import { insert, select, selectOne } from "./store";

const dir = path.join(os.tmpdir(), `gx-auth-${process.pid}-${Date.now()}`);
beforeAll(() => {
  process.env.GX_DATA_DIR = dir;
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

let n = 0;
const email = () => `person${++n}@example.com`;
const outbox = () => {
  const box = path.join(dir, "outbox");
  return fs.existsSync(box) ? fs.readdirSync(box).map((f) => fs.readFileSync(path.join(box, f), "utf8")) : [];
};
const lastTokenFor = (to: string) => {
  const mails = outbox().filter((m) => m.includes(to));
  const match = mails.at(-1)?.match(/token=([A-Za-z0-9_-]+)/);
  return match?.[1];
};

describe("tokens", () => {
  it("are 256-bit, url-safe and unique; only the hash is stored", async () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 200 }, newToken)).size).toBe(200);
    const to = email();
    const token = await issueLinkToken({ email: to, purpose: "signup", pending: { name: "A", company: "B" } });
    const rows = await select<Record<string, unknown>>("auth_tokens", []);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows.some((r) => r.token_hash === hashToken(token))).toBe(true);
  });

  it("only allows same-site redirects", () => {
    expect(safeRedirect("/account/reports")).toBe("/account/reports");
    expect(safeRedirect("https://evil.example")).toBe("/account");
    expect(safeRedirect("//evil.example")).toBe("/account");
    expect(safeRedirect("/\\evil.example")).toBe("/account");
    expect(safeRedirect(undefined, "/x")).toBe("/x");
  });
});

describe("magic links", () => {
  it("signup link creates the account once and can't be reused", async () => {
    const to = email();
    const token = await issueLinkToken({ email: to, purpose: "signup", pending: { name: "Sara", company: "Oud Co" } });
    const first = await consumeLinkToken(token);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.isNew).toBe(true);
    expect(first.account).toMatchObject({ email: to, name: "Sara", company: "Oud Co" });
    expect(first.account.verified_at).toBeTruthy();

    const again = await consumeLinkToken(token);
    expect(again).toMatchObject({ ok: false, reason: "used" });
  });

  it("expires", async () => {
    const to = email();
    const issued = new Date(Date.now() - 21 * 60_000);
    const token = await issueLinkToken({ email: to, purpose: "login", pending: { name: "A", company: "B" }, now: issued });
    expect(await consumeLinkToken(token)).toMatchObject({ ok: false, reason: "expired" });
    expect(await findAccountByEmail(to)).toBeNull();
  });

  it("rejects malformed and unknown tokens", async () => {
    expect(await consumeLinkToken("short")).toMatchObject({ ok: false, reason: "invalid" });
    expect(await consumeLinkToken(newToken())).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("two racing clicks sign in at most once", async () => {
    const to = email();
    const token = await issueLinkToken({ email: to, purpose: "signup", pending: { name: "A", company: "B" } });
    const results = await Promise.all([consumeLinkToken(token), consumeLinkToken(token), consumeLinkToken(token)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("returning user logs into the same account", async () => {
    const to = email();
    const first = await consumeLinkToken(await issueLinkToken({ email: to, purpose: "signup", pending: { name: "A", company: "B" } }));
    const second = await consumeLinkToken(await issueLinkToken({ email: to.toUpperCase(), purpose: "login" }));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.account.id).toBe(first.account.id);
      expect(second.isNew).toBe(false);
    }
  });

  it("report link signs in, attaches the diagnostic and lands on the report", async () => {
    const to = email();
    const sessionId = crypto.randomUUID();
    await insert("diagnostic_sessions", { id: sessionId, account_id: null, lead_id: null, overall_score: 50 });
    const token = await issueLinkToken({ email: to, purpose: "report", pending: { name: "A", company: "B" }, diagnosticSessionId: sessionId });
    const res = await consumeLinkToken(token);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.redirectTo).toBe(`/account/reports/${sessionId}`);
    const row = await selectOne<{ account_id: string }>("diagnostic_sessions", [{ col: "id", op: "eq", value: sessionId }]);
    expect(row?.account_id).toBe(res.account.id);
  });

  it("never moves a diagnostic that already belongs to someone", async () => {
    const sessionId = crypto.randomUUID();
    await insert("diagnostic_sessions", { id: sessionId, account_id: "owner-1", lead_id: null });
    expect(await attachDiagnostic(sessionId, "intruder")).toBe(false);
    const row = await selectOne<{ account_id: string }>("diagnostic_sessions", [{ col: "id", op: "eq", value: sessionId }]);
    expect(row?.account_id).toBe("owner-1");
  });
});

describe("no account enumeration", () => {
  it("login for an unknown email sends a token-free email and creates nothing", async () => {
    const to = email();
    await sendSignInLink({ mode: "login", email: to });
    const mail = outbox().filter((m) => m.includes(to)).at(-1)!;
    expect(mail).toBeTruthy();
    expect(mail).not.toContain("token=");
    expect(await findAccountByEmail(to)).toBeNull();
  });

  it("signup for an existing email sends a login link and leaves details unchanged", async () => {
    const to = email();
    await consumeLinkToken(await issueLinkToken({ email: to, purpose: "signup", pending: { name: "Original", company: "Co" } }));
    await sendSignInLink({ mode: "signup", email: to, name: "Attacker", company: "Evil" });
    const res = await consumeLinkToken(lastTokenFor(to)!);
    expect(res.ok && res.account.name).toBe("Original");
  });

  it("caps links per address", async () => {
    const to = email();
    for (let i = 0; i < MAX_LINKS_PER_15_MIN + 3; i++) await sendSignInLink({ mode: "signup", email: to, name: "A", company: "B" });
    const tokens = await select("auth_tokens", [{ col: "email", op: "eq", value: to }]);
    expect(tokens).toHaveLength(MAX_LINKS_PER_15_MIN);
  });
});

describe("sessions", () => {
  it("resolve to the account until revoked", async () => {
    const to = email();
    const res = await consumeLinkToken(await issueLinkToken({ email: to, purpose: "signup", pending: { name: "A", company: "B" } }));
    if (!res.ok) throw new Error("signup failed");
    const { token } = await createSession(res.account.id);
    expect((await accountForSessionToken(token))?.id).toBe(res.account.id);
    expect(await accountForSessionToken(newToken())).toBeNull();
    await revokeSession(token);
    expect(await accountForSessionToken(token)).toBeNull();
  });
});

describe("self-service deletion", () => {
  async function setup() {
    const to = email();
    const res = await consumeLinkToken(await issueLinkToken({ email: to, purpose: "signup", pending: { name: "A", company: "B" } }));
    if (!res.ok) throw new Error("signup failed");
    const leadId = crypto.randomUUID();
    // A report requested before the account existed, with the email typed in capitals.
    await insert("leads", { id: leadId, email: to.toUpperCase(), account_id: null });
    await insert("diagnostic_sessions", { id: crypto.randomUUID(), lead_id: leadId, account_id: null });
    await insert("diagnostic_sessions", { id: crypto.randomUUID(), lead_id: null, account_id: res.account.id });
    await insert("consent_records", { lead_id: leadId, account_id: null });
    await insert("advisor_requests", { id: crypto.randomUUID(), email: to, account_id: res.account.id });
    // Someone else's data must survive.
    await insert("diagnostic_sessions", { id: crypto.randomUUID(), lead_id: null, account_id: "someone-else" });
    const { token } = await createSession(res.account.id);
    return { to, account: res.account, leadId, token };
  }
  const count = async (table: Parameters<typeof select>[0], col: string, value: string) =>
    (await select(table, [{ col, op: "eq", value }])).length;

  it("deletes saved data but keeps the account", async () => {
    const { to, account, leadId, token } = await setup();
    const { diagnostics } = await eraseAccountData(account, "data");
    expect(diagnostics).toBe(2);
    expect(await count("diagnostic_sessions", "account_id", account.id)).toBe(0);
    expect(await count("diagnostic_sessions", "lead_id", leadId)).toBe(0);
    expect(await count("leads", "id", leadId)).toBe(0);
    expect(await count("consent_records", "lead_id", leadId)).toBe(0);
    expect(await count("advisor_requests", "email", to)).toBe(0);
    expect(await count("diagnostic_sessions", "account_id", "someone-else")).toBeGreaterThan(0);
    expect((await accountForSessionToken(token))?.id).toBe(account.id);
    expect(outbox().some((m) => m.includes(to) && m.includes("data has been deleted"))).toBe(true);
  });

  it("deletes the account, its sessions and sign-in links", async () => {
    const { to, account, token } = await setup();
    await eraseAccountData(account, "account");
    expect(await findAccountByEmail(to)).toBeNull();
    expect(await accountForSessionToken(token)).toBeNull();
    expect(await count("auth_sessions", "account_id", account.id)).toBe(0);
    expect(await count("auth_tokens", "email", to)).toBe(0);
    expect(await count("diagnostic_sessions", "account_id", account.id)).toBe(0);
    expect(outbox().some((m) => m.includes(to) && m.includes("account has been deleted"))).toBe(true);
  });
});
