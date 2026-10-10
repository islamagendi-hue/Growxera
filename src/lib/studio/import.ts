import "server-only";
/**
 * One-off import of the Buffer export saved on 10 Oct 2026 (content/buffer-snapshots/).
 * This reads a file. It does not call Buffer, and the studio has no Buffer integration.
 *
 * - Published posts become history (li_content) with their metrics as lifetime snapshots.
 * - Posts that were scheduled or drafted in Buffer become drafts in the approval queue,
 *   status "Ready for review" (or "Draft"), keeping their original text, assets and date.
 *   They are never approved by the import.
 * - A scheduled post whose text already appears in the published history is blocked as a
 *   likely duplicate (Buffer may have published it after the export).
 * - Re-importing the same file changes nothing (keyed on the Buffer post id).
 */
import { z } from "zod";
import { eq, insert, select, selectOne } from "@/lib/server/store";
import { audit, createDraft, markBlocked } from "./repo";

const metric = z.object({ type: z.string(), value: z.number() });
const asset = z.object({
  type: z.string(),
  source: z.string().url(),
  document: z.object({ title: z.string().nullish() }).nullish(),
});
const node = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/),
  status: z.enum(["draft", "needs_approval", "scheduled", "sending", "sent", "error"]),
  via: z.string().nullish(),
  dueAt: z.string().nullish(),
  sentAt: z.string().nullish(),
  externalLink: z.string().nullish(),
  text: z.string(),
  assets: z.array(asset).default([]),
  metadata: z.object({ firstComment: z.string().nullish() }).nullish(),
  metrics: z.array(metric).nullish(),
  metricsUpdatedAt: z.string().nullish(),
});
export const snapshotSchema = z.object({
  posts: z.object({ edges: z.array(z.object({ node })) }),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
type Node = z.infer<typeof node>;

export interface ImportSummary {
  history: { added: number; existing: number };
  metricSnapshots: number;
  queue: { added: number; existing: number; blockedAsDuplicate: number };
  skipped: { id: string; reason: string }[];
}

/** Text compared for duplicate detection: whitespace and case don't matter. */
export const normalizeText = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

const assetsOf = (n: Node) =>
  n.assets.map((a) => ({ type: a.type, url: a.source, title: a.document?.title ?? null }));

const metricValue = (n: Node, type: string) => n.metrics?.find((m) => m.type === type)?.value ?? null;

export async function importSnapshot(snapshot: Snapshot, actor: string): Promise<ImportSummary> {
  const summary: ImportSummary = {
    history: { added: 0, existing: 0 },
    metricSnapshots: 0,
    queue: { added: 0, existing: 0, blockedAsDuplicate: 0 },
    skipped: [],
  };
  const nodes = snapshot.posts.edges.map((e) => e.node);

  // 1. Published history first, so the queue can be checked against it.
  for (const n of nodes.filter((n) => n.status === "sent")) {
    let row = await selectOne<{ id: string }>("li_content", [eq("source", "buffer_export"), eq("source_id", n.id)], { columns: "id" });
    if (row) summary.history.existing++;
    else {
      row = { id: crypto.randomUUID() };
      await insert("li_content", {
        id: row.id,
        kind: "post",
        text: n.text,
        language: /[؀-ۿ]/.test(n.text) ? "ar" : "en",
        published_at: n.sentAt ?? n.dueAt ?? null,
        external_url: n.externalLink ?? null,
        source: "buffer_export",
        source_id: n.id,
        // "network" = you posted it natively on LinkedIn; "buffer" = published through Buffer.
        published_via: n.via === "network" ? "linkedin_native" : n.via ?? null,
        assets: assetsOf(n),
      });
      summary.history.added++;
    }
    if (n.metrics?.length && n.metricsUpdatedAt) {
      const exists = await selectOne("li_metrics_snapshots", [
        eq("content_id", row.id),
        eq("source", "buffer_export"),
        eq("measured_at", new Date(n.metricsUpdatedAt).toISOString()),
      ]);
      if (!exists) {
        await insert("li_metrics_snapshots", {
          id: crypto.randomUUID(),
          content_id: row.id,
          measured_at: new Date(n.metricsUpdatedAt).toISOString(),
          window_kind: "lifetime",
          source: "buffer_export",
          impressions: metricValue(n, "impressions"),
          reach: metricValue(n, "reach"),
          reactions: metricValue(n, "reactions"),
          comments: metricValue(n, "comments"),
          shares: metricValue(n, "shares"),
          engagement_rate: metricValue(n, "engagementRate"),
        });
        summary.metricSnapshots++;
      }
    }
  }

  // 1b. A post that was queued earlier and has since been published (by Buffer, after an
  // earlier export) must not be published again: block its queue item.
  for (const n of nodes.filter((n) => n.status === "sent")) {
    const draft = await selectOne<{ id: string }>("li_drafts", [eq("origin", "migrated_buffer"), eq("origin_ref", n.id)], { columns: "id" });
    if (!draft) continue;
    const action = await selectOne<{ id: string; status: string }>("li_actions", [eq("draft_id", draft.id)], { columns: "id,status" });
    if (action && ["draft", "ready_for_review", "approved"].includes(action.status)) {
      await markBlocked(
        action.id,
        `Already published by Buffer on ${n.sentAt ?? n.dueAt ?? "an unknown date"}${n.externalLink ? ` (${n.externalLink})` : ""}. Do not publish again.`,
        "system",
      );
      summary.queue.blockedAsDuplicate++;
    }
  }

  // 2. Unpublished posts go to the approval queue, unapproved.
  const published = new Set(
    (await select<{ text: string }>("li_content", [], { columns: "text" })).map((r) => normalizeText(r.text)),
  );
  for (const n of nodes.filter((n) => n.status !== "sent")) {
    if (n.status === "sending") {
      summary.skipped.push({ id: n.id, reason: "Was being published at export time; check LinkedIn and re-export." });
      continue;
    }
    const firstComment = n.metadata?.firstComment;
    const { actionId, created } = await createDraft({
      kind: "post",
      actionKind: "publish_post",
      // Direct LinkedIn publishing is not verified for this app yet, so execution is manual.
      channel: "manual",
      content: { text: n.text, assets: assetsOf(n), target_at: n.dueAt ?? null },
      origin: "migrated_buffer",
      originRef: n.id,
      originalDueAt: n.dueAt ?? null,
      notes:
        `Migrated from the Buffer export of 10 Oct 2026. Buffer status at export: ${n.status}.` +
        (firstComment ? ` Buffer first comment (not migrated as content): ${firstComment}` : ""),
      status: n.status === "draft" ? "draft" : "ready_for_review",
      author: actor,
    });
    if (!created) {
      summary.queue.existing++;
      continue;
    }
    summary.queue.added++;
    if (published.has(normalizeText(n.text)) && n.status !== "draft") {
      await markBlocked(actionId, "Same text already appears in your published history. Check LinkedIn before publishing.", "system");
      summary.queue.blockedAsDuplicate++;
    }
  }

  await audit(actor, "import.buffer_snapshot", "li_content", null, summary);
  return summary;
}
