"use client";

import { useMemo, useState } from "react";
import {
  EXPERIMENTS,
  EXPERIMENT_MODELS,
  EXPERIMENT_STAGES,
  type Effort,
  type ExperimentModel,
  type ExperimentStage,
} from "@/content/experiments";

const STAGE_LABEL = Object.fromEntries(EXPERIMENT_STAGES.map((s) => [s.id, s.label])) as Record<ExperimentStage, string>;
const EFFORTS: { id: Effort; label: string }[] = [
  { id: "low", label: "Low effort" },
  { id: "medium", label: "Medium effort" },
  { id: "high", label: "High effort" },
];

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T | "all";
  onChange: (v: T | "all") => void;
}) {
  const all = [{ id: "all" as const, label: "All" }, ...options];
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={`border px-3 py-1.5 text-sm transition-colors ${
                active ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ExperimentLab() {
  const [model, setModel] = useState<ExperimentModel | "all">("all");
  const [stage, setStage] = useState<ExperimentStage | "all">("all");
  const [effort, setEffort] = useState<Effort | "all">("all");

  const results = useMemo(
    () => EXPERIMENTS.filter((e) => (stage === "all" || e.stage === stage) && (effort === "all" || e.effort === effort)),
    [stage, effort],
  );
  const sections = EXPERIMENT_MODELS.filter((m) => model === "all" || m.id === model)
    .map((m) => ({ ...m, items: results.filter((e) => e.model === m.id) }))
    .filter((m) => m.items.length > 0);
  const shown = sections.reduce((n, m) => n + m.items.length, 0);

  return (
    <div>
      <nav aria-label="Business models" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-px border border-line bg-line sm:grid sm:min-w-0 sm:grid-cols-3">
          {[{ id: "all" as const, label: "All models" }, ...EXPERIMENT_MODELS].map((m) => {
            const active = model === m.id;
            const count = m.id === "all" ? results.length : results.filter((e) => e.model === m.id).length;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setModel(m.id)}
                  className={`flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    active ? "bg-ink text-paper" : "bg-paper hover:bg-paper-2"
                  }`}
                >
                  <span className="whitespace-nowrap font-medium">{m.label}</span>
                  <span className={`font-mono text-xs ${active ? "text-paper/70" : "text-ink-3"}`}>{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-8 grid gap-8 border-b border-line pb-10 lg:grid-cols-2">
        <Chips label="Funnel stage" options={EXPERIMENT_STAGES} value={stage} onChange={setStage} />
        <Chips label="Effort" options={EFFORTS} value={effort} onChange={setEffort} />
      </div>
      <p className="mt-8 text-sm text-ink-3" aria-live="polite">
        Showing {shown} of {EXPERIMENTS.length} experiments
      </p>
      {sections.map((m) => (
        <section key={m.id} id={`lab-${m.id}`} className="mt-12 scroll-mt-24">
          <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-3">
            <h2 className="text-h3 font-semibold">{m.label}</h2>
            <p className="font-mono text-xs text-ink-3">{m.items.length} experiments</p>
          </div>
          <ul className="mt-6 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
            {m.items.map((e) => (
              <li key={e.id} className="flex flex-col bg-paper p-6">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  #{String(e.id).padStart(3, "0")} · {STAGE_LABEL[e.stage]}
                </p>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{e.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{e.hypothesis}</p>
                <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-xs">
                  <div>
                    <dt className="text-ink-3">Decision metric</dt>
                    <dd className="mt-0.5 font-medium">{e.metric}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">Effort</dt>
                    <dd className="mt-0.5 font-medium capitalize">{e.effort}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {shown === 0 && <p className="mt-6 text-ink-2">No experiments match these filters yet.</p>}
    </div>
  );
}
