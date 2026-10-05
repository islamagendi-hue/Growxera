import { SYSTEM_STEPS } from "@/content/site-content";

/** MARKET → VALUE → ACQUIRE → ACTIVATE → RETAIN → EXPAND → SCALE */
export function GrowthSystem({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const dark = tone === "ink";
  return (
    <ol className={`grid border-t ${dark ? "border-paper/20" : "border-line"} sm:grid-cols-2 lg:grid-cols-7`}>
      {SYSTEM_STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`relative border-b py-6 pr-6 lg:border-b-0 lg:border-r lg:py-8 lg:pl-5 lg:first:pl-0 lg:last:border-r-0 ${
            dark ? "border-paper/20" : "border-line"
          }`}
        >
          <div className="flex items-baseline gap-3 lg:block">
            <span className={`font-mono text-xs ${dark ? "text-accent-bright" : "text-accent"}`}>0{i + 1}</span>
            <p className="mt-0 font-mono text-sm font-medium tracking-[0.12em] lg:mt-5">
              {s.verb}
              {i < SYSTEM_STEPS.length - 1 && (
                <span aria-hidden className={`ml-2 lg:hidden ${dark ? "text-paper/40" : "text-ink-3"}`}>
                  ↓
                </span>
              )}
            </p>
          </div>
          <p className={`mt-3 text-[0.95rem] leading-relaxed ${dark ? "text-paper/70" : "text-ink-2"}`}>{s.text}</p>
          {i < SYSTEM_STEPS.length - 1 && (
            <span
              aria-hidden
              className={`absolute -right-[7px] top-9 hidden h-3 w-3 rotate-45 border-r border-t lg:block ${
                dark ? "border-paper/40 bg-ink" : "border-line-strong bg-paper"
              }`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
