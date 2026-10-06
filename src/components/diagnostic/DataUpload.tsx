"use client";
import { useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import { isVisible, QUESTION_MAP } from "@/lib/diagnostic/questions";
import { analyseOrders, MAX_UPLOAD_BYTES, type UploadMetrics, type UploadSummary } from "@/lib/diagnostic/upload";
import type { Answers } from "@/lib/diagnostic/types";
import { formatNumber } from "@/lib/format";

export interface AppliedUpload {
  metrics: Partial<UploadMetrics>;
  summary: UploadSummary & { applied: string[] };
}

const ORDER: (keyof UploadMetrics)[] = ["monthlyRevenue", "monthlyOrders", "monthlyNewCustomers", "aov", "repeatRate"];

/**
 * Optional last step: read an orders export in the browser and offer the
 * figures it yields. Nothing is applied until the visitor confirms.
 */
export function DataUpload({
  answers,
  currency,
  busy,
  onBack,
  onContinue,
}: {
  answers: Answers;
  currency: string;
  busy: boolean;
  onBack: () => void;
  onContinue: (applied: AppliedUpload | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<{ summary: UploadSummary; metrics: UploadMetrics; warnings: string[] } | null>(null);
  const [use, setUse] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File) {
    setError(null);
    setResult(null);
    if (/\.(xlsx|xls|numbers)$/i.test(file.name)) {
      setError("This looks like a spreadsheet file. Open it and save or export it as CSV (comma separated), then upload the CSV.");
      return;
    }
    if (!/\.(csv|txt|tsv)$/i.test(file.name) && !/csv|text\/plain|tab-separated/.test(file.type)) {
      setError("Please upload a CSV file (an orders or sales export).");
      return;
    }
    if (file.size === 0) {
      setError("This file is empty.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`This file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Export the last 12 months only and try again.`);
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      const res = analyseOrders(file.name, text);
      if (!res.ok) {
        setError(res.error);
        track("diagnostic_upload_failed", {});
        return;
      }
      setResult(res);
      setUse(Object.fromEntries(ORDER.filter((k) => res.metrics[k] !== undefined && relevant(k)).map((k) => [k, true])));
      track("diagnostic_upload_read", { rows: res.summary.validRows, months: res.summary.monthsUsed });
    } catch {
      setError("We couldn't read this file. Make sure it is a plain CSV export and try again.");
    } finally {
      setReading(false);
    }
  }

  const relevant = (k: string) => !!QUESTION_MAP[k] && isVisible(QUESTION_MAP[k], answers);
  const shown = result ? ORDER.filter((k) => result.metrics[k] !== undefined && relevant(k)) : [];

  function display(k: keyof UploadMetrics, v: unknown) {
    if (typeof v !== "number") return v === "unknown" ? "I don't know" : "—";
    if (k === "repeatRate") return `${formatNumber(v, 1)}%`;
    if (k === "monthlyRevenue" || k === "aov") return `${currency} ${formatNumber(v, k === "aov" ? 2 : 0)}`;
    return formatNumber(v);
  }

  function confirm() {
    if (!result) return onContinue(null);
    const applied = shown.filter((k) => use[k]);
    const metrics = Object.fromEntries(applied.map((k) => [k, result.metrics[k]])) as Partial<UploadMetrics>;
    const s = result.summary;
    onContinue({
      metrics,
      summary: {
        ...s,
        columns: {
          date: s.columns.date.slice(0, 80),
          amount: s.columns.amount.slice(0, 80),
          ...(s.columns.customer ? { customer: s.columns.customer.slice(0, 80) } : {}),
        },
        applied,
      },
    });
  }

  return (
    <div className="mt-10 space-y-8">
      {!result && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void read(f);
          }}
          className={`border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-card"}`}
        >
          <p className="text-lg font-medium">Upload an orders or sales export (CSV)</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm text-ink-2">
            One row per order with a date and an amount. A customer column (ID, email or phone) adds new-customer and repeat
            figures. Shopify, Salla, Zid, WooCommerce and POS exports work.
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={reading}
            className="mt-6 inline-flex min-h-12 items-center justify-center border border-ink px-6 font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
          >
            {reading ? "Reading the file…" : "Choose a CSV file"}
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            aria-label="Choose a CSV file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void read(f);
              e.target.value = "";
            }}
          />
          <p className="mt-4 text-xs text-ink-3">
            The file is read in your browser and never uploaded. Only the figures you choose to use are sent with your diagnostic.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {result && (
        <div className="border border-ink bg-card">
          <div className="border-b border-line p-5 sm:p-6">
            <p className="eyebrow">Read from {result.summary.fileName}</p>
            <p className="mt-2 text-sm text-ink-2">
              {formatNumber(result.summary.validRows)} orders from {result.summary.from} to {result.summary.to}. Monthly figures
              average the last {result.summary.monthsUsed} full month{result.summary.monthsUsed === 1 ? "" : "s"}.
            </p>
            {result.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-alert">
                {result.warnings.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            )}
          </div>
          {shown.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-ink-3">
                  <th className="p-3 pl-5 font-medium sm:pl-6">Use</th>
                  <th className="p-3 font-medium">Metric</th>
                  <th className="hidden p-3 font-medium sm:table-cell">Your answer</th>
                  <th className="p-3 pr-5 text-right font-medium sm:pr-6">From file</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((k) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="p-3 pl-5 sm:pl-6">
                      <input
                        type="checkbox"
                        checked={!!use[k]}
                        onChange={(e) => setUse((u) => ({ ...u, [k]: e.target.checked }))}
                        aria-label={`Use the file figure for ${QUESTION_MAP[k].label}`}
                        className="h-5 w-5 accent-[var(--color-accent)]"
                      />
                    </td>
                    <td className="p-3">{QUESTION_MAP[k].label}</td>
                    <td className="hidden p-3 font-mono text-ink-3 sm:table-cell">{display(k, answers[k])}</td>
                    <td className="p-3 pr-5 text-right font-mono sm:pr-6">{display(k, result.metrics[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-5 text-sm text-ink-2 sm:p-6">None of the figures in this file apply to the questions for your business type.</p>
          )}
          <div className="border-t border-line p-5 sm:p-6">
            <button type="button" onClick={() => setResult(null)} className="text-sm underline underline-offset-4">
              Use a different file
            </button>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <button type="button" onClick={onBack} className="min-h-12 px-2 text-ink-2 hover:text-ink">
          ← Back
        </button>
        <div className="flex flex-1 flex-col-reverse items-stretch gap-2 sm:flex-none sm:flex-row sm:items-center">
          {result && shown.some((k) => use[k]) ? (
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60"
            >
              {busy ? "Calculating your score…" : "Use these figures and see results"} {!busy && <span aria-hidden>→</span>}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onContinue(null)}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60"
            >
              {busy ? "Calculating your score…" : "Skip and see my results"} {!busy && <span aria-hidden>→</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
