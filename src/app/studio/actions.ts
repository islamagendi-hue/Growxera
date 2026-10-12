"use server";
/**
 * Studio server actions. Each one re-checks that the owner is signed in (server actions
 * are reachable by direct POST), validates input, and goes through repo.ts so the
 * workflow rules and audit log always apply.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { secureAssets, uploadAsset, UploadError, type UploadedAsset } from "@/lib/studio/assets";
import { designText, isDesignFormat, renderDesign } from "@/lib/studio/design";
import { GrokUnavailableError, verifyGrok } from "@/lib/studio/grok";
import { addTopic, removeTopic, writeDraft, writeTopic, type WriteFormat } from "@/lib/studio/writer";
import { importSnapshot, snapshotSchema } from "@/lib/studio/import";
import { authorizeAutoPublish, revokeAutoPublish, setAutoPublish, setPublishing } from "@/lib/studio/autopublish";
import { validateExport } from "@/lib/studio/export";
import { disconnect, isValidClientId, isValidClientSecret, saveAppKeys } from "@/lib/studio/linkedin";
import { publishAction, publishDue, resolveUnknown } from "@/lib/studio/publish";
import { ownerOrThrow } from "@/lib/studio/owner";
import {
  addVersion,
  approve,
  audit,
  createDraft,
  getAction,
  markFailed,
  recordManualExecution,
  reject,
  reopen,
  requestRevision,
  submitForReview,
  verifyExecution,
} from "@/lib/studio/repo";
import { fromRiyadhInput, isPast } from "@/lib/studio/time";
import { WorkflowError } from "@/lib/studio/workflow";

/** Log line without the database's response body, which can contain post text or emails. */
const safeLog = (err: unknown) =>
  err instanceof Error ? (err.message.match(/^(\w+ li_\w+ failed: \d+)/)?.[1] ?? err.name) : "unknown";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function run(actionId: string, fn: (actor: string) => Promise<unknown>, notice: string): Promise<never> {
  const owner = await ownerOrThrow();
  if (!isUuid(actionId)) redirect("/studio/queue");
  let error: string | null = null;
  try {
    await fn(owner.email);
  } catch (err) {
    if (err instanceof WorkflowError) error = err.message;
    else {
      console.error("[studio] action failed", safeLog(err));
      error = "Something went wrong. Nothing was changed.";
    }
  }
  revalidatePath("/studio", "layout");
  const q = error ? `error=${encodeURIComponent(error)}` : `notice=${encodeURIComponent(notice)}`;
  redirect(`/studio/queue/${actionId}?${q}`);
}

export async function approveAction(form: FormData) {
  const id = str(form, "actionId");
  await run(
    id,
    (actor) => approve(id, str(form, "versionId"), str(form, "hash"), actor),
    "Approved. Nothing is published automatically unless you also schedule it for automatic publishing below.",
  );
}

export async function authorizeAutoPublishAction(form: FormData) {
  const id = str(form, "actionId");
  await run(
    id,
    (actor) => {
      if (form.get("confirm") !== "yes") throw new WorkflowError("Tick the box to confirm automatic publishing of this exact version and time.");
      return authorizeAutoPublish(id, str(form, "versionId"), str(form, "hash"), actor);
    },
    "Confirmed for automatic publishing. It can go out at its planned time only while both all publishing and automatic publishing are ON; otherwise it is held. Any edit cancels it.",
  );
}

export async function revokeAutoPublishAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => revokeAutoPublish(id, actor, "Cancelled by the owner"), "Automatic publishing cancelled. The approval of the content stays.");
}

