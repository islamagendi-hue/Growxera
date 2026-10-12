import "server-only";
/**
 * Storage and state changes for the LinkedIn Growth Studio. Every state change goes
 * through here, checks the workflow rules, and writes an audit entry.
 *
 * Guarantees (each covered by repo.test.ts):
 * - Approval binds to the exact version hash. An edit creates a new version and voids it.
 * - Nothing is executed without a valid approval for the current version.
 * - An action executes at most once per approved content (unique idempotency key), and the
 *   same content can't be recorded as published by two different actions.
 * - "Executed" and "Verified" are separate states.
 */
import { eq, inList, insert, select, selectAll, selectOne, StoreError, update } from "@/lib/server/store";
import {
  type ActionKind,
  assertTransition,
  type Channel,
  contentHash,
  idempotencyKey,
  isLinkedInContentUrl,
  normalizeText,
  publishedFingerprint,
  type Status,
  type VersionContent,
  WorkflowError,
} from "./workflow";

export interface DraftRow {
  id: string;
  created_at: string;
  kind: "post" | "newsletter" | "comment" | "reply";
  title: string | null;
  current_version: string | null;
  origin: string;
  origin_ref: string | null;
  notes: string | null;
}

export interface VersionRow extends VersionContent {
  id: string;
  created_at: string;
  draft_id: string;
  version: number;
  content_hash: string;
  author: string;
  change_note: string | null;
}

export interface ActionRow {
  id: string;
  created_at: string;
  updated_at: string;
  draft_id: string;
  kind: ActionKind;
  channel: Channel;
  status: Status;
  status_reason: string | null;
  sensitive: boolean;
  original_due_at: string | null;
  target_url: string | null;
}

export interface ApprovalRow {
  id: string;
  created_at: string;
  action_id: string;
  version_id: string;
  content_hash: string;
  decision: "approved" | "rejected" | "needs_revision" | "revoked";
  reason: string | null;
  decided_by: string;
}

export interface ExecutionRow {
  id: string;
  created_at: string;
  action_id: string;
  idempotency_key: string;
  content_hash: string;
  channel: Channel;
  result: "executed" | "failed" | "unknown";
  external_url: string | null;
  error: string | null;
  verified_at: string | null;
  verification: string | null;
}

const now = () => new Date().toISOString();

export async function audit(actor: string, event: string, entity: string, entityId: string | null, detail?: unknown) {
  await insert("li_audit_log", { id: crypto.randomUUID(), created_at: now(), actor, event, entity, entity_id: entityId, detail: detail ?? null });
}

// ── Creating drafts ─────────────────────────────────────────────────────────

export interface NewDraft {
  kind: DraftRow["kind"];
  actionKind: ActionKind;
  channel: Channel;
  content: VersionContent;
  origin: string;
  originRef?: string | null;
  title?: string | null;
  notes?: string | null;
  originalDueAt?: string | null;
  targetUrl?: string | null;
  sensitive?: boolean;
  status?: "draft" | "ready_for_review";
  author: string;
}

/**
 * Creates a draft, its first version and its action. Idempotent on (origin, originRef), and
 * safe after a crash: if an earlier attempt stopped part-way, the missing rows are completed
 * instead of failing on the unique index or creating a second draft.
 */
export async function createDraft(input: NewDraft): Promise<{ actionId: string; created: boolean }> {
  const at = now();
  const existing = input.originRef
    ? await selectOne<DraftRow>("li_drafts", [eq("origin", input.origin), eq("origin_ref", input.originRef)])
    : null;
  if (existing) {
    const action = await selectOne<ActionRow>("li_actions", [eq("draft_id", existing.id)]);
    const versions = await select<VersionRow>("li_draft_versions", [eq("draft_id", existing.id)], { columns: "id" });
    if (action && versions.length) return { actionId: action.id, created: false };
    // Incomplete earlier attempt: finish it.
    if (!versions.length) await insertFirstVersion(existing.current_version ?? crypto.randomUUID(), existing.id, input, at);
    const actionId = action?.id ?? (await insertAction(existing.id, input, at));
    await audit(input.author, "draft.repaired", "li_actions", actionId, { origin: input.origin, originRef: input.originRef ?? null });
    return { actionId, created: !action };
  }
  const draftId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  // Order matters for crash recovery: the draft row (with its unique origin key) first.
  await insert("li_drafts", {
    id: draftId,
    created_at: at,
    kind: input.kind,
    title: input.title ?? null,
    current_version: versionId,
    origin: input.origin,
    origin_ref: input.originRef ?? null,
    notes: input.notes ?? null,
  });
  await insertFirstVersion(versionId, draftId, input, at);
  const actionId = await insertAction(draftId, input, at);
  await audit(input.author, "draft.created", "li_actions", actionId, { origin: input.origin, originRef: input.originRef ?? null });
  return { actionId, created: true };
}

