import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { select } from "@/lib/server/store";
import { generate, grokStatus, GrokUnavailableError } from "./grok";
import { importSnapshot, snapshotSchema } from "./import";
import { isOwner } from "./owner";
import {
  addVersion,
  approve,
  createDraft,
  getAction,
  markFailed,
  recordManualExecution,
  reject,
  reopen,
  requestRevision,
  verifyExecution,
  type ApprovalRow,
} from "./repo";
import { canTransition, contentHash, isLinkedInContentUrl, STATUSES, WorkflowError } from "./workflow";
import { fromRiyadhInput, toRiyadhInput } from "./time";

const ME = "owner@example.com";
let n = 0;
const post = (text?: string) =>
  createDraft({
    kind: "post",
    actionKind: "publish_post",
    channel: "manual",
    content: { text: text ?? `Draft number ${++n} ${crypto.randomUUID()}`, assets: [], target_at: "2026-10-20T13:00:00.000Z" },
    origin: "manual",
    author: ME,
  });
const url = () => `https://www.linkedin.com/feed/update/urn:li:share:${Math.floor(Math.random() * 1e15)}`;
async function approved() {
  const { actionId } = await post();
  const d = (await getAction(actionId))!;
  await approve(actionId, d.current.id, d.current.content_hash, ME);
  return actionId;
}

describe("workflow rules", () => {
  it("allows the documented path and refuses shortcuts", () => {
    expect(canTransition("draft", "ready_for_review")).toBe(true);
    expect(canTransition("ready_for_review", "approved")).toBe(true);
    expect(canTransition("approved", "executed")).toBe(true);
    expect(canTransition("executed", "verified")).toBe(true);
    // Shortcuts that would skip review or verification:
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("ready_for_review", "executed")).toBe(false);
    expect(canTransition("approved", "verified")).toBe(false);
    expect(canTransition("blocked", "approved")).toBe(false);
    expect(canTransition("failed", "executed")).toBe(false);
    for (const s of STATUSES) expect(canTransition("verified", s)).toBe(false);
  });

  it("hashes content deterministically and notices any material change", () => {
    const base = { text: "Line one\nLine two", assets: [], target_at: "2026-10-20T13:00:00.000Z" };
    expect(contentHash(base)).toBe(contentHash({ ...base, text: "Line one\r\nLine two" }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, text: "Line one\nLine two." }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, target_at: "2026-10-20T14:00:00.000Z" }));
    expect(contentHash(base)).not.toBe(contentHash({ ...base, assets: [{ type: "image", url: "https://x.test/a.png" }] }));
  });

  it("accepts only LinkedIn post links as evidence", () => {
    expect(isLinkedInContentUrl("https://www.linkedin.com/feed/update/urn:li:share:7514716982915813377")).toBe(true);
    expect(isLinkedInContentUrl("https://www.linkedin.com/posts/islamgendi_growth-activity-1")).toBe(true);
    expect(isLinkedInContentUrl("http://www.linkedin.com/feed/update/urn:li:share:1")).toBe(false);
    expect(isLinkedInContentUrl("https://linkedin.com.evil.test/feed/update/urn:li:share:1")).toBe(false);
    expect(isLinkedInContentUrl("https://www.linkedin.com/in/someone")).toBe(false);
  });

  it("reads planned times as Riyadh time", () => {
    expect(fromRiyadhInput("2026-10-12T17:00")).toBe("2026-10-12T14:00:00.000Z");
    expect(toRiyadhInput("2026-10-12T14:00:00.000Z")).toBe("2026-10-12T17:00");
    expect(() => fromRiyadhInput("tomorrow")).toThrow(WorkflowError);
  });
});

