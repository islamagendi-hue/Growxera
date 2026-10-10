import "server-only";
/**
 * One-off import of the read-only Buffer export (10 Oct 2026). This reads files the owner
 * uploads. It does not call Buffer, and the studio has no Buffer integration.
 *
 * Rules
 * - Published posts become history (li_content) with their metrics as lifetime snapshots.
 * - Unpublished posts become queue items, unapproved ("Ready for review", or "Draft").
 * - A queue item is blocked, never publishable, when it matches published history:
 *     1. same Buffer post id now published (certain),
 *     2. same text AND same media (duplicate), or same text with different media
 *        (possible duplicate: blocked with a different reason, for a person to check).
 *   Approval and recording also refuse content or links found in published history.
 * - Each record is validated on its own. Invalid or conflicting records are listed in the
 *   reconciliation report, never silently dropped.
 * - Safe to re-run: keyed on the Buffer post id; an interrupted import is completed on retry.
 */
import { z } from "zod";
import { eq, insert, selectOne } from "@/lib/server/store";
import { audit, createDraft, describeMatch, findPublishedMatch, markBlocked, reject } from "./repo";

const metric = z.object({ type: z.string(), value: z.number() });
const asset = z.object({
  type: z.enum(["image", "video", "document"]),
  source: z.string().url().startsWith("https://"),
  document: z.object({ title: z.string().nullish() }).nullish(),
});
const node = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/),
  status: z.enum(["draft", "needs_approval", "scheduled", "sending", "sent", "error"]),
  via: z.string().nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  sentAt: z.string().datetime({ offset: true }).nullish(),
  externalLink: z.string().url().nullish(),
  text: z.string().min(1).max(3000),
  assets: z.array(asset).default([]),
  metadata: z.object({ firstComment: z.string().nullish() }).nullish(),
  metrics: z.array(metric).nullish(),
  metricsUpdatedAt: z.string().nullish(),
});
type Node = z.infer<typeof node>;

const edgesShape = z.object({ edges: z.array(z.object({ node: z.unknown() })) });
/** File shape: { posts: { edges: [{ node }] } }, or wrapped in { data } (re-export files). */
export const snapshotSchema = z
  .object({ posts: edgesShape.optional(), data: z.object({ posts: edgesShape }).optional() })
  .refine((v) => v.posts || v.data, "No posts in this file.");
export type Snapshot = z.infer<typeof snapshotSchema>;

export type Outcome =
  | "history_added"
  | "history_existing"
  | "queue_added"
  | "queue_existing"
  | "blocked_published_by_source"
  | "blocked_duplicate"
  | "blocked_possible_duplicate"
  | "conflict_published_twice"
  | "error"
  | "skipped_in_flight"
  | "invalid";

export interface RecordResult {
  sourceId: string | null;
  outcome: Outcome;
  detail?: string;
}

export interface ImportSummary {
  records: number;
  history: { added: number; existing: number };
  metricSnapshots: number;
  queue: { added: number; existing: number; blockedAsDuplicate: number };
  invalid: number;
  errors: number;
  skipped: { id: string; reason: string }[];
  results: RecordResult[];
}

/** Reports a failed record without the database's response body (it can contain row data). */
function recordError(summary: ImportSummary, sourceId: string, err: unknown) {
  summary.errors++;
  const msg = err instanceof Error ? err.message : "Unknown error";
  const safe = msg.match(/^(\w+ li_\w+ failed: \d+)/)?.[1] ?? (err instanceof Error && !(err.name === "StoreError") ? msg.slice(0, 120) : "Database error");
  summary.results.push({ sourceId, outcome: "error", detail: `${safe}. Nothing else was skipped; re-run the import to retry this record.` });
}

const assetsOf = (n: Node) => n.assets.map((a) => ({ type: a.type, url: a.source, title: a.document?.title ?? null }));
const metricValue = (n: Node, type: string) => n.metrics?.find((m) => m.type === type)?.value ?? null;

