import Link from "next/link";
import { DIMENSION_LABELS, GROWTH_STAGES } from "@/lib/diagnostic/config";
import type { Dimension } from "@/lib/diagnostic/types";
import type { DiagnosticSummary } from "@/lib/server/accounts";
import { Delta } from "./Delta";

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const stageLabel = (id: string) => GROWTH_STAGES.find((s) => s.id === id)?.label ?? id;

/** Saved diagnostics, newest first, each with its change from the one before. */
export function ReportList({ items }: { items: DiagnosticSummary[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((d, i) => {
        const prev = items[i + 1];
        return (
          <li key={d.id}>
            <Link href={`/account/reports/${d.id}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-1 py-5 hover:bg-card sm:grid-cols-12 sm:px-3">
              <span className="tabular row-span-2 font-mono text-3xl font-semibold sm:col-span-1 sm:row-span-1">{d.overall_score}</span>
              <span className="min-w-0 sm:col-span-6">
                <span className="block font-medium">{formatDate(d.completed_at)}</span>
                <span className="block truncate text-sm text-ink-3">{d.context?.label ?? stageLabel(d.stage)}</span>
              </span>
              <span className="text-right text-sm sm:col-span-2 sm:text-left">
                {prev ? <Delta value={d.overall_score - prev.overall_score} /> : <span className="text-ink-3">first</span>}
              </span>
              <span className="col-start-2 text-sm text-ink-2 sm:col-span-2 sm:col-start-auto">
                Bottleneck: {DIMENSION_LABELS[d.bottleneck as Dimension] ?? d.bottleneck}
              </span>
              <span aria-hidden className="hidden text-right text-ink-3 group-hover:text-ink sm:col-span-1 sm:block">
                View →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