describe("approval enforcement", () => {
  it("approves only the exact version reviewed", async () => {
    const { actionId } = await post();
    const d = (await getAction(actionId))!;
    await expect(approve(actionId, d.current.id, "0".repeat(64), ME)).rejects.toThrow(WorkflowError);
    await approve(actionId, d.current.id, d.current.content_hash, ME);
    const after = (await getAction(actionId))!;
    expect(after.action.status).toBe("approved");
    expect(after.approvalValid).toBe(true);
  });

  it("refuses an approval for a version that was replaced while the reviewer was looking", async () => {
    const { actionId } = await post();
    const seen = (await getAction(actionId))!;
    await addVersion(actionId, { text: "Changed meanwhile", assets: [], target_at: null }, ME);
    await expect(approve(actionId, seen.current.id, seen.current.content_hash, ME)).rejects.toThrow(/changed/);
  });

  it("voids an approval when the content is edited after approval", async () => {
    const id = await approved();
    const before = (await getAction(id))!;
    await addVersion(id, { text: before.current.text + " One more sentence.", assets: [], target_at: before.current.target_at }, ME);
    const after = (await getAction(id))!;
    expect(after.action.status).toBe("ready_for_review");
    expect(after.approvalValid).toBe(false);
    expect(after.approvals[0].decision).toBe("revoked");
    await expect(recordManualExecution(id, url(), ME)).rejects.toThrow(/no valid approval/);
  });

  it("treats a schedule change as material", async () => {
    const id = await approved();
    const d = (await getAction(id))!;
    await addVersion(id, { text: d.current.text, assets: [], target_at: "2026-11-01T13:00:00.000Z" }, ME);
    expect((await getAction(id))!.approvalValid).toBe(false);
  });

  it("does not create a version, or void approval, when nothing changed", async () => {
    const id = await approved();
    const d = (await getAction(id))!;
    const r = await addVersion(id, { text: d.current.text, assets: [], target_at: d.current.target_at }, ME);
    expect(r.changed).toBe(false);
    expect((await getAction(id))!.approvalValid).toBe(true);
  });

  it("never records execution without approval", async () => {
    const { actionId } = await post();
    await expect(recordManualExecution(actionId, url(), ME)).rejects.toThrow(WorkflowError);
    expect((await getAction(actionId))!.executions).toHaveLength(0);
  });

  it("detects tampering with stored content after approval", async () => {
    const id = await approved();
    const d = (await getAction(id))!;
    const { update, eq } = await import("@/lib/server/store");
    await update("li_draft_versions", [eq("id", d.current.id)], { text: "Swapped behind the reviewer's back" });
    expect((await getAction(id))!.approvalValid).toBe(false);
    await expect(recordManualExecution(id, url(), ME)).rejects.toThrow(WorkflowError);
  });

  it("requires reasons for rejection and revision, and records them", async () => {
    const a = (await post()).actionId;
    await expect(reject(a, "  ", ME)).rejects.toThrow(WorkflowError);
    await reject(a, "Too generic", ME);
    const d = (await getAction(a))!;
    expect(d.action.status).toBe("rejected");
    expect(d.approvals[0]).toMatchObject({ decision: "rejected", reason: "Too generic" });
    const b = (await post()).actionId;
    await requestRevision(b, "Sharper opening", ME);
    expect((await getAction(b))!.action.status).toBe("needs_revision");
    await reopen(b, ME);
    expect((await getAction(b))!.action.status).toBe("ready_for_review");
  });
});

describe("execution, verification and duplicate prevention", () => {
  it("separates executed from verified", async () => {
    const id = await approved();
    await recordManualExecution(id, url(), ME);
    expect((await getAction(id))!.action.status).toBe("executed");
    await verifyExecution(id, ME, "manual check");
    const d = (await getAction(id))!;
    expect(d.action.status).toBe("verified");
    expect(d.executions[0].verified_at).toBeTruthy();
  });

  it("refuses to record the same approved content twice", async () => {
    const id = await approved();
    await recordManualExecution(id, url(), ME);
    await expect(recordManualExecution(id, url(), ME)).rejects.toThrow(WorkflowError);
    const rows = await select("li_executions", []);
    expect(rows.filter((r) => r.action_id === id)).toHaveLength(1);
  });

  it("refuses identical content published by a second item", async () => {
    const text = `Same text ${crypto.randomUUID()}`;
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { actionId } = await post(text);
      const d = (await getAction(actionId))!;
      await approve(actionId, d.current.id, d.current.content_hash, ME);
      ids.push(actionId);
    }
    await recordManualExecution(ids[0], url(), ME);
    await expect(recordManualExecution(ids[1], url(), ME)).rejects.toThrow(/duplicate/);
  });

  it("refuses a post link already recorded for another item", async () => {
    const link = url();
    const a = await approved();
    const b = await approved();
    await recordManualExecution(a, link, ME);
    await expect(recordManualExecution(b, link, ME)).rejects.toThrow(/already recorded/);
  });

  it("keeps a failure visible and never re-executes it automatically", async () => {
    const id = await approved();
    await recordManualExecution(id, url(), ME);
    await markFailed(id, "Post not visible", ME);
    const d = (await getAction(id))!;
    expect(d.action.status).toBe("failed");
    await expect(recordManualExecution(id, url(), ME)).rejects.toThrow(WorkflowError);
  });

  it("refuses edits to published items", async () => {
    const id = await approved();
    await recordManualExecution(id, url(), ME);
    await expect(addVersion(id, { text: "late edit", assets: [], target_at: null }, ME)).rejects.toThrow(/Published/);
  });
});

