import { ScoreBars } from "@/components/diagnostic/ScoreBars";
import { CountUp } from "@/components/ui/CountUp";

/** Hero visual. Numbers are an illustrative example, clearly labelled, not client data. */
export function IllustrativeReport() {
  return (
    <div className="relative border border-ink/15 bg-card p-6 shadow-[0_30px_80px_-40px_rgba(14,19,17,0.45)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <p className="eyebrow">Growth Diagnostic™ report</p>
        <span className="border border-line px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-ink-3">
          Illustrative example
        </span>
      </div>
      <div className="mt-6 flex items-end gap-6 border-b border-line pb-6">
        <p className="tabular text-7xl font-semibold leading-none tracking-tight">
          <CountUp value="64" /><span className="text-2xl text-ink-3">/100</span>
        </p>
        <div className="pb-1">
          <p className="eyebrow">Stage</p>
          <p className="mt-1 font-medium">Growth Emerging</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="eyebrow">Primary bottleneck</p>
        <p className="mt-1 text-2xl font-semibold">Retention</p>
      </div>
      <div className="mt-6">
        <ScoreBars
          compact
          highlight="retention"
          data={[
            { dimension: "market", score: 72 },
            { dimension: "value", score: 68 },
            { dimension: "acquisition", score: 81 },
            { dimension: "activation", score: 66 },
            { dimension: "retention", score: 38 },
            { dimension: "expansion", score: 55 },
            { dimension: "scale", score: 70 },
          ]}
        />
      </div>
    </div>
  );
}
