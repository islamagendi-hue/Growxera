import { EXPERIMENTS, EXPERIMENT_STAGES } from "@/content/experiments";
import { ChartFrame } from "./ChartFrame";

/** Count of Lab experiments per funnel stage, plus one real idea from the library. */
export function ExperimentsAtAGlance() {
  const counts = EXPERIMENT_STAGES.map((s) => ({ ...s, n: EXPERIMENTS.filter((e) => e.stage === s.id).length }));
  const max = Math.max(...counts.map((c) => c.n));
  const sample = EXPERIMENTS.find((e) => e.title === "WhatsApp abandoned-cart flow") ?? EXPERIMENTS[0];
  return (
    <ChartFrame title="Experiments by funnel stage" tag="From the Lab">
      <ul className="space-y-2.5">
        {counts.map((c, i) => (
          <li key={c.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span>{c.label}</span>
            <span className="h-2.5 bg-ink/[0.06]">
              <span className="animate-grow block h-full bg-accent" style={{ width: `${(c.n / max) * 100}%`, animationDelay: `${0.1 + i * 0.1}s` }} />
            </span>
            <span className="tabular text-right font-mono">{c.n}</span>
          </li>
        ))}
      </ul>
      <div className="animate-fade mt-6 border border-line bg-paper p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-accent">{EXPERIMENT_STAGES.find((s) => s.id === sample.stage)?.label}</p>
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-3">{sample.effort} effort</p>
        </div>
        <p className="mt-2 font-medium">{sample.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{sample.hypothesis}</p>
        <p className="mt-3 text-xs text-ink-3">
          Decides it: <span className="font-medium text-ink">{sample.metric}</span>
        </p>
      </div>
    </ChartFrame>
  );
}

/** A prioritised testing backlog, scored with ICE. Example scores. */
export function IceBacklog() {
  const rows = [
    { title: "WhatsApp abandoned-cart flow", i: 8, c: 8, e: 9, status: "Running" },
    { title: "Free shipping threshold test", i: 7, c: 7, e: 8, status: "Next" },
    { title: "Guest checkout with phone-only login", i: 8, c: 6, e: 5, status: "Next" },
    { title: "Replenishment reminders", i: 6, c: 6, e: 6, status: "Backlog" },
  ];
  return (
    <ChartFrame title="This week's testing backlog" caption="ICE = impact × confidence × ease, each scored 1–10. Highest score runs first.">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-wider text-ink-3">
            <th className="pb-2 font-medium">Experiment</th>
            <th className="pb-2 text-right font-medium">ICE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const ice = r.i * r.c * r.e;
            return (
              <tr key={r.title} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3">
                  <p className="leading-snug">{r.title}</p>
                  <div className="mt-1.5 h-1.5 bg-ink/[0.06]">
                    <span className="animate-grow block h-full bg-accent" style={{ width: `${(ice / 1000) * 100}%`, animationDelay: `${0.1 + idx * 0.12}s` }} />
                  </div>
                </td>
                <td className="py-2.5 text-right align-top">
                  <p className="tabular font-mono">{ice}</p>
                  <p className={`mt-1 font-mono text-[0.6rem] uppercase tracking-wider ${r.status === "Running" ? "text-accent" : "text-ink-3"}`}>{r.status}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ChartFrame>
  );
}
