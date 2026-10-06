import type { Metadata } from "next";
import { CaseStudyCards } from "@/components/home/CaseStudyCards";
import { GrowthSystem } from "@/components/home/GrowthSystem";
import { IllustrativeReport } from "@/components/home/IllustrativeReport";
import { ProductMockups } from "@/components/home/ProductMockups";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container, Section } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { TRACK_RECORD } from "@/content/case-studies";
import { EXPERIMENTS } from "@/content/experiments";
import { FAQ } from "@/content/faq";
import { BOTTLENECKS, CAPABILITIES, HOW_WE_WORK, OFFERINGS, STANDALONE_SERVICES, PROBLEM_ORIGINS } from "@/content/site-content";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = { title: { absolute: SITE.title }, alternates: { canonical: "/" } };

export default function Home() {
  const talkHref = SITE.bookingUrl || "/contact";
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Container className="relative grid gap-[3.4375rem] py-[3.4375rem] sm:py-[5.5625rem] lg:grid-cols-[1.618fr_1fr] lg:gap-[2.125rem] lg:py-[5.5625rem]">
          <div>
            <p className="eyebrow">Growth &amp; Transformation Partner · GCC</p>
            <h1 className="mt-6 text-display font-semibold">
              Build Your Next Era of Growth<span className="text-accent">.</span>
            </h1>
            <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-ink-2 sm:text-xl">
              Diagnose what&apos;s holding your business back, discover your biggest growth opportunities, and build a
              system to capture them.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <CtaLink href="/diagnostic" cta="hero_diagnose">
                Diagnose Your Growth
              </CtaLink>
              <CtaLink href="/how-we-work" cta="hero_how_we_work" variant="ghost" className="self-start sm:self-auto">
                Explore How We Work
              </CtaLink>
            </div>
            <p className="mt-14 max-w-[46ch] border-l-2 border-accent pl-4 text-ink-2">
              Your business doesn&apos;t need more marketing. It needs a better growth system.
            </p>
          </div>
          <div className="lg:pt-6">
            <IllustrativeReport />
          </div>
        </Container>
      </section>

      {/* THE PROBLEM */}
      <Section
        index="01"
        eyebrow="The problem"
        title="Growth rarely breaks in one place."
        lead="When revenue stalls, the instinct is to buy more traffic. But the constraint can sit anywhere in the system, and pushing more volume into a leaking system makes it more expensive, not more profitable."
      >
        <ul className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-4">
          {PROBLEM_ORIGINS.map((p, i) => (
            <li key={p} className="border-b border-r border-line p-5 sm:p-6">
              <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-6 text-lg font-medium">{p}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-h3 font-semibold">
          More traffic isn&apos;t always the answer<span className="text-accent">.</span>
        </p>
      </Section>

      {/* SYSTEM */}
      <Section
        id="system"
        tone="ink"
        index="02"
        eyebrow="The Growx Era system"
        title="Seven dimensions. One growth system."
        lead="Every engagement and every diagnostic runs on the same framework, so we can see where growth is constrained and what fixing it is worth."
      >
        <GrowthSystem />
      </Section>

      {/* BOTTLENECKS */}
      <Section index="03" eyebrow="Growth bottlenecks" title="Where is your growth stuck?">
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {BOTTLENECKS.map((b) => (
            <li key={b.title} className="flex flex-col bg-paper p-6 sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-accent">{b.title}</p>
              <p className="mt-4 text-xl font-medium leading-snug">{b.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <CtaLink href="/diagnostic" cta="bottlenecks_diagnose" variant="secondary">
            Find yours
          </CtaLink>
        </div>
      </Section>

      {/* DIAGNOSTIC TOOL */}
      <section id="diagnostic" className="scroll-mt-20 bg-paper-2 py-[3.4375rem] sm:py-[5.5625rem]">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow">
              <span className="mr-3">04</span>Growx Era Growth Diagnostic™
            </p>
            <h2 className="mt-6 text-h2 font-semibold">Find Your Growth Bottleneck</h2>
            <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-ink-2">
              Get a preliminary Growth Score and discover where your biggest opportunities may be hiding.
            </p>
            <div className="mt-10">
              <CtaLink href="/diagnostic" cta="diagnostic_section_start">
                Start Free Growth Diagnostic
              </CtaLink>
              <p className="mt-4 text-sm text-ink-3">Free · About 8 minutes · &ldquo;I don&apos;t know&rdquo; is always an option</p>
            </div>
          </div>
          <ol className="grid gap-px self-start border border-line bg-line sm:grid-cols-2 lg:col-span-6">
            {[
              ["Growth Score", "0–100 across seven growth dimensions."],
              ["Primary bottleneck", "Weighted by impact, severity and dependency, not just the lowest score."],
              ["Up to 10 recommendations", "Ranked by impact, the size of your gap and relevance to your business."],
              ["Benchmarks and progress", "How you compare with businesses like yours, and what changed since last time."],
            ].map(([t, d], i) => (
              <li key={t} className="bg-paper-2 p-6">
                <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
                <p className="mt-4 font-medium">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* PRODUCT TOUR */}
      <Section
        eyebrow="Inside the product"
        title="From diagnosis to progress, in one place."
        lead="Run the diagnostic, read your report, act on ranked recommendations, track progress month to month, and talk to an advisor when you want a second pair of eyes."
      >
        <ProductMockups />
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <CtaLink href="/diagnostic" cta="tour_start">
            Start Free Growth Diagnostic
          </CtaLink>
          <CtaLink href="/advisor" cta="tour_advisor" variant="ghost">
            Talk to an advisor
          </CtaLink>
        </div>
      </Section>

      {/* HOW WE WORK */}
      <Section index="05" eyebrow="How we work" title="Diagnose. Transform. Scale.">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {HOW_WE_WORK.map((s) => (
            <li key={s.n} className="border-t border-ink pt-6">
              <p className="font-mono text-sm text-accent">{s.n}</p>
              <p className="mt-4 text-h3 font-semibold">{s.title}</p>
              <p className="mt-1 text-ink-2">{s.line}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <CtaLink href="/how-we-work" cta="how_we_work_more" variant="ghost">
            How an engagement runs
          </CtaLink>
        </div>
      </Section>

      {/* SERVICES */}
      <Section
        tone="card"
        index="06"
        eyebrow="Services"
        title="One path, from diagnosis to partnership."
        lead="We don't sell disconnected services. Each stage builds on the last."
      >
        <ol className="grid gap-px border border-line bg-line lg:grid-cols-3">
          {OFFERINGS.map((o, i) => (
            <li key={o.name} className="flex flex-col bg-paper-2 p-6 sm:p-8">
              <p className="font-mono text-xs text-ink-3">Stage {i + 1}</p>
              <p className="mt-6 text-h3 font-semibold">{o.name}</p>
              <p className="mt-1 text-accent">{o.line}</p>
              <p className="mt-4 leading-relaxed text-ink-2">{o.text}</p>
            </li>
          ))}
        </ol>
        {STANDALONE_SERVICES.map((svc) => (
          <div key={svc.id} className="mt-px flex flex-col gap-4 border border-line bg-paper p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs text-ink-3">Also</p>
              <p className="mt-2 text-h3 font-semibold">
                {svc.name} <span className="text-accent">· {svc.line}</span>
              </p>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-2">{svc.text}</p>
            </div>
            <CtaLink href={`/services#${svc.id}`} cta={`${svc.id}_more`} variant="ghost" className="shrink-0">
              Learn more
            </CtaLink>
          </div>
        ))}
        <div className="mt-10">
          <p className="eyebrow">Supporting capabilities</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <li key={c} className="border border-line-strong px-3 py-1.5 text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* CASE STUDIES */}
      <Section
        index="07"
        eyebrow="Case studies"
        title="Problem. Diagnosis. Solution. Result."
        lead="Every case study follows the same structure and leads with the numbers that matter: revenue, CAC, conversion, retention, AOV, LTV, payback and margin."
      >
        <div className="mb-10">
          <dl className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
            {TRACK_RECORD.map((t) => (
              <div key={t.label} className="flex flex-col-reverse bg-paper p-5 sm:p-6">
                <dt className="mt-2 text-sm text-ink-3">{t.label}</dt>
                <dd className="tabular font-mono text-3xl font-medium"><CountUp value={t.value} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">Track record of the Growx Era team in mobile apps, SaaS and e-commerce across KSA and the GCC.</p>
        </div>
        <CaseStudyCards limit={2} />
        <div className="mt-10">
          <CtaLink href="/case-studies" cta="case_studies_all" variant="ghost">
            All case studies
          </CtaLink>
        </div>
      </Section>

      {/* EXPERIMENTATION LAB */}
      <Section
        tone="card"
        index="08"
        eyebrow="Experimentation Lab"
        title={`${EXPERIMENTS.length} growth experiments, ready to test.`}
        lead="Hypotheses and decision metrics grouped by business model: mobile apps, SaaS, e-commerce, marketplaces, food delivery, EdTech, fintech, real estate, clinics, lead generation and multi-branch services."
      >
        <CtaLink href="/experimentation-lab" cta="home_experiment_lab" variant="ghost">
          Open the Experimentation Lab
        </CtaLink>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Five questions people ask first.">
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      </Section>

      {/* FINAL CTA */}
      <section className="bg-ink py-20 text-paper sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <h2 className="text-h2 font-semibold lg:col-span-8">
            Ready to find what&apos;s holding your growth back?
          </h2>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
            <CtaLink href="/diagnostic" cta="final_diagnose" variant="inverse" className="w-full sm:w-auto">
              Start Your Growth Diagnostic
            </CtaLink>
            <CtaLink
              href={talkHref}
              cta="final_talk"
              booking={!!SITE.bookingUrl}
              variant="ghost"
              className="!text-paper decoration-paper/40 hover:decoration-paper"
            >
              Talk to Growx Era
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
