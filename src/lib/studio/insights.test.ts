import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { eq, insert, select, update } from "@/lib/server/store";
import { authorizeAutoPublish } from "./autopublish";
import { attention, calendarMonth, describe as describeEvent, loadPosts, publishBlockers, riyadhDay, shiftMonth, type AuditRow, type Controls } from "./insights";
import { approve, createDraft, getAction, submitForReview } from "./repo";

const ME = "owner@example.com";
const original = process.env.GX_DATA_DIR;
beforeEach(() => vi.stubEnv("GX_DATA_DIR", path.join(os.tmpdir(), `gx-insights-${crypto.randomUUID()}`)));
afterEach(() => {
  vi.unstubAllEnvs();
  if (original) process.env.GX_DATA_DIR = original;
});

async function post(text: string, target: string | null, status: "draft" | "ready_for_review" = "ready_for_review") {
  const { actionId } = await createDraft({
    kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME, status,
    content: { text, assets: [], target_at: target },
  });
  return actionId;
}
async function approved(text: string, target: string) {
  const id = await post(text, target);
  const d = (await getAction(id))!;
  await approve(id, d.current.id, d.current.content_hash, ME);
  return id;
}
const byId = async (id: string) => (await loadPosts()).find((p) => p.action.id === id)!;

const OFF: Controls = {
  publishing: { enabled: false, ready: true, changedAt: null, changedBy: null },
  auto: { enabled: false, deploymentAllowed: false, ownerEnabled: false, ready: true, changedAt: null, changedBy: null },
  linkedin: { state: "not_connected" },
};
const ON: Controls = {
  publishing: { enabled: true, ready: true, changedAt: null, changedBy: null },
  auto: { enabled: true, deploymentAllowed: true, ownerEnabled: true, ready: true, changedAt: null, changedBy: null },
  linkedin: { state: "connected", row: {} as never, daysLeft: 50, expiringSoon: false, canPost: true },
};

describe("post states", () => {
  it("tells approved-but-not-confirmed posts (the 19 legacy approvals) from posts confirmed for automatic publishing", async () => {
    const legacy = await approved("Legacy approval", "2099-03-01T10:00:00.000Z");
    const confirmed = await approved("Confirmed one", "2099-03-02T10:00:00.000Z");
    const d = (await getAction(confirmed))!;
    await authorizeAutoPublish(confirmed, d.current.id, d.current.content_hash, ME);
    expect(await byId(legacy)).toMatchObject({ approvalValid: true, autoAuthorized: false, awaitingAutoConfirmation: true });
    expect(await byId(confirmed)).toMatchObject({ approvalValid: true, autoAuthorized: true, awaitingAutoConfirmation: false });
  });

  it("marks held, overdue and unknown-outcome posts", async () => {
    const held = await post("Held one", "2099-03-01T10:00:00.000Z");
    await update("li_actions", [eq("id", held)], { status_reason: "Held: missed its window" });
    const overdue = await post("Late one", "2020-01-01T10:00:00.000Z");
    const unknown = await approved("Sent, unclear", "2099-03-03T10:00:00.000Z");
    await update("li_actions", [eq("id", unknown)], { status: "executed" });
    await insert("li_executions", { id: crypto.randomUUID(), created_at: new Date().toISOString(), action_id: unknown, idempotency_key: "k", content_hash: "h", channel: "linkedin_api", result: "unknown", external_url: null, error: "No answer", verified_at: null, verification: null });
    expect(await byId(held)).toMatchObject({ held: true, overdue: false });
    expect(await byId(overdue)).toMatchObject({ held: false, overdue: true });
    expect(await byId(unknown)).toMatchObject({ unknownOutcome: true, unverified: false });
    const order = attention(await loadPosts()).map((a) => a.kind);
    expect(order.indexOf("unknown_outcome")).toBeLessThan(order.indexOf("held"));
    expect(order.indexOf("held")).toBeLessThan(order.indexOf("overdue"));
  });

  it("an edit after approval shows the approval no longer covers the current version", async () => {
    const id = await approved("Before edit", "2099-03-01T10:00:00.000Z");
    const { addVersion } = await import("./repo");
    await addVersion(id, { text: "After edit", assets: [], target_at: "2099-03-01T10:00:00.000Z" }, ME);
    const p = await byId(id);
    expect(p.approvalValid).toBe(false);
    expect(p.action.status).toBe("ready_for_review");
  });
});

