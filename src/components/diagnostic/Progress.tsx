import { STEPS } from "@/lib/diagnostic/questions";

const LABELS = [...STEPS.map((s) => s.label), "Results"];

/** Business → Economics → Acquisition → Conversion → Retention → Growth → Results */
export function Progress({ current, fraction }: { current: number; fraction: number }) {
  return (
    <nav aria-label="Diagnostic progress">
      <p className="mb-3 flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.1em] text-ink-3 sm:hidden">
        <span>
          Step {Math.min(current + 1, LABELS.length)} of {LABELS.length}
        </span>
        <span className="text-ink">{LABELS[current]}</span>
      </p>
      <ol className="grid grid-cols-7 gap-1">
        {LABELS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              <span className="block h-1 bg-ink/10">
                <span
                  className="block h-full bg-accent transition-[width] duration-500"
                  style={{ width: state === "done" ? "100%" : state === "current" ? `${Math.max(8, fraction * 100)}%` : "0%" }}
                />
              </span>
              <span
                className={`mt-2 hidden truncate font-mono text-[0.68rem] uppercase tracking-[0.08em] sm:block ${
                  state === "todo" ? "text-ink-3" : "text-ink"
                }`}
              >
                {label}
                <span className="sr-only">{state === "done" ? " (completed)" : state === "current" ? " (current)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
