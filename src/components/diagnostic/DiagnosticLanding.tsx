"use client";
import type { RefObject } from "react";
import { GrowthSystem } from "@/components/home/GrowthSystem";
import { IllustrativeReport } from "@/components/home/IllustrativeReport";
import { buttonClass } from "@/components/ui/button";
import { CountUp } from "@/components/ui/CountUp";
import { Container, Section } from "@/components/ui/Section";
import { TRACK_RECORD } from "@/content/case-studies";
import { FAQ } from "@/content/faq";
import { track } from "@/lib/analytics/client";

const REPORT_PARTS = [
  ["Growth Score", "0–100 across seven growth dimensions."],
  ["Primary bottleneck", "Weighted by impact, severity and dependency, not just the lowest score."],
  ["Up to 10 recommendations", "Ranked by impact, the size of your gap and relevance to your business."],
  ["Benchmarks and progress", "How you compare with businesses like yours, and what changed since last time."],
];

const STEPS = [
  ["Answer", "Six short sections, about 8 minutes. Optionally upload an Excel or CSV file and we fill in the figures from it."],
  ["Get your report", "Your score, your bottleneck and ranked recommendations, saved to your account so you can track progress."],
  ["Plan the first moves", "Ask an advisor a question or book a free 30-minute review. No card, no commitment."],
];

const PROMISES = [
  ["No guessing", "Every metric has an “I don't know” option. We never invent numbers."],
  ["Adapted to you", "Questions change with your business model."],
  ["Private", "Your answers are used to produce your result. Contact details are optional until you want the full report."],
  ["Yours to delete", "Delete your saved data, or your whole account, yourself at any time."],
];

function Start({ onStart, cta, inverse }: { onStart: () => void; cta: string; inverse?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        track("cta_clicked", { cta, href: "/diagnostic" });
        onStart();
      }}
      className={buttonClass(inverse ? "inverse" : "primary", inverse ? "w-full sm:w-auto" : "")}
    >
      Start Free Growth Diagnostic <span aria-hidden>→</span>
    </button>
  );
}

/** The /diagnostic landing page: shown before the first question, with no site header or footer. */
export function DiagnosticLanding({ onStart, resume, topRef }: { onStart: () => void; resume?: () => void; topRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={topRef}>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Container className="relative grid gap-[3.4375rem] py-[3.4375rem] sm:py-[5.5625rem] lg:grid-cols-[1.618fr_1fr] lg:gap-[2.125rem]">
          <div>
            <p className="eyebrow">Growx Era Growth Diagnostic</p>
            <h1 className="mt-6 text-h2 font-semibold sm:text-[clamp(2.5rem,5.5vw,4.5rem)]">Find Your Growth Bottleneck</h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-2">
              Answer a structured set of questions about your business. You&apos;ll get a preliminary Growth Score across
              seven dimensions, your most likely bottleneck, and where the biggest opportunities may be hiding.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Start onStart={onStart} cta="landing_hero_start" />
              {resume && (
                <button type="button" onClick={resume} className="min-h-12 px-2 text-left underline underline-offset-4">
                  Resume where you left off
                </button>
              )}
            </div>
            <p className="mt-4 text-sm text-ink-3">Free · About 8 minutes · &ldquo;I don&apos;t know&rdquo; is always an option</p>
          </div>
          <IllustrativeReport />
        </Container>
      </section>

      {/* WHAT YOU GET */}
      <Section tone="card" eyebrow="What you get" title="A report you can act on, not a vanity score.">
        <ol className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_PARTS.map(([t, d], i) => (
            <li key={t} className="bg-paper-2 p-6">
              <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
              <p className="mt-4 font-medium">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* SEVEN DIMENSIONS */}
      <Section
        eyebrow="What we measure"
        title="Seven dimensions. One growth system."
        lead="Growth rarely breaks in one place. The diagnostic checks every stage, so you see where growth is constrained before you spend more on traffic."
      >
        <GrowthSystem tone="paper" />
      </Section>

      {/* HOW IT WORKS */}
      <Section tone="card" eyebrow="How it works" title="Three steps to your first moves.">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="border-t border-ink pt-6">
              <p className="font-mono text-sm text-accent">0{i + 1}</p>
              <p className="mt-4 text-h3 font-semibold">{t}</p>
              <p className="mt-2 leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Start onStart={onStart} cta="landing_steps_start" />
        </div>
      </Section>

      {/* PROMISES */}
      <Section eyebrow="Built on your numbers" title="Honest by design.">
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PROMISES.map(([t, d]) => (
            <li key={t} className="bg-paper p-6">
              <p className="font-medium">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* TRACK RECORD */}
      <Section tone="card" eyebrow="Track record" title="Built by operators who have done it.">
        <dl className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {TRACK_RECORD.map((t) => (
            <div key={t.label} className="flex flex-col-reverse bg-paper p-5 sm:p-6">
              <dt className="mt-2 text-sm text-ink-3">{t.label}</dt>
              <dd className="tabular whitespace-nowrap font-mono text-xl font-medium sm:text-3xl">
                <CountUp value={t.value} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">Track record of the Growx Era team in mobile apps, SaaS and e-commerce across KSA and the GCC.</p>
      </Section>

      {/* FAQ */}
      <Section eyebrow="FAQ" title="Before you start.">
        <div className="grid lg:grid-cols-12">
          <div className="divide-y divide-line border-y border-line lg:col-span-9 lg:col-start-4">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="shrink-0 font-mono text-xl text-ink-3 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-6 leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <section className="bg-ink py-20 text-paper sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <h2 className="text-h2 font-semibold lg:col-span-8">Ready to find what&apos;s holding your growth back?</h2>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
            <Start onStart={onStart} cta="landing_final_start" inverse />
          </div>
        </Container>
      </section>
    </div>
  );
}
