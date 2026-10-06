import { ChartFrame } from "./ChartFrame";

/** Example funnel: where 1,000 visitors drop out. Illustrative numbers, labelled as such. */
const STEPS = [
  { label: "Visitors", value: 1000 },
  { label: "Product views", value: 460 },
  { label: "Add to cart", value: 110 },
  { label: "Checkout", value: 41 },
  { label: "First order", value: 23 },
  { label: "Second order", value: 5 },
];

export function LeakyFunnel() {
  // The step that keeps the smallest share is the leak worth fixing first.
  let leak = 1;
  for (let i = 1; i < STEPS.length; i++) {
    if (STEPS[i].value / STEPS[i - 1].value < STEPS[leak].value / STEPS[leak - 1].value) leak = i;
  }
  return (
    <ChartFrame
      title="Where 1,000 visitors go"
      caption="Buying more traffic only fills the top. Revenue stays capped until the biggest leak is fixed."
    >
      <ol className="space-y-2.5">
        {STEPS.map((s, i) => {
          const isLeak = i === leak;
          const kept = i ? Math.round((s.value / STEPS[i - 1].value) * 100) : 100;
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={isLeak ? "font-semibold" : ""}>{s.label}</span>
                <span className="tabular font-mono text-xs text-ink-3">
                  {i > 0 && <span className={isLeak ? "text-alert" : ""}>{kept}% kept · </span>}
                  {s.value.toLocaleString("en-US")}
                </span>
              </div>
              <div className="mt-1 h-2 bg-ink/[0.06]">
                <div
                  className={`animate-grow h-full ${isLeak ? "bg-alert" : "bg-accent"}`}
                  style={{ width: `${Math.max(1.5, (s.value / STEPS[0].value) * 100)}%`, animationDelay: `${0.1 + i * 0.12}s` }}
                />
              </div>
              {isLeak && <p className="mt-1 text-xs font-medium text-alert">▲ Biggest leak: only {kept}% come back</p>}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
