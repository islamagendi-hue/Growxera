"use server";
/**
 * Studio server actions. Each one re-checks that the owner is signed in (server actions
 * are reachable by direct POST), validates input, and goes through repo.ts so the
 * workflow rules and audit log always apply.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyGrok } from "@/lib/studio/grok";
import { importSnapshot, snapshotSchema } from "@/lib/studio/import";
import { ownerOrThrow } from "@/lib/studio/owner";
import {
  addVersion,
  approve,
  getAction,
  markFailed,
  recordManualExecution,
  reject,
  reopen,
  requestRevision,
  verifyExecution,
} from "@/lib/studio/repo";
import { fromRiyadhInput } from "@/lib/studio/time";
import { WorkflowError } from "@/lib/studio/workflow";

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
      console.error("[studio] action failed", err instanceof Error ? err.message : "unknown");
      error = "Something went wrong. Nothing was changed.";
    }
  }
  revalidatePath("/studio", "layout");
  const q = error ? `error=${encodeURIComponent(error)}` : `notice=${encodeURIComponent(notice)}`;
  redirect(`/studio/queue/${actionId}?${q}`);
}

export async function approveAction(form: FormData) {
  const id = str(form, "actionId");
  await run(id, (actor) => approve(id, str(form, "versionId"), str(form, "hash"), actor), "Approved. It will not be published until you complete the next step.");
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

export async function editAction(form: FormData) {
  const id = str(form, "actionId");
  const text = String(form.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  const target = str(form, "target_at");
  await run(
    id,
    async (actor) => {
      if (!text) throw new WorkflowError("The text can't be empty.");
      if (text.length > 3000) throw new WorkflowError("LinkedIn posts are limited to 3,000 characters.");
      const d = await getAction(id);
      if (!d) throw new WorkflowError("Item not found.");
      const target_at = target ? fromRiyadhInput(target) : null;
      const { changed } = await addVersion(id, { text, assets: d.current.assets, target_at }, actor, str(form, "note") || "Edited in studio");
      if (!changed) throw new WorkflowError("No changes to save.");
    },
    "Saved as a new version. Any earlier approval no longer applies.",
  );
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
      `Imported. History: ${s.history.added} new, ${s.history.existing} already there. ` +
        `Metric snapshots: ${s.metricSnapshots}. Queue: ${s.queue.added} new, ${s.queue.existing} already there, ` +
        `${s.queue.blockedAsDuplicate} blocked as likely duplicates. Skipped: ${s.skipped.length}.`,
    )}`;
  } catch (err) {
    const message = err instanceof WorkflowError ? err.message : err instanceof SyntaxError ? "The file isn't valid JSON." : "Import failed. Nothing partial is hidden: re-running the import is safe.";
    if (!(err instanceof WorkflowError) && !(err instanceof SyntaxError)) console.error("[studio] import failed", err instanceof Error ? err.message : "unknown");
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
