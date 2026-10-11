import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// A working cookie jar, so sessions can be exercised end to end.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (c: { name: string; value: string }) => void jar.set(c.name, c.value),
    delete: (c: string | { name: string }) => void jar.delete(typeof c === "string" ? c : c.name),
  }),
  headers: async () => new Headers({ host: "agent.growxera.com" }),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { insert, select, update } from "@/lib/server/store";
import {
  completeSetup,
  createSetupToken,
  GLOBAL_MAX_FAILURES,
  MAX_FAILURES,
  SESSION_COOKIE,
  sessionCookie,
  signIn,
  signOut,
  signOutEverywhere,
  startSetup,
  studioOwner,
} from "./access";
import { base32Decode, base32Encode, hashPassword, totpAt, verifyPassword, verifyTotp } from "./crypto";
import { isStudioHost, isStudioPath, STUDIO_HOST } from "./host";

const OWNER = "owner@example.com";
const PASSWORD = "correct horse battery staple";
const step = (t = Date.now()) => Math.floor(t / 30_000);

/** Creates credentials through the real setup flow; returns the authenticator secret. */
async function setUp(): Promise<string> {
  const token = await createSetupToken();
  const s = (await startSetup(token))!;
  const session = await completeSetup({ token, sealed: s.sealed, password: PASSWORD, confirm: PASSWORD, code: totpAt(s.secret, step()), userAgent: "test" });
  jar.set(SESSION_COOKIE, session);
  return s.secret;
}

beforeEach(() => {
  jar.clear();
  vi.stubEnv("STUDIO_OWNER_EMAIL", OWNER);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("crypto building blocks", () => {
  it("matches the RFC 6238 test vectors (SHA-1, 8 digits)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpAt(secret, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(totpAt(secret, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(totpAt(secret, Math.floor(1234567890 / 30), 8)).toBe("89005924");
    expect(Buffer.from(base32Decode(secret)).toString()).toBe("12345678901234567890");
  });

  it("accepts the current code and one step of clock drift, nothing else", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const t = 1_800_000_000_000;
    expect(verifyTotp(secret, totpAt(secret, step(t)), t)).toBe(step(t));
    expect(verifyTotp(secret, totpAt(secret, step(t) - 1), t)).toBe(step(t) - 1);
    expect(verifyTotp(secret, totpAt(secret, step(t) + 2), t)).toBeNull();
    expect(verifyTotp(secret, "12345", t)).toBeNull();
  });

  it("hashes passwords with a random salt and verifies them", () => {
    const a = hashPassword(PASSWORD);
    expect(a).not.toBe(hashPassword(PASSWORD));
    expect(a).not.toContain(PASSWORD);
    expect(verifyPassword(PASSWORD, a)).toBe(true);
    expect(verifyPassword(PASSWORD + "x", a)).toBe(false);
  });
});

