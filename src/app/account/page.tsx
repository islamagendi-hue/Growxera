import Link from "next/link";
import { Delta } from "@/components/account/Delta";
import { formatDate, ReportList, stageLabel } from "@/components/account/ReportList";
import { ScoreTrend } from "@/components/account/ScoreTrend";
import { buttonClass } from "@/components/ui/button";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { Dimension } from "@/lib/diagnostic/types";
import { listDiagnostics } from "@/lib/server/accounts";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function AccountHome() {
  const account = await requireAccount("/account");
  const items = await listDiagnostics(account.id);
  const [latest, previous] = items;
  const first = account.name.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <p className="eyebrow">{account.company}</p>
      <h1 className="mt-3 text-h2 font-semibold">Welcome, {first}.</h1>

      {latest ? (
        <div className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-3">
          <div className="bg-card p-6 sm:p-8">
            <p className="eyebrow">Latest Growth Score</p>
            <p className="tabular mt-2 text-6xl font-semibold tracking-[-0.04em]">
              {latest.overall_score}
              <span className="text-xl font-medium text-ink-3"> / 100</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">
              {stageLabel(latest.stage)} · {formatDate(latest.completed_at)}
            </p>
            {previous && (
              <p className="mt-3 text-sm">
                <Delta value={latest.overall_score - previous.overall_score} /> since {formatDate(previous.completed_at)}
              </p>
            )}
            <Link href={`/account/reports/${latest.id}`} className={buttonClass("primary", "mt-6 w-full")}>
              View report <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="bg-card p-6 sm:p-8">
            <p className="eyebrow">My progress</p>
            {items.length > 1 ? (
              <>
                <div className="mt-4">
                  <ScoreTrend points={[...items].reverse().map((d) => ({ score: d.overall_score, date: d.completed_at }))} />
                </div>
                <p className="mt-2 text-sm text-ink-2">{items.length} diagnostics saved.</p>
                <Link href="/account/progress" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
                  Compare progress →
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-2">
                Run the diagnostic again next month to see what changed: your score, each growth area and your benchmarks.
              </p>
            )}
          </div>
          <div className="bg-card p-6 sm:p-8">
            <p className="eyebrow">Your focus</p>
            <p className="mt-2 text-h3 font-semibold">{DIMENSION_LABELS[latest.bottleneck as Dimension] ?? latest.bottleneck}</p>
            <p className="mt-2 text-sm text-ink-2">Your current primary bottleneck.</p>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <Link href={`/specialist?report=${latest.id}#book`} className="font-medium text-accent underline underline-offset-4">
                Book a Free 30-Minute Review
              </Link>
              <Link href={`/specialist?report=${latest.id}#ask`} className="underline underline-offset-4">
                Ask a specialist a question
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 border border-ink bg-card p-6 sm:p-10">
          <h2 className="text-h3 font-semibold">Run your first Growth Diagnostic</h2>
          <p className="mt-2 max-w-[56ch] text-ink-2">
            About 8 minutes. Your report is saved here automatically, and every future diagnostic is compared with it.
          </p>
          <Link href="/diagnostic" className={buttonClass("primary", "mt-6")}>
            Start the diagnostic <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-h3 font-semibold">My reports</h2>
            <Link href="/diagnostic" className="text-sm font-medium underline underline-offset-4">
              New diagnostic
            </Link>
          </div>
          <div className="mt-6">
            <ReportList items={items.slice(0, 5)} />
          </div>
          {items.length > 5 && (
            <Link href="/account/reports" className="mt-4 inline-block text-sm underline underline-offset-4">
              All {items.length} reports →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
