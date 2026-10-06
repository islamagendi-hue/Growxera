"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScoreBars } from "@/components/diagnostic/ScoreBars";
import { getCaseStudy } from "@/content/case-studies";
import { DIMENSION_DESCRIPTIONS, DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type {
  BenchmarkSnapshot,
  DiagnosticReport,
  Estimate,
  Level,
  Opportunity,
  RecommendationSnapshot,
  ReportPreview,
} from "@/lib/diagnostic/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { AdvisorCta, advisorHref } from "./AdvisorCta";
import { CountUp } from "@/components/ui/CountUp";

const LEVEL_LABEL: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };
const wrap = "mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10";

export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`text-sm text-ink-2 underline-offset-4 hover:underline print:hidden ${className}`}>
      Print / save as PDF
    </button>
  );
}

/**
 * The Growth Diagnostic report. Used right after the diagnostic, in the account
 * and on legacy shared links. With only a preview, `gate` replaces the full sections.
 */
export function ReportView({
  preview,
  report,
  reportId,
  notice,
  actions,
  gate,
  generatedAt,
}: {
  preview: ReportPreview;
  report?: DiagnosticReport;
  /** The diagnostic session id, passed to the advisor so they can read the report. */
  reportId?: string;
  notice?: ReactNode;
  actions?: ReactNode;
  gate?: ReactNode;
  generatedAt?: string;
}) {
  const strongest = preview.dimensions.find((d) => d.dimension === preview.strongest);
  const weakest = preview.dimensions.find((d) => d.dimension === preview.weakest);
  const date = generatedAt ?? report?.generatedAt;

  return (
    <div className="pb-8">
      <section className="border-b border-line">
        <div className={`${wrap} py-12 sm:py-16`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Growth Diagnostic report</p>
              {(preview.context?.label || date) && (
                <p className="mt-2 text-sm text-ink-3">
                  {preview.context?.label}
                  {preview.context?.label && date && " · "}
                  {date && new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm print:hidden">{actions}</div>
          </div>
          {notice && <div className="mt-6 print:hidden">{notice}</div>}
          <JourneySteps current={report ? 2 : 1} />

          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h1 className="eyebrow !text-ink">Your Growth Score</h1>
              <p className="tabular mt-3 text-[clamp(5rem,14vw,9rem)] font-semibold leading-[0.9] tracking-[-0.05em]">
                <CountUp value={preview.overallScore} />
                <span className="text-[0.3em] font-medium tracking-normal text-ink-3"> / 100</span>
              </p>
              <div className="mt-8 border-t border-line pt-6">
                <p className="eyebrow">Growth stage</p>
                <p className="mt-2 text-h3 font-semibold">{preview.stage.label}</p>
                <p className="mt-2 max-w-[42ch] text-ink-2">{preview.stage.description}</p>
              </div>
              <p className="mt-6 text-xs text-ink-3">
                Data confidence: {LEVEL_LABEL[preview.dataConfidence]}. Based on the information provided; not a guarantee of results.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div className="border border-ink bg-card p-6 sm:p-8">
                <p className="eyebrow flex items-center gap-2 !text-alert">
                  <span aria-hidden>▲</span> Your primary bottleneck
                </p>
                <p className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold leading-none tracking-[-0.03em]">
                  {DIMENSION_LABELS[preview.bottleneck]}
                </p>
                <p className="mt-5 text-lg leading-relaxed text-ink-2">{preview.bottleneckExplanation}</p>
                <div className="mt-6">
                  <AdvisorCta reportId={reportId} context={`bottleneck:${preview.bottleneck}`} />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-px border border-line bg-line">
                <div className="bg-paper p-5">
                  <p className="eyebrow">Strongest</p>
                  <p className="mt-2 font-medium">
                    {DIMENSION_LABELS[preview.strongest]} <span className="font-mono text-ink-3">{strongest?.score}</span>
                  </p>
                </div>
                <div className="bg-paper p-5">
                  <p className="eyebrow">Weakest</p>
                  <p className="mt-2 font-medium">
                    {DIMENSION_LABELS[preview.weakest]} <span className="font-mono text-ink-3">{weakest?.score}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className={`${wrap} grid gap-10 py-12 sm:py-16 lg:grid-cols-12`}>
          <div className="lg:col-span-4">
            <h2 className="text-h3 font-semibold">Score breakdown</h2>
            <p className="mt-3 text-ink-2">
              Seven dimensions, each scored 0–100 from your answers. Metrics you didn&apos;t know are left out, not guessed.
            </p>
          </div>
          <div className="lg:col-span-8">
            <ScoreBars data={preview.dimensions} highlight={preview.bottleneck} />
            <dl className="mt-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {preview.dimensions.map((d) => (
                <div key={d.dimension} className="flex gap-2">
                  <dt className="font-medium">{DIMENSION_LABELS[d.dimension]}:</dt>
                  <dd className="text-ink-2">
                    {DIMENSION_DESCRIPTIONS[d.dimension]}
                    {!d.hasData && " Not enough data to score."}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {report ? <FullReport report={report} reportId={reportId} /> : gate}

      <NextSteps reportId={reportId} hasReport={!!report} />
    </div>
  );
}

function JourneySteps({ current }: { current: 1 | 2 }) {
  const steps = ["Diagnose", "Understand your results", "Talk to an advisor"];
  return (
    <ol className="mt-8 grid grid-cols-3 gap-px border border-line bg-line text-xs sm:text-sm print:hidden" aria-label="Your next steps">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className={`flex items-center gap-2 px-3 py-3 sm:px-4 ${state === "current" ? "bg-card font-medium" : "bg-paper text-ink-3"}`}>
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.7rem] ${
                state === "done" ? "border-accent bg-accent text-paper" : state === "current" ? "border-ink" : "border-line-strong"
              }`}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className="leading-tight">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

function FullReport({ report, reportId }: { report: DiagnosticReport; reportId?: string }) {
  const recs = report.recommendations;
  return (
    <>
      {report.benchmarks && report.benchmarks.length > 0 && <Benchmarks items={report.benchmarks} reportId={reportId} />}

      <section className="border-b border-line">
        <div className={`${wrap} py-12 sm:py-16`}>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-h3 font-semibold">{recs ? "Your recommendations" : "Top opportunities"}</h2>
            </div>
            <p className="text-ink-2 lg:col-span-8">
              {recs
                ? "Ranked by expected impact, the size of your gap against the benchmark, and how relevant each one is to your business type. At most ten, so you can focus."
                : "Prioritised by Impact × Confidence ÷ Effort. Confidence reflects how much of the relevant data you were able to provide."}
            </p>
          </div>
          {recs ? (
            recs.length ? (
              <ol className="mt-10 space-y-px border border-line bg-line">
                {recs.map((r, i) => (
                  <RecommendationCard key={r.id} r={r} n={i + 1} reportId={reportId} />
                ))}
              </ol>
            ) : (
              <p className="mt-6 text-ink-2">No significant gaps were found in the areas you answered. An advisor review can look for the less visible gains.</p>
            )
          ) : (
            <ol className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-3">
              {report.opportunities.map((o, i) => (
                <OpportunityCard key={o.id} o={o} n={i + 1} />
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="border-b border-line">
        <div className={`${wrap} py-12 sm:py-16`}>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className="text-h3 font-semibold">Opportunity estimate</h2>
              <p className="mt-3 text-sm text-ink-3">Estimated opportunity based on user-provided inputs. These are estimates, not guarantees.</p>
            </div>
            <div className="lg:col-span-8">
              {report.estimatedOpportunity ? (
                <div className="border-l-2 border-accent pl-5">
                  <p className="eyebrow">Combined revenue opportunity, per month</p>
                  <p className="tabular mt-2 text-[clamp(1.75rem,4.5vw,3rem)] font-semibold tracking-[-0.03em]">
                    <CountUp value={formatMoney(report.estimatedOpportunity.monthlyLow, report.currency)} />
                    <span className="text-ink-3"> – </span>
                    <CountUp value={formatMoney(report.estimatedOpportunity.monthlyHigh, report.currency)} />
                  </p>
                  <p className="mt-2 text-sm text-ink-3">
                    Sum of the revenue scenarios below. Scenarios overlap in practice, so treat this as a ceiling for discussion, not a forecast.
                  </p>
                </div>
              ) : (
                <p className="text-ink-2">Not enough data to estimate the revenue opportunity accurately.</p>
              )}
            </div>
          </div>
          <ul className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2">
            {report.estimates.map((e) => (
              <EstimateCard key={e.id} e={e} currency={report.currency} />
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-line">
        <div className={`${wrap} py-10 text-sm text-ink-3`}>
          <p>
            Methodology: scores use Growx Era&apos;s weighting (Market 10%, Value 10%, Acquisition 15%, Activation 15%, Retention 15%,
            Expansion 15%, Scale 20%). The primary bottleneck is chosen by Impact × Severity × Dependency, so the lowest score is not
            automatically the bottleneck. Benchmarks are Growx Era working ranges for your business type, not published industry
            statistics. Scoring version {report.scoringVersion}
            {report.benchmarkVersion && `, benchmarks ${report.benchmarkVersion}`}.
          </p>
        </div>
      </section>
    </>
  );
}

const POSITION: Record<BenchmarkSnapshot["position"], { label: string; className: string }> = {
  worse: { label: "Below benchmark", className: "border-alert text-alert" },
  within: { label: "Within benchmark", className: "border-line-strong text-ink-2" },
  better: { label: "Above benchmark", className: "border-accent text-accent" },
  outlier: { label: "Significantly above", className: "border-ink bg-ink text-paper" },
};

function fmt(v: number, unit: BenchmarkSnapshot["unit"]) {
  return unit === "%" ? `${formatNumber(v, v < 10 ? 1 : 0)}%` : `${formatNumber(v, 1)}×`;
}

function Benchmarks({ items, reportId }: { items: BenchmarkSnapshot[]; reportId?: string }) {
  const worst = items.find((b) => b.position === "worse");
  return (
    <section className="border-b border-line">
      <div className={`${wrap} py-12 sm:py-16`}>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-h3 font-semibold">Against the benchmark</h2>
          </div>
          <p className="text-ink-2 lg:col-span-8">
            How your metrics compare with the working range for businesses like yours. A result far above the range is treated as
            a special case rather than a simple win.
          </p>
        </div>
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {items.map((b) => {
            const pos = POSITION[b.position];
            return (
              <li key={b.metric} className="grid gap-3 py-5 sm:grid-cols-12 sm:items-start">
                <div className="sm:col-span-4">
                  <p className="font-medium">{b.label}</p>
                  <p className="mt-1 text-xs text-ink-3">{b.basis}</p>
                </div>
                <div className="flex items-baseline gap-4 sm:col-span-3">
                  <span className="tabular font-mono text-xl">{fmt(b.value, b.unit)}</span>
                  <span className="text-sm text-ink-3">
                    range {fmt(b.low, b.unit)}–{fmt(b.high, b.unit)}
                  </span>
                </div>
                <div className="sm:col-span-5">
                  <span className={`inline-block border px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] ${pos.className}`}>{pos.label}</span>
                  <p className="mt-2 text-sm text-ink-2">{b.explanation}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {worst && (
          <div className="mt-6">
            <AdvisorCta reportId={reportId} context={`benchmark:${worst.metric}`} message={`${worst.label} is below the range for businesses like yours.`} />
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendationCard({ r, n, reportId }: { r: RecommendationSnapshot; n: number; reportId?: string }) {
  const cs = r.caseStudy ? getCaseStudy(r.caseStudy) : undefined;
  return (
    <li className="grid gap-6 bg-paper p-6 sm:p-8 lg:grid-cols-12">
      <div className="lg:col-span-1">
        <p className="font-mono text-sm text-accent">{String(n).padStart(2, "0")}</p>
      </div>
      <div className="lg:col-span-7">
        <p className="eyebrow">{DIMENSION_LABELS[r.dimension]}</p>
        <h3 className="mt-2 text-h3 font-semibold">{r.title}</h3>
        <p className="mt-3 leading-relaxed text-ink-2">{r.body}</p>
        {(cs || r.link) && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm print:hidden">
            {cs && (
              <Link href={`/case-studies/${cs.slug}`} className="underline underline-offset-4">
                Case study: {cs.title}
              </Link>
            )}
            {r.link && (
              <Link href={r.link.href} className="underline underline-offset-4">
                {r.link.label}
              </Link>
            )}
          </div>
        )}
        {n === 1 && (
          <div className="mt-6">
            <AdvisorCta reportId={reportId} context={`recommendation:${r.id}`} message="This is your highest-impact move. An advisor can help you plan it." />
          </div>
        )}
      </div>
      <div className="lg:col-span-4">
        <dl className="grid grid-cols-2 gap-px border border-line bg-line text-center">
          {(
            [
              ["Impact", r.impact],
              ["Effort", r.effort],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="bg-card px-2 py-3">
              <dt className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-3">{k}</dt>
              <dd className="mt-1 font-mono text-sm font-medium uppercase">{LEVEL_LABEL[v]}</dd>
            </div>
          ))}
        </dl>
        {r.evidence.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow">Why</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {r.evidence.map((e) => (
                <li key={e} className="border-b border-line pb-1.5">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

function OpportunityCard({ o, n }: { o: Opportunity; n: number }) {
  return (
    <li className="flex flex-col bg-paper p-6 sm:p-8">
      <p className="font-mono text-sm text-accent">{String(n).padStart(2, "0")}</p>
      <h3 className="mt-4 text-h3 font-semibold">{o.title}</h3>
      <p className="mt-3 leading-relaxed text-ink-2">{o.summary}</p>
      {o.evidence.length > 0 && (
        <ul className="mt-6 space-y-1.5 text-sm">
          {o.evidence.map((s) => (
            <li key={s.id} className="flex justify-between gap-3 border-b border-line pb-1.5">
              <span className="text-ink-2">{s.label}</span>
              <span className="text-right font-mono">{s.display}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function EstimateCard({ e, currency }: { e: Estimate; currency: string }) {
  return (
    <li className="bg-paper p-6">
      <p className="font-medium">{e.title}</p>
      {e.available ? (
        <>
          <p className="mt-2 text-sm text-ink-2">{e.scenario}</p>
          <p className="tabular mt-4 font-mono text-xl">
            {formatMoney(e.monthlyLow ?? 0, currency)} – {formatMoney(e.monthlyHigh ?? 0, currency)}
            <span className="ml-1 text-sm text-ink-3">/ month {e.kind === "savings" ? "saved" : ""}</span>
          </p>
          {e.assumptions && (
            <ul className="mt-3 space-y-1 text-xs text-ink-3">
              {e.assumptions.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">Not enough data to estimate this opportunity accurately.</p>
          {e.missing && e.missing.length > 0 && <p className="mt-2 text-xs text-ink-3">Needs: {e.missing.join(", ")}.</p>}
        </>
      )}
    </li>
  );
}

function NextSteps({ reportId, hasReport }: { reportId?: string; hasReport: boolean }) {
  return (
    <section className="bg-ink text-paper print:hidden">
      <div className={`${wrap} grid gap-10 py-16 sm:py-20 lg:grid-cols-12`}>
        <div className="lg:col-span-6">
          <p className="eyebrow !text-paper/60">Step 3 · Talk to an advisor</p>
          <h2 className="mt-4 text-h2 font-semibold">Turn this diagnosis into a plan.</h2>
          <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-paper/70">
            {hasReport
              ? "A Growx Era advisor reads your report before replying, so you don't have to explain your business from scratch."
              : "Get your full report first, then an advisor can walk you through it."}
          </p>
        </div>
        <div className="grid gap-px self-end border border-paper/20 bg-paper/20 sm:grid-cols-2 lg:col-span-6">
          <Link href={advisorHref("ask", reportId, "report")} className="group bg-ink p-6 hover:bg-paper/5">
            <p className="font-medium">Ask an advisor</p>
            <p className="mt-2 text-sm text-paper/60">Send a question about your results. We reply by email.</p>
            <p className="mt-4 text-sm text-accent-bright">Ask a question →</p>
          </Link>
          <Link href={advisorHref("book", reportId, "report")} className="group bg-ink p-6 hover:bg-paper/5">
            <p className="font-medium">Book a Free 30-Minute Review</p>
            <p className="mt-2 text-sm text-paper/60">Pick a time. We go through your report and the first moves together.</p>
            <p className="mt-4 text-sm text-accent-bright">Choose a time →</p>
          </Link>
        </div>
      </div>
    </section>
  );
}
