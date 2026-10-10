import "server-only";
/**
 * Publishing approved posts to LinkedIn through the official API (see linkedin.ts).
 *
 * Rules (each covered by studio.test.ts):
 * - Only an approved post whose approval still matches its current content is published.
 * - The item is claimed first (approved → executed, conditional update), so two runs can't
 *   both publish it, and an edit made meanwhile fails instead of slipping through.
 * - One execution per action and content hash (unique idempotency key).
 * - LinkedIn rejected it (definite): the item is marked failed and nothing was posted.
 * - No clear answer (unknown): the item stays "executed" with an unknown outcome and is
 *   never retried automatically. The owner checks LinkedIn and resolves it.
 * - Media is uploaded from the studio's verified copies only, checked by SHA-256 first.
 * - Automatic publishing needs three locks open: the global switch, the owner's per-post
 *   authorization, and the on-time window. A missed post is held, never published late
 *   (autopublish.ts).
 */
import { eq, insert, select, selectOne, update } from "@/lib/server/store";
import { type AssetRow, getObject } from "./assets";
import { authorizationsFor, autoPublishSwitch, holdMissed, isAutoAuthorized, timing } from "./autopublish";
import { LinkedInError, postingCredentials, postToLinkedIn, postUrl, type PostMedia, readBackPost } from "./linkedin";
import {
  audit,
  describeMatch,
  type ExecutionRow,
  findPublishedMatch,
  getAction,
  listActions,
  load,
  transition,
  verifyExecution,
} from "./repo";
import { idempotencyKey, isLinkedInContentUrl, normalizeText, WorkflowError } from "./workflow";
import { createHash } from "node:crypto";

const now = () => new Date().toISOString();

async function loadMedia(assets: { type: string; url: string; title?: string | null }[]): Promise<PostMedia | null> {
  if (!assets.length) return null;
  if (assets.length > 1) throw new WorkflowError("Posts with more than one file can't be published directly yet. Publish this one manually.");
  const a = assets[0];
  if (a.type !== "image" && a.type !== "document") throw new WorkflowError(`Unsupported file type "${a.type}". Publish this one manually.`);
  const row = await selectOne<AssetRow>("li_assets", [eq("original_url", a.url)]);
  if (!row?.verified_at || !row.storage_path || !row.sha256) throw new WorkflowError("The file isn't secured yet. Run Copy and verify media on the Import page first.");
  const bytes = await getObject(row.storage_path);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== row.sha256) {
    throw new WorkflowError("The secured copy of the file doesn't match its checksum. Nothing was posted.");
  }
  if (a.type === "document" && row.content_type !== "application/pdf") throw new WorkflowError("Document posts must be PDFs.");
  return { kind: a.type, bytes, title: a.title?.trim() || "Document" };
}

export interface PublishResult {
  url: string;
  verified: boolean;
}

/**
 * Publishes one approved post now. Throws WorkflowError with a message for the owner.
 * `f` is injectable for tests.
 */
