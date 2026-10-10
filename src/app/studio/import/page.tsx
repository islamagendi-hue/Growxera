import { first, Notice, SourceLabel } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { eq, select, selectAll } from "@/lib/server/store";
import { type AssetRow, referencedAssetUrls } from "@/lib/studio/assets";
import type { RecordResult } from "@/lib/studio/import";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";
import { STATUS_LABELS, type Status } from "@/lib/studio/workflow";
import { importAction, secureAssetsAction } from "../actions";

export const dynamic = "force-dynamic";

const OUTCOME_TEXT: Record<string, string> = {
  blocked_published_by_source: "Blocked: already published (same Buffer post)",
  blocked_duplicate: "Blocked: same text and media already published",
  blocked_possible_duplicate: "Blocked: same text, different media (check)",
  conflict_published_twice: "Conflict: published twice?",
  skipped_in_flight: "Skipped: was being published",
  invalid: "Invalid record",
  error: "Error (re-run to retry)",
};

export default async function ImportPage({ searchParams }: PageProps<"/studio/import">) {
  await requireOwner("/studio/import");
  const sp = await searchParams;

  const [history, drafts, actions, imports, assets, urls] = await Promise.all([
    selectAll<{ id: string }>("li_content", [eq("source", "buffer_export")], { columns: "id" }),
    selectAll<{ id: string; origin: string }>("li_drafts", [eq("origin", "migrated_buffer")], { columns: "id,origin" }),
    selectAll<{ draft_id: string; status: Status }>("li_actions", [], { columns: "draft_id,status" }),
    select<{ created_at: string; detail: { records: number; results: RecordResult[] } | null }>(
      "li_audit_log",
      [eq("event", "import.buffer_snapshot")],
      { order: { col: "created_at", ascending: false }, limit: 10 },
    ),
    selectAll<AssetRow>("li_assets", []),
    referencedAssetUrls(),
  ]);
  const migratedIds = new Set(drafts.map((d) => d.id));
  const byStatus = new Map<Status, number>();
  for (const a of actions) if (migratedIds.has(a.draft_id)) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
  const exceptions = imports.flatMap((i) => (i.detail?.results ?? []).filter((r) => OUTCOME_TEXT[r.outcome]).map((r) => ({ ...r, at: i.created_at })));
  const secured = assets.filter((a) => a.verified_at).length;
  const failedAssets = assets.filter((a) => !a.verified_at && a.last_error);

  return (
    <div className="mt-8 max-w-[80ch]">
      <h1 className="text-h2 font-semibold">Import</h1>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      <section className="mt-8 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">Buffer export (one-off migration)</h2>
        <p className="mt-2 text-sm text-ink-2">Upload the private files you received (they are not in the public repository), in this order:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>
            <span className="font-mono">2026-10-10-history-with-metrics.json</span>: 58 records (57 published with metrics, 1 Buffer draft).
          </li>
          <li>
            <span className="font-mono">2026-10-10-scheduled-before-pause.json</span>: 37 scheduled posts. They arrive unapproved.
          </li>
          <li>
            <span className="font-mono">2026-10-10-update-1839-published-after-export.json</span>: the post Buffer published at 18:30 UTC. Its queue
            item is blocked.
          </li>
          <li>
            Any later re-export (for example <span className="font-mono">2026-10-10-reexport-current-state.json</span>): reconciles by Buffer post id.
          </li>
        </ol>
        <p className="mt-2 text-sm text-ink-2">
          Re-uploading is safe. Records are matched by Buffer post id; published posts never become publishable; invalid records are reported, not
          dropped.
        </p>
        <form action={importAction} className="mt-4">
          <input type="file" name="file" accept="application/json,.json" required className="block text-sm" />
          <button className={buttonClass("primary", "mt-4")}>Import</button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 font-semibold">Reconciliation</h2>
        <dl className="mt-3 grid grid-cols-2 gap-px border border-line bg-line text-sm sm:grid-cols-4">
          <div className="bg-card p-4">
            <dt className="text-ink-3">Published history</dt>
            <dd className="tabular text-2xl font-semibold">{history.length}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-ink-3">Migrated queue items</dt>
            <dd className="tabular text-2xl font-semibold">{migratedIds.size}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-ink-3">Approved</dt>
            <dd className="tabular text-2xl font-semibold">{byStatus.get("approved") ?? 0}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className="text-ink-3">Blocked</dt>
            <dd className="tabular text-2xl font-semibold">{byStatus.get("blocked") ?? 0}</dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-ink-2">
          Migrated items by status:{" "}
          {[...byStatus.entries()].map(([s, n]) => `${STATUS_LABELS[s]} ${n}`).join(" · ") || "none yet"}. Expected after the four files: 58 published, 38
          migrated items (36 Ready for review, 1 Draft, 1 Blocked), 0 approved.
        </p>
        <SourceLabel>Studio database, live</SourceLabel>

        <h3 className="mt-6 font-semibold">Exceptions from recent imports</h3>
        {exceptions.length ? (
          <ul className="mt-2 divide-y divide-line border border-line bg-card text-sm">
            {exceptions.map((r, i) => (
              <li key={i} className="p-3">
                <span className="font-medium">{OUTCOME_TEXT[r.outcome]}</span> · <span className="font-mono text-xs">{r.sourceId ?? "no id"}</span> ·{" "}
                {formatRiyadh(r.at)}
                {r.detail && <p className="mt-1 text-ink-2">{r.detail}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">None.</p>
        )}
      </section>

      <section id="media" className="mt-10 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">Media</h2>
        <p className="mt-2 text-sm text-ink-2">
          Post images and PDFs are referenced from another project&apos;s public storage, which may be reset. This copies each file into Growxera&apos;s
          private storage, checks the copy byte for byte, and keeps the originals untouched. Run it after importing; it is safe to run again.
        </p>
        <p className="mt-3 text-sm">
          <span className="tabular font-semibold">{secured}</span> of <span className="tabular font-semibold">{urls.length}</span> referenced files secured and
          verified.
        </p>
        {failedAssets.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-alert">
            {failedAssets.map((a) => (
              <li key={a.id}>
                {a.original_url.split("/").pop()}: {a.last_error}
              </li>
            ))}
          </ul>
        )}
        <form action={secureAssetsAction} className="mt-4">
          <button className={buttonClass("secondary")} disabled={!urls.length}>
            Copy and verify media
          </button>
        </form>
      </section>
    </div>
  );
}
