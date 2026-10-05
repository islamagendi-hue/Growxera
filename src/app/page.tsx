import type { Metadata } from "next";
import { CaseStudyPlaceholders } from "@/components/home/CaseStudyPlaceholders";
import { GrowthSystem } from "@/components/home/GrowthSystem";
import { IllustrativeReport } from "@/components/home/IllustrativeReport";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container, Section } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { BOTTLENECKS, CAPABILITIES, HOW_WE_WORK, OFFERINGS, PROBLEM_ORIGINS } from "@/content/site-content";

export const metadata: Metadata = { title: { absolute: SITE.title }, alternates: { canonical: "/" } };

export default function Home() {
  const talkHref = SITE.bookingUrl || "/contact";
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Container className="relative grid gap-14 py-16 sm:py-24 lg:grid-cols-12 lg:gap-10 lg:py-28">
          <div className="lg:col-span-7">
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
          <div className="lg:col-span-5 lg:pt-6">
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
        eyebrow="The Growx_era system"
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
      <section id="diagnostic" className="scroll-mt-20 bg-paper-2 py-20 sm:py-28">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow">
              <span className="mr-3">04</span>Growx_era Growth Diagnostic™
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
              ["Top 3 opportunities", "Prioritised by impact, confidence and effort."],
              ["Opportunity estimate", "A revenue range from your own numbers, only where the data supports it."],
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
        title="Problem. Diagnosis. Intervention. Result."
        lead="Every case study follows the same structure and leads with the numbers that matter: revenue, CAC, conversion, retention, AOV, LTV, payback and margin."
      >
        <CaseStudyPlaceholders limit={2} />
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
              Talk to Growx_era
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
