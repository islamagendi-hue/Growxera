import Link from "next/link";
import { SourceLabel, StatusBadge } from "@/components/studio/StudioUi";
import { CAPABILITIES } from "@/lib/studio/capabilities";
import { grokStatus, spentThisMonthUsd } from "@/lib/studio/grok";
import { requireOwner } from "@/lib/studio/owner";
import { listActions, statusCounts } from "@/lib/studio/repo";
import { historyStats } from "@/lib/studio/stats";
import { formatRiyadh } from "@/lib/studio/time";
import { STATUS_LABELS, type Status } from "@/lib/studio/workflow";

export const dynamic = "force-dynamic";

const fmt = (n: number | null) => (n === null ? "No data" : new Intl.NumberFormat("en-US").format(n));

export default async function StudioOverview() {
  await requireOwner("/studio");
  const [counts, history, review, grok, spent] = await Promise.all([
    statusCounts(),
    historyStats(),
    listActions(["ready_for_review", "blocked", "failed", "approved", "executed"]),
    Promise.resolve(grokStatus()),
    spentThisMonthUsd(),
  ]);
  const upcoming = review
    .filter((i) => ["ready_for_review", "approved", "blocked"].includes(i.action.status))
    .sort((a, b) => (a.current?.target_at ?? "9").localeCompare(b.current?.target_at ?? "9"))
    .slice(0, 6);
  const publishing = CAPABILITIES.find((c) => c.id === "publish_text")!;
  const attention: Status[] = ["failed", "blocked", "executed"];

  return (
    <div className="mt-8">
      <h1 className="text-h2 font-semibold">Overview</h1>

      <section aria-labelledby="queue-h" className="mt-8">
        <h2 id="queue-h" className="eyebrow">Approval queue</h2>
        <div className="mt-3 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {(["ready_for_review", "approved", "executed", "verified", "needs_revision", "rejected", "blocked", "failed", "draft"] as Status[]).map((s) => (
            <Link key={s} href={`/studio/queue?status=${s}`} className="bg-card p-4 hover:bg-paper-2">
              <p className="text-sm text-ink-2">{STATUS_LABELS[s]}</p>
              <p className="tabular mt-1 text-3xl font-semibold">{counts[s]}</p>
            </Link>
          ))}
        </div>
        <SourceLabel>Studio database, live</SourceLabel>
        {attention.some((s) => counts[s] > 0) && (
          <p className="mt-4 border border-alert bg-alert-soft p-4 text-sm text-alert">
            Needs your attention: {counts.failed} failed, {counts.blocked} blocked, {counts.executed} published but not yet verified.
          </p>
        )}
      </section>

      <section aria-labelledby="next-h" className="mt-10">
        <h2 id="next-h" className="eyebrow">Next up for review</h2>
        {upcoming.length ? (
          <ul className="mt-3 divide-y divide-line border border-line bg-card">
            {upcoming.map(({ action, current }) => (
              <li key={action.id}>
                <Link href={`/studio/queue/${action.id}`} className="flex flex-col gap-1 p-4 hover:bg-paper-2 sm:flex-row sm:items-center sm:gap-4">
                  <StatusBadge status={action.status} />
                  <span className="font-mono text-xs text-ink-3">{formatRiyadh(current?.target_at ?? null)}</span>
                  <span className="line-clamp-1 text-sm">{current?.text.split("\n")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-2">Nothing waiting. Import the Buffer snapshot on the Import page to bring in the migrated queue.</p>
        )}
      </section>

      <section aria-labelledby="hist-h" className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-3">
        <h2 id="hist-h" className="sr-only">History and performance</h2>
        <div className="bg-card p-6">
          <p className="eyebrow">Published history</p>
          <p className="tabular mt-2 text-3xl font-semibold">{history.posts ? fmt(history.posts) : "No data"}</p>
          {history.posts > 0 && (
            <p className="mt-1 text-sm text-ink-2">
              {history.native} native, {history.viaTool} via a scheduler · {formatRiyadh(history.firstAt, false)} to {formatRiyadh(history.lastAt, false)}
            </p>
          )}
          <SourceLabel>{history.sources.length ? `Source: ${history.sources.join(", ")}` : "No import yet"}</SourceLabel>
        </div>
        <div className="bg-card p-6">
          <p className="eyebrow">Median per post</p>
          {history.metrics ? (
            <>
              <p className="tabular mt-2 text-3xl font-semibold">{fmt(history.metrics.medianImpressions)}</p>
              <p className="mt-1 text-sm text-ink-2">
                impressions and {fmt(history.metrics.medianReach)} reach per post (median). Total across {history.metrics.posts} posts:{" "}
                {history.metrics.totalReactions} reactions, {history.metrics.totalComments} comments.
              </p>
              <SourceLabel>
                Measured: {history.metrics.source}, {history.metrics.window} totals, as of {formatRiyadh(history.metrics.measuredAt)}. Frozen: no live
                feed.
              </SourceLabel>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-2">No data. Post analytics are not available through the API; they come from uploads.</p>
          )}
        </div>
        <div className="bg-card p-6">
          <p className="eyebrow">Followers, profile views, subscribers</p>
          <p className="mt-2 text-sm text-ink-2">No data. Not available by API for a personal profile; weekly upload arrives in Milestone 2.</p>
          <SourceLabel>Unavailable</SourceLabel>
        </div>
      </section>

      <section aria-labelledby="eng-h" className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-2">
        <h2 id="eng-h" className="sr-only">Engines</h2>
        <div className="bg-card p-6">
          <p className="eyebrow">Writing engine: Grok</p>
          {grok.enabled ? (
            <p className="mt-2 text-sm">
              Enabled, model <span className="font-mono">{grok.model}</span>. ${spent.toFixed(2)} of ${grok.budgetUsd.toFixed(2)} used this month.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-2">
              Disabled. Missing: <span className="font-mono">{grok.missing.join(", ")}</span>. No other model is used in its place.
            </p>
          )}
          <SourceLabel>Server configuration</SourceLabel>
        </div>
        <div className="bg-card p-6">
          <p className="eyebrow">Publishing to LinkedIn</p>
          <p className="mt-2 text-sm text-ink-2">
            Direct publishing: not verified. Approved items use the copy-and-open step, then you paste the link back.{" "}
            <Link href="/studio/capabilities" className="underline underline-offset-4">
              Capabilities
            </Link>
          </p>
          <SourceLabel>Checked {publishing.status === "available" ? "and working" : "status: not verified"}</SourceLabel>
        </div>
      </section>
    </div>
  );
}
