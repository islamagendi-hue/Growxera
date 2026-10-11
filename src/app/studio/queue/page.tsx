import Link from "next/link";
import { first, Notice, StatusBadge } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { attention, loadPosts, type PostState } from "@/lib/studio/insights";
import { connectionState } from "@/lib/studio/linkedin";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/studio/workflow";
import { publishDueNowAction } from "../actions";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, { label: string; match: (p: PostState, needs: Set<string>) => boolean }> = {
  attention: { label: "Needs action", match: (p, needs) => needs.has(p.action.id) },
  held: { label: "Held", match: (p) => p.held },
  overdue: { label: "Planned time passed", match: (p) => p.overdue },
  awaiting_confirmation: { label: "Approved, not confirmed for auto", match: (p) => p.awaitingAutoConfirmation },
  confirmed: { label: "Confirmed for auto", match: (p) => p.autoAuthorized },
};

export default async function Posts({ searchParams }: PageProps<"/studio/queue">) {
  await requireOwner();
  const sp = await searchParams;
  const wanted = first(sp.status);
  const status = STATUSES.includes(wanted as Status) ? (wanted as Status) : null;
  const filterKey = first(sp.filter);
  const filter = filterKey && filterKey in FILTERS ? filterKey : null;
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const [posts, li] = await Promise.all([loadPosts(), connectionState()]);
  const needs = new Set(attention(posts).map((a) => a.post.action.id));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, posts.filter((p) => p.action.status === s).length])) as Record<Status, number>;
  const shown = posts
    .filter((p) => (!status || p.action.status === status) && (!filter || FILTERS[filter].match(p, needs)) && (!q || p.current.text.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.current.target_at ?? "9").localeCompare(b.current.target_at ?? "9"));
  const href = (o: { status?: string | null; filter?: string | null }) => {
    const p = new URLSearchParams();
    const s = o.status === undefined ? status : o.status;
    const f = o.filter === undefined ? filter : o.filter;
    if (s) p.set("status", s);
    if (f) p.set("filter", f);
    if (q) p.set("q", q);
    return `/studio/queue${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold">Posts</h1>
          <p className="mt-2 max-w-[70ch] text-ink-2">Nothing here is published until you approve the exact version. Editing after approval voids the approval.</p>
        </div>
        <Link href="/studio/new" className={buttonClass("primary")}>
          New post
        </Link>
      </div>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      {li.state === "connected" && (
        <form action={publishDueNowAction} className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-2">
            LinkedIn connected. Only posts confirmed for automatic publishing one by one can go out, only inside their window, and only while both switches
            are on.
          </span>
          <button className={buttonClass("secondary")}>Run scheduler now</button>
        </form>
      )}

      <form role="search" className="mt-6 flex max-w-xl gap-2" action="/studio/queue">
        {status && <input type="hidden" name="status" value={status} />}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <label className="sr-only" htmlFor="q">
          Search post text
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search post text" className="w-full border border-line-strong bg-card px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        <button className={buttonClass("secondary")}>Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={href({ status: null })} className={`border px-3 py-1 ${!status ? "border-ink bg-ink text-paper" : "border-line"}`}>
          All <span className="tabular opacity-70">{posts.length}</span>
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={`border px-3 py-1 ${status === s ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {STATUS_LABELS[s]} <span className="tabular opacity-70">{counts[s]}</span>
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([key, f]) => (
          <Link key={key} href={href({ filter: filter === key ? null : key })} className={`border px-3 py-1 ${filter === key ? "border-accent bg-accent text-paper" : "border-line"}`}>
            {f.label} <span className="tabular opacity-70">{posts.filter((p) => f.match(p, needs)).length}</span>
          </Link>
        ))}
      </div>

      {shown.length ? (
        <ul className="mt-6 divide-y divide-line border border-line bg-card">
          {shown.map((p) => (
            <li key={p.action.id}>
              <Link href={`/studio/queue/${p.action.id}`} className="block p-4 hover:bg-paper-2">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={p.action.status} />
                  <span className="font-mono text-xs text-ink-3">{formatRiyadh(p.current.target_at)}</span>
                  <span className="font-mono text-xs text-ink-3">{p.draft.origin === "migrated_buffer" ? "Migrated from Buffer" : p.draft.origin === "studio" ? "Written in studio" : p.draft.origin}</span>
                  {p.action.sensitive && <span className="font-mono text-xs text-alert">Sensitive</span>}
                  {p.held && <span className="font-mono text-xs text-alert">Held</span>}
                  {p.overdue && <span className="font-mono text-xs text-alert">Planned time passed</span>}
                  {p.unknownOutcome && <span className="font-mono text-xs text-alert">Outcome unknown</span>}
                  {p.autoAuthorized && <span className="font-mono text-xs text-accent-ink">Confirmed for auto</span>}
                  {p.awaitingAutoConfirmation && <span className="font-mono text-xs text-ink-3">Not confirmed for auto</span>}
                  {p.action.status === "approved" && !p.approvalValid && <span className="font-mono text-xs text-alert">Approval outdated</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{p.current.text}</p>
                {p.action.status_reason && <p className="mt-1 text-xs text-ink-3">{p.action.status_reason}</p>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 border border-line bg-card p-4 text-sm text-ink-2">
          {posts.length ? "No posts match." : "No posts yet."}{" "}
          <Link href="/studio/new" className="underline underline-offset-4">
            Write one
          </Link>
          {!posts.length && (
            <>
              {" "}
              or{" "}
              <Link href="/studio/import" className="underline underline-offset-4">
                import the Buffer snapshot
              </Link>
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}
