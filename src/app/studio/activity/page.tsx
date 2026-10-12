import Link from "next/link";
import { first } from "@/components/studio/StudioUi";
import { ACTIVITY_CATEGORIES, recentActivity, type ActivityCategory } from "@/lib/studio/insights";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";

export const dynamic = "force-dynamic";

const LIMITS = [100, 300, 1000];

export default async function Activity({ searchParams }: PageProps<"/studio/activity">) {
  await requireOwner();
  const sp = await searchParams;
  const category = first(sp.category) as ActivityCategory | undefined;
  const problemsOnly = first(sp.problems) === "1";
  const limit = LIMITS.includes(Number(first(sp.limit))) ? Number(first(sp.limit)) : LIMITS[0];
  const all = await recentActivity(limit);
  const items = all.filter((a) => (!category || a.category === category) && (!problemsOnly || a.problem));
  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ category, problems: problemsOnly ? "1" : undefined, limit: String(limit), ...q }).filter(([, v]) => v) as [string, string][]);
    return `/studio/activity?${p}`;
  };

  return (
    <div className="mt-8">
      <h1 className="text-h2 font-semibold">Activity</h1>
      <p className="mt-2 max-w-[70ch] text-ink-2">Everything recorded in the studio&apos;s audit log, newest first: approvals, edits, publishing, switches, sign-in setup and backups.</p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href={link({ category: undefined })} className={`border px-3 py-1 ${!category ? "border-ink bg-ink text-paper" : "border-line"}`}>
          All
        </Link>
        {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => (
          <Link key={c} href={link({ category: c })} className={`border px-3 py-1 ${category === c ? "border-ink bg-ink text-paper" : "border-line"}`}>
            {ACTIVITY_CATEGORIES[c]}
          </Link>
        ))}
        <Link href={link({ problems: problemsOnly ? undefined : "1" })} className={`border px-3 py-1 ${problemsOnly ? "border-alert bg-alert text-paper" : "border-alert text-alert"}`}>
          Problems only
        </Link>
      </div>

      {items.length ? (
        <ul className="mt-6 divide-y divide-line border border-line bg-card text-sm">
          {items.map((a) => (
            <li key={a.row.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
              <span className="shrink-0 font-mono text-xs text-ink-3 sm:w-40">{formatRiyadh(a.row.created_at)}</span>
              <span className="shrink-0 font-mono text-xs uppercase tracking-wide text-ink-3 sm:w-36">{ACTIVITY_CATEGORIES[a.category]}</span>
              <span className={a.problem ? "text-alert" : ""}>
                {a.href ? (
                  <Link href={a.href} className="underline-offset-4 hover:underline">
                    {a.text}
                  </Link>
                ) : (
                  a.text
                )}
                {a.note && <span className="text-ink-3"> · {a.note}</span>}
                <span className="block text-xs text-ink-3">by {a.row.actor}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 border border-line bg-card p-4 text-sm text-ink-2">No matching activity in the latest {limit} entries.</p>
      )}

      {all.length === limit && limit < LIMITS[LIMITS.length - 1] && (
        <p className="mt-4 text-sm">
          <Link href={link({ limit: String(LIMITS[LIMITS.indexOf(limit) + 1]) })} className="underline underline-offset-4">
            Show older entries
          </Link>
        </p>
      )}
    </div>
  );
}
