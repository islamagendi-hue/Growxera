import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// Failure injection: the next insert into this table throws (simulates a crash mid-import).
const fail = vi.hoisted(() => ({ table: null as string | null }));
vi.mock("@/lib/server/store", async (orig) => {
  const actual = await orig<typeof import("@/lib/server/store")>();
  return {
    ...actual,
    insert: async (table: Parameters<typeof actual.insert>[0], rows: Parameters<typeof actual.insert>[1]) => {
      if (fail.table === table) {
        fail.table = null;
        throw new Error("Simulated failure");
      }
      return actual.insert(table, rows);
    },
  };
});

import { select } from "@/lib/server/store";
import { generate, grokStatus, GrokUnavailableError } from "./grok";
import { importSnapshot, snapshotSchema } from "./import";
import { studioStorageError } from "./owner";
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
    content: { text: text ?? `Draft number ${++n} ${crypto.randomUUID()}`, assets: [], target_at: "2099-10-20T13:00:00.000Z" },
    origin: "manual",
    author: ME,
  });
/** A moment inside the automatic submission window [T − 60 s, T − 10 s] (default T − 30 s). */
const inWindow = (t: string, beforeMs = 30_000) => new Date(new Date(t).getTime() - beforeMs);
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
    await addVersion(id, { text: d.current.text, assets: [], target_at: "2099-11-01T13:00:00.000Z" }, ME);
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
  const raw = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const load = (f: string) => snapshotSchema.parse(raw(f));

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
    const node = raw("2026-10-10-scheduled-before-pause.json").posts.edges[5].node as {
      id: string;
      text: string;
      dueAt: string;
      assets: { source: string }[];
    };
    const drafts = await select<{ id: string; origin_ref: string }>("li_drafts", []);
    const draft = drafts.find((d) => d.origin_ref === node.id)!;
    const actions = await select<{ id: string; draft_id: string }>("li_actions", []);
    const d = (await getAction(actions.find((a) => a.draft_id === draft.id)!.id))!;
    expect(d.current.text).toBe(node.text);
    expect(d.current.target_at).toBe(node.dueAt);
    expect(d.action.original_due_at).toBe(node.dueAt);
    expect(d.current.assets.map((a) => a.url)).toEqual(node.assets.map((a) => a.source));
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
    // 36 still queued; the one Buffer published after the export is reported, not re-queued.
    expect(again.queue).toMatchObject({ added: 0, existing: 36 });
    expect(again.results.filter((r) => r.outcome === "blocked_published_by_source")).toHaveLength(1);
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
  it("refuses to run when the database is not configured, instead of dropping writes", async () => {
    expect(studioStorageError("disabled")).toMatch(/not configured/);
    expect(studioStorageError("supabase")).toBeNull();
    expect(studioStorageError("local")).toBeNull();
    const owner = fs.readFileSync(path.join(process.cwd(), "src/lib/studio/owner.ts"), "utf8");
    expect(owner).toMatch(/export async function ownerOrThrow[\s\S]*?studioStorageError\(\)[\s\S]*?throw/);
    expect(fs.readFileSync(path.join(process.cwd(), "src/app/studio/layout.tsx"), "utf8")).toMatch(/studioStorageError\(\)/);
  });

  it("no longer accepts the website's accounts: only the studio's own sign-in (access.test.ts)", () => {
    const owner = fs.readFileSync(path.join(process.cwd(), "src/lib/studio/owner.ts"), "utf8");
    expect(owner).not.toMatch(/currentAccount/);
    expect(owner).toMatch(/studioOwner\(\)/);
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

// ── Activation safety checks ───────────────────────────────────────────────

const hex = () => Array.from({ length: 24 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const snap = (nodes: Record<string, unknown>[]) => snapshotSchema.parse({ posts: { edges: nodes.map((node) => ({ node })) } });
const node = (over: Record<string, unknown> = {}) => ({
  id: hex(),
  status: "scheduled",
  text: `Post ${crypto.randomUUID()}`,
  dueAt: "2026-10-20T14:00:00.000Z",
  assets: [],
  ...over,
});
const actionFor = async (sourceId: string) => {
  const drafts = await select<{ id: string; origin_ref: string | null }>("li_drafts", []);
  const d = drafts.find((x) => x.origin_ref === sourceId);
  if (!d) return null;
  const actions = await select<{ id: string; draft_id: string; status: string }>("li_actions", []);
  return actions.find((a) => a.draft_id === d.id) ?? null;
};

describe("import safety", () => {
  it("never lets an already-published post enter the publishing queue", async () => {
    const id = hex();
    await importSnapshot(snap([node({ id, status: "sent", sentAt: "2026-10-10T18:30:47.108Z", externalLink: `https://www.linkedin.com/feed/update/urn:li:share:${Date.now()}` })]), ME);
    // An older file that still lists the same post as scheduled:
    const r = await importSnapshot(snap([node({ id, status: "scheduled" })]), ME);
    expect(r.queue.added).toBe(0);
    expect(r.results[0].outcome).toBe("blocked_published_by_source");
    expect(await actionFor(id)).toBeNull();
  });

  it("does not treat same text with different media as identical, but still blocks it for a check", async () => {
    const text = `Shared text ${crypto.randomUUID()}`;
    await importSnapshot(snap([node({ status: "sent", text, sentAt: "2026-10-01T10:00:00Z", assets: [{ type: "image", source: "https://img.example.com/a.png" }] })]), ME);
    const id = hex();
    const r = await importSnapshot(snap([node({ id, text, assets: [{ type: "image", source: "https://img.example.com/b.png" }] })]), ME);
    expect(r.results.find((x) => x.sourceId === id)?.outcome).toBe("blocked_possible_duplicate");
    expect((await actionFor(id))!.status).toBe("blocked");
  });

  it("reports invalid records instead of silently dropping them, and imports the valid ones", async () => {
    const good = node();
    const r = await importSnapshot(snap([good, { id: "not-an-id", status: "scheduled", text: "x" }, { ...node(), text: "" }, good]), ME);
    expect(r.records).toBe(4);
    expect(r.queue.added).toBe(1);
    expect(r.invalid).toBe(3); // bad id, empty text, duplicate id within the file
    expect(r.results.filter((x) => x.outcome === "invalid")).toHaveLength(3);
  });

  it("leaves no partial or duplicate records after a failure mid-import, and the retry completes", async () => {
    const nodes = [node(), node(), node()];
    fail.table = "li_actions"; // crash after the draft and version of the first post were written
    const first = await importSnapshot(snap(nodes), ME);
    // The failing record is reported (without database details); the others still import.
    expect(first.errors).toBe(1);
    expect(first.results.find((r) => r.outcome === "error")?.sourceId).toBe(nodes[0].id);
    expect(first.queue.added).toBe(2);
    const retry = await importSnapshot(snap(nodes), ME);
    expect(retry.errors).toBe(0);
    expect(retry.queue).toMatchObject({ added: 1, existing: 2 });
    const drafts = await select<{ id: string; origin_ref: string | null }>("li_drafts", []);
    for (const n of nodes) {
      const mine = drafts.filter((d) => d.origin_ref === n.id);
      expect(mine).toHaveLength(1);
      const a = await actionFor(n.id as string);
      expect(a?.status).toBe("ready_for_review");
      const d = (await getAction(a!.id))!;
      expect(d.versions).toHaveLength(1);
      expect(d.current.text).toBe(n.text);
    }
    const again = await importSnapshot(snap(nodes), ME);
    expect(again.queue).toMatchObject({ added: 0, existing: 3 });
  });

  it("re-checks existing queue items, so a crash between creating and blocking is repaired", async () => {
    const text = `Late duplicate ${crypto.randomUUID()}`;
    const id = hex();
    await importSnapshot(snap([node({ id, text })]), ME); // queued, not published yet
    expect((await actionFor(id))!.status).toBe("ready_for_review");
    // The same text and media now appear as published under another post id.
    await importSnapshot(snap([node({ status: "sent", text, sentAt: "2026-10-12T10:00:00Z" })]), ME);
    const again = await importSnapshot(snap([node({ id, text })]), ME);
    expect(again.results[0].outcome).toBe("blocked_duplicate");
    expect((await actionFor(id))!.status).toBe("blocked");
  });
});

describe("approval covers text, images and time; history is respected", () => {
  it("voids approval when an image changes", async () => {
    const id = await approved();
    const d = (await getAction(id))!;
    await addVersion(id, { text: d.current.text, assets: [{ type: "image", url: "https://img.example.com/new.png" }], target_at: d.current.target_at }, ME);
    const after = (await getAction(id))!;
    expect(after.approvalValid).toBe(false);
    expect(after.action.status).toBe("ready_for_review");
  });

  it("refuses to approve content that is already in published history", async () => {
    const text = `Published already ${crypto.randomUUID()}`;
    await importSnapshot(snap([node({ status: "sent", text, sentAt: "2026-10-01T10:00:00Z" })]), ME);
    const { actionId } = await post(text);
    const d = (await getAction(actionId))!;
    await expect(approve(actionId, d.current.id, d.current.content_hash, ME)).rejects.toThrow(/Already published/);
  });

  it("refuses a link that belongs to a post in published history", async () => {
    const link = `https://www.linkedin.com/feed/update/urn:li:share:${Date.now()}1`;
    await importSnapshot(snap([node({ status: "sent", sentAt: "2026-10-01T10:00:00Z", externalLink: link })]), ME);
    const id = await approved();
    await expect(recordManualExecution(id, link, ME)).rejects.toThrow(/published history/);
  });
});

describe("races and verification", () => {
  it("an edit racing 'record as published' never leaves a published item on an unapproved version", async () => {
    for (let i = 0; i < 5; i++) {
      const id = await approved();
      const d = (await getAction(id))!;
      await Promise.allSettled([
        addVersion(id, { text: d.current.text + " Edited.", assets: [], target_at: d.current.target_at }, ME),
        recordManualExecution(id, url(), ME),
      ]);
      const after = (await getAction(id))!;
      if (after.action.status === "executed") {
        // The published content is exactly the approved, current version.
        expect(after.executions[0].content_hash).toBe(after.current.content_hash);
        expect(after.approvalValid).toBe(true);
      } else {
        expect(after.action.status).toBe("ready_for_review");
        expect(after.executions).toHaveLength(0);
      }
    }
  });

  it("refuses to verify when the current version is not the one that was published", async () => {
    const id = await approved();
    await recordManualExecution(id, url(), ME);
    const d = (await getAction(id))!;
    const { update, eq } = await import("@/lib/server/store");
    // Simulate an out-of-band change of the current version after publication.
    const v2 = crypto.randomUUID();
    const { insert } = await import("@/lib/server/store");
    await insert("li_draft_versions", { id: v2, draft_id: d.draft.id, version: 2, text: "other", assets: [], target_at: null, content_hash: "b".repeat(64), author: ME });
    await update("li_drafts", [eq("id", d.draft.id)], { current_version: v2 });
    await expect(verifyExecution(id, ME, "manual")).rejects.toThrow(/doesn't match/);
  });

  it("adds what the studio publishes to history, so a second item with the same text is refused at approval", async () => {
    const text = `Studio published ${crypto.randomUUID()}`;
    const a = (await post(text)).actionId;
    const da = (await getAction(a))!;
    await approve(a, da.current.id, da.current.content_hash, ME);
    await recordManualExecution(a, url(), ME);
    // Same text, different planned time: a different content hash, but the same post for readers.
    const { actionId: b } = await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
      content: { text, assets: [], target_at: "2099-12-01T10:00:00.000Z" },
    });
    const db = (await getAction(b))!;
    await expect(approve(b, db.current.id, db.current.content_hash, ME)).rejects.toThrow(/Already published/);
  });
});

describe("no publishing path without approval", () => {
  const src = path.join(process.cwd(), "src");
  const files = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const code = files(src).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

  it("talks to LinkedIn only from linkedin.ts, posts only through publish.ts, and never calls Buffer", () => {
    const client = path.join(src, "lib/studio/linkedin.ts");
    const publisher = path.join(src, "lib/studio/publish.ts");
    for (const f of code) {
      const text = fs.readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/api\.bufferapp\.com|api\.buffer\.com|graph\.buffer/);
      if (f !== client) expect(text, f).not.toMatch(/api\.linkedin\.com|linkedin\.com\/oauth|linkedin\.com\/v2/);
      if (f !== client && f !== publisher && !f.endsWith(".test.ts")) expect(text, f).not.toMatch(/postToLinkedIn/);
    }
    // publish.ts only posts after loading the item and checking its approval.
    const pub = fs.readFileSync(publisher, "utf8");
    expect(pub.indexOf("!d.approvalValid")).toBeGreaterThan(-1);
    expect(pub.indexOf("!d.approvalValid")).toBeLessThan(pub.indexOf("await postToLinkedIn("));
    expect(pub.indexOf('transition(d.action, "executed"')).toBeLessThan(pub.indexOf("await postToLinkedIn("));
    expect(fs.existsSync(path.join(process.cwd(), "vercel.json"))).toBe(false);
  });

  it("checks the owner on every studio page, server action and route", () => {
    const studio = code.filter((f) => f.includes(`${path.sep}app${path.sep}studio`));
    for (const f of studio.filter((f) => f.endsWith("page.tsx") || f.endsWith("layout.tsx"))) {
      expect(fs.readFileSync(f, "utf8"), f).toMatch(/await requireOwner\(/);
    }
    for (const f of studio.filter((f) => f.endsWith("route.ts"))) {
      expect(fs.readFileSync(f, "utf8"), f).toMatch(/if \(!\(await studioOwner\(\)\)\) return|const account = await studioOwner\(\);\s*if \(!account\) return/);
    }
    const actions = fs.readFileSync(path.join(src, "app/studio/actions.ts"), "utf8");
    const exported = [...actions.matchAll(/export async function (\w+)\([^)]*\)\s*\{([\s\S]*?)\n\}/g)];
    expect(exported.length).toBeGreaterThanOrEqual(10);
    for (const [, name, body] of exported) {
      expect(/await ownerOrThrow\(\)|await run\(|await topics\(/.test(body), `${name} must check the owner`).toBe(true);
    }
    expect(actions).toMatch(/async function run\([\s\S]*?const owner = await ownerOrThrow\(\);/);
    expect(actions).toMatch(/async function topics\([^)]*\)[^{]*\{\s*const owner = await ownerOrThrow\(\);/);
  });
});

describe("capability register is honest", () => {
  it("claims nothing available before live verification, and marks unbuilt features as not built", async () => {
    const { CAPABILITIES } = await import("./capabilities");
    expect(CAPABILITIES.filter((c) => c.status === "available")).toEqual([]);
    for (const id of ["read_comments", "write_comments", "post_analytics", "account_metrics"]) {
      expect(CAPABILITIES.find((c) => c.id === id)!.implementation, id).toMatch(/^Not built yet\./);
    }
    // Newsletters: drafts can be written; publishing is never claimed (no API).
    const newsletter = CAPABILITIES.find((c) => c.id === "newsletter")!;
    expect(newsletter.status).toBe("unavailable");
    expect(newsletter.implementation).toMatch(/^Drafts only\..*Publishing stays manual\.$/);
    // Approval alone never publishes (G1, P2): the description names the switches.
    const text = CAPABILITIES.find((c) => c.id === "publish_text")!.implementation;
    expect(text).toMatch(/All publishing ON/);
    expect(text).not.toMatch(/approved posts are published at their planned time/);
  });
});

describe("public repository hygiene", () => {
  const git = (args: string) => {
    try {
      return execSync(`git ${args}`, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  };
  it.skipIf(git("rev-parse --is-inside-work-tree") === null)("keeps private exports and secrets out of git", () => {
    const tracked = git("ls-files")!.split("\n");
    expect(tracked.filter((f) => f.startsWith("content/buffer-snapshots") || f.startsWith("content/private") || /(^|\/)\.env($|\.local)/.test(f))).toEqual([]);
    expect(fs.readFileSync(".gitignore", "utf8")).toMatch(/\/content\/buffer-snapshots\//);
    expect(git("check-ignore content/buffer-snapshots/x.json")?.trim()).toBe("content/buffer-snapshots/x.json");
    const secret = /xai-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{30,}|re_[A-Za-z0-9]{24,}/;
    for (const f of tracked.filter((f) => f && fs.existsSync(f) && !/\.(png|jpg|ico|woff2|svg)$/.test(f) && f !== "package-lock.json")) {
      expect(secret.test(fs.readFileSync(f, "utf8")), f).toBe(false);
    }
  });
});

describe("one-paste activation script", () => {
  it("contains both migrations unchanged, a wrong-project guard and a single transaction", () => {
    const root = path.join(process.cwd(), "supabase");
    const act = fs.readFileSync(path.join(root, "activation/2026-10-10_studio_activation.sql"), "utf8");
    for (const f of ["20261010000000_linkedin_studio.sql", "20261011000000_linkedin_studio_hardening.sql"]) {
      expect(act.includes(fs.readFileSync(path.join(root, "migrations", f), "utf8")), f).toBe(true);
    }
    expect(act).toMatch(/Wrong project: site tables not found/);
    expect(act.match(/^begin;$/gm)).toHaveLength(1);
    expect(act.match(/^commit;$/gm)).toHaveLength(1);
    expect(act.indexOf("raise exception 'Wrong project")).toBeLessThan(act.indexOf("create schema backup_20261010"));
  });
});

describe("media copies", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("copies allowed files, verifies them by checksum, and is safe to re-run", async () => {
    const { secureAssets, getObject, isAllowedSource } = await import("./assets");
    const url = `https://stpnogsoeaofxlnighnt.supabase.co/storage/v1/object/public/li-assets/test/${crypto.randomUUID()}.png`;
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
      content: { text: `With image ${crypto.randomUUID()}`, assets: [{ type: "image", url }, { type: "image", url: "https://evil.example.com/x.png" }], target_at: null },
    });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u === url ? new Response(bytes, { headers: { "content-type": "image/png" } }) : new Response("no", { status: 404 }))));
    const r = await secureAssets(ME);
    expect(r.failed.find((f) => f.url.includes("evil.example.com"))?.error).toMatch(/allowed list/);
    const rows = await select<{ original_url: string; storage_path: string; verified_at: string | null; sha256: string }>("li_assets", []);
    const row = rows.find((x) => x.original_url === url)!;
    expect(row.verified_at).toBeTruthy();
    expect(Buffer.from((await getObject(row.storage_path))!)).toEqual(Buffer.from(bytes));
    expect(isAllowedSource("http://stpnogsoeaofxlnighnt.supabase.co/x.png")).toBe(false);
    const again = await secureAssets(ME);
    expect(again.copied).toBe(0);
    expect(again.alreadySecured).toBeGreaterThanOrEqual(1);
  });
});

describe("all-publishing switch, before anyone touches it (owner decision P2)", () => {
  it("is OFF by default: Publish now and the scheduler both refuse, before any LinkedIn call", async () => {
    const { publishingSwitch } = await import("./switch");
    const { publishAction, publishDue } = await import("./publish");
    expect(await publishingSwitch()).toMatchObject({ enabled: false, ready: true });
    const id = await approved();
    const f = vi.fn(async () => new Response("unexpected", { status: 500 })) as unknown as typeof fetch;
    await expect(publishAction(id, ME, f)).rejects.toThrow(/All publishing is switched off/);
    await expect(publishAction(id, "scheduler", f, { mode: "auto", now: new Date("2099-10-20T13:00:00.000Z") })).rejects.toThrow(/All publishing is switched off/);
    const r = await publishDue("scheduler", new Date("2099-10-20T13:00:00.000Z"), f);
    expect(r).toMatchObject({ ran: false, reason: expect.stringMatching(/All publishing is switched off/) });
    expect(f).not.toHaveBeenCalled();
    expect((await getAction(id))!.action.status).toBe("approved");
  });
});

describe("LinkedIn direct publishing", () => {
  const SECRET = "test-client-secret-0123456789";
  const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();
  let seq = 7_000_000_000_000_000_000;

  /** A fake LinkedIn: records every call; behaviour per test via `mode`. */
  const fake = {
    mode: "ok" as "ok" | "reject" | "silent" | "read_ok",
    calls: [] as { url: string; method: string; body?: string }[],
    lastCommentary: "",
  };
  const linkedinFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input);
    const method = init?.method ?? "GET";
    fake.calls.push({ url: u, method, body: typeof init?.body === "string" ? init.body : undefined });
    if (u.endsWith("/rest/posts") && method === "POST") {
      if (fake.mode === "silent") throw new TypeError("network down");
      if (fake.mode === "reject") return Response.json({ message: "Invalid content" }, { status: 422 });
      fake.lastCommentary = JSON.parse(String(init!.body)).commentary;
      return new Response(null, { status: 201, headers: { "x-restli-id": `urn:li:share:${++seq}` } });
    }
    if (u.includes("/rest/posts/")) {
      return fake.mode === "read_ok" ? Response.json({ commentary: fake.lastCommentary }) : Response.json({ message: "Not enough permissions" }, { status: 403 });
    }
    if (u.includes("/rest/images?action=initializeUpload")) return Response.json({ value: { uploadUrl: "https://www.linkedin.com/dms-uploads/x", image: "urn:li:image:C4E1" } });
    if (u.startsWith("https://www.linkedin.com/dms-uploads/")) return new Response(null, { status: 201 });
    if (u.includes("/rest/images/")) return Response.json({ status: "AVAILABLE" });
    return new Response("unexpected", { status: 500 });
  }) as unknown as typeof fetch;

  async function connect() {
    const { saveConnection } = await import("./linkedin");
    await saveConnection({ memberUrn: "urn:li:person:abc123", memberName: "Owner", scopes: "openid profile w_member_social", accessToken: "token-xyz", expiresIn: 60 * 86_400 });
  }
  async function approvedAt(target: string | null, text?: string) {
    const { actionId } = await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
      content: { text: text ?? `Direct post ${crypto.randomUUID()} (with brackets) #UnitEconomics`, assets: [], target_at: target },
    });
    const d = (await getAction(actionId))!;
    await approve(actionId, d.current.id, d.current.content_hash, ME);
    return actionId;
  }

  beforeAll(async () => {
    vi.stubEnv("LINKEDIN_CLIENT_ID", "client-id");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", SECRET);
    await connect();
    // Every test here publishes, so the all-publishing switch (P2) is on; its own tests turn it off.
    const { setPublishing } = await import("./autopublish");
    await setPublishing(true, ME);
  });
  afterEach(() => {
    fake.mode = "ok";
    fake.calls = [];
  });

  it("formats post text so LinkedIn keeps every character, with real hashtags", async () => {
    const { toLittleText } = await import("./linkedin");
    expect(toLittleText("Revenue (+16%) vs GMV_2 [note] @x <y> *z* ~w | {a} \\ end")).toBe(
      "Revenue \\(+16%\\) vs GMV\\_2 \\[note\\] \\@x \\<y\\> \\*z\\* \\~w \\| \\{a\\} \\\\ end",
    );
    expect(toLittleText("Line\n\n#UnitEconomics #GTM")).toBe("Line\n\n{hashtag|\\#|UnitEconomics} {hashtag|\\#|GTM}");
    expect(toLittleText("Not a tag: a#b and # alone")).toBe("Not a tag: a\\#b and \\# alone");
  });

  it("uses app keys entered in the studio when the env has none, stored encrypted", async () => {
    const { linkedInConfig, saveAppKeys, isValidClientId } = await import("./linkedin");
    vi.stubEnv("LINKEDIN_CLIENT_ID", "");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "");
    try {
      await saveAppKeys("86abcdEFG123", SECRET);
      const c = await linkedInConfig();
      expect(c.source).toBe("studio");
      expect(c.config).toMatchObject({ clientId: "86abcdEFG123", clientSecret: SECRET });
      const rows = await select<{ client_secret_enc: string }>("li_linkedin_app", []);
      expect(rows.some((r) => r.client_secret_enc.includes(SECRET))).toBe(false);
      expect(isValidClientId("LINKEDIN_CLIENT_ID")).toBe(false);
    } finally {
      vi.stubEnv("LINKEDIN_CLIENT_ID", "client-id");
      vi.stubEnv("LINKEDIN_CLIENT_SECRET", SECRET);
    }
    expect((await linkedInConfig()).source).toBe("env");
  });

  it("stores the token encrypted and can't read it with another secret", async () => {
    const { encryptToken, decryptToken } = await import("./linkedin");
    const enc = encryptToken("secret-token", SECRET);
    expect(enc).not.toContain("secret-token");
    expect(decryptToken(enc, SECRET)).toBe("secret-token");
    expect(decryptToken(enc, "another-secret")).toBeNull();
    const rows = await select<{ access_token_enc: string | null }>("li_linkedin_connection", []);
    expect(rows.some((r) => r.access_token_enc?.includes("token-xyz"))).toBe(false);
  });

  it("publishes an approved post once, records it, and doesn't call it verified without evidence", async () => {
    const { publishAction } = await import("./publish");
    const id = await approvedAt(inAnHour());
    const r = await publishAction(id, ME, linkedinFetch);
    expect(r.url).toMatch(/^https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:share:\d+\/$/);
    expect(r.verified).toBe(false);
    const sent = JSON.parse(fake.calls.find((c) => c.url.endsWith("/rest/posts"))!.body!);
    expect(sent).toMatchObject({ author: "urn:li:person:abc123", visibility: "PUBLIC", lifecycleState: "PUBLISHED" });
    expect(sent.commentary).toContain("\\(with brackets\\)");
    const d = (await getAction(id))!;
    expect(d.action.status).toBe("executed");
    expect(d.executions[0]).toMatchObject({ channel: "linkedin_api", result: "executed", external_url: r.url });
    const history = await select<{ source: string; external_url: string }>("li_content", []);
    expect(history.some((h) => h.source === "studio" && h.external_url === r.url)).toBe(true);
    await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/no valid approval/);
    expect(fake.calls.filter((c) => c.url.endsWith("/rest/posts"))).toHaveLength(1);
  });

  it("marks it verified only when LinkedIn returns the same text", async () => {
    const { publishAction } = await import("./publish");
    fake.mode = "read_ok";
    const id = await approvedAt(inAnHour());
    expect((await publishAction(id, ME, linkedinFetch)).verified).toBe(true);
    expect((await getAction(id))!.action.status).toBe("verified");
  });

  it("refuses without approval, after an edit, and for content already published", async () => {
    const { publishAction } = await import("./publish");
    const { actionId } = await post();
    await expect(publishAction(actionId, ME, linkedinFetch)).rejects.toThrow(/no valid approval/);
    const id = await approvedAt(inAnHour());
    const d = (await getAction(id))!;
    await addVersion(id, { ...d.current, text: d.current.text + " edited" }, ME);
    await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/no valid approval/);
    expect(fake.calls).toHaveLength(0);
  });

  it("a rejection by LinkedIn fails cleanly and can be tried again after re-approval", async () => {
    const { publishAction } = await import("./publish");
    fake.mode = "reject";
    const id = await approvedAt(inAnHour());
    await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/rejected the post \(422.*Nothing was posted/);
    let d = (await getAction(id))!;
    expect(d.action.status).toBe("failed");
    expect(d.executions[0].result).toBe("failed");
    await reopen(id, ME);
    d = (await getAction(id))!;
    await approve(id, d.current.id, d.current.content_hash, ME);
    fake.mode = "ok";
    await expect(publishAction(id, ME, linkedinFetch)).resolves.toMatchObject({ verified: false });
  });

  it("an unknown outcome is never retried and waits for the owner to check", async () => {
    const { publishAction, publishDue, resolveUnknown } = await import("./publish");
    fake.mode = "silent";
    const id = await approvedAt(inAnHour());
    await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/may or may not have been published/);
    let d = (await getAction(id))!;
    expect(d.action.status).toBe("executed");
    expect(d.executions[0].result).toBe("unknown");
    fake.mode = "ok";
    await publishDue("scheduler", new Date(Date.now() + 2 * 3_600_000), linkedinFetch);
    expect(fake.calls.filter((c) => c.url.endsWith("/rest/posts"))).toHaveLength(1);
    await expect(addVersion(id, { ...d.current, text: "change" }, ME)).rejects.toThrow(/can't be edited/);
    await resolveUnknown(id, "not_published", ME);
    d = (await getAction(id))!;
    expect(d.action.status).toBe("failed");
  });

  describe("all-publishing switch (owner decision P2)", () => {
    const off = async () => (await import("./autopublish")).setPublishing(false, ME);
    const on = async () => (await import("./autopublish")).setPublishing(true, ME);
    afterEach(on);
    const posts = () => fake.calls.filter((c) => c.url.endsWith("/rest/posts") && c.method === "POST").length;

    it("blocks Publish now while OFF: no LinkedIn call, the item stays approved; ON again, it posts", async () => {
      const { publishAction } = await import("./publish");
      const id = await approvedAt(inAnHour());
      await off();
      await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/All publishing is switched off/);
      expect(fake.calls).toHaveLength(0);
      expect((await getAction(id))!.action.status).toBe("approved");
      await on();
      await expect(publishAction(id, ME, linkedinFetch)).resolves.toMatchObject({ verified: false });
      expect(posts()).toBe(1);
    });

    it("blocks automatic publishing while OFF even with the automatic switch on and the post authorized and due", async () => {
      const { publishDue, publishAction } = await import("./publish");
      const { authorizeAutoPublish, setAutoPublish } = await import("./autopublish");
      const t = new Date(Date.now() + 6 * 60_000).toISOString();
      const id = await approvedAt(t);
      const d = (await getAction(id))!;
      await authorizeAutoPublish(id, d.current.id, d.current.content_hash, ME);
      vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "true");
      await setAutoPublish(true, ME);
      try {
        await off();
        const r = await publishDue("scheduler", inWindow(t), linkedinFetch);
        expect(r).toMatchObject({ ran: false, switchOn: true, reason: expect.stringMatching(/All publishing is switched off/) });
        await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", now: inWindow(t) })).rejects.toThrow(/All publishing is switched off/);
        expect(posts()).toBe(0);
        // Missed posts are still held while OFF, so nothing fires late when it comes back on.
        const late = await publishDue("scheduler", new Date(new Date(t).getTime() + 1), linkedinFetch);
        expect(late.held).toContain(id);
        await on();
        await publishDue("scheduler", new Date(new Date(t).getTime() + 2), linkedinFetch);
        expect(posts()).toBe(0);
      } finally {
        await setAutoPublish(false, ME);
        vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "");
      }
    });

    it("a direct call to the LinkedIn client is refused while OFF, before any request", async () => {
      const { postToLinkedIn } = await import("./linkedin");
      await off();
      await expect(postToLinkedIn({ token: "t", author: "urn:li:person:abc123", apiVersion: "202606", text: "Hello", media: null }, linkedinFetch)).rejects.toThrow(
        /All publishing is switched off/,
      );
      expect(fake.calls).toHaveLength(0);
    });

    it("switching OFF while a post is being prepared stops it before the post request", async () => {
      const { postToLinkedIn } = await import("./linkedin");
      const flipping = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).includes("/rest/images/")) await off(); // the owner switches OFF during the upload
        return linkedinFetch(input, init);
      }) as unknown as typeof fetch;
      const media = { kind: "image" as const, bytes: new Uint8Array([137, 80, 78, 71]), title: "x" };
      await expect(postToLinkedIn({ token: "t", author: "urn:li:person:abc123", apiVersion: "202606", text: "Hello", media }, flipping)).rejects.toThrow(
        /All publishing is switched off/,
      );
      expect(fake.calls.some((c) => c.url.includes("/rest/images/"))).toBe(true);
      expect(posts()).toBe(0);
    });

    it("reads anything but a stored true as OFF", async () => {
      const { publishingSwitch, PUBLISHING_SETTING } = await import("./switch");
      const { update, eq } = await import("@/lib/server/store");
      for (const value of ["true", 1, null, "yes"]) {
        await update("li_settings", [eq("key", PUBLISHING_SETTING)], { value });
        expect((await publishingSwitch()).enabled, String(value)).toBe(false);
      }
    });

    it("every publishing path goes through the switch (static check)", () => {
      const read = (f: string) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
      const pub = read("lib/studio/publish.ts");
      const body = pub.slice(pub.indexOf("export async function publishAction("));
      // Checked first, before credentials, the claim or anything sent.
      expect(body.indexOf("await assertPublishingOn()")).toBeGreaterThan(-1);
      expect(body.indexOf("await assertPublishingOn()")).toBeLessThan(body.indexOf("postingCredentials("));
      expect(body.indexOf("await assertPublishingOn()")).toBeLessThan(body.indexOf('transition(d.action, "executed"'));
      const li = read("lib/studio/linkedin.ts");
      const post = li.slice(li.indexOf("export async function postToLinkedIn("));
      expect(post.indexOf("await stopIfOff()")).toBeLessThan(post.indexOf("uploadMedia("));
      expect(post.lastIndexOf("await stopIfOff()")).toBeLessThan(post.indexOf("/rest/posts"));
      // The only callers of publishAction are the owner's Publish now action and the scheduler.
      expect(read("app/studio/actions.ts").match(/publishAction\(/g)).toHaveLength(1);
      expect(read("app/api/studio/publish-due/route.ts")).not.toMatch(/publishAction\(/);
    });
  });

  describe("automatic publishing safeguards (owner decisions G1, G2)", () => {
    const MIN = 60_000;
    /** Planned time far enough ahead to be authorized (lead time is 5 minutes). */
    const soon = (minutes = 6) => new Date(Date.now() + minutes * MIN).toISOString();
    const posts = () => fake.calls.filter((c) => c.url.endsWith("/rest/posts") && c.method === "POST").length;

    async function switchOn() {
      const { setAutoPublish } = await import("./autopublish");
      vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "true");
      await setAutoPublish(true, ME);
    }
    async function authorize(id: string) {
      const { authorizeAutoPublish } = await import("./autopublish");
      const d = (await getAction(id))!;
      await authorizeAutoPublish(id, d.current.id, d.current.content_hash, ME);
    }
    afterEach(async () => {
      const { setAutoPublish } = await import("./autopublish");
      await setAutoPublish(false, ME);
      vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "");
    });

    it("the switch is OFF by default and turning it on needs the deployment flag", async () => {
      const { autoPublishSwitch, setAutoPublish } = await import("./autopublish");
      expect((await autoPublishSwitch()).enabled).toBe(false);
      await expect(setAutoPublish(true, ME)).rejects.toThrow(/isn't allowed for this deployment/);
      vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "true");
      expect((await autoPublishSwitch()).enabled).toBe(false); // flag alone isn't enough
      await setAutoPublish(true, ME);
      expect((await autoPublishSwitch()).enabled).toBe(true);
      vi.stubEnv("STUDIO_AUTO_PUBLISH_ALLOWED", "");
      expect((await autoPublishSwitch()).enabled).toBe(false); // removing the flag closes it again
    });

    it("never publishes while the switch is off, even an authorized post that is due", async () => {
      const { publishDue } = await import("./publish");
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      const r = await publishDue("scheduler", inWindow(t), linkedinFetch);
      expect(r).toMatchObject({ ran: false, switchOn: false });
      expect(r.published).toHaveLength(0);
      expect(posts()).toBe(0);
      expect((await getAction(id))!.action.status).toBe("approved");
    });

    it("19 legacy approvals never publish automatically until each one is authorized individually", async () => {
      const { publishDue } = await import("./publish");
      const t = soon();
      const legacy: string[] = [];
      for (let i = 0; i < 19; i++) legacy.push(await approvedAt(t, `Legacy approved post ${i} ${crypto.randomUUID()}`));
      await switchOn();
      const at = inWindow(t);
      const r = await publishDue("scheduler", at, linkedinFetch);
      expect(r.ran).toBe(true);
      expect(r.published.filter((p) => legacy.includes(p.actionId))).toHaveLength(0);
      expect(r.held.filter((h) => legacy.includes(h))).toHaveLength(0);
      expect(r.notAuthorized).toBeGreaterThanOrEqual(19);
      for (const id of legacy) {
        const d = (await getAction(id))!;
        expect(d.action.status).toBe("approved");
        expect(d.approvals.filter((a) => a.decision === "approved")).toHaveLength(1); // history preserved
      }
      const legacyPosts = () => fake.calls.filter((c) => c.url.endsWith("/rest/posts") && c.method === "POST" && c.body?.includes("Legacy approved post")).length;
      expect(legacyPosts()).toBe(0);
      // Confirm exactly one of them: only that one goes out.
      await authorize(legacy[7]);
      const r2 = await publishDue("scheduler", at, linkedinFetch);
      expect(r2.published.map((p) => p.actionId).filter((x) => legacy.includes(x))).toEqual([legacy[7]]);
      expect(legacyPosts()).toBe(1);
      for (const id of legacy.filter((x) => x !== legacy[7])) expect((await getAction(id))!.action.status).toBe("approved");
    });

    it("a missed post is held for review with the reason, never published late, even after the switch comes on", async () => {
      const { publishDue } = await import("./publish");
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      const late = new Date(new Date(t).getTime() + 1);
      // Switch off when the time passes: still held, so it can't fire later.
      const r = await publishDue("scheduler", late, linkedinFetch);
      expect(r.held).toContain(id);
      const d = (await getAction(id))!;
      expect(d.action.status).toBe("ready_for_review");
      expect(d.action.status_reason).toMatch(/^Held:/);
      await switchOn();
      await publishDue("scheduler", new Date(late.getTime() + MIN), linkedinFetch);
      expect(posts()).toBe(0);
    });

    it("a missed post needs a new time and a new approval", async () => {
      const { publishDue } = await import("./publish");
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      await switchOn();
      await publishDue("scheduler", new Date(new Date(t).getTime() + 11 * MIN), linkedinFetch);
      vi.useFakeTimers({ now: new Date(new Date(t).getTime() + 11 * MIN), toFake: ["Date"] });
      try {
        const d = (await getAction(id))!;
        await expect(approve(id, d.current.id, d.current.content_hash, ME)).rejects.toThrow(/planned time has passed/);
      } finally {
        vi.useRealTimers();
      }
      expect(posts()).toBe(0);
    });

    it("submits only from 60 s to 10 s before the planned time: earlier waits, later is held (G2, P1)", async () => {
      const { publishDue } = await import("./publish");
      await switchOn();
      const ids: Record<string, string> = {};
      for (const [i, name] of ["early", "first", "last", "late", "atT"].entries()) {
        ids[name] = await approvedAt(soon(6 + i), `Edge ${name} ${crypto.randomUUID()}`);
        await authorize(ids[name]);
      }
      const target = async (id: string) => (await getAction(id))!.current.target_at!;
      const before = async (id: string, ms: number) => new Date(new Date(await target(id)).getTime() - ms);
      // Exact millisecond edges are in the timing() test below; a run's clock keeps running, so these use ±0.5 s.
      // T − 61 s: too early, waits (stays approved, still authorized).
      const r1 = await publishDue("scheduler", await before(ids.early, 61_000), linkedinFetch);
      expect(r1.published.map((p) => p.actionId)).not.toContain(ids.early);
      expect((await getAction(ids.early))!.action.status).toBe("approved");
      // T − 59.5 s: the window is open.
      const r2 = await publishDue("scheduler", await before(ids.first, 59_500), linkedinFetch);
      expect(r2.published.map((p) => p.actionId)).toContain(ids.first);
      // T − 10.5 s: near the last moment.
      const r3 = await publishDue("scheduler", await before(ids.last, 10_500), linkedinFetch);
      expect(r3.published.map((p) => p.actionId)).toContain(ids.last);
      // T − 9.5 s: missed, held for review, nothing sent.
      const r4 = await publishDue("scheduler", await before(ids.late, 9_500), linkedinFetch);
      expect(r4.held).toContain(ids.late);
      expect((await getAction(ids.late))!.action.status).toBe("ready_for_review");
      // Exactly at T: held too.
      const r5 = await publishDue("scheduler", new Date(await target(ids.atT)), linkedinFetch);
      expect(r5.held).toContain(ids.atT);
      const sent = fake.calls.filter((c) => c.url.endsWith("/rest/posts") && c.method === "POST").map((c) => c.body ?? "");
      expect(sent.filter((b) => b.includes("Edge"))).toHaveLength(2);
      expect(sent.some((b) => b.includes("Edge late") || b.includes("Edge atT") || b.includes("Edge early"))).toBe(false);
    });

    it("re-checks the deadline with the clock right before the post request: a run that ran late holds the post, nothing sent", async () => {
      const { publishAction } = await import("./publish");
      await switchOn();
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      // The run starts inside the window, but by the time it reaches the post request it is past T − 10 s.
      let calls = 0;
      const clock = () => inWindow(t, calls++ === 0 ? 30_000 : 5_000);
      await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", clock })).rejects.toThrow(/held for review/);
      expect(posts()).toBe(0);
      const d = (await getAction(id))!;
      expect(d.action.status).toBe("ready_for_review");
      expect(d.action.status_reason).toMatch(/^Held:/);
      // A new approval and authorization are needed; the old content isn't sent later.
      const { publishDue } = await import("./publish");
      await publishDue("scheduler", inWindow(t, 20_000), linkedinFetch);
      expect(posts()).toBe(0);
    });

    it("an unknown LinkedIn outcome is never retried automatically", async () => {
      const { publishDue } = await import("./publish");
      await switchOn();
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      fake.mode = "silent";
      const r = await publishDue("scheduler", inWindow(t, 50_000), linkedinFetch);
      expect(r.failed.map((x) => x.actionId)).toContain(id);
      fake.mode = "ok";
      // Later runs inside the window don't send it again.
      await publishDue("scheduler", inWindow(t, 35_000), linkedinFetch);
      await publishDue("scheduler", inWindow(t, 20_000), linkedinFetch);
      expect(fake.calls.filter((c) => c.url.endsWith("/rest/posts") && c.method === "POST")).toHaveLength(1);
      const d = (await getAction(id))!;
      expect(d.action.status).toBe("executed");
      expect(d.action.status_reason).toMatch(/may or may not have been published/);
    });

    it("cuts the post request off at the planned time", async () => {
      const { postToLinkedIn } = await import("./linkedin");
      const seen: number[] = [];
      const timed = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).endsWith("/rest/posts")) seen.push(init?.signal ? 1 : 0);
        return linkedinFetch(input, init);
      }) as unknown as typeof fetch;
      const T = Date.now() + 12_000;
      await postToLinkedIn({ token: "t", author: "urn:li:person:abc123", apiVersion: "202606", text: "Hi", media: null, deadline: { submitBy: T - 10_000, cutoffAt: T, now: () => Date.now() } }, timed);
      expect(seen).toEqual([1]);
      await expect(
        postToLinkedIn({ token: "t", author: "urn:li:person:abc123", apiVersion: "202606", text: "Hi", media: null, deadline: { submitBy: Date.now() - 1, cutoffAt: Date.now() + 9_999, now: () => Date.now() } }, timed),
      ).rejects.toThrow(/deadline passed/);
      expect(seen).toEqual([1]);
    });

    it("an edit voids the automatic-publishing authorization, and re-approval doesn't restore it", async () => {
      const { publishDue } = await import("./publish");
      await switchOn();
      const id = await approvedAt(soon());
      await authorize(id);
      const d = (await getAction(id))!;
      const t2 = soon(30);
      await addVersion(id, { ...d.current, target_at: t2 }, ME);
      const d2 = (await getAction(id))!;
      await approve(id, d2.current.id, d2.current.content_hash, ME);
      const r = await publishDue("scheduler", inWindow(t2), linkedinFetch);
      expect(r.published.map((p) => p.actionId)).not.toContain(id);
      expect(posts()).toBe(0);
    });

    it("a direct automatic call re-checks every lock", async () => {
      const { publishAction } = await import("./publish");
      const t = soon();
      const id = await approvedAt(t);
      const due = inWindow(t);
      await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", now: due })).rejects.toThrow(/switched off/);
      await switchOn();
      await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", now: due })).rejects.toThrow(/isn't authorized/);
      await authorize(id);
      await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", now: new Date(new Date(t).getTime() + 1) })).rejects.toThrow(/Outside its submission window/);
      expect(posts()).toBe(0);
      await expect(publishAction(id, "scheduler", linkedinFetch, { mode: "auto", now: due })).resolves.toMatchObject({ verified: false });
    });

    it("two scheduler runs at the same moment publish an authorized post once", async () => {
      const { publishDue } = await import("./publish");
      await switchOn();
      const t = soon();
      const id = await approvedAt(t);
      await authorize(id);
      const at = inWindow(t);
      const [a, b] = await Promise.all([publishDue("scheduler", at, linkedinFetch), publishDue("scheduler", at, linkedinFetch)]);
      expect([...a.published, ...b.published].filter((p) => p.actionId === id)).toHaveLength(1);
      expect(posts()).toBe(1);
    });

    it("authorizing refuses content that isn't approved, a time too close, and a stale page", async () => {
      const { authorizeAutoPublish } = await import("./autopublish");
      const { actionId } = await post();
      let d = (await getAction(actionId))!;
      await expect(authorizeAutoPublish(actionId, d.current.id, d.current.content_hash, ME)).rejects.toThrow(/Approve the content first/);
      const close = await approvedAt(soon(2));
      d = (await getAction(close))!;
      await expect(authorizeAutoPublish(close, d.current.id, d.current.content_hash, ME)).rejects.toThrow(/too close/);
      const ok = await approvedAt(soon());
      d = (await getAction(ok))!;
      await expect(authorizeAutoPublish(ok, d.current.id, "0".repeat(64), ME)).rejects.toThrow(/changed since you opened it/);
    });

    it("reads planned times as Riyadh time at the window boundaries", async () => {
      const { timing } = await import("./autopublish");
      const target = fromRiyadhInput("2026-12-01T17:00");
      expect(target).toBe("2026-12-01T14:00:00.000Z");
      expect(timing(target, new Date("2026-12-01T13:58:59.999Z"))).toBe("early");
      expect(timing(target, new Date("2026-12-01T13:59:00.000Z"))).toBe("on_time"); // T − 60 s
      expect(timing(target, new Date("2026-12-01T13:59:50.000Z"))).toBe("on_time"); // T − 10 s
      expect(timing(target, new Date("2026-12-01T13:59:50.001Z"))).toBe("missed");
      expect(timing(target, new Date("2026-12-01T14:00:00.000Z"))).toBe("missed"); // at T
      expect(timing(target, new Date("2026-12-01T14:00:00.001Z"))).toBe("missed");
    });
  });

  it("publishes an image uploaded in the studio from its verified private copy", async () => {
    const { publishAction } = await import("./publish");
    const { uploadAsset } = await import("./assets");
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7, crypto.getRandomValues(new Uint8Array(1))[0]]);
    const file = await uploadAsset(bytes, null, ME);
    const { actionId } = await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "studio", author: ME,
      content: { text: `Uploaded image post ${crypto.randomUUID()}`, assets: [file], target_at: inAnHour() },
    });
    const d = (await getAction(actionId))!;
    await approve(actionId, d.current.id, d.current.content_hash, ME);
    let sent: Uint8Array | null = null;
    const capture = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") sent = new Uint8Array(init.body as Buffer);
      return linkedinFetch(input, init);
    }) as unknown as typeof fetch;
    await publishAction(actionId, ME, capture);
    expect(Buffer.from(sent!)).toEqual(Buffer.from(bytes));
    expect(JSON.parse(fake.calls.find((c) => c.url.endsWith("/rest/posts"))!.body!).content).toEqual({ media: { id: "urn:li:image:C4E1" } });
  });

  it("uploads an image from the verified copy before posting", async () => {
    const { publishAction } = await import("./publish");
    const { secureAssets } = await import("./assets");
    const imgUrl = `https://stpnogsoeaofxlnighnt.supabase.co/storage/v1/object/public/li-assets/test/${crypto.randomUUID()}.png`;
    const bytes = new Uint8Array([137, 80, 78, 71, 9, 9, 9]);
    const { actionId } = await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
      content: { text: `Image post ${crypto.randomUUID()}`, assets: [{ type: "image", url: imgUrl }], target_at: inAnHour() },
    });
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (u === imgUrl ? new Response(bytes, { headers: { "content-type": "image/png" } }) : new Response("no", { status: 404 }))));
    await secureAssets(ME);
    vi.unstubAllGlobals();
    const d = (await getAction(actionId))!;
    await approve(actionId, d.current.id, d.current.content_hash, ME);
    await publishAction(actionId, ME, linkedinFetch);
    const put = fake.calls.find((c) => c.method === "PUT");
    expect(put?.url).toBe("https://www.linkedin.com/dms-uploads/x");
    const sent = JSON.parse(fake.calls.find((c) => c.url.endsWith("/rest/posts"))!.body!);
    expect(sent.content).toEqual({ media: { id: "urn:li:image:C4E1" } });
  });

  it("approval refuses a planned time that has passed", async () => {
    const { actionId } = await createDraft({
      kind: "post", actionKind: "publish_post", channel: "manual", origin: "manual", author: ME,
      content: { text: `Past ${crypto.randomUUID()}`, assets: [], target_at: "2020-01-01T10:00:00.000Z" },
    });
    const d = (await getAction(actionId))!;
    await expect(approve(actionId, d.current.id, d.current.content_hash, ME)).rejects.toThrow(/planned time has passed/);
  });

  it("does nothing when LinkedIn isn't connected", async () => {
    const { publishDue, publishAction } = await import("./publish");
    const { disconnect } = await import("./linkedin");
    const id = await approvedAt(inAnHour());
    await disconnect();
    try {
      expect(await publishDue("scheduler", new Date(Date.now() + 3_700_000), linkedinFetch)).toMatchObject({ ran: false });
      await expect(publishAction(id, ME, linkedinFetch)).rejects.toThrow(/isn't connected/);
      expect(fake.calls).toHaveLength(0);
    } finally {
      await connect();
    }
  });

  it("the scheduler endpoint is hidden without the right secret", async () => {
    const { GET } = await import("@/app/api/studio/publish-due/route");
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("http://x/api/studio/publish-due"))).status).toBe(404);
    vi.stubEnv("CRON_SECRET", "c".repeat(40));
    expect((await GET(new Request("http://x/api/studio/publish-due", { headers: { authorization: "Bearer wrong" } }))).status).toBe(404);
    expect((await GET(new Request("http://x/api/studio/publish-due", { headers: { authorization: `Bearer ${"d".repeat(40)}` } }))).status).toBe(404);
    const ok = await GET(new Request("http://x/api/studio/publish-due", { headers: { authorization: `Bearer ${"c".repeat(40)}` } }));
    expect(ok.status).toBe(200);
    expect(JSON.stringify(await ok.json())).not.toMatch(/Direct post|commentary/);
    vi.stubEnv("CRON_SECRET", "");
  });
});
