import Link from "next/link";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { Comparison } from "@/lib/diagnostic/compare";
import { formatNumber } from "@/lib/format";
import { Delta } from "./Delta";
import { formatDate, stageLabel } from "./ReportList";

const POSITION: Record<string, string> = { worse: "Below", within: "Within", better: "Above", outlier: "Far above" };
const fmt = (v: number, unit: "%" | "x") => (unit === "%" ? `${formatNumber(v, v < 10 ? 1 : 0)}%` : `${formatNumber(v, 1)}×`);

/** Previous → current, for one pair of saved diagnostics. Both snapshots stay unchanged. */
export function ComparisonView({ c, beforeId, afterId }: { c: Comparison; beforeId: string; afterId: string }) {
  return (
    <div className="space-y-14">
      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <Link href={`/account/reports/${beforeId}`} className="bg-card p-6 hover:bg-paper">
          <p className="eyebrow">Previous · {formatDate(c.before.generatedAt)}</p>
          <p className="tabular mt-2 text-5xl font-semibold">{c.before.overallScore}</p>
          <p className="mt-1 text-sm text-ink-3">{stageLabel(c.before.stage)}</p>
        </Link>
        <Link href={`/account/reports/${afterId}`} className="bg-card p-6 hover:bg-paper">
          <p className="eyebrow">Current · {formatDate(c.after.generatedAt)}</p>
          <p className="tabular mt-2 text-5xl font-semibold">{c.after.overallScore}</p>
          <p className="mt-1 text-sm text-ink-3">{stageLabel(c.after.stage)}</p>
        </Link>
        <div className="bg-ink p-6 text-paper">
          <p className="eyebrow !text-paper/60">Overall change</p>
          <p className="tabular mt-2 text-5xl font-semibold">
            {c.overallDelta > 0 ? "+" : c.overallDelta < 0 ? "−" : ""}
            {Math.abs(c.overallDelta)}
          </p>
          <p className="mt-1 text-sm text-paper/60">
            Bottleneck: {DIMENSION_LABELS[c.before.bottleneck]}
            {c.before.bottleneck !== c.after.bottleneck ? ` → ${DIMENSION_LABELS[c.after.bottleneck]}` : " (unchanged)"}
          </p>
        </div>
      </div>
      {!c.sameScoringVersion && (
        <p className="border-l-2 border-line-strong bg-paper-2 px-4 py-3 text-sm text-ink-2">
          These two diagnostics used different versions of our scoring, so some of the change may come from the method rather than your business.
        </p>
      )}

      <section>
        <h2 className="text-h3 font-semibold">Change by growth area</h2>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {c.dimensions.map((d) => (
            <li key={d.dimension} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 sm:grid-cols-12">
              <span className="font-medium sm:col-span-4">{d.label}</span>
              <span className="tabular font-mono text-sm text-ink-3 sm:col-span-4">
                {d.before ?? "—"} → <span className="text-ink">{d.after ?? "—"}</span>
              </span>
              <span className="text-right text-sm sm:col-span-4">
                <Delta value={d.delta} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <MetricList title="Improved metrics" items={c.improved} empty="No metric improved by a meaningful amount." />
        <MetricList title="Declined metrics" items={c.declined} empty="No metric declined by a meaningful amount." />
      </div>

      {c.benchmarkMoves.length > 0 && (
        <section>
          <h2 className="text-h3 font-semibold">Benchmark movement</h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {c.benchmarkMoves.map((b) => (
              <li key={b.metric} className="grid gap-1 py-3 sm:grid-cols-12 sm:items-center">
                <span className="font-medium sm:col-span-4">{b.label}</span>
                <span className="tabular font-mono text-sm sm:col-span-4">
                  {b.previousValue !== null ? fmt(b.previousValue, b.unit) : "—"} → {fmt(b.value, b.unit)}
                </span>
                <span className="text-sm text-ink-2 sm:col-span-4">
                  {b.before ? POSITION[b.before] : "Not measured"} → <strong className="font-medium text-ink">{POSITION[b.after]}</strong> the range
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-h3 font-semibold">New recommendations</h2>
          {c.newRecommendations.length ? (
            <ul className="mt-4 space-y-2">
              {c.newRecommendations.map((r) => (
                <li key={r.id} className="border-l-2 border-accent pl-3">
                  {r.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-2">Nothing new since the previous diagnostic.</p>
          )}
        </section>
        <section>
          <h2 className="text-h3 font-semibold">No longer flagged</h2>
          {c.resolvedRecommendations.length ? (
            <ul className="mt-4 space-y-2">
              {c.resolvedRecommendations.map((r) => (
                <li key={r.id} className="border-l-2 border-line-strong pl-3 text-ink-2">
                  <span aria-hidden className="mr-1 text-accent">
                    ✓
                  </span>
                  {r.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-2">Every earlier recommendation still applies.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricList({ title, items, empty }: { title: string; items: Comparison["improved"]; empty: string }) {
  return (
    <section>
      <h2 className="text-h3 font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span>{m.label}</span>
              <span className="tabular font-mono text-ink-2">
                {m.before} → <span className="text-ink">{m.after}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-2">{empty}</p>
      )}
    </section>
  );
}