export async function setAutoPublishAction(form: FormData) {
  const owner = await ownerOrThrow();
  const enable = str(form, "enabled") === "true";
  let q: string;
  try {
    if (enable && form.get("confirm") !== "yes") throw new WorkflowError("Tick the box to confirm switching automatic publishing on.");
    await setAutoPublish(enable, owner.email);
    q = `notice=${encodeURIComponent(enable ? "Automatic publishing is ON. Only posts you confirmed one by one can go out, and only while all publishing is also ON." : "Automatic publishing is OFF. Nothing is published automatically.")}`;
  } catch (err) {
    q = `error=${encodeURIComponent(err instanceof WorkflowError ? err.message : "Changing the switch failed. Nothing changed.")}`;
    if (!(err instanceof WorkflowError)) console.error("[studio] switch failed", safeLog(err));
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/capabilities?${q}#autopublish`);
}

export async function setPublishingAction(form: FormData) {
  const owner = await ownerOrThrow();
  const enable = str(form, "enabled") === "true";
  let q: string;
  try {
    if (enable && form.get("confirm") !== "yes") throw new WorkflowError("Tick the box to confirm switching publishing on.");
    await setPublishing(enable, owner.email);
    q = `notice=${encodeURIComponent(enable ? "All publishing is ON. Each post still needs its approval and your confirmation." : "All publishing is OFF. Nothing can be posted to LinkedIn.")}`;
  } catch (err) {
    q = `error=${encodeURIComponent(err instanceof WorkflowError ? err.message : "Changing the switch failed. Nothing changed.")}`;
    if (!(err instanceof WorkflowError)) console.error("[studio] publishing switch failed", safeLog(err));
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/capabilities?${q}#publishing`);
}

export async function rejectAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => reject(id, str(form, "reason"), actor), "Rejected. Your reason was recorded.");
}

export async function reviseAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => requestRevision(id, str(form, "reason"), actor), "Marked as needing revision.");
}

export async function reopenAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => reopen(id, actor), "Back in the review queue.");
}

// ── Writing ─────────────────────────────────────────────────────────────────

export interface NewPostState {
  error: string | null;
  text: string;
  target: string;
  note: string;
}