export async function publishAction(
  actionId: string,
  actor: string,
  f: typeof fetch = fetch,
  opts: { mode?: "manual" | "auto"; now?: Date } = {},
): Promise<PublishResult> {
  const mode = opts.mode ?? "manual";
  const at = opts.now ?? new Date();
  const creds = await postingCredentials(at);
  if ("error" in creds) throw new WorkflowError(creds.error);
  const d = await load(actionId);
  if (d.action.status !== "approved" || !d.approvalValid) throw new WorkflowError("This item has no valid approval for its current content.");
  // Automatic runs re-check every lock here too, so no caller can skip them (see autopublish.ts).
  if (mode === "auto") {
    if (!(await autoPublishSwitch()).enabled) throw new WorkflowError("Automatic publishing is switched off.");
    if (!isAutoAuthorized(d, await authorizationsFor(actionId))) throw new WorkflowError("This post isn't authorized for automatic publishing.");
    if (timing(d.current.target_at!, at) !== "on_time") throw new WorkflowError("Outside its publishing window: never published early or late automatically.");
  }
  if (d.action.kind !== "publish_post") throw new WorkflowError("Only posts can be published directly. Use the manual step.");
  if (!d.current.text.trim() || d.current.text.length > 3000) throw new WorkflowError("The text must be 1 to 3,000 characters.");

  const key = idempotencyKey(actionId, d.current.content_hash);
  if (await selectOne<ExecutionRow>("li_executions", [eq("idempotency_key", key)])) {
    throw new WorkflowError("This approved content has already been published or is being published.");
  }
  const sameContent = await select<ExecutionRow>("li_executions", [eq("content_hash", d.current.content_hash), eq("result", "executed")]);
  if (sameContent.some((e) => e.action_id !== actionId)) throw new WorkflowError("The same content was already published by another item.");
  const match = await findPublishedMatch(d.current.text, d.current.assets);
  if (match) throw new WorkflowError(describeMatch(match));
  const media = await loadMedia(d.current.assets);

  // Claim it. A concurrent run or an edit in another tab now fails cleanly.
  await transition(d.action, "executed", "Publishing to LinkedIn…");
  const exec: ExecutionRow = {
    id: crypto.randomUUID(),
    created_at: now(),
    action_id: actionId,
    idempotency_key: key,
    content_hash: d.current.content_hash,
    channel: "linkedin_api",
    result: "unknown",
    external_url: null,
    error: null,
    verified_at: null,
    verification: null,
  };
  try {
    await insert("li_executions", exec as unknown as Record<string, unknown>);
  } catch {
    await update("li_actions", [eq("id", actionId), eq("status", "executed")], { status: "failed", status_reason: "Couldn't record the attempt, so nothing was sent to LinkedIn.", updated_at: now() });
    throw new WorkflowError("Couldn't record the attempt, so nothing was sent to LinkedIn.");
  }
  await update("li_actions", [eq("id", actionId)], { channel: "linkedin_api" });

  let urn: string;
  let sentCommentary: string;
  try {
    ({ urn, sentCommentary } = await postToLinkedIn({ ...creds, text: d.current.text, media }, f));
  } catch (err) {
    const e = err instanceof LinkedInError ? err : new LinkedInError("Unexpected error while publishing.", null, false);
    if (e.definite) {
      // Nothing was created: free the key so the same content can be approved and tried again.
      await update("li_executions", [eq("id", exec.id)], { result: "failed", error: e.message, idempotency_key: `${key}:failed:${exec.id}` });
      await update("li_actions", [eq("id", actionId), eq("status", "executed")], { status: "failed", status_reason: `${e.message} Nothing was posted.`, updated_at: now() });
      await audit(actor, "action.failed", "li_actions", actionId, { channel: "linkedin_api", error: e.message, status: e.status });
      throw new WorkflowError(`${e.message} Nothing was posted.`);
    }
    const reason = `${e.message} Check your LinkedIn profile, then tell the studio what you found.`;
    await update("li_executions", [eq("id", exec.id)], { error: e.message });
    await update("li_actions", [eq("id", actionId)], { status_reason: reason, updated_at: now() });
    await audit(actor, "action.outcome_unknown", "li_actions", actionId, { channel: "linkedin_api", error: e.message });
    throw new WorkflowError(reason);
  }

  const url = postUrl(urn);
  await update("li_executions", [eq("id", exec.id)], { result: "executed", external_url: url });
  await update("li_actions", [eq("id", actionId)], { status_reason: null, updated_at: now() });
  await insert("li_content", {
    id: crypto.randomUUID(),
    kind: d.draft.kind,
    text: d.current.text,
    language: /[؀-ۿ]/.test(d.current.text) ? "ar" : "en",
    published_at: now(),
    external_url: url,
    source: "studio",
    source_id: actionId,
    published_via: "linkedin_api",
    assets: d.current.assets,
  });
  await audit(actor, "action.executed", "li_actions", actionId, { channel: "linkedin_api", url });

  // Verified only on evidence: LinkedIn returns the post and its text is what was sent.
  const back = await readBackPost({ token: creds.token, apiVersion: creds.apiVersion, urn }, f);
  if (back && normalizeText(back.commentary) === normalizeText(sentCommentary)) {
    await verifyExecution(actionId, "system", "api: LinkedIn returned the post and its text matches the approved version");
    return { url, verified: true };
  }
  return { url, verified: false };
}

/**
 * The owner checked LinkedIn after an unknown outcome. Either the post is there (record its
 * link, then verify as usual) or it isn't (the attempt is closed as failed, nothing retried).
 */
