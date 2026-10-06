import { ChartFrame } from "./ChartFrame";

/** What a 90-day growth roadmap looks like. Example workstreams and timing. */
const ROWS = [
  { name: "Tracking and data", start: 0, end: 3, kind: "fix" },
  { name: "Checkout conversion", start: 2, end: 7, kind: "fix" },
  { name: "Retention and CRM", start: 4, end: 11, kind: "fix" },
  { name: "Paid acquisition", start: 7, end: 12, kind: "scale" },
  { name: "Weekly experiments", start: 3, end: 12, kind: "run" },
] as const;

const WEEKS = 12;

export function RoadmapMockup() {
  return (
    <ChartFrame title="A 90-day growth roadmap" caption="Fix what the diagnosis found first, then spend more on acquisition once the system can hold it.">
      <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 text-xs sm:grid-cols-[9rem_1fr]">
        <span />
        <div className="mb-2 grid grid-cols-3 font-mono text-[0.6rem] uppercase tracking-wider text-ink-3">
          <span>Month 1</span>
          <span>Month 2</span>
          <span>Month 3</span>
        </div>
        {ROWS.map((r, i) => (
          <div key={r.name} className="contents">
            <span className="truncate py-1.5 text-ink-2">{r.name}</span>
            <div className="relative my-1 h-5 bg-[repeating-linear-gradient(to_right,transparent,transparent_calc(100%/3_-_1px),var(--color-line)_calc(100%/3_-_1px),var(--color-line)_calc(100%/3))]">
              <span
                className={`animate-grow absolute inset-y-0 ${r.kind === "scale" ? "bg-ink" : r.kind === "run" ? "bg-accent-soft outline outline-1 -outline-offset-1 outline-accent" : "bg-accent"}`}
                style={{ left: `${(r.start / WEEKS) * 100}%`, width: `${((r.end - r.start) / WEEKS) * 100}%`, animationDelay: `${0.1 + i * 0.15}s` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 bg-accent" /> Fix
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 border border-accent bg-accent-soft" /> Test weekly
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 bg-ink" /> Scale
        </span>
      </div>
    </ChartFrame>
  );
}
