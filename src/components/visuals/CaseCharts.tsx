import type { CaseMetric, CaseStudy } from "@/content/case-studies";
import { ChartFrame } from "./ChartFrame";

/** A before → after pair read from a case metric, e.g. "SAR 116 → SAR 35" or "28% → 40%". */
export interface MetricChange {
  label: string;
  from: number;
  to: number;
  fromText: string;
  toText: string;
}

/** A relative change read from a case metric, e.g. "+25%" or "−12%". */
export interface MetricDelta {
  label: string;
  pct: number;
  text: string;
}

const ARROW = /^\s*(.+?)\s*→\s*(.+?)\s*$/;

/** "SAR 116" → 116, "100K" → 100000, "28%" → 28, "0" → 0. */
export function parseFigure(text: string): number | undefined {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([KkMm]?)/);
  if (!m) return undefined;
  const mult = /k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1;
  return Number(m[1]) * mult;
}

export function changeOf(m: CaseMetric): MetricChange | undefined {
  for (const s of [m.value, m.detail ?? ""]) {
    const a = s.match(ARROW);
    if (!a) continue;
    const from = parseFigure(a[1]);
    const to = parseFigure(a[2]);
    if (from !== undefined && to !== undefined) return { label: m.label, from, to, fromText: a[1], toText: a[2] };
  }
  return undefined;
}

export function deltaOf(m: CaseMetric): MetricDelta | undefined {
  const d = m.value.match(/^\s*([+−-])\s*(\d+(?:\.\d+)?)%\s*$/);
  if (!d) return undefined;
  return { label: m.label, pct: (d[1] === "+" ? 1 : -1) * Number(d[2]), text: m.value.trim() };
}

function ChangeRow({ c, delay = 0 }: { c: MetricChange; delay?: number }) {
  const max = Math.max(c.from, c.to) || 1;
  const pct = c.from ? Math.round(((c.to - c.from) / c.from) * 100) : undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{c.label}</span>
        {pct !== undefined && (
          <span className="tabular font-mono text-xs text-accent">
            {pct > 0 ? "+" : "−"}
            {Math.abs(pct)}%
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {[
          { k: "Before", v: c.from, t: c.fromText, cls: "bg-line-strong" },
          { k: "After", v: c.to, t: c.toText, cls: "bg-accent" },
        ].map((b, i) => (
          <div key={b.k} className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2">
            <span className="text-xs text-ink-3">{b.k}</span>
            <span className="h-2.5 bg-ink/[0.06]">
              <span
                className={`animate-grow block h-full ${b.cls}`}
                style={{ width: `${Math.max(1.5, (b.v / max) * 100)}%`, animationDelay: `${delay + i * 0.25}s` }}
              />
            </span>
            <span className="tabular min-w-16 text-right font-mono text-xs">{b.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeltaRow({ d, max, delay = 0 }: { d: MetricDelta; max: number; delay?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3">
      <span className="truncate text-sm">{d.label}</span>
      <span className="h-2.5 bg-ink/[0.06]">
        <span
          className="animate-grow block h-full bg-accent"
          style={{ width: `${Math.max(3, (Math.abs(d.pct) / max) * 100)}%`, animationDelay: `${delay}s` }}
        />
      </span>
      <span className="tabular text-right font-mono text-sm">{d.text}</span>
    </div>
  );
}

/** Every before → after and % change the case reports, drawn to scale. Real numbers only. */
export function CaseChart({ study }: { study: CaseStudy }) {
  const changes = study.metrics.map(changeOf).filter((c): c is MetricChange => !!c);
  const deltas = study.metrics.filter((m) => !changeOf(m)).map(deltaOf).filter((d): d is MetricDelta => !!d);
  if (!changes.length && !deltas.length) return null;
  const max = Math.max(...deltas.map((d) => Math.abs(d.pct)), 1);
  return (
    <ChartFrame title="Before and after" tag="As reported" caption={study.period ? `Measured over ${study.period}.` : "Figures as reported for this engagement."}>
      <div className="space-y-5">
        {changes.map((c, i) => (
          <ChangeRow key={c.label} c={c} delay={0.1 + i * 0.3} />
        ))}
        {deltas.length > 0 && (
          <div className="space-y-3">
            {changes.length > 0 && <p className="eyebrow">Change vs. before</p>}
            {deltas.map((d, i) => (
              <DeltaRow key={d.label} d={d} max={max} delay={0.1 + i * 0.15} />
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/** One headline change per case, side by side. Real numbers only. */
export function CaseResultsChart({ studies }: { studies: CaseStudy[] }) {
  const rows = studies
    .map((s) => {
      const change = s.metrics.map(changeOf).find(Boolean);
      const delta = change ? undefined : s.metrics.map(deltaOf).find(Boolean);
      return { s, change, delta };
    })
    .filter((r) => r.change || r.delta);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.delta?.pct ?? 0)), 1);
  return (
    <ChartFrame title="Results at a glance" tag="As reported" caption="The headline result of each case below, drawn to scale.">
      <ul className="space-y-5">
        {rows.map(({ s, change, delta }, i) => (
          <li key={s.slug}>
            <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-ink-3">{s.sector}</p>
            {change ? <ChangeRow c={change} delay={0.1 + i * 0.3} /> : <DeltaRow d={delta!} max={max} delay={0.1 + i * 0.3} />}
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
