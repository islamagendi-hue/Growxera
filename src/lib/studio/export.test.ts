import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { insert, select } from "@/lib/server/store";
import { buildExport, EXPORTED, restoreExport, validateExport, type ExportFile } from "./export";
import { createDraft, getAction, approve } from "./repo";

const ME = "owner@example.com";
const isolated = () => path.join(os.tmpdir(), `gx-restore-${crypto.randomUUID()}`);
const original = process.env.GX_DATA_DIR;

/** Each test works in its own empty store, so nothing leaks between files or into a real database. */
function useStore(dir = isolated()) {
  vi.stubEnv("GX_DATA_DIR", dir);
  return dir;
}
afterEach(() => {
  vi.unstubAllEnvs();
  if (original) process.env.GX_DATA_DIR = original;
});

async function seed() {
  const { actionId } = await createDraft({
    kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
    content: { text: `Backup me ${crypto.randomUUID()}`, assets: [], target_at: "2099-01-01T10:00:00.000Z" },
  });
  const d = (await getAction(actionId))!;
  await approve(actionId, d.current.id, d.current.content_hash, ME);
  // Secrets that must never leave the database in an export.
  await insert("li_linkedin_connection", { id: crypto.randomUUID(), created_at: new Date().toISOString(), member_urn: "urn:li:person:abc", member_name: "Owner", scopes: "openid", access_token_enc: "v1.SECRET-TOKEN", expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null });
  await insert("li_linkedin_app", { id: crypto.randomUUID(), created_at: new Date().toISOString(), client_id: "abcdefgh123", client_secret_enc: "v1.SECRET-CLIENT" });
  await insert("li_access_credentials", { id: crypto.randomUUID(), email: ME, password_hash: "scrypt$SECRET-HASH", totp_secret_enc: "v1.SECRET-TOTP", totp_last_step: 0 });
  await insert("li_access_sessions", { id: crypto.randomUUID(), token_hash: "a".repeat(64), expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null });
  await insert("li_settings", { key: "auto_publish_enabled", value: false, updated_at: new Date().toISOString(), updated_by: ME });
  return actionId;
}

describe("weekly backup export", () => {
  it("contains the owner's work, validates, and leaves every secret out", async () => {
    useStore();
    const actionId = await seed();
    const file = await buildExport(ME);
    expect(validateExport(file)).toMatchObject({ ok: true, errors: [] });
    expect(file.tables.li_actions.rows.map((r) => r.id)).toContain(actionId);
    expect(file.tables.li_approvals.count).toBe(1);
    expect(file.tables.li_settings.count).toBe(1);
    const text = JSON.stringify(file);
    for (const s of ["SECRET-TOKEN", "SECRET-CLIENT", "SECRET-HASH", "SECRET-TOTP", "a".repeat(64)]) expect(text).not.toContain(s);
    expect(file.tables).not.toHaveProperty("li_access_credentials");
    expect(file.tables).not.toHaveProperty("li_access_sessions");
    expect(file.tables.li_linkedin_connection.rows[0]).toMatchObject({ member_urn: "urn:li:person:abc" });
    // The export is recorded, for the weekly reminder.
    expect((await select<{ event: string }>("li_audit_log", [])).some((r) => r.event === "export.generated")).toBe(true);
  });

  it("detects a changed, truncated or secret-carrying file", async () => {
    useStore();
    await seed();
    const file = await buildExport(ME);
    const changed = structuredClone(file) as ExportFile;
    (changed.tables.li_draft_versions.rows[0] as Record<string, unknown>).text = "edited by hand";
    expect(validateExport(changed).errors.join(" ")).toMatch(/li_draft_versions: contents don't match/);
    const truncated = structuredClone(file) as ExportFile;
    truncated.tables.li_actions.rows = [];
    expect(validateExport(truncated).ok).toBe(false);
    const leaky = structuredClone(file) as ExportFile;
    (leaky.tables.li_linkedin_connection.rows[0] as Record<string, unknown>).access_token_enc = "x";
    expect(validateExport(leaky).errors.join(" ")).toMatch(/Secret fields present/);
    expect(validateExport({ hello: "world" })).toMatchObject({ ok: false });
  });

  it("restores into an empty isolated store and the result matches, then refuses a second restore", async () => {
    useStore();
    await seed();
    const file = await buildExport(ME);
    useStore(); // a fresh, empty store
    const restored = await restoreExport(JSON.parse(JSON.stringify(file)));
    for (const { table } of EXPORTED) {
      if (table === "li_linkedin_connection" || table === "li_linkedin_app") continue;
      expect(restored[table], table).toBe(file.tables[table].count);
      expect((await select(table, [])).length, table).toBe(file.tables[table].count);
    }
    expect(await select("li_linkedin_connection", [])).toHaveLength(0); // must be reconnected
    await expect(restoreExport(file)).rejects.toThrow(/already has data/);
  });

  it("refuses to restore an invalid file", async () => {
    useStore();
    await expect(restoreExport({ format: "growxera-studio-export", version: 1, tables: {} })).rejects.toThrow(/isn't valid/);
  });
});