async function insertFirstVersion(versionId: string, draftId: string, input: NewDraft, at: string) {
  await insert("li_draft_versions", {
    id: versionId,
    created_at: at,
    draft_id: draftId,
    version: 1,
    text: input.content.text,
    assets: input.content.assets,
    target_at: input.content.target_at,
    content_hash: contentHash(input.content),
    author: input.author,
    change_note: "Created",
  });
  await update("li_drafts", [eq("id", draftId)], { current_version: versionId });
}

async function insertAction(draftId: string, input: NewDraft, at: string): Promise<string> {
  const actionId = crypto.randomUUID();
  await insert("li_actions", {
    id: actionId,
    created_at: at,
    updated_at: at,
    draft_id: draftId,
    kind: input.actionKind,
    channel: input.channel,
    status: input.status ?? "ready_for_review",
    status_reason: null,
    sensitive: input.sensitive ?? false,
    original_due_at: input.originalDueAt ?? null,
    target_url: input.targetUrl ?? null,
  });
  return actionId;
}

// ── Published history checks ────────────────────────────────────────────────

export interface PublishedMatch {
  kind: "same_text_and_media" | "same_text_different_media";
  url: string | null;
  publishedAt: string | null;
}

/** Finds published history with the same text (and says whether the media matches too). */
export async function findPublishedMatch(text: string, assets: { url: string }[]): Promise<PublishedMatch | null> {
  const rows = await selectAll<{ text: string; assets: { url: string }[]; external_url: string | null; published_at: string | null }>(
    "li_content",
    [],
    { columns: "text,assets,external_url,published_at" },
  );
  const fp = publishedFingerprint(text, assets);
  const norm = normalizeText(text);
  let textOnly: PublishedMatch | null = null;
  for (const r of rows) {
    if (publishedFingerprint(r.text, r.assets ?? []) === fp) return { kind: "same_text_and_media", url: r.external_url, publishedAt: r.published_at };
    if (!textOnly && normalizeText(r.text) === norm) textOnly = { kind: "same_text_different_media", url: r.external_url, publishedAt: r.published_at };
  }
  return textOnly;
}

export function describeMatch(m: PublishedMatch): string {
  const where = m.url ? ` (${m.url})` : "";
  return m.kind === "same_text_and_media"
    ? `Already published${m.publishedAt ? ` on ${m.publishedAt.slice(0, 10)}` : ""}${where}. Do not publish again.`
    : `Same text was already published with different media${where}. Check before publishing; edit it or reject it.`;
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface ActionDetail {
  action: ActionRow;
  draft: DraftRow;
  current: VersionRow;
  versions: VersionRow[];
  approvals: ApprovalRow[];
  executions: ExecutionRow[];
  approvalValid: boolean;
}

export async function getAction(actionId: string): Promise<ActionDetail | null> {
  const action = await selectOne<ActionRow>("li_actions", [eq("id", actionId)]);
  if (!action) return null;
  const draft = await selectOne<DraftRow>("li_drafts", [eq("id", action.draft_id)]);
  if (!draft) return null;
  const versions = await select<VersionRow>("li_draft_versions", [eq("draft_id", draft.id)], { order: { col: "version", ascending: false } });
  const current = versions.find((v) => v.id === draft.current_version) ?? versions[0];
  const approvals = await select<ApprovalRow>("li_approvals", [eq("action_id", action.id)], { order: { col: "created_at", ascending: false } });
  const executions = await select<ExecutionRow>("li_executions", [eq("action_id", action.id)], { order: { col: "created_at", ascending: false } });
  return { action, draft, current, versions, approvals, executions, approvalValid: hasValidApproval(action, current, approvals) };
}

/**
 * True only when the latest decision is an approval of the current version, its hash
 * still matches, and the stored content still produces that hash (tamper check).
 */
export function hasValidApproval(action: ActionRow, current: VersionRow, approvals: ApprovalRow[]): boolean {
  if (!["approved", "executed", "verified"].includes(action.status)) return false;
  const latest = [...approvals].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest || latest.decision !== "approved") return false;
  if (latest.version_id !== current.id || latest.content_hash !== current.content_hash) return false;
  return contentHash(current) === current.content_hash;
}

