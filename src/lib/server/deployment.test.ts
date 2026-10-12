import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "a".repeat(43) }) }), headers: async () => new Headers({ host: "agent.growxera.com" }) }));

import { studioDataBlocked } from "./deployment";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("studio data stays on the production deployment", () => {
  it("allows production and non-Vercel runs; refuses preview and development unless isolated", () => {
    expect(studioDataBlocked({})).toBeNull();
    expect(studioDataBlocked({ VERCEL_ENV: "production" })).toBeNull();
    expect(studioDataBlocked({ VERCEL_ENV: "preview" })).toMatch(/only on the production deployment; this is a preview/);
    expect(studioDataBlocked({ VERCEL_ENV: "development" })).toMatch(/development deployment/);
    expect(studioDataBlocked({ VERCEL_ENV: "preview", STUDIO_DATABASE: "isolated" })).toBeNull();
    expect(studioDataBlocked({ VERCEL_ENV: "preview", STUDIO_DATABASE: "shared" })).not.toBeNull();
  });

  /** A preview configured like today's: the production database URL and a service key. */
  async function previewWithDatabase(vercelEnv: string, extra: Record<string, string> = {}) {
    vi.stubEnv("SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("STUDIO_OWNER_EMAIL", "owner@example.com");
    for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, store: await import("./store") };
  }

  it("on a preview, every studio read, write and function call is refused before any request is sent", async () => {
    const { fetchMock, store } = await previewWithDatabase("preview");
    expect(store.storageMode).toBe("supabase");
    await expect(store.select("li_actions", [])).rejects.toThrow(/only on the production deployment/);
    await expect(store.selectAll("li_audit_log", [])).rejects.toThrow(/production deployment/);
    await expect(store.insert("li_settings", { key: "publishing_enabled", value: true })).rejects.toThrow(/production deployment/);
    await expect(store.update("li_actions", [store.eq("id", "x")], { status: "approved" })).rejects.toThrow(/production deployment/);
    await expect(store.remove("li_access_sessions", [store.eq("id", "x")])).rejects.toThrow(/production deployment/);
    await expect(store.rpc("li_check_cron_secret", { token: "t" })).rejects.toThrow(/production deployment/);
    expect(fetchMock).not.toHaveBeenCalled();
    // The public website's own tables are untouched by this rule.
    await store.select("leads", []);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on a preview the studio is off, nobody counts as signed in, and the scheduler doesn't exist", async () => {
    const { fetchMock } = await previewWithDatabase("preview");
    const { studioStorageError } = await import("@/lib/studio/owner");
    expect(studioStorageError()).toMatch(/production deployment/);
    const { studioOwner } = await import("@/lib/studio/access");
    expect(await studioOwner()).toBeNull();
    const { POST } = await import("@/app/api/studio/publish-due/route");
    const res = await POST(new Request("https://preview.example/api/studio/publish-due", { method: "POST", headers: { Authorization: `Bearer ${"s".repeat(40)}` } }));
    expect(res.status).toBe(404);
    const { getObject } = await import("@/lib/studio/assets");
    await expect(getObject("media/x.png")).rejects.toThrow(/production deployment/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("production and an explicitly isolated preview database work as before", async () => {
    for (const [env, extra] of [["production", {}], ["preview", { STUDIO_DATABASE: "isolated" }]] as const) {
      const { fetchMock, store } = await previewWithDatabase(env, extra);
      await store.select("li_actions", []);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const { studioStorageError } = await import("@/lib/studio/owner");
      expect(studioStorageError()).toBeNull();
      vi.resetModules();
      vi.unstubAllGlobals();
    }
  });
});