export async function importSnapshot(snapshot: Snapshot, actor: string): Promise<ImportSummary> {
  const edges = snapshot.posts?.edges ?? snapshot.data?.posts.edges ?? [];
  const summary: ImportSummary = {
    records: edges.length,
    history: { added: 0, existing: 0 },
    metricSnapshots: 0,
    queue: { added: 0, existing: 0, blockedAsDuplicate: 0 },
    invalid: 0,
    errors: 0,
    skipped: [],
    results: [],
  };

  // Validate every record first; invalid ones are reported, valid ones continue.
  const nodes: Node[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const raw = e.node as { id?: unknown } | null;
    const rawId = typeof raw?.id === "string" ? raw.id.slice(0, 40) : null;
    const parsed = node.safeParse(e.node);
    if (!parsed.success) {
      summary.invalid++;
      summary.results.push({
        sourceId: rawId,
        outcome: "invalid",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300),
      });
      continue;
    }
    if (seen.has(parsed.data.id)) {
      summary.invalid++;
      summary.results.push({ sourceId: parsed.data.id, outcome: "invalid", detail: "Same post id appears twice in this file." });
      continue;
    }
    seen.add(parsed.data.id);
    nodes.push(parsed.data);
  }

  // 1. Published history. Each record is isolated: a failure is reported and the rest continue.
  for (const n of nodes.filter((n) => n.status === "sent")) {
    try {
      let row = await selectOne<{ id: string }>("li_content", [eq("source", "buffer_export"), eq("source_id", n.id)], { columns: "id" });
      if (row) {
        summary.history.existing++;
        summary.results.push({ sourceId: n.id, outcome: "history_existing" });
      } else {
        row = { id: crypto.randomUUID() };
        await insert("li_content", {
          id: row.id,
          kind: "post",
          text: n.text,
          language: /[\u0600-\u06FF]/.test(n.text) ? "ar" : "en",
          published_at: n.sentAt ?? n.dueAt ?? null,
          external_url: n.externalLink ?? null,
          source: "buffer_export",
          source_id: n.id,
          // "network" = posted natively on LinkedIn; "buffer" = published through Buffer.
          published_via: n.via === "network" ? "linkedin_native" : n.via ?? null,
          assets: assetsOf(n),
        });
        summary.history.added++;
        summary.results.push({ sourceId: n.id, outcome: "history_added" });
      }
      if (n.metrics?.length && n.metricsUpdatedAt) {
        const measuredAt = new Date(n.metricsUpdatedAt).toISOString();
        const exists = await selectOne("li_metrics_snapshots", [eq("content_id", row.id), eq("source", "buffer_export"), eq("measured_at", measuredAt)]);
        if (!exists) {
          await insert("li_metrics_snapshots", {
            id: crypto.randomUUID(),
            content_id: row.id,
            measured_at: measuredAt,
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

      // A queue item for this same Buffer post (from an earlier import) must never be published again.
      const draft = await selectOne<{ id: string }>("li_drafts", [eq("origin", "migrated_buffer"), eq("origin_ref", n.id)], { columns: "id" });
      if (draft) {
        const action = await selectOne<{ id: string; status: string }>("li_actions", [eq("draft_id", draft.id)], { columns: "id,status" });
        if (action && ["draft", "ready_for_review", "approved", "needs_revision", "failed"].includes(action.status)) {
          if (action.status === "needs_revision" || action.status === "failed") {
            // These can't move to blocked directly; reject instead, with the same reason.
            await reject(action.id, `Already published by Buffer${n.externalLink ? ` (${n.externalLink})` : ""}.`, "system");
          } else {
            await markBlocked(
              action.id,
              `Already published by Buffer on ${n.sentAt ?? n.dueAt ?? "an unknown date"}${n.externalLink ? ` (${n.externalLink})` : ""}. Do not publish again.`,
              "system",
            );
          }
          summary.queue.blockedAsDuplicate++;
          summary.results.push({ sourceId: n.id, outcome: "blocked_published_by_source", detail: "Queue item from an earlier import was published by Buffer." });
        } else if (action && ["executed", "verified"].includes(action.status)) {
          summary.results.push({
            sourceId: n.id,
            outcome: "conflict_published_twice",
            detail: "Recorded as published in the studio AND published by Buffer. Check LinkedIn for a duplicate post.",
          });
        }
      }
    } catch (err) {
      recordError(summary, n.id, err);
    }
  }

  // 2. Unpublished posts: queue, unapproved; blocked if they match published history.
  for (const n of nodes.filter((n) => n.status !== "sent")) {
    try {
      if (n.status === "sending") {
        summary.skipped.push({ id: n.id, reason: "Was being published at export time; check LinkedIn and re-export." });
        summary.results.push({ sourceId: n.id, outcome: "skipped_in_flight", detail: "Status 'sending' at export time." });
        continue;
      }
      // Never re-queue a post whose Buffer id is already in published history.
      if (await selectOne("li_content", [eq("source", "buffer_export"), eq("source_id", n.id)], { columns: "id" })) {
        summary.results.push({ sourceId: n.id, outcome: "blocked_published_by_source", detail: "This file is older than one already imported: the post is published." });
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
      if (created) summary.queue.added++;
      else summary.queue.existing++;
      // Checked for new AND existing items: a crash between creating and blocking is repaired here.
      const current = created ? null : await selectOne<{ status: string }>("li_actions", [eq("id", actionId)], { columns: "status" });
      const checkable = created || (current && ["draft", "ready_for_review"].includes(current.status));
      const match = checkable ? await findPublishedMatch(n.text, assetsOf(n)) : null;
      if (!created && !match) {
        summary.results.push({ sourceId: n.id, outcome: "queue_existing" });
        continue;
      }
      if (match) {
        await markBlocked(actionId, describeMatch(match), "system");
        summary.queue.blockedAsDuplicate++;
        summary.results.push({
          sourceId: n.id,
          outcome: match.kind === "same_text_and_media" ? "blocked_duplicate" : "blocked_possible_duplicate",
          detail: describeMatch(match),
        });
      } else {
        summary.results.push({ sourceId: n.id, outcome: "queue_added" });
      }
    } catch (err) {
      recordError(summary, n.id, err);
    }
  }

  await audit(actor, "import.buffer_snapshot", "li_content", null, {
    ...summary,
    results: summary.results.filter((r) => !["history_existing", "queue_existing"].includes(r.outcome)),
  });
  return summary;
}
