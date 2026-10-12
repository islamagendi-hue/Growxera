import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { select } from "@/lib/server/store";
import { authorizationsFor, isAutoAuthorized } from "./autopublish";
import { getAction } from "./repo";
import { approveWeek, MAX_PER_RUN, prepareWeek, qualityProblems, riyadhDate, upcomingSlots, weekBatch } from "./weekly";

const ME = "owner@example.com";
const GROK = {
  XAI_API_KEY: "xai-test-secret-key",
  STUDIO_GROK_ENABLED: "true",
  XAI_MODEL: "grok-test",
  XAI_MONTHLY_BUDGET_USD: "10",
  XAI_PRICE_INPUT_PER_MTOK: "1.25",
  XAI_PRICE_OUTPUT_PER_MTOK: "2.5",
};
// Approval checks planned times against the real clock, so the plan starts from now.
const NOW = new Date();

let n = 0;
const body = (i: number) =>
  `Hook number ${i} about unit economics. A turn that matters ${i}.\n\n` +
  Array.from({ length: 8 }, (_, k) => `Paragraph ${k} of draft ${i}: retention cohorts, payback windows and pricing tiers move together in practice ${i}${k}.`).join("\n\n");

beforeEach(() => {
  n = 0;
  vi.stubEnv("GX_DATA_DIR", path.join(os.tmpdir(), `gx-weekly-${crypto.randomUUID()}`));
  for (const [k, v] of Object.entries(GROK)) vi.stubEnv(k, v);
  const realFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      // Only Grok is faked; the image renderer loads its own wasm through fetch.
      if (!String(url).startsWith("https://api.x.ai/")) return realFetch(url, init);
      const req = JSON.parse(String(init?.body ?? "{}"));
      const content = req.max_tokens === 60 ? `Fresh topic ${++n}` : body(++n);
      return Response.json({ model: "grok-test", choices: [{ message: { content } }], usage: { prompt_tokens: 500, completion_tokens: 300 } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("weekly plan", () => {
  it("plans one post a day at noon or 22:00 Riyadh", () => {
    const slots = upcomingSlots(NOW, 7);
    expect(slots).toHaveLength(7);
    expect(new Set(slots.map(riyadhDate)).size).toBe(7);
    for (const s of slots) expect([9, 19]).toContain(new Date(s).getUTCHours()); // 12:00 and 22:00 Riyadh
  });

  it("rejects drafts that are short, repeated, boilerplate or placeholder", () => {
    expect(qualityProblems(body(1), 0.1)).toEqual([]);
    expect(qualityProblems("short", null)).toContain("too short");
    expect(qualityProblems(body(1), 0.6).join()).toMatch(/too similar/);
    expect(qualityProblems(`${body(1)} As an AI language model`, null).join()).toMatch(/boilerplate/);
    expect(qualityProblems(`${body(1)} [insert company]`, null).join()).toMatch(/placeholders/);
  });

  it("prepares drafts for review only: designed, planned on free days, a few per run, nothing approved or published", async () => {
    const r = await prepareWeek(NOW);
    expect(r.prepared).toHaveLength(MAX_PER_RUN);
    for (const p of r.prepared) {
      const d = (await getAction(p.actionId))!;
      expect(d.action.status).toBe("ready_for_review");
      expect(d.current.target_at).toBe(p.targetAt);
      expect(d.current.assets).toHaveLength(1);
      expect(d.approvals).toHaveLength(0);
    }
    expect(new Set(r.prepared.map((p) => riyadhDate(p.targetAt))).size).toBe(MAX_PER_RUN);
    // Later runs fill the remaining days, never a day twice; then the newsletter.
    for (let i = 0; i < 4; i++) await prepareWeek(NOW);
    const batch = await weekBatch(NOW);
    const posts = batch.filter((b) => !b.newsletter);
    expect(new Set(posts.map((b) => riyadhDate(b.targetAt))).size).toBe(posts.length);
    expect(posts.length).toBeGreaterThanOrEqual(7);
    expect(batch.filter((b) => b.newsletter)).toHaveLength(1);
    expect(await select("li_publish_authorizations", [])).toHaveLength(0);
    expect(await select("li_executions", [])).toHaveLength(0);
  });

  it("the owner's one click approves exactly the list and schedules the posts; the newsletter is approved only", async () => {
    for (let i = 0; i < 5; i++) await prepareWeek(NOW);
    const batch = await weekBatch(NOW);
    await expect(approveWeek([...batch.map((b) => b.actionId), crypto.randomUUID()], ME, NOW)).rejects.toThrow(/changed since you opened it/);
    const r = await approveWeek(
      batch.map((b) => b.actionId),
      ME,
      NOW,
    );
    expect(r.skipped).toEqual([]);
    expect(r.scheduled).toBe(batch.length);
    for (const b of batch) {
      const d = (await getAction(b.actionId))!;
      expect(d.action.status).toBe("approved");
      expect(isAutoAuthorized(d, await authorizationsFor(b.actionId))).toBe(!b.newsletter);
    }
    expect(await select("li_executions", [])).toHaveLength(0);
    expect(await weekBatch(NOW)).toEqual([]);
  });

  it("does nothing without Grok", async () => {
    vi.stubEnv("STUDIO_GROK_ENABLED", "");
    expect(await prepareWeek(NOW)).toMatchObject({ ran: false, reason: "Grok isn't enabled." });
  });
});