export interface QueueItem {
  action: ActionRow;
  draft: DraftRow;
  current: VersionRow | null;
}

export async function listActions(statuses?: Status[]): Promise<QueueItem[]> {
  const actions = await selectAll<ActionRow>("li_actions", statuses?.length ? [inList("status", statuses)] : [], {
    order: { col: "updated_at", ascending: false },
  });
  if (!actions.length) return [];
  // Whole tables, paged: id lists in the URL would hit length limits as the queue grows.
  const drafts = await selectAll<DraftRow>("li_drafts", []);
  const byDraft = new Map(drafts.map((d) => [d.id, d]));
  const wanted = new Set(actions.map((a) => byDraft.get(a.draft_id)?.current_version).filter(Boolean));
  const versions = (await selectAll<VersionRow>("li_draft_versions", [])).filter((v) => wanted.has(v.id));
  const byVersion = new Map(versions.map((v) => [v.id, v]));
  return actions
    .map((action) => {
      const draft = byDraft.get(action.draft_id)!;
      return { action, draft, current: draft?.current_version ? byVersion.get(draft.current_version) ?? null : null };
    })
    .filter((i) => i.draft);
}

export async function statusCounts(): Promise<Record<Status, number>> {
  const rows = await selectAll<{ status: Status }>("li_actions", [], { columns: "status" });
  const counts = Object.fromEntries(
    ["draft", "ready_for_review", "approved", "executed", "verified", "rejected", "needs_revision", "failed", "blocked"].map((s) => [s, 0]),
  ) as Record<Status, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

// ── State changes ───────────────────────────────────────────────────────────

/**
 * Moves an action from `from` to `to` with a conditional update, so two requests racing
 * on the same item can't both succeed. Returns the updated row.
 */
export async function transition(action: ActionRow, to: Status, reason: string | null): Promise<ActionRow> {
  assertTransition(action.status, to);
  const [row] = await update<ActionRow>("li_actions", [eq("id", action.id), eq("status", action.status)], {
    status: to,
    status_reason: reason,
    updated_at: now(),
  });
  if (!row) throw new WorkflowError("This item changed in the meantime. Reload and try again.");
  return row;
}

export async function load(actionId: string): Promise<ActionDetail> {
  const detail = await getAction(actionId);
  if (!detail) throw new WorkflowError("Item not found.");
  return detail;
}

/**
 * Saves an edit as a new version. A material change (different hash) voids any approval
 * and sends the item back to review. Executed or verified items can't be edited.
 */
export async function addVersion(
  actionId: string,
  content: VersionContent,
  actor: string,
  note?: string,
): Promise<{ versionId: string; changed: boolean }> {
  const d = await load(actionId);
  if (["executed", "verified"].includes(d.action.status)) throw new WorkflowError("Published items can't be edited.");
  const hash = contentHash(content);
  if (hash === d.current.content_hash) return { versionId: d.current.id, changed: false };

  // Claim the status change first, with a conditional update. If the item moved meanwhile
  // (for example it was just recorded as published in another tab), nothing is written.
  const wasApproved = d.approvalValid;
  if (d.action.status !== "ready_for_review" && d.action.status !== "draft") {
    await transition(d.action, "ready_for_review", wasApproved ? "Edited after approval: approval voided" : "Edited");
  } else {
    const [still] = await update<ActionRow>("li_actions", [eq("id", actionId), eq("status", d.action.status)], { updated_at: now() });
    if (!still) throw new WorkflowError("This item changed in the meantime. Reload and try again.");
  }

  const versionId = crypto.randomUUID();
  await insert("li_draft_versions", {
    id: versionId,
    created_at: now(),
    draft_id: d.draft.id,
    version: Math.max(...d.versions.map((v) => v.version)) + 1,
    text: content.text,
    assets: content.assets,
    target_at: content.target_at,
    content_hash: hash,
    author: actor,
    change_note: note ?? null,
  });
  await update("li_drafts", [eq("id", d.draft.id)], { current_version: versionId });

  if (wasApproved) {
    await insert("li_approvals", {
      id: crypto.randomUUID(),
      created_at: now(),
      action_id: actionId,
      version_id: d.current.id,
      content_hash: d.current.content_hash,
      decision: "revoked",
      reason: "Content changed after approval",
      decided_by: "system",
    });
  }
  await audit(actor, "version.created", "li_actions", actionId, { versionId, approvalVoided: wasApproved });
  return { versionId, changed: true };
}

/**
 * Approves exactly the version the reviewer saw. The caller passes the hash shown on the
 * page; if the content changed since, the approval is refused.
 */
export async function approve(actionId: string, versionId: string, hash: string, actor: string) {
  const d = await load(actionId);
  if (d.action.status !== "ready_for_review") {
    throw new WorkflowError("Only items that are ready for review can be approved.");
  }
  if (versionId !== d.current.id || hash !== d.current.content_hash || contentHash(d.current) !== hash) {
    throw new WorkflowError("The content changed since you opened it. Review the latest version.");
  }
  // An approval includes the planned time, and the scheduler publishes at that time.
  // A time that has already passed would mean publishing at a moment nobody approved.
  if (d.current.target_at && new Date(d.current.target_at).getTime() < Date.now()) {
    throw new WorkflowError("The planned time has passed. Set a new time in Edit, then approve.");
  }
  const match = await findPublishedMatch(d.current.text, d.current.assets);
  if (match) throw new WorkflowError(describeMatch(match));
  await transition(d.action, "approved", null);
  await insert("li_approvals", {
    id: crypto.randomUUID(),
    created_at: now(),
    action_id: actionId,
    version_id: versionId,
    content_hash: hash,
    decision: "approved",
    reason: null,
    decided_by: actor,
  });
  await audit(actor, "action.approved", "li_actions", actionId, { versionId, hash });
}

export async function reject(actionId: string, reason: string, actor: string) {
  if (!reason.trim()) throw new WorkflowError("Give a short reason, so the system can learn from it.");
  const d = await load(actionId);
  await transition(d.action, "rejected", reason.trim());
  await insert("li_approvals", {
    id: crypto.randomUUID(),
    created_at: now(),
    action_id: actionId,
    version_id: d.current.id,
    content_hash: d.current.content_hash,
    decision: "rejected",
    reason: reason.trim(),
    decided_by: actor,
  });
  await audit(actor, "action.rejected", "li_actions", actionId, { reason: reason.trim() });
}

export async function requestRevision(actionId: string, reason: string, actor: string) {
  if (!reason.trim()) throw new WorkflowError("Say what should change.");
  const d = await load(actionId);
  await transition(d.action, "needs_revision", reason.trim());
  await insert("li_approvals", {
    id: crypto.randomUUID(),
    created_at: now(),
    action_id: actionId,
    version_id: d.current.id,
    content_hash: d.current.content_hash,
    decision: "needs_revision",
    reason: reason.trim(),
    decided_by: actor,
  });
  await audit(actor, "action.needs_revision", "li_actions", actionId, { reason: reason.trim() });
}

/** Sends a draft to the review queue. Only drafts; the text must not be empty. */
export async function submitForReview(actionId: string, actor: string) {
  const d = await load(actionId);
  if (d.action.status !== "draft") throw new WorkflowError("Only drafts can be submitted for review.");
  if (!d.current.text.trim()) throw new WorkflowError("Write the post before submitting it.");
  await transition(d.action, "ready_for_review", null);
  await audit(actor, "action.submitted", "li_actions", actionId, { version: d.current.version });
}

/** Returns a rejected, failed or revised item to the review queue without changing it. */
export async function reopen(actionId: string, actor: string) {
  const d = await load(actionId);
  await transition(d.action, "ready_for_review", "Reopened");
  await audit(actor, "action.reopened", "li_actions", actionId);
}

/**
 * Records that the owner published approved content by hand (the copy-and-open fallback
 * for actions LinkedIn's API doesn't allow this app to do). Refuses without a valid
 * approval, refuses a second execution, and refuses content already published elsewhere.
 */
export async function recordManualExecution(actionId: string, url: string, actor: string): Promise<ExecutionRow> {
  const d = await load(actionId);
  if (d.action.status !== "approved" || !d.approvalValid) {
    throw new WorkflowError("This item has no valid approval for its current content.");
  }
  if (!isLinkedInContentUrl(url)) throw new WorkflowError("Paste the link to the published LinkedIn post or comment.");

  const key = idempotencyKey(actionId, d.current.content_hash);
  if (await selectOne<ExecutionRow>("li_executions", [eq("idempotency_key", key)])) {
    throw new WorkflowError("This approved content has already been recorded as published.");
  }
  const sameContent = await select<ExecutionRow>("li_executions", [eq("content_hash", d.current.content_hash), eq("result", "executed")]);
  if (sameContent.some((e) => e.action_id !== actionId)) {
    throw new WorkflowError("The same content was already published by another item. This looks like a duplicate.");
  }
  const sameUrl = await select<ExecutionRow>("li_executions", [eq("external_url", url)]);
  if (sameUrl.some((e) => e.action_id !== actionId)) {
    throw new WorkflowError("That link is already recorded for another item.");
  }
  if (await selectOne("li_content", [eq("external_url", url)], { columns: "id" })) {
    throw new WorkflowError("That link belongs to a post already in your published history.");
  }
  const match = await findPublishedMatch(d.current.text, d.current.assets);
  if (match) throw new WorkflowError(describeMatch(match));

  // Claim the item first (approved -> executed, conditional). A concurrent edit or a second
  // click then fails cleanly instead of leaving an execution on an unapproved version.
  await transition(d.action, "executed", null);

  const row: ExecutionRow = {
    id: crypto.randomUUID(),
    created_at: now(),
    action_id: actionId,
    idempotency_key: key,
    content_hash: d.current.content_hash,
    channel: "manual",
    result: "executed",
    external_url: url,
    error: null,
    verified_at: null,
    verification: null,
  };
  try {
    await insert("li_executions", row as unknown as Record<string, unknown>);
  } catch (err) {
    // Never retried silently: the item is marked failed with a reason a person can act on.
    const reason = err instanceof StoreError ? "Recording the publication failed. Check LinkedIn before doing anything else." : "Unexpected error while recording.";
    await update("li_actions", [eq("id", actionId), eq("status", "executed")], { status: "failed", status_reason: reason, updated_at: now() });
    await audit(actor, "action.failed", "li_actions", actionId, { error: reason });
    throw new WorkflowError(reason);
  }
  // What the studio publishes joins the published history, so the same text and media, or the
  // same link, can never be approved or recorded again by another item.
  await insert("li_content", {
    id: crypto.randomUUID(),
    kind: d.draft.kind,
    text: d.current.text,
    language: /[\u0600-\u06FF]/.test(d.current.text) ? "ar" : "en",
    published_at: now(),
    external_url: url,
    source: "studio",
    source_id: actionId,
    published_via: "linkedin_manual",
    assets: d.current.assets,
  });
  await audit(actor, "action.executed", "li_actions", actionId, { channel: "manual", url });
  return row;
}

/**
 * Marks an executed item as verified. For manual execution the evidence is the owner's
 * confirmation that the linked post is live and matches; it is labelled as such.
 */
export async function verifyExecution(actionId: string, actor: string, method: string) {
  const d = await load(actionId);
  const exec = d.executions.find((e) => e.result === "executed" && !e.verified_at);
  if (d.action.status !== "executed" || !exec) throw new WorkflowError("Nothing to verify.");
  if (exec.content_hash !== d.current.content_hash || contentHash(d.current) !== d.current.content_hash) {
    throw new WorkflowError("The recorded publication doesn't match the current approved version. Mark it failed and check LinkedIn.");
  }
  await update("li_executions", [eq("id", exec.id)], { verified_at: now(), verification: method });
  await transition(d.action, "verified", null);
  await audit(actor, "action.verified", "li_actions", actionId, { method });
}

/** Stops an item that must not proceed, with the reason shown in the queue. */
export async function markBlocked(actionId: string, reason: string, actor: string) {
  const d = await load(actionId);
  await transition(d.action, "blocked", reason);
  await audit(actor, "action.blocked", "li_actions", actionId, { reason });
}

/** Records a failed execution or verification. It stays visible until a person reopens it. */
export async function markFailed(actionId: string, error: string, actor: string) {
  const d = await load(actionId);
  await transition(d.action, "failed", error);
  await audit(actor, "action.failed", "li_actions", actionId, { error });
}
