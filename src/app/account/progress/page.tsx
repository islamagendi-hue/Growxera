import Link from "next/link";
import { ComparisonView } from "@/components/account/ComparisonView";
import { formatDate } from "@/components/account/ReportList";
import { ScoreTrend } from "@/components/account/ScoreTrend";
import { buttonClass } from "@/components/ui/button";
import { compareReports } from "@/lib/diagnostic/compare";
import { getDiagnostic, listDiagnostics } from "@/lib/server/accounts";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function ProgressPage({ searchParams }: PageProps<"/account/progress">) {
  const account = await requireAccount("/account/progress");
  const sp = await searchParams;
  const items = await listDiagnostics(account.id);

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
        <h1 className="text-h2 font-semibold">My progress</h1>
        <p className="mt-4 max-w-[60ch] text-ink-2">
          Progress needs two diagnostics. Run it again after a month of changes and we&apos;ll show what moved: your overall
          score, each growth area, the metrics that improved or declined, your benchmarks and any new recommendations.
        </p>
        <Link href="/diagnostic" className={buttonClass("primary", "mt-8")}>
          Run a new diagnostic <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  const valid = (v: unknown) => (typeof v === "string" && items.some((d) => d.id === v) ? v : undefined);
  let toId = valid(sp.to) ?? items[0].id;
  let fromId = valid(sp.from) ?? items[items.findIndex((d) => d.id === toId) + 1]?.id ?? items[1].id;
  if (fromId === toId) fromId = items.find((d) => d.id !== toId)!.id;
  // Always compare older → newer.
  if (items.findIndex((d) => d.id === fromId) < items.findIndex((d) => d.id === toId)) [fromId, toId] = [toId, fromId];

  const [before, after] = await Promise.all([getDiagnostic(account.id, fromId), getDiagnostic(account.id, toId)]);
  const c = before && after ? compareReports(before.report, after.report) : null;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="text-h2 font-semibold">My progress</h1>
          <p className="mt-2 text-ink-2">Compare any two diagnostics. Each report stays exactly as it was on the day.</p>
        </div>
        <div className="lg:col-span-5">
          <ScoreTrend points={[...items].reverse().map((d) => ({ score: d.overall_score, date: d.completed_at }))} />
        </div>
      </div>

      <form method="get" className="mt-8 grid gap-3 border border-line bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {(
          [
            ["from", "Previous", fromId],
            ["to", "Current", toId],
          ] as const
        ).map(([name, label, value]) => (
          <label key={name} className="block text-sm">
            <span className="font-medium">{label}</span>
            <select name={name} defaultValue={value} className="mt-1 block min-h-12 w-full border border-line-strong bg-paper px-3 text-base">
              {items.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDate(d.completed_at)} · score {d.overall_score}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className={buttonClass("primary")}>
          Compare
        </button>
      </form>

      <div className="mt-12">{c ? <ComparisonView c={c} beforeId={fromId} afterId={toId} /> : <p>We couldn&apos;t load these reports.</p>}</div>
    </div>
  );
}
