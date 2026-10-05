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

const MODEL_LABEL = Object.fromEntries(EXPERIMENT_MODELS.map((m) => [m.id, m.label])) as Record<ExperimentModel, string>;
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
    () =>
      EXPERIMENTS.filter(
        (e) => (model === "all" || e.model === model) && (stage === "all" || e.stage === stage) && (effort === "all" || e.effort === effort),
      ),
    [model, stage, effort],
  );

  return (
    <div>
      <div className="grid gap-8 border-b border-line pb-10 lg:grid-cols-3">
        <Chips label="Business model" options={EXPERIMENT_MODELS} value={model} onChange={setModel} />
        <Chips label="Funnel stage" options={EXPERIMENT_STAGES} value={stage} onChange={setStage} />
        <Chips label="Effort" options={EFFORTS} value={effort} onChange={setEffort} />
      </div>
      <p className="mt-8 text-sm text-ink-3" aria-live="polite">
        Showing {results.length} of {EXPERIMENTS.length} experiments
      </p>
      <ul className="mt-6 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
        {results.map((e) => (
          <li key={e.id} className="flex flex-col bg-paper p-6">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
              #{String(e.id).padStart(3, "0")} · {MODEL_LABEL[e.model]} · {STAGE_LABEL[e.stage]}
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
      {results.length === 0 && <p className="mt-6 text-ink-2">No experiments match these filters yet.</p>}
    </div>
  );
}