describe("why a post can't be published", () => {
  it("lists every reason while switches are OFF and LinkedIn isn't connected", async () => {
    const p = await byId(await approved("Approved", "2099-03-01T10:00:00.000Z"));
    const b = publishBlockers(p, OFF);
    expect(b.manual).toEqual(["All publishing is switched OFF.", "LinkedIn isn't connected."]);
    expect(b.automatic).toEqual(expect.arrayContaining(["Automatic publishing is switched OFF.", "Not confirmed for automatic publishing (each post is confirmed one by one)."]));
  });

  it("reports nothing blocking only when every lock is open", async () => {
    const id = await approved("Ready", "2099-03-01T10:00:00.000Z");
    expect(publishBlockers(await byId(id), ON).automatic).toEqual(["Not confirmed for automatic publishing (each post is confirmed one by one)."]);
    const d = (await getAction(id))!;
    await authorizeAutoPublish(id, d.current.id, d.current.content_hash, ME);
    expect(publishBlockers(await byId(id), ON)).toEqual({ manual: [], automatic: [] });
    const draft = await byId(await post("Draft", null, "draft"));
    expect(publishBlockers(draft, ON).manual).toEqual(['It is "draft", not approved.']);
  });
});

describe("drafts", () => {
  it("are submitted for review once, and the activity log records it", async () => {
    const id = await post("New idea", null, "draft");
    await submitForReview(id, ME);
    expect((await getAction(id))!.action.status).toBe("ready_for_review");
    await expect(submitForReview(id, ME)).rejects.toThrow(/Only drafts/);
    const log = await select<AuditRow>("li_audit_log", [eq("event", "action.submitted")]);
    expect(describeEvent(log[0])).toMatchObject({ category: "content", text: "Submitted for review", href: `/studio/queue/${id}` });
  });
});

describe("calendar", () => {
  it("builds whole weeks from Sunday, groups by Riyadh day, and flags two posts on one day", async () => {
    await post("Morning", "2099-03-10T05:00:00.000Z");
    await post("Evening", "2099-03-10T15:00:00.000Z");
    // 21:30 UTC is 00:30 the next day in Riyadh.
    await post("Late night", "2099-03-11T21:30:00.000Z");
    const days = calendarMonth("2099-03", await loadPosts(), [{ published_at: "2099-03-05T09:00:00.000Z", text: "Old post\nmore", external_url: "https://www.linkedin.com/feed/update/urn:li:share:1" }]);
    expect(days.length % 7).toBe(0);
    expect(new Date(`${days[0].date}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(days.find((d) => d.date === "2099-03-10")).toMatchObject({ conflict: true });
    expect(days.find((d) => d.date === "2099-03-12")!.entries.map((e) => e.title)).toEqual(["Late night"]);
    expect(days.find((d) => d.date === "2099-03-05")!.entries[0]).toMatchObject({ type: "published", title: "Old post" });
    expect(riyadhDay("2099-03-11T21:30:00.000Z")).toBe("2099-03-12");
    expect(shiftMonth("2099-01", -1)).toBe("2098-12");
    expect(() => calendarMonth("March", [], [])).toThrow();
  });
});

describe("activity", () => {
  const row = (event: string, detail: Record<string, unknown> | null = null): AuditRow => ({ id: "1", created_at: "2099-01-01T00:00:00.000Z", actor: ME, event, entity: "li_actions", entity_id: "abc", detail });
  it("describes events in plain words, flags problems, and keeps unknown events readable", () => {
    expect(describeEvent(row("action.held_missed_schedule"))).toMatchObject({ category: "publishing", problem: true });
    expect(describeEvent(row("publishing.switched_off"))).toMatchObject({ category: "controls", text: "All publishing switched OFF", problem: false });
    expect(describeEvent(row("scheduler.run", { published: 0, failed: 1, held: 2 })).note).toBe("0 published, 1 failed, 2 held");
    expect(describeEvent(row("action.rejected", { reason: "Off brand" })).note).toBe("Off brand");
    expect(describeEvent(row("something.new_thing"))).toMatchObject({ category: "other", text: "something new thing" });
  });
});