// The real export is private and not committed (public repository); these run where the files exist.
const SNAPSHOT_DIR = path.join(process.cwd(), "content/buffer-snapshots");
const hasSnapshots = fs.existsSync(path.join(SNAPSHOT_DIR, "2026-10-10-scheduled-before-pause.json"));

describe.skipIf(!hasSnapshots)("Buffer snapshot import (real export of 10 Oct 2026)", () => {
  const dir = SNAPSHOT_DIR;
  const load = (f: string) => snapshotSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

  it("imports history with metrics, then the scheduled posts as unapproved queue items", async () => {
    const history = await importSnapshot(load("2026-10-10-history-with-metrics.json"), ME);
    expect(history.history.added).toBe(57);
    expect(history.metricSnapshots).toBe(57);
    expect(history.queue.added).toBe(1); // the one Buffer draft

    const scheduled = await importSnapshot(load("2026-10-10-scheduled-before-pause.json"), ME);
    expect(scheduled.queue.added).toBe(37);

    const drafts = await select<{ id: string; origin: string; origin_ref: string }>("li_drafts", []);
    const migrated = drafts.filter((d) => d.origin === "migrated_buffer");
    expect(migrated).toHaveLength(38);
    const actions = await select<{ id: string; draft_id: string; status: string; original_due_at: string | null }>("li_actions", []);
    const mine = actions.filter((a) => migrated.some((d) => d.id === a.draft_id));
    expect(mine.filter((a) => a.status === "approved")).toHaveLength(0);
    expect(mine.filter((a) => a.status === "ready_for_review" || a.status === "blocked")).toHaveLength(37);
    expect(mine.filter((a) => a.original_due_at).length).toBe(38);

    const approvals = await select<ApprovalRow>("li_approvals", []);
    expect(approvals.some((a) => a.decision === "approved" && mine.some((m) => m.id === a.action_id))).toBe(false);
  });

  it("preserves text, assets and the original date exactly", async () => {
    const raw = load("2026-10-10-scheduled-before-pause.json").posts.edges[5].node;
    const drafts = await select<{ id: string; origin_ref: string }>("li_drafts", []);
    const draft = drafts.find((d) => d.origin_ref === raw.id)!;
    const actions = await select<{ id: string; draft_id: string }>("li_actions", []);
    const d = (await getAction(actions.find((a) => a.draft_id === draft.id)!.id))!;
    expect(d.current.text).toBe(raw.text);
    expect(d.current.target_at).toBe(raw.dueAt);
    expect(d.action.original_due_at).toBe(raw.dueAt);
    expect(d.current.assets.map((a) => a.url)).toEqual(raw.assets.map((a) => a.source));
  });

  it("blocks a queued post that Buffer published after the export", async () => {
    const r = await importSnapshot(load("2026-10-10-update-1839-published-after-export.json"), ME);
    expect(r.history.added).toBe(1);
    expect(r.queue.blockedAsDuplicate).toBe(1);
    const drafts = await select<{ id: string; origin_ref: string }>("li_drafts", []);
    const draft = drafts.find((d) => d.origin_ref === "6aca0aa7bba9419ccbf8e78b")!;
    const actions = await select<{ draft_id: string; status: string }>("li_actions", []);
    expect(actions.find((a) => a.draft_id === draft.id)!.status).toBe("blocked");
  });

  it("is idempotent", async () => {
    const again = await importSnapshot(load("2026-10-10-scheduled-before-pause.json"), ME);
    expect(again.queue).toMatchObject({ added: 0, existing: 37 });
    const h = await importSnapshot(load("2026-10-10-history-with-metrics.json"), ME);
    expect(h.history).toMatchObject({ added: 0, existing: 57 });
    expect(h.queue.blockedAsDuplicate).toBe(0);
    expect(h.metricSnapshots).toBe(0);
  });

});

