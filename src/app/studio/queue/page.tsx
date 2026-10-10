import Link from "next/link";
import { first, Notice, StatusBadge } from "@/components/studio/StudioUi";
import { requireOwner } from "@/lib/studio/owner";
import { listActions, statusCounts } from "@/lib/studio/repo";
import { formatRiyadh } from "@/lib/studio/time";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/studio/workflow";

export const dynamic = "force-dynamic";

export default async function Queue({ searchParams }: PageProps<"/studio/queue">) {
  await requireOwner("/studio/queue");
  const sp = await searchParams;
  const wanted = first(sp.status);
  const status = STATUSES.includes(wanted as Status) ? (wanted as Status) : null;
  const [items, counts] = await Promise.all([listActions(status ? [status] : undefined), statusCounts()]);
  const now = new Date().toISOString();
  const sorted = [...items].sort((a, b) => (a.current?.target_at ?? "9").localeCompare(b.current?.target_at ?? "9"));

  return (
    <div className="mt-8">
      <h1 className="text-h2 font-semibold">Approval queue</h1>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        Nothing here is published until you approve the exact version and complete the publishing step. Editing after approval
        voids the approval.
      </p>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/studio/queue" className={`border px-3 py-1 ${!status ? "border-ink bg-ink text-paper" : "border-line"}`}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/studio/queue?status=${s}`} className={`border px-3 py-1 ${status === s ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {STATUS_LABELS[s]} <span className="tabular text-ink-3">{counts[s]}</span>
          </Link>
        ))}
      </div>

      {sorted.length ? (
        <ul className="mt-6 divide-y divide-line border border-line bg-card">
          {sorted.map(({ action, draft, current }) => (
            <li key={action.id}>
              <Link href={`/studio/queue/${action.id}`} className="block p-4 hover:bg-paper-2">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={action.status} />
                  <span className="font-mono text-xs text-ink-3">{formatRiyadh(current?.target_at ?? null)}</span>
                  <span className="font-mono text-xs text-ink-3">{draft.origin === "migrated_buffer" ? "Migrated from Buffer" : draft.origin}</span>
                  {action.sensitive && <span className="font-mono text-xs text-alert">Sensitive</span>}
                  {["ready_for_review", "approved"].includes(action.status) && current?.target_at && current.target_at < now && (
                    <span className="font-mono text-xs text-alert">Planned time passed</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{current?.text}</p>
                {action.status_reason && <p className="mt-1 text-xs text-ink-3">{action.status_reason}</p>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-ink-2">No items{status ? ` with status "${STATUS_LABELS[status]}"` : ""}.</p>
      )}
    </div>
  );
}
