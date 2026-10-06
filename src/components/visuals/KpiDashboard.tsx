import { ChartFrame } from "./ChartFrame";

/** The numbers a weekly growth review tracks: P&L metrics, not vanity ones. Example values. */
const KPIS = [
  { label: "Revenue", value: "SAR 412K", change: "+6%", good: true, series: [30, 32, 31, 35, 37, 36, 40, 42] },
  { label: "CAC", value: "SAR 58", change: "−9%", good: true, series: [44, 43, 41, 40, 38, 37, 36, 34] },
  { label: "Payback", value: "2.1 mo", change: "−0.4", good: true, series: [40, 39, 38, 36, 35, 34, 33, 31] },
  { label: "90-day repeat", value: "24%", change: "+3 pts", good: true, series: [18, 18, 19, 20, 21, 21, 23, 24] },
  { label: "Gross margin", value: "41%", change: "−1 pt", good: false, series: [43, 43, 42, 42, 42, 41, 41, 41] },
];

function Spark({ series, good }: { series: number[]; good: boolean }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 60},${18 - ((v - min) / (max - min || 1)) * 16}`).join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16" aria-hidden>
      <polyline className="animate-draw" pathLength={1} points={pts} fill="none" stroke={good ? "var(--color-accent)" : "var(--color-alert)"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiDashboard() {
  return (
    <ChartFrame title="Weekly growth review" caption="Five numbers that move the P&L, every week, from one trusted source. Followers and impressions don't make the list.">
      <ul className="divide-y divide-line border-y border-line">
        {KPIS.map((k) => (
          <li key={k.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5">
            <div>
              <p className="text-xs text-ink-3">{k.label}</p>
              <p className="tabular font-mono text-sm font-medium">{k.value}</p>
            </div>
            <Spark series={k.series} good={k.good} />
            <span className={`tabular w-14 text-right font-mono text-xs ${k.good ? "text-accent" : "text-alert"}`}>{k.change}</span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