/** Creates a post written in the studio, as a draft or straight into review. Never publishes. */
export async function createPostAction(_prev: NewPostState, form: FormData): Promise<NewPostState> {
  const owner = await ownerOrThrow();
  const text = String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  const target = str(form, "target_at");
  const note = str(form, "note").slice(0, 300);
  const keep = { text, target, note };
  let actionId: string;
  try {
    if (!text) throw new WorkflowError("Write the post first.");
    if (text.length > 3000) throw new WorkflowError("LinkedIn posts are limited to 3,000 characters.");
    const target_at = target ? fromRiyadhInput(target) : null;
    if (target_at && isPast(target_at)) throw new WorkflowError("That planned time has already passed. Pick a future time or leave it empty.");
    const file = await attachment(form, owner.email);
    ({ actionId } = await createDraft({
      kind: "post",
      actionKind: "publish_post",
      channel: "manual",
      origin: "studio",
      author: owner.email,
      notes: note || null,
      status: str(form, "intent") === "draft" ? "draft" : "ready_for_review",
      content: { text, assets: file ? [file] : [], target_at },
    }));
  } catch (err) {
    if (err instanceof WorkflowError) return { error: err.message, ...keep };
    if (err instanceof UploadError) return { error: `${err.message} Choose the file again.`, ...keep };
    console.error("[studio] create post failed", safeLog(err));
    return { error: "Saving failed. Nothing was saved; try again.", ...keep };
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/queue/${actionId}?notice=${encodeURIComponent(str(form, "intent") === "draft" ? "Saved as a draft." : "Submitted for review.")}`);
}

/** The uploaded file in a form ("file", optional "file_title"), stored and verified; null when none was chosen. */
async function attachment(form: FormData, actor: string): Promise<UploadedAsset | null> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return uploadAsset(new Uint8Array(await file.arrayBuffer()), str(form, "file_title") || null, actor);
}

export async function submitForReviewAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => submitForReview(id, actor), "Submitted for review.");
}

export async function editAction(form: FormData) {
  const id = str(form, "actionId");
  const text = String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  const target = str(form, "target_at");
  await run(
    id,
    async (actor) => {
      if (!text) throw new WorkflowError("The text can't be empty.");
      const d = await getAction(id);
      if (!d) throw new WorkflowError("Item not found.");
      const limit = d.action.kind === "publish_newsletter" ? 12000 : 3000;
      if (text.length > limit) throw new WorkflowError(`This is limited to ${limit.toLocaleString("en")} characters.`);
      const target_at = target ? fromRiyadhInput(target) : null;
      let assets = d.current.assets;
      try {
        const file = await attachment(form, actor);
        if (file) assets = [file];
        else if (form.get("remove_file") === "yes") assets = [];
      } catch (err) {
        if (err instanceof UploadError) throw new WorkflowError(err.message);
        throw err;
      }
      const { changed } = await addVersion(id, { text, assets, target_at }, actor, str(form, "note") || "Edited in studio");
      if (!changed) throw new WorkflowError("No changes to save.");
    },
    "Saved as a new version. Any earlier approval no longer applies.",
  );
}

/** Renders the post's design with the owner's lines and attaches it as the post's image (a new version). */
export async function attachDesignAction(form: FormData) {
  const id = str(form, "actionId");
  await run(
    id,
    async (actor) => {
      const d = await getAction(id);
      if (!d) throw new WorkflowError("Item not found.");
      const format = str(form, "format");
      const t = designText(d.current.text, { eyebrow: str(form, "eyebrow"), lineA: str(form, "a"), lineB: str(form, "b"), footer: str(form, "footer") });
      if (!t.lineA) throw new WorkflowError("The first line can't be empty.");
      const png = new Uint8Array(await (await renderDesign(t, isDesignFormat(format) ? format : "square")).arrayBuffer());
      const file = await uploadAsset(png, `Design: ${t.lineA}`.slice(0, 200), actor);
      const { changed } = await addVersion(id, { text: d.current.text, assets: [file], target_at: d.current.target_at }, actor, "Design attached in studio");
      if (!changed) throw new WorkflowError("That design is already attached.");
    },
    "Design attached as a new version. Approve it again before it can be published.",
  );
}

// ── Topics and Grok writing ─────────────────────────────────────────────────

const writeFormat = (f: FormData): WriteFormat => (str(f, "format") === "newsletter" ? "newsletter" : "post");

/** Redirects to the topics page with a notice or an error; Grok and workflow errors are shown as they are. */
async function topics(fn: (actor: string) => Promise<string | void>, notice: string): Promise<never> {
  const owner = await ownerOrThrow();
  let q: string;
  let target = "/studio/topics";
  try {
    const next = await fn(owner.email);
    if (next) target = next;
    q = `notice=${encodeURIComponent(notice)}`;
  } catch (err) {
    if (err instanceof WorkflowError || err instanceof GrokUnavailableError) q = `error=${encodeURIComponent(err.message)}`;
    else {
      console.error("[studio] topics action failed", safeLog(err));
      q = `error=${encodeURIComponent("Something went wrong. Nothing was saved.")}`;
    }
    target = "/studio/topics";
  }
  revalidatePath("/studio", "layout");
  redirect(`${target}?${q}`);
}

export async function addTopicAction(form: FormData) {
  await topics(async (actor) => {
    await addTopic({ text: str(form, "topic"), angle: str(form, "angle"), format: writeFormat(form) }, actor);
  }, "Topic added.");
}

export async function removeTopicAction(form: FormData) {
  await topics((actor) => removeTopic(str(form, "topicId"), actor), "Topic removed.");
}

/** Writes a draft with Grok, from a saved topic or straight from the form. Never publishes. */
export async function writeWithGrokAction(form: FormData) {
  await topics(async (actor) => {
    const id = str(form, "topicId");
    const r = id ? await writeTopic(id, actor) : await writeDraft({ topic: str(form, "topic"), angle: str(form, "angle"), format: writeFormat(form) }, actor);
    return `/studio/queue/${r.actionId}`;
  }, "Draft written by Grok. Review and edit it, then submit it for review. Nothing is published.");
}

export async function recordPublishedAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => recordManualExecution(id, str(form, "url"), actor), "Recorded as published. Confirm it is live to verify.");
}

export async function verifyAction(form: FormData) {
  const id = str(form, "actionId");
  await run(
    id,
    (actor) => {
      if (form.get("confirm") !== "yes") throw new WorkflowError("Tick the box to confirm you checked the live post.");
      return verifyExecution(id, actor, "manual: owner opened the link and confirmed the live post matches the approved version");
    },
    "Verified.",
  );
}

export async function failedAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => markFailed(id, str(form, "reason") || "Publishing failed", actor), "Marked as failed.");
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function importAction(form: FormData) {
  const owner = await ownerOrThrow();
  const file = form.get("file");
  let q: string;
  try {
    if (!(file instanceof File) || file.size === 0) throw new WorkflowError("Choose a snapshot file.");
    if (file.size > MAX_IMPORT_BYTES) throw new WorkflowError("That file is larger than 5 MB.");
    const parsed = snapshotSchema.safeParse(JSON.parse(await file.text()));
    if (!parsed.success) throw new WorkflowError("This isn't a Buffer snapshot file from content/buffer-snapshots/.");
    const s = await importSnapshot(parsed.data, owner.email);
    q = `notice=${encodeURIComponent(
      `Imported ${file.name}: ${s.records} records. History ${s.history.added} new / ${s.history.existing} already there; ` +
        `${s.metricSnapshots} metric snapshots; queue ${s.queue.added} new / ${s.queue.existing} already there; ` +
        `${s.queue.blockedAsDuplicate} blocked as published or duplicate; ${s.invalid} invalid; ${s.errors} errors; ${s.skipped.length} skipped. ` +
        `Full reconciliation below.`,
    )}`;
  } catch (err) {
    const message = err instanceof WorkflowError ? err.message : err instanceof SyntaxError ? "The file isn't valid JSON." : "Import failed. Nothing partial is hidden: re-running the import is safe.";
    if (!(err instanceof WorkflowError) && !(err instanceof SyntaxError)) console.error("[studio] import failed", safeLog(err));
    q = `error=${encodeURIComponent(message)}`;
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/import?${q}`);
}

