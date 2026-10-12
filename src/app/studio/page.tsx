import Link from "next/link";
import { OnOff, SourceLabel, StatusBadge } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { EXPORT_REMINDER_DAYS, lastExportAt } from "@/lib/studio/export";
import { grokStatus } from "@/lib/studio/grok";
import { ATTENTION, attention, loadControls, loadPosts, PIPELINE, recentActivity } from "@/lib/studio/insights";
import { requireOwner } from "@/lib/studio/owner";
import { historyStats } from "@/lib/studio/stats";
import { formatRiyadh } from "@/lib/studio/time";

export const dynamic = "force-dynamic";

const fmt = (n: number | null) => (n === null ? "No data" : new Intl.NumberFormat("en-US").format(n));
const DAY = 86_400_000;

export default async function Dashboard() {
  await requireOwner();
  const now = new Date();
  const [posts, controls, activity, lastExport, history] = await Promise.all([loadPosts(now), loadControls(), recentActivity(8), lastExportAt(), historyStats()]);
  const grok = grokStatus();

  const todo = attention(posts);
  const upcoming = posts
    .filter((p) => p.current.target_at && new Date(p.current.target_at).getTime() >= now.getTime() && ["draft", "ready_for_review", "approved"].includes(p.action.status))
    .sort((a, b) => a.current.target_at!.localeCompare(b.current.target_at!));
  const next14 = upcoming.filter((p) => new Date(p.current.target_at!).getTime() < now.getTime() + 14 * DAY);
  const awaitingConfirmation = posts.filter((p) => p.awaitingAutoConfirmation).length;
  const confirmed = posts.filter((p) => p.autoAuthorized).length;
  const backupDue = !lastExport || new Date(lastExport).getTime() + EXPORT_REMINDER_DAYS * DAY < now.getTime();
  const li = controls.linkedin;
  const liText =
    li.state === "connected"
      ? `Connected, ${li.daysLeft} days left${li.canPost ? "" : " (no posting permission)"}`
      : li.state === "not_configured"
        ? "Not set up (app keys missing)"
        : li.state === "not_connected"
          ? "Not connected"
          : "Connection stopped working";

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">{formatRiyadh(now.toISOString())} Riyadh time</p>
        </div>
        <Link href="/studio/new" className={buttonClass("primary")}>
          New post
        </Link>
      </div>

      {/* Publishing controls: the first thing to know is whether anything can go out. */}
      <section aria-labelledby="controls-h" className="mt-8">
        <h2 id="controls-h" className="eyebrow">Publishing controls</h2>
        <div className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/studio/capabilities#publishing" className="bg-card p-4 hover:bg-paper-2">
            <p className="text-sm text-ink-2">All publishing</p>
            <p className="mt-2">
              <OnOff on={controls.publishing.enabled} />
            </p>
            <p className="mt-2 text-xs text-ink-3">{controls.publishing.enabled ? "Posts can go out after their own approval and confirmation." : "Nothing can be posted, manually or automatically."}</p>
          </Link>
          <Link href="/studio/capabilities#autopublish" className="bg-card p-4 hover:bg-paper-2">
            <p className="text-sm text-ink-2">Automatic publishing</p>
            <p className="mt-2">
              <OnOff on={controls.auto.enabled} />
            </p>
            <p className="mt-2 text-xs text-ink-3">
              {controls.auto.deploymentAllowed ? "Allowed for this deployment." : "Not allowed for this deployment (owner-approved setting needed)."}
            </p>
          </Link>
          <Link href="/studio/capabilities#linkedin" className="bg-card p-4 hover:bg-paper-2">
            <p className="text-sm text-ink-2">LinkedIn</p>
            <p className="mt-2">
              <OnOff on={li.state === "connected"} label={li.state === "connected" ? "Connected" : "Not connected"} />
            </p>
            <p className="mt-2 text-xs text-ink-3">{liText}</p>
          </Link>
          <Link href="/studio/queue?filter=awaiting_confirmation" className="bg-card p-4 hover:bg-paper-2">
            <p className="text-sm text-ink-2">Confirmed for automatic publishing</p>
            <p className="tabular mt-1 text-2xl font-semibold">{confirmed}</p>
            <p className="mt-1 text-xs text-ink-3">
              {awaitingConfirmation} approved post{awaitingConfirmation === 1 ? "" : "s"} not confirmed. Each one is confirmed individually; approval alone never publishes.
            </p>
          </Link>
        </div>
        {!controls.publishing.ready && <p className="mt-2 text-sm text-alert">The publishing-controls database update isn&apos;t applied yet, so every switch reads OFF.</p>}
      </section>

      <section aria-labelledby="pipeline-h" className="mt-10">
        <h2 id="pipeline-h" className="eyebrow">Pipeline</h2>
        <ol className="mt-3 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE.map((stage) => (
            <li key={stage.key} className="bg-card">
              <Link href={stage.href} className="block p-4 hover:bg-paper-2">
                <p className="text-sm text-ink-2">{stage.label}</p>
                <p className="tabular mt-1 text-3xl font-semibold">{posts.filter((p) => stage.statuses.includes(p.action.status)).length}</p>
              </Link>
            </li>
          ))}
        </ol>
        <SourceLabel>Studio database, live</SourceLabel>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="todo-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="todo-h" className="eyebrow">Needs your action ({todo.length})</h2>
            {todo.length > 8 && (
              <Link href="/studio/queue?filter=attention" className="text-sm underline underline-offset-4">
                See all
              </Link>
            )}
          </div>
          {todo.length ? (
            <ul className="mt-3 divide-y divide-line border border-line bg-card">
              {todo.slice(0, 8).map(({ kind, post }) => (
                <li key={post.action.id}>
                  <Link href={`/studio/queue/${post.action.id}`} className="block p-4 hover:bg-paper-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`font-mono text-xs uppercase tracking-wide ${ATTENTION[kind].rank <= 4 ? "text-alert" : "text-ink-2"}`}>{ATTENTION[kind].label}</span>
                      {post.current.target_at && <span className="font-mono text-xs text-ink-3">{formatRiyadh(post.current.target_at)}</span>}
                    </div>
                    <p className="mt-1 text-sm font-medium">{post.title}</p>
                    <p className="mt-1 text-xs text-ink-2">{ATTENTION[kind].next}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border border-line bg-card p-4 text-sm text-ink-2">Nothing needs you right now.</p>
          )}
        </section>

        <section aria-labelledby="upcoming-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="upcoming-h" className="eyebrow">Next 14 days ({next14.length})</h2>
            <Link href="/studio/calendar" className="text-sm underline underline-offset-4">
              Calendar
            </Link>
          </div>
          {next14.length ? (
            <ul className="mt-3 divide-y divide-line border border-line bg-card">
              {next14.slice(0, 8).map((p) => (
                <li key={p.action.id}>
                  <Link href={`/studio/queue/${p.action.id}`} className="block p-4 hover:bg-paper-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-3">{formatRiyadh(p.current.target_at)}</span>
                      <StatusBadge status={p.action.status} />
                      {p.autoAuthorized && <span className="font-mono text-xs text-accent-ink">Auto-confirmed</span>}
                    </div>
                    <p className="mt-1 text-sm">{p.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border border-line bg-card p-4 text-sm text-ink-2">
              Nothing planned in the next 14 days.{" "}
              <Link href="/studio/new" className="underline underline-offset-4">
                Write a post
              </Link>
            </p>
          )}
        </section>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="activity-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="activity-h" className="eyebrow">Recent activity</h2>
            <Link href="/studio/activity" className="text-sm underline underline-offset-4">
              All activity
            </Link>
          </div>
          {activity.length ? (
            <ul className="mt-3 divide-y divide-line border border-line bg-card text-sm">
              {activity.map((a) => (
                <li key={a.row.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
                  <span className="shrink-0 font-mono text-xs text-ink-3 sm:w-36">{formatRiyadh(a.row.created_at)}</span>
                  <span className={a.problem ? "text-alert" : ""}>
                    {a.href ? (
                      <Link href={a.href} className="underline-offset-4 hover:underline">
                        {a.text}
                      </Link>
                    ) : (
                      a.text
                    )}
                    {a.note && <span className="text-ink-3"> · {a.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border border-line bg-card p-4 text-sm text-ink-2">No activity yet.</p>
          )}
        </section>

        <section aria-labelledby="health-h" className="space-y-px self-start border border-line bg-line">
          <h2 id="health-h" className="sr-only">Backup, writing engine and history</h2>
          <div className="bg-card p-4">
            <p className="eyebrow">Backup</p>
            <p className={`mt-2 text-sm ${backupDue ? "text-alert" : ""}`}>
              {lastExport ? `Last export ${formatRiyadh(lastExport)}.` : "No export downloaded yet."} {backupDue ? "A weekly export is due." : ""}
            </p>
            <Link href="/studio/export" className="mt-2 inline-block text-sm underline underline-offset-4">
              Backup page
            </Link>
          </div>
          <div className="bg-card p-4">
            <p className="eyebrow">Writing engine: Grok</p>
            <p className="mt-2 text-sm text-ink-2">
              {grok.enabled ? `Enabled, model ${grok.model}, budget $${grok.budgetUsd.toFixed(2)}/month.` : "Off: budget is $0, so no model calls are made. Posts are written by you."}
            </p>
          </div>
          <div className="bg-card p-4">
            <p className="eyebrow">Published history</p>
            <p className="tabular mt-2 text-2xl font-semibold">{history.posts ? fmt(history.posts) : "No data"}</p>
            {history.metrics && (
              <p className="mt-1 text-xs text-ink-2">
                Median {fmt(history.metrics.medianImpressions)} impressions per post ({history.metrics.source}, as of {formatRiyadh(history.metrics.measuredAt, false)}; no live
                feed).
              </p>
            )}
            <SourceLabel>{history.sources.length ? `Source: ${history.sources.join(", ")}` : "No import yet"}</SourceLabel>
          </div>
        </section>
      </div>
    </div>
  );
}
