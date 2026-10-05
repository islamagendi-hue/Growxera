"use client";
import { useEffect, useRef, useState } from "react";
import { CtaLink } from "@/components/ui/CtaLink";
import { SITE } from "@/config/site";
import { track } from "@/lib/analytics/client";
import { DIMENSION_DESCRIPTIONS, DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { Answers, DiagnosticReport, Estimate, Level, Opportunity, ReportPreview } from "@/lib/diagnostic/types";
import { formatMoney } from "@/lib/format";
import { LeadForm } from "./LeadForm";
import { ScoreBars } from "./ScoreBars";

const LEVEL_LABEL: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };

export function Results({
  preview,
  report,
  sessionId,
  answers,
  onUnlocked,
  onRestart,
}: {
  preview: ReportPreview;
  report?: DiagnosticReport;
  sessionId: string;
  answers?: Answers;
  onUnlocked?: (r: DiagnosticReport) => void;
  /** Omitted on a shared report link, where "Start over" becomes a link to the diagnostic. */
  onRestart?: () => void;
}) {
  const unlocked = !!report;
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    const key = `${sessionId}:${unlocked}`;
    if (viewed.current === key) return;
    viewed.current = key;
    track("report_viewed", { sessionId, full: unlocked });
  }, [sessionId, unlocked]);

  const bookingHref = SITE.bookingUrl || "/contact";
  const strongest = preview.dimensions.find((d) => d.dimension === preview.strongest);

  return (
    <div className="pb-8">
      {/* Score header */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">Growth Diagnostic™ · Preliminary diagnosis</p>
            <div className="flex gap-4 text-sm print:hidden">
              <button type="button" onClick={() => window.print()} className="text-ink-2 underline-offset-4 hover:underline">
                Download PDF report
              </button>
              {onRestart ? (
                <button type="button" onClick={onRestart} className="text-ink-2 underline-offset-4 hover:underline">
                  Start over
                </button>
              ) : (
                <a href="/diagnostic" className="text-ink-2 underline-offset-4 hover:underline">
                  Take the diagnostic
                </a>
              )}
            </div>
          </div>
          {emailedTo && (
            <p role="status" className="mt-6 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm print:hidden">
              We&apos;ve emailed a copy of this report to <strong>{emailedTo}</strong>.
            </p>
          )}
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h1 className="eyebrow !text-ink">Your Growth Score</h1>
              <p className="tabular mt-3 text-[clamp(5rem,14vw,9rem)] font-semibold leading-[0.9] tracking-[-0.05em]">
                {preview.overallScore}
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
                    {DIMENSION_LABELS[preview.weakest]}{" "}
                    <span className="font-mono text-ink-3">{preview.dimensions.find((d) => d.dimension === preview.weakest)?.score}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Breakdown */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:px-10">
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

      {unlocked ? (
        <FullReport report={report} />
      ) : (
        <section className="bg-paper-2 print:hidden">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-5">
              <p className="eyebrow">Your full report</p>
              <h2 className="mt-4 text-h2 font-semibold">Unlock your top opportunities and their estimated value.</h2>
              <ul className="mt-8 space-y-3">
                {[
                  "Top 3 growth opportunities, ranked by impact, confidence and effort",
                  "The evidence behind each one, from your own answers",
                  `Estimated revenue opportunity in ${preview.currency}, where your data supports it`,
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="text-accent">→</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-line bg-card p-6 sm:p-8 lg:col-span-7">
              <LeadForm
                source="diagnostic"
                sessionId={sessionId}
                answers={answers}
                submitLabel="Show my full report"
                onSuccess={(r, to) => {
                  if (to) setEmailedTo(to);
                  if (r) onUnlocked?.(r);
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Lead → consultation */}
      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-7">
            <h2 className="text-h2 font-semibold">Want us to turn this diagnosis into a growth plan?</h2>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-paper/70">
              Your diagnostic gives you the signal. Growx Era can validate the diagnosis, quantify the opportunity, and
              build the roadmap to capture it.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end lg:justify-end print:hidden">
            <CtaLink href={bookingHref} cta="results_book" booking variant="inverse" className="w-full sm:w-auto">
              Book a Growth Diagnostic
            </CtaLink>
            <CtaLink href="/contact" cta="results_talk" variant="ghost" className="!text-paper decoration-paper/40">
              Talk to Growx Era
            </CtaLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function FullReport({ report }: { report: DiagnosticReport }) {
  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-12">
            <h2 className="text-h3 font-semibold lg:col-span-4">Top opportunities</h2>
            <p className="text-ink-2 lg:col-span-8">
              Prioritised by Impact × Confidence ÷ Effort. Confidence reflects how much of the relevant data you were able to provide.
            </p>
          </div>
          <ol className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-3">
            {report.opportunities.map((o, i) => (
              <OpportunityCard key={o.id} o={o} n={i + 1} />
            ))}
          </ol>
          {report.opportunities.length === 0 && (
            <p className="mt-6 text-ink-2">Every dimension scored strongly. The next step is a deeper diagnostic to find the less visible gains.</p>
          )}
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
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
                    {formatMoney(report.estimatedOpportunity.monthlyLow, report.currency)}
                    <span className="text-ink-3"> – </span>
                    {formatMoney(report.estimatedOpportunity.monthlyHigh, report.currency)}
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
        <div className="mx-auto max-w-[1240px] px-4 py-10 text-sm text-ink-3 sm:px-6 lg:px-10">
          <p>
            Methodology: scores use Growx Era&apos;s initial weighting (Market 10%, Value 10%, Acquisition 15%, Activation 15%,
            Retention 15%, Expansion 15%, Scale 20%). The primary bottleneck is chosen by Impact × Severity × Dependency, so the
            lowest score is not automatically the bottleneck. Scoring version {report.scoringVersion}.
          </p>
        </div>
      </section>
    </>
  );
}

function OpportunityCard({ o, n }: { o: Opportunity; n: number }) {
  return (
    <li className="flex flex-col bg-paper p-6 sm:p-8">
      <p className="font-mono text-sm text-accent">{String(n).padStart(2, "0")}</p>
      <h3 className="mt-4 text-h3 font-semibold">{o.title}</h3>
      <p className="mt-3 leading-relaxed text-ink-2">{o.summary}</p>
      <dl className="mt-6 grid grid-cols-3 gap-px border border-line bg-line text-center">
        {(
          [
            ["Impact", o.impact],
            ["Confidence", o.confidence],
            ["Effort", o.effort],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-card px-2 py-3">
            <dt className="text-[0.68rem] uppercase tracking-[0.08em] text-ink-3">{k}</dt>
            <dd className="mt-1 font-mono text-sm font-medium uppercase">{LEVEL_LABEL[v]}</dd>
          </div>
        ))}
      </dl>
      {o.evidence.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow">Why</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {o.evidence.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 border-b border-line pb-1.5">
                <span className="text-ink-2">{s.label}</span>
                <span className="text-right font-mono">{s.display}</span>
              </li>
            ))}
          </ul>
        </div>
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