export async function checkGrokAction() {
  await ownerOrThrow();
  const r = await verifyGrok();
  redirect(`/studio/capabilities?${r.ok ? "notice" : "error"}=${encodeURIComponent(r.message)}#grok`);
}

export async function secureAssetsAction() {
  const owner = await ownerOrThrow();
  let q: string;
  try {
    const r = await secureAssets(owner.email);
    const msg = `Media: ${r.referenced} referenced, ${r.alreadySecured} already secured, ${r.copied} copied and verified, ${r.failed.length} failed.`;
    q = r.failed.length ? `error=${encodeURIComponent(msg + " Failed files are listed below; run again to retry.")}` : `notice=${encodeURIComponent(msg)}`;
  } catch (err) {
    console.error("[studio] secure assets failed", safeLog(err));
    q = `error=${encodeURIComponent("Copying media failed. Nothing was deleted; run it again.")}`;
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/import?${q}#media`);
}

// ── LinkedIn direct publishing ──────────────────────────────────────────────

export async function publishNowAction(form: FormData) {
  const id = str(form, "actionId");
  await run(
    id,
    async (actor) => {
      if (form.get("confirm") !== "yes") throw new WorkflowError("Tick the box to confirm you want to post it now.");
      await publishAction(id, actor);
    },
    "Posted to LinkedIn. See the result below.",
  );
}

export async function resolveUnknownAction(form: FormData) {
  const id = str(form, "actionId");
  const notPublished = str(form, "found") === "not_published";
  await run(
    id,
    (actor) => resolveUnknown(id, notPublished ? "not_published" : { url: str(form, "url") }, actor),
    notPublished ? "Recorded as not published. Return it to review to try again." : "Recorded. Confirm it is live to verify.",
  );
}

export async function publishDueNowAction() {
  const owner = await ownerOrThrow();
  let q: string;
  try {
    const r = await publishDue(owner.email);
    const summary =
      `Scheduler: ${r.published.length} posted, ${r.failed.length} failed, ${r.held.length} held (missed time), ` +
      `${r.waiting} scheduled for later, ${r.notAuthorized} approved but not scheduled for automatic publishing.`;
    q = r.ran ? `notice=${encodeURIComponent(summary)}` : `error=${encodeURIComponent(`${r.reason ?? "Not running."} ${summary}`)}`;
  } catch (err) {
    console.error("[studio] publish due failed", safeLog(err));
    q = `error=${encodeURIComponent("Publishing due posts failed. Check the queue before trying again.")}`;
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/queue?${q}`);
}

export async function saveLinkedInKeysAction(form: FormData) {
  const owner = await ownerOrThrow();
  const clientId = str(form, "clientId");
  const clientSecret = str(form, "clientSecret");
  let q: string;
  if (!isValidClientId(clientId)) q = `error=${encodeURIComponent("That doesn't look like a LinkedIn Client ID (letters and numbers only).")}`;
  else if (!isValidClientSecret(clientSecret)) q = `error=${encodeURIComponent("That doesn't look like a LinkedIn Client Secret.")}`;
  else {
    try {
      await saveAppKeys(clientId, clientSecret);
      await audit(owner.email, "linkedin.app_keys_saved", "li_linkedin_app", null, { clientId });
      q = `notice=${encodeURIComponent("LinkedIn app keys saved (the secret is stored encrypted). Now click Connect LinkedIn.")}`;
    } catch (err) {
      console.error("[studio] saving LinkedIn keys failed", safeLog(err));
      q = `error=${encodeURIComponent("Saving the keys failed. Nothing was saved.")}`;
    }
  }
  revalidatePath("/studio", "layout");
  redirect(`/studio/capabilities?${q}#linkedin`);
}

export async function disconnectLinkedInAction() {
  const owner = await ownerOrThrow();
  const done = await disconnect();
  if (done) await audit(owner.email, "linkedin.disconnected", "li_linkedin_connection", null);
  revalidatePath("/studio", "layout");
  redirect(`/studio/capabilities?notice=${encodeURIComponent(done ? "Disconnected. The studio no longer holds a LinkedIn token." : "Nothing was connected.")}#linkedin`);
}

const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

/** Checks an export file the owner kept. Reads it only; nothing is imported or stored. */
export async function validateExportAction(form: FormData) {
  await ownerOrThrow();
  const file = form.get("file");
  let q: string;
  try {
    if (!(file instanceof File) || file.size === 0) throw new WorkflowError("Choose an export file.");
    if (file.size > MAX_EXPORT_BYTES) throw new WorkflowError("That file is larger than 50 MB.");
    const r = validateExport(JSON.parse(await file.text()));
    const counts = Object.entries(r.counts).map(([t, n]) => `${t} ${n}`).join(", ");
    q = r.ok
      ? `notice=${encodeURIComponent(`${file.name} is complete and unchanged. Rows: ${counts}.`)}`
      : `error=${encodeURIComponent(`${file.name} failed the check: ${r.errors.slice(0, 5).join(" ")}`)}`;
  } catch (err) {
    q = `error=${encodeURIComponent(err instanceof WorkflowError ? err.message : err instanceof SyntaxError ? "The file isn't valid JSON." : "Checking failed.")}`;
  }
  redirect(`/studio/export?${q}`);
}
