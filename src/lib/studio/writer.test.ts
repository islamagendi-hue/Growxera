import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { insert, select } from "@/lib/server/store";
import { getAction } from "./repo";
import { addTopic, buildPrompt, closestPublished, listTopics, removeTopic, similarity, writeDraft, writeTopic } from "./writer";

const ME = "owner@example.com";
const GROK = {
  XAI_API_KEY: "xai-test-secret-key",
  STUDIO_GROK_ENABLED: "true",
  XAI_MODEL: "grok-test",
  XAI_MONTHLY_BUDGET_USD: "10",
  XAI_PRICE_INPUT_PER_MTOK: "2",
  XAI_PRICE_OUTPUT_PER_MTOK: "6",
};
const PUBLISHED = "Your pipeline looks fine. But revenue keeps slipping by a quarter.\n\nDeals slip because buyers delay decisions, not because reps stop working.";

beforeEach(async () => {
  vi.stubEnv("GX_DATA_DIR", path.join(os.tmpdir(), `gx-writer-${crypto.randomUUID()}`));
  for (const [k, v] of Object.entries(GROK)) vi.stubEnv(k, v);
  await insert("li_content", { id: "c1", created_at: new Date().toISOString(), kind: "post", text: PUBLISHED, published_at: "2026-10-01T15:00:00.000Z", source: "manual", source_id: "c1", assets: [] });
  await insert("li_metrics_snapshots", { id: "m1", created_at: new Date().toISOString(), content_id: "c1", measured_at: new Date().toISOString(), window_kind: "lifetime", source: "manual", impressions: 900, reactions: 20, comments: 5 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const grokReturns = (content: string) => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    void init;
    return Response.json({ model: "grok-test", choices: [{ message: { content } }], usage: { prompt_tokens: 800, completion_tokens: 300 } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("Grok writer", () => {
  it("builds the prompt from the topic, the best posts and what's already published", () => {
    const p = buildPrompt({ topic: "CAC payback", angle: "for seed founders", format: "post" }, ["EXAMPLE TEXT"], ["Old hook"]);
    expect(p.system).toMatch(/150–220 words/);
    expect(p.system).toMatch(/Never invent statistics/);
    expect(p.prompt).toContain("Topic: CAC payback");
    expect(p.prompt).toContain("for seed founders");
    expect(p.prompt).toContain("EXAMPLE TEXT");
    expect(p.prompt).toContain("- Old hook");
    const n = buildPrompt({ topic: "Pricing", format: "newsletter" }, [], []);
    expect(n.system).toMatch(/Behind the Number/);
    expect(n.system).toMatch(/Case study/);
    expect(n.maxOutputTokens).toBeGreaterThan(p.maxOutputTokens);
  });

  it("measures similarity on meaningful words", () => {
    expect(similarity(PUBLISHED, PUBLISHED)).toBe(1);
    expect(similarity(PUBLISHED, "Completely different words about onboarding emails")).toBeLessThan(0.1);
  });

  it("writes a post as a draft only, learning from the best post and flagging a near-repeat", async () => {
    const fetchMock = grokReturns(`\`\`\`\n${PUBLISHED}\n\`\`\``);
    const r = await writeDraft({ topic: "Pipeline slippage", format: "post" }, ME);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[1].content).toContain("Your pipeline looks fine."); // example and "already published"
    const d = (await getAction(r.actionId))!;
    expect(d.action.status).toBe("draft");
    expect(d.action.kind).toBe("publish_post");
    expect(d.current.text).toBe(PUBLISHED); // code fences removed
    expect(r.similar?.score).toBeGreaterThan(0.9);
    expect(d.draft.notes).toMatch(/Similar to a published post/);
    expect(await select("li_executions", [])).toHaveLength(0);
    const usage = await select<{ purpose: string }>("li_llm_usage", []);
    expect(usage.map((u) => u.purpose)).toEqual(["post_draft"]);
  });

  it("writes a newsletter as a newsletter draft, which can't go through post publishing", async () => {
    grokReturns("Title\nSubtitle\n\nThe number\nSomething new entirely about onboarding cohorts.");
    const r = await writeDraft({ topic: "Onboarding cohorts", format: "newsletter" }, ME);
    const d = (await getAction(r.actionId))!;
    expect(d.action.kind).toBe("publish_newsletter");
    expect(r.similar).toBeNull();
  });

  it("refuses when Grok is off or the budget is spent, before calling and without saving", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("STUDIO_GROK_ENABLED", "");
    await expect(writeDraft({ topic: "Anything", format: "post" }, ME)).rejects.toThrow(/not enabled/);
    vi.stubEnv("STUDIO_GROK_ENABLED", "true");
    vi.stubEnv("XAI_MONTHLY_BUDGET_USD", "0.000001");
    await expect(writeDraft({ topic: "Anything", format: "post" }, ME)).rejects.toThrow(/budget/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await select("li_actions", [])).toHaveLength(0);
  });

  it("keeps a topic list: add, refuse duplicates, write from it, remove", async () => {
    const t = await addTopic({ text: "Why CAC payback beats ROAS", angle: "budget reviews", format: "post" }, ME);
    await expect(addTopic({ text: "why cac payback beats roas", format: "post" }, ME)).rejects.toThrow(/already on the list/);
    grokReturns("CAC payback tells you when cash comes back. ROAS doesn't.\n\nBody.");
    const r = await writeTopic(t.id, ME);
    expect((await listTopics())[0].draft_action_id).toBe(r.actionId);
    await removeTopic(t.id, ME);
    expect(await listTopics()).toEqual([]);
    expect(await closestPublished("unrelated words entirely here")).toBeNull();
  });
});
