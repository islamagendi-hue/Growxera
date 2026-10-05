import type { Metadata } from "next";
import { GrowthSystem } from "@/components/home/GrowthSystem";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { HOW_WE_WORK } from "@/content/site-content";

export const metadata: Metadata = {
  title: "How We Work",
  description: "Diagnose the bottleneck, transform the growth system, and scale what works. How a Growx Era engagement runs.",
  alternates: { canonical: "/how-we-work" },
};

export default function HowWeWork() {
  return (
    <>
      <PageHero
        eyebrow="How we work"
        title="We find what's holding growth back, then build the system to fix it."
        lead="Most growth problems are system problems. We work across the full system, from market to scale, and start every engagement with a diagnosis rather than a channel plan."
      />
      <Section index="01" eyebrow="The process" title="Three stages, one direction.">
        <ol className="divide-y divide-line border-y border-line">
          {HOW_WE_WORK.map((s) => (
            <li key={s.n} className="grid gap-4 py-10 md:grid-cols-12">
              <p className="font-mono text-sm text-accent md:col-span-2">{s.n}</p>
              <div className="md:col-span-4">
                <p className="text-h3 font-semibold">{s.title}</p>
                <p className="mt-1 text-ink-2">{s.line}</p>
              </div>
              <p className="leading-relaxed text-ink-2 md:col-span-6">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>
      <Section tone="card" index="02" eyebrow="The framework" title="The seven dimensions we work across.">
        <GrowthSystem tone="paper" />
      </Section>
      <Section index="03" eyebrow="Principles" title="How we think about growth.">
        <ul className="grid gap-8 md:grid-cols-3">
          {[
            ["Diagnosis before prescription", "We don't recommend a channel, a tool or a campaign until we know where the constraint is."],
            ["Economics, not vanity metrics", "We measure what moves the P&L: revenue, CAC, payback, retention and margin."],
            ["Systems that outlast us", "We build capability, data and rhythm into your team, so results hold after the engagement."],
          ].map(([t, d]) => (
            <li key={t} className="border-t border-ink pt-6">
              <p className="font-medium">{t}</p>
              <p className="mt-3 leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand source="how_we_work" />
    </>
  );
}