describe("one-time setup", () => {
  it("pairs the authenticator only with a correct code, and the link works once", async () => {
    const token = await createSetupToken();
    const s = (await startSetup(token))!;
    expect(s.email).toBe(OWNER);
    await expect(completeSetup({ token, sealed: s.sealed, password: PASSWORD, confirm: PASSWORD, code: "000000", userAgent: null })).rejects.toThrow(/code isn't right/);
    await expect(completeSetup({ token, sealed: s.sealed, password: "short", confirm: "short", code: totpAt(s.secret, step()), userAgent: null })).rejects.toThrow(/at least 12/);
    await completeSetup({ token, sealed: s.sealed, password: PASSWORD, confirm: PASSWORD, code: totpAt(s.secret, step()), userAgent: null });
    expect(await startSetup(token)).toBeNull();
    await expect(completeSetup({ token, sealed: s.sealed, password: PASSWORD, confirm: PASSWORD, code: totpAt(s.secret, step()), userAgent: null })).rejects.toThrow(/expired or was already used/);
  });

  it("refuses an expired link and a page sealed for a different link", async () => {
    const t1 = await createSetupToken();
    const t2 = await createSetupToken();
    const s1 = (await startSetup(t1))!;
    await expect(completeSetup({ token: t2, sealed: s1.sealed, password: PASSWORD, confirm: PASSWORD, code: totpAt(s1.secret, step()), userAgent: null })).rejects.toThrow(/expired/);
    vi.useFakeTimers({ now: Date.now() + 25 * 3_600_000, toFake: ["Date"] });
    expect(await startSetup(t2)).toBeNull();
  });

  it("stores only hashes and encrypted secrets", async () => {
    const secret = await setUp();
    const creds = await select<{ password_hash: string; totp_secret_enc: string }>("li_access_credentials", []);
    expect(JSON.stringify(creds)).not.toContain(PASSWORD);
    expect(JSON.stringify(creds)).not.toContain(secret);
    const sessions = await select<{ token_hash: string }>("li_access_sessions", []);
    expect(sessions.some((s) => s.token_hash === jar.get(SESSION_COOKIE))).toBe(false);
  });

  it("nobody gets in when the owner email isn't configured", async () => {
    await setUp();
    vi.stubEnv("STUDIO_OWNER_EMAIL", "");
    expect(await studioOwner()).toBeNull();
    expect(await startSetup(await createSetupToken())).toBeNull();
  });
});

describe("sign-in", () => {
  it("needs the right email, password and a fresh code; a code can't be reused", async () => {
    const secret = await setUp();
    jar.clear();
    const now = Date.now();
    const used = totpAt(secret, step(now)); // used during setup
    const ip = `ip-${crypto.randomUUID()}`;
    await expect(signIn({ email: OWNER, password: PASSWORD, code: used, ip, userAgent: null })).rejects.toThrow(/aren't right/);
    await expect(signIn({ email: OWNER, password: "wrong password!!", code: totpAt(secret, step(now) + 1), ip, userAgent: null })).rejects.toThrow(/aren't right/);
    await expect(signIn({ email: "someone@example.com", password: PASSWORD, code: totpAt(secret, step(now) + 1), ip, userAgent: null })).rejects.toThrow(/aren't right/);
    const token = await signIn({ email: " Owner@Example.com ", password: PASSWORD, code: totpAt(secret, step(now) + 1), ip, userAgent: null });
    jar.set(SESSION_COOKIE, token);
    expect(await studioOwner()).toEqual({ email: OWNER });
    await expect(signIn({ email: OWNER, password: PASSWORD, code: totpAt(secret, step(now) + 1), ip, userAgent: null })).rejects.toThrow(/aren't right/);
  });

  it("locks one address after 5 failures without locking the owner out from another", async () => {
    const secret = await setUp();
    const attacker = `ip-${crypto.randomUUID()}`;
    for (let i = 0; i < MAX_FAILURES; i++) {
      await expect(signIn({ email: OWNER, password: "guess guess guess", code: "123456", ip: attacker, userAgent: null })).rejects.toThrow(/aren't right/);
    }
    await expect(signIn({ email: OWNER, password: PASSWORD, code: totpAt(secret, step() + 1), ip: attacker, userAgent: null })).rejects.toThrow(/Too many attempts/);
    await expect(signIn({ email: OWNER, password: PASSWORD, code: totpAt(secret, step() + 1), ip: `ip-${crypto.randomUUID()}`, userAgent: null })).resolves.toBeTruthy();
  });

  it("refuses everyone after many failures from many addresses, then recovers", async () => {
    await setUp();
    const rows = Array.from({ length: GLOBAL_MAX_FAILURES }, () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ok: false, ip_hash: crypto.randomUUID() }));
    await insert("li_access_attempts", rows);
    await expect(signIn({ email: OWNER, password: PASSWORD, code: "123456", ip: "fresh", userAgent: null })).rejects.toThrow(/Too many attempts/);
    vi.useFakeTimers({ now: Date.now() + 61 * 60_000, toFake: ["Date"] });
    await expect(signIn({ email: OWNER, password: PASSWORD, code: "000000", ip: "fresh2", userAgent: null })).rejects.toThrow(/aren't right/);
  });
});

describe("recovery", () => {
  it("a new setup link gets the owner back in during a global lockout and replaces the old password and authenticator", async () => {
    const oldSecret = await setUp();
    const oldSession = jar.get(SESSION_COOKIE)!;
    const rows = Array.from({ length: GLOBAL_MAX_FAILURES }, () => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ok: false, ip_hash: crypto.randomUUID() }));
    await insert("li_access_attempts", rows);
    await expect(signIn({ email: OWNER, password: PASSWORD, code: totpAt(oldSecret, step() + 1), ip: "owner", userAgent: null })).rejects.toThrow(/Too many attempts/);

    // Recovery: a fresh one-time link (scripts/studio-setup-link.mjs) skips the lockout.
    const NEW_PASSWORD = "a brand new long password";
    const token = await createSetupToken();
    const s = (await startSetup(token))!;
    jar.clear();
    const session = await completeSetup({ token, sealed: s.sealed, password: NEW_PASSWORD, confirm: NEW_PASSWORD, code: totpAt(s.secret, step()), userAgent: null });
    jar.set(SESSION_COOKIE, session);
    expect(await studioOwner()).toEqual({ email: OWNER });
    // Every earlier session is signed out.
    jar.set(SESSION_COOKIE, oldSession);
    expect(await studioOwner()).toBeNull();
    // Once the lockout window has passed, the old password and old authenticator no longer work; the new ones do.
    vi.useFakeTimers({ now: Date.now() + 61 * 60_000, toFake: ["Date"] });
    await expect(signIn({ email: OWNER, password: PASSWORD, code: totpAt(s.secret, step()), ip: "owner-2", userAgent: null })).rejects.toThrow(/aren't right/);
    await expect(signIn({ email: OWNER, password: NEW_PASSWORD, code: totpAt(oldSecret, step() + 1), ip: "owner-3", userAgent: null })).rejects.toThrow(/aren't right/);
    await expect(signIn({ email: OWNER, password: NEW_PASSWORD, code: totpAt(s.secret, step() + 1), ip: "owner-4", userAgent: null })).resolves.toBeTruthy();
  });
});

describe("sessions", () => {
  it("cookie is httpOnly, SameSite=Lax, whole-site path, 7 days", () => {
    expect(sessionCookie("x")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  });

  it("expire after 7 days and end on sign-out", async () => {
    await setUp();
    expect(await studioOwner()).not.toBeNull();
    await signOut();
    expect(jar.has(SESSION_COOKIE)).toBe(false);
    await setUp();
    vi.useFakeTimers({ now: Date.now() + 7 * 86_400_000 + 1000, toFake: ["Date"] });
    expect(await studioOwner()).toBeNull();
  });

  it("sign out everywhere ends every session", async () => {
    await setUp();
    const other = jar.get(SESSION_COOKIE)!;
    await setUp();
    expect(await signOutEverywhere()).toBeGreaterThanOrEqual(1);
    jar.set(SESSION_COOKIE, other);
    expect(await studioOwner()).toBeNull();
  });

  it("ignores a forged or malformed cookie", async () => {
    await setUp();
    jar.set(SESSION_COOKIE, "x".repeat(43));
    expect(await studioOwner()).toBeNull();
    jar.set(SESSION_COOKIE, "'; drop table --");
    expect(await studioOwner()).toBeNull();
  });

  it("a revoked session stays revoked even with the right cookie", async () => {
    await setUp();
    const rows = await select<{ id: string }>("li_access_sessions", []);
    for (const r of rows) await update("li_access_sessions", [{ col: "id", op: "eq", value: r.id }], { revoked_at: new Date().toISOString() });
    expect(await studioOwner()).toBeNull();
  });
});

describe("own address only", () => {
  const req = (url: string, host: string) => new NextRequest(url, { headers: { host } });

  it("uses agent.growxera.com by default", () => {
    expect(STUDIO_HOST).toBe("agent.growxera.com");
  });

  it("answers 404 for studio paths on the website and on previews", () => {
    for (const [url, host] of [
      ["https://www.growxera.com/studio", "www.growxera.com"],
      ["https://www.growxera.com/studio/queue", "www.growxera.com"],
      ["https://www.growxera.com/access", "www.growxera.com"],
      ["https://gro-git-x.vercel.app/studio/capabilities", "gro-git-x.vercel.app"],
      ["https://growxera.com/access/setup?token=abc", "growxera.com"],
    ]) {
      expect(proxy(req(url, host)).status, url).toBe(404);
    }
  });

  it("serves the studio on its own host and sends / there", () => {
    expect(proxy(req("https://agent.growxera.com/studio", "agent.growxera.com")).headers.get("x-middleware-next")).toBe("1");
    const root = proxy(req("https://agent.growxera.com/", "agent.growxera.com"));
    expect(root.status).toBe(307);
    expect(root.headers.get("location")).toBe("https://agent.growxera.com/studio");
    expect(proxy(req("https://www.growxera.com/", "www.growxera.com")).headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts localhost only outside production", () => {
    expect(isStudioHost("localhost:3000", "development")).toBe(true);
    expect(isStudioHost("localhost:3000", "production")).toBe(false);
    expect(isStudioHost("127.0.0.1", "production")).toBe(false);
    expect(isStudioHost("AGENT.growxera.com:443", "production")).toBe(true);
    expect(isStudioHost("agent.growxera.com.evil.test", "production")).toBe(false);
    expect(isStudioPath("/studio-old")).toBe(false);
    expect(isStudioPath("/accessibility")).toBe(false);
  });
});
