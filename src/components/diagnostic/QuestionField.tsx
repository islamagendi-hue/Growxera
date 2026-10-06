"use client";
import { useState } from "react";
import { Combobox } from "@/components/ui/Combobox";
import { InfoTip } from "@/components/ui/InfoTip";
import { optionsOf, type Question } from "@/lib/diagnostic/questions";
import { UNKNOWN, type AnswerValue, type Answers } from "@/lib/diagnostic/types";
import { formatNumber, parseNumber } from "@/lib/format";

export interface Suggestion {
  value: number;
  label: string;
}

const unknownBtn = (active: boolean) =>
  `min-h-11 shrink-0 self-start border px-4 text-sm transition-colors sm:self-auto ${
    active ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink"
  }`;

export function QuestionField({
  q,
  value,
  answers,
  error,
  currency,
  suggestion,
  onChange,
}: {
  q: Question;
  value: AnswerValue | undefined;
  answers: Answers;
  error?: string;
  currency: string;
  suggestion?: Suggestion;
  onChange: (v: AnswerValue | undefined) => void;
}) {
  const id = `q-${q.id}`;
  const describedBy = [q.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const isUnknown = value === UNKNOWN;

  const options = optionsOf(q, answers);
  const labelText = (
    <span className="text-lg font-medium leading-snug">
      {q.label}
      {q.optional && <span className="ml-1 text-sm font-normal text-ink-3">(optional)</span>}
    </span>
  );
  // The (?) sits beside the label, never inside a <label>, so tapping it doesn't focus the field.
  const header = (
    <>
      <span id={`${id}-label`} className="block">
        {labelText}
        {q.info && <InfoTip note={q.info} label={q.label} />}
      </span>
      {q.help && (
        <span id={`${id}-help`} className="mt-1 block text-sm text-ink-3">
          {q.help}
        </span>
      )}
    </>
  );
  const errorEl = error && (
    <p id={`${id}-error`} className="mt-2 text-sm text-alert" role="alert">
      {error}
    </p>
  );

  if (q.type === "choice") {
    const opts = [...options, ...(q.allowUnknown ? [{ value: UNKNOWN, label: "I don't know", hint: undefined }] : [])];
    return (
      <fieldset aria-describedby={describedBy} data-field={q.id}>
        <legend className="mb-4">{header}</legend>
        <div className={`grid gap-2 ${opts.length > 4 ? "sm:grid-cols-2" : opts.some((o) => o.hint) ? "sm:grid-cols-2" : ""}`}>
          {opts.map((o) => {
            const checked = value === o.value;
            return (
              <label
                key={o.value}
                className={`flex min-h-14 cursor-pointer items-center gap-3 border px-4 py-3 transition-colors ${
                  checked ? "border-ink bg-ink text-paper" : "border-line-strong bg-card hover:border-ink"
                } ${o.value === UNKNOWN ? "border-dashed" : ""}`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={o.value}
                  checked={checked}
                  onChange={() => onChange(o.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-paper" : "border-ink-3"}`}
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-accent-bright" />}
                </span>
                <span>
                  <span className="block">{o.label}</span>
                  {o.hint && <span className={`block text-sm ${checked ? "text-paper/70" : "text-ink-3"}`}>{o.hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
        {errorEl}
      </fieldset>
    );
  }

  if (q.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      let next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
      // "None" is exclusive.
      if (v === "none" && next.includes("none")) next = ["none"];
      else next = next.filter((x) => x !== "none");
      onChange(next.length ? next : undefined);
    };
    return (
      <fieldset aria-describedby={describedBy} data-field={q.id}>
        <legend className="mb-4">{header}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label
                key={o.value}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4 transition-colors ${
                  checked ? "border-ink bg-ink text-paper" : "border-line-strong bg-card hover:border-ink"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(o.value)} />
                <span aria-hidden className="font-mono text-xs">{checked ? "✓" : "+"}</span>
                {o.label}
              </label>
            );
          })}
        </div>
        {errorEl}
      </fieldset>
    );
  }

  if (q.type === "select") {
    return (
      <div data-field={q.id}>
        {header}
        <div className="mt-3">
          <Combobox
            id={id}
            value={typeof value === "string" ? value : undefined}
            options={options}
            onChange={onChange}
            placeholder={q.placeholder ?? "Select…"}
            disabled={options.length === 0}
            invalid={!!error}
            labelledBy={`${id}-label`}
            describedBy={describedBy}
          />
        </div>
        {errorEl}
      </div>
    );
  }

  return (
    <NumberField
      q={q}
      id={id}
      header={header}
      errorEl={errorEl}
      describedBy={describedBy}
      value={value}
      isUnknown={isUnknown}
      currency={currency}
      suggestion={suggestion}
      error={error}
      onChange={onChange}
    />
  );
}

function NumberField({
  q,
  id,
  header,
  errorEl,
  describedBy,
  value,
  isUnknown,
  currency,
  suggestion,
  error,
  onChange,
}: {
  q: Question;
  id: string;
  header: React.ReactNode;
  errorEl: React.ReactNode;
  describedBy?: string;
  value: AnswerValue | undefined;
  isUnknown: boolean;
  currency: string;
  suggestion?: Suggestion;
  error?: string;
  onChange: (v: AnswerValue | undefined) => void;
}) {
  // Local text keeps what the visitor typed (e.g. "1,250."); value changes made from
  // here (suggestion, "I don't know") update both.
  const [text, setText] = useState(typeof value === "number" ? formatNumber(value, 2) : "");

  const prefix = q.type === "currency" ? currency : null;
  const suffix = q.type === "percent" ? "%" : null;

  return (
    <div data-field={q.id}>
      {header}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div
          className={`flex min-h-14 flex-1 items-center border bg-card transition-colors focus-within:border-ink ${
            error ? "border-alert" : "border-line-strong"
          } ${isUnknown ? "opacity-50" : ""}`}
        >
          {prefix && <span className="pl-4 font-mono text-sm text-ink-3">{prefix}</span>}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={isUnknown}
            value={text}
            placeholder={isUnknown ? "Not known" : q.type === "percent" ? "e.g. 2.5" : "e.g. 250,000"}
            onChange={(e) => {
              const t = e.target.value.replace(/[^0-9.,\s]/g, "");
              setText(t);
              onChange(parseNumber(t));
            }}
            onBlur={() => {
              const n = parseNumber(text);
              if (n !== undefined) setText(formatNumber(n, 2));
            }}
            aria-invalid={!!error}
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            className="tabular h-full min-h-14 w-full flex-1 bg-transparent px-4 font-mono text-lg outline-none"
          />
          {suffix && <span className="pr-4 font-mono text-ink-3">{suffix}</span>}
        </div>
        {q.allowUnknown && (
          <button
            type="button"
            aria-pressed={isUnknown}
            className={unknownBtn(isUnknown)}
            onClick={() => {
              setText("");
              onChange(isUnknown ? undefined : UNKNOWN);
            }}
          >
            I don&apos;t know
          </button>
        )}
      </div>
      {suggestion && (value === undefined || isUnknown) && (
        <button
          type="button"
          onClick={() => {
            setText(formatNumber(suggestion.value, 2));
            onChange(suggestion.value);
          }}
          className="mt-2 text-left text-sm text-accent underline underline-offset-4 hover:text-accent-ink"
        >
          {suggestion.label}
        </button>
      )}
      {errorEl}
    </div>
  );
}