describe("snapshot import rules", () => {
  it("blocks a queued post whose text is already published", async () => {
    const text = `Already live ${crypto.randomUUID()}`;
    const snap = (status: "sent" | "scheduled", id: string) => ({
      posts: { edges: [{ node: { id, status, text, dueAt: "2026-10-11T14:00:00.000Z", sentAt: status === "sent" ? "2026-10-11T14:00:30.000Z" : null, assets: [] } }] },
    });
    await importSnapshot(snapshotSchema.parse(snap("sent", "aaaaaaaaaaaaaaaaaaaaaaa1")), ME);
    const r = await importSnapshot(snapshotSchema.parse(snap("scheduled", "aaaaaaaaaaaaaaaaaaaaaaa2")), ME);
    expect(r.queue.blockedAsDuplicate).toBe(1);
  });
});

describe("owner gate", () => {
  afterEach(() => {
    delete process.env.STUDIO_OWNER_EMAIL;
  });
  it("admits only the configured owner, and nobody when unset", () => {
    expect(isOwner({ email: "islam@example.com" })).toBe(false);
    process.env.STUDIO_OWNER_EMAIL = " Islam@Example.com ";
    expect(isOwner({ email: "islam@example.com" })).toBe(true);
    expect(isOwner({ email: "someone@example.com" })).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});

describe("Grok client", () => {
  const KEYS = ["XAI_API_KEY", "STUDIO_GROK_ENABLED", "XAI_MODEL", "XAI_MONTHLY_BUDGET_USD", "XAI_PRICE_INPUT_PER_MTOK", "XAI_PRICE_OUTPUT_PER_MTOK"];
  const enable = (budget = "5") => {
    Object.assign(process.env, {
      XAI_API_KEY: "xai-test-secret-key",
      STUDIO_GROK_ENABLED: "true",
      XAI_MODEL: "grok-test",
      XAI_MONTHLY_BUDGET_USD: budget,
      XAI_PRICE_INPUT_PER_MTOK: "2",
      XAI_PRICE_OUTPUT_PER_MTOK: "6",
    });
  };
  beforeAll(() => KEYS.forEach((k) => delete process.env[k]));
  afterEach(() => {
    KEYS.forEach((k) => delete process.env[k]);
    vi.unstubAllGlobals();
  });
  const input = { system: "s", prompt: "p", purpose: "test", maxOutputTokens: 500 };

  it("stays disabled without every setting, and never calls the API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.XAI_API_KEY = "xai-test-secret-key";
    expect(grokStatus()).toMatchObject({ enabled: false, keyPresent: true });
    await expect(generate(input)).rejects.toThrow(GrokUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("records usage and cost when enabled", async () => {
    enable();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ model: "grok-test", choices: [{ message: { content: "Hello" } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }),
      ),
    );
    const r = await generate(input);
    expect(r.text).toBe("Hello");
    expect(r.costUsd).toBeCloseTo((1000 * 2 + 500 * 6) / 1e6);
  });

  it("refuses before calling when the monthly budget would be exceeded", async () => {
    enable("0.000001");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(generate(input)).rejects.toThrow(/budget/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never echoes the key in errors", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key xai-test-secret-key", { status: 401 })));
    const err = await generate(input).catch((e: Error) => e);
    expect(String(err)).not.toContain("xai-test-secret-key");
  });
});
