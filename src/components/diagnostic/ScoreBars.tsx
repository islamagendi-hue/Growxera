import { CountUp } from "@/components/ui/CountUp";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { Dimension } from "@/lib/diagnostic/types";

export interface BarDatum {
  dimension: Dimension;
  score: number;
  hasData?: boolean;
  confidence?: number;
}

/**
 * Single-series horizontal bars (magnitude, 0–100). One hue; the bottleneck is
 * marked with a text label and icon, never by colour alone.
 */
export function ScoreBars({
  data,
  highlight,
  dark = false,
  compact = false,
}: {
  data: BarDatum[];
  highlight?: Dimension;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <figure>
      <ul className={compact ? "space-y-2.5" : "space-y-4"}>
        {data.map((d) => {
          const isHi = d.dimension === highlight;
          const noData = d.hasData === false;
          return (
            <li key={d.dimension} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 sm:grid-cols-[8rem_1fr_3rem]">
              <span className={`truncate text-sm ${isHi ? "font-semibold" : ""}`}>
                {DIMENSION_LABELS[d.dimension]}
              </span>
              <span
                className={`relative block ${compact ? "h-2" : "h-2.5"} ${dark ? "bg-paper/10" : "bg-ink/[0.07]"}`}
                role="img"
                aria-label={`${DIMENSION_LABELS[d.dimension]}: ${noData ? "not enough data" : `${d.score} out of 100`}${isHi ? ", primary bottleneck" : ""}`}
              >
                {!noData && (
                  <span
                    className={`animate-grow absolute inset-y-0 left-0 rounded-r-[3px] ${
                      isHi ? (dark ? "bg-paper" : "bg-ink") : dark ? "bg-accent-bright" : "bg-accent"
                    }`}
                    style={{ width: `${Math.max(2, d.score)}%` }}
                  />
                )}
                {[25, 50, 75].map((t) => (
                  <span key={t} aria-hidden className={`absolute inset-y-0 w-px ${dark ? "bg-ink/40" : "bg-paper"}`} style={{ left: `${t}%` }} />
                ))}
              </span>
              <span className="tabular text-right font-mono text-sm">
                {noData ? "n/a" : <CountUp value={d.score} />}
                {isHi && <span className="sr-only"> (bottleneck)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