export async function resolveUnknown(actionId: string, outcome: { url: string } | "not_published", actor: string) {
  const d = await load(actionId);
  const exec = d.executions.find((e) => e.result === "unknown");
  if (d.action.status !== "executed" || !exec) throw new WorkflowError("Nothing to resolve.");
  if (outcome === "not_published") {
    await update("li_executions", [eq("id", exec.id)], { result: "failed", idempotency_key: `${exec.idempotency_key}:failed:${exec.id}`, verification: "owner: not on LinkedIn" });
    await transition(d.action, "failed", "Not published (checked on LinkedIn by the owner).");
    await audit(actor, "action.failed", "li_actions", actionId, { resolved: "not_published" });
    return;
  }
  if (!isLinkedInContentUrl(outcome.url)) throw new WorkflowError("Paste the link to the post on LinkedIn.");
  if (await selectOne("li_content", [eq("external_url", outcome.url)], { columns: "id" })) throw new WorkflowError("That link belongs to a post already in your history.");
  await update("li_executions", [eq("id", exec.id)], { result: "executed", external_url: outcome.url });
  await update("li_actions", [eq("id", actionId)], { status_reason: null, updated_at: now() });
  await insert("li_content", {
    id: crypto.randomUUID(),
    kind: d.draft.kind,
    text: d.current.text,
    language: /[؀-ۿ]/.test(d.current.text) ? "ar" : "en",
    published_at: now(),
    external_url: outcome.url,
    source: "studio",
    source_id: actionId,
    published_via: "linkedin_api",
    assets: d.current.assets,
  });
  await audit(actor, "action.executed", "li_actions", actionId, { resolved: "published", url: outcome.url });
}

export interface DueReport {
  /** False when nothing could be published this run (switch off or LinkedIn not connected). */
  ran: boolean;
  reason?: string;
  switchOn: boolean;
  published: { actionId: string; url: string; verified: boolean }[];
  failed: { actionId: string; error: string }[];
  /** Authorized posts whose time passed unpublished: back in review, never published late. */
  held: string[];
  /** Authorized, planned time still ahead. */
  waiting: number;
  /** Approved but not authorized for automatic publishing (for example legacy approvals). Never touched. */
  notAuthorized: number;
}

/**
 * The scheduler run (/api/studio/publish-due, and the owner's "Run scheduler now" button).
 * Only posts the owner authorized for automatic publishing are considered; approved posts
 * without that authorization are left exactly as they are. Holding a missed post happens even
 * while the switch is off or LinkedIn is disconnected, so nothing can fire late once they
 * come back.
 */
export async function publishDue(actor: string, at = new Date(), f: typeof fetch = fetch): Promise<DueReport> {
  const sw = await autoPublishSwitch();
  const report: DueReport = { ran: false, switchOn: sw.enabled, published: [], failed: [], held: [], waiting: 0, notAuthorized: 0 };
  const items = (await listActions(["approved"])).filter((i) => i.current?.target_at && i.action.kind === "publish_post");
  items.sort((a, b) => a.current!.target_at!.localeCompare(b.current!.target_at!));

  const due: string[] = [];
  for (const { action } of items) {
    const d = await getAction(action.id);
    if (!d || !isAutoAuthorized(d, await authorizationsFor(action.id))) {
      report.notAuthorized++;
      continue;
    }
    const t = timing(d.current.target_at!, at);
    if (t === "early") report.waiting++;
    else if (t === "missed") {
      try {
        await holdMissed(action.id, actor, at);
        report.held.push(action.id);
      } catch (err) {
        report.failed.push({ actionId: action.id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    } else due.push(action.id);
  }

  if (!sw.enabled) report.reason = "Automatic publishing is switched off.";
  else {
    const creds = await postingCredentials(at);
    if ("error" in creds) report.reason = creds.error;
    else report.ran = true;
  }
  if (report.ran) {
    for (const id of due) {
      try {
        const r = await publishAction(id, actor, f, { mode: "auto", now: at });
        report.published.push({ actionId: id, ...r });
      } catch (err) {
        report.failed.push({ actionId: id, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  }
  if (report.published.length || report.failed.length || report.held.length) {
    await audit(actor, "scheduler.run", "li_actions", null, { published: report.published.length, failed: report.failed.length, held: report.held.length, switchOn: sw.enabled });
  }
  return report;
}
