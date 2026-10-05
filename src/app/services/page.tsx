import type { Metadata } from "next";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { CAPABILITIES, OFFERINGS, STANDALONE_SERVICES } from "@/content/site-content";

export const metadata: Metadata = {
  title: "Services",
  description: "Growth Diagnostic, Growth Transformation and Growth Partnership, plus MVP builds and tracking implementation: one path from finding the problem to scaling the solution.",
  alternates: { canonical: "/services" },
};

export default function Services() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="From diagnosis to partnership."
        lead="Marketing, CRM, CRO, analytics and GTM are components of a growth system, not a menu. We engage in three stages, each building on the last."
      />
      <Section>
        <ol className="space-y-px border border-line bg-line">
          {OFFERINGS.map((o, i) => (
            <li key={o.name} className="grid gap-6 bg-paper p-6 sm:p-10 lg:grid-cols-12">
              <p className="font-mono text-sm text-ink-3 lg:col-span-2">Stage {i + 1}</p>
              <div className="lg:col-span-4">
                <h2 className="text-h3 font-semibold">{o.name}</h2>
                <p className="mt-1 text-accent">{o.line}</p>
              </div>
              <div className="lg:col-span-6">
                <p className="leading-relaxed text-ink-2">{o.text}</p>
                <ul className="mt-5 space-y-2">
                  {o.deliverables.map((d) => (
                    <li key={d} className="flex gap-3 text-sm">
                      <span aria-hidden className="text-accent">
                        →
                      </span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        {STANDALONE_SERVICES.map((svc) => (
        <div key={svc.id} id={svc.id} className="mt-px grid scroll-mt-24 gap-6 border border-line bg-paper-2 p-6 sm:p-10 lg:grid-cols-12">
          <p className="font-mono text-sm text-ink-3 lg:col-span-2">Also</p>
          <div className="lg:col-span-4">
            <h2 className="text-h3 font-semibold">{svc.name}</h2>
            <p className="mt-1 text-accent">{svc.line}</p>
          </div>
          <div className="lg:col-span-6">
            <p className="leading-relaxed text-ink-2">{svc.text}</p>
            <ul className="mt-5 space-y-2">
              {svc.deliverables.map((d) => (
                <li key={d} className="flex gap-3 text-sm">
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
        ))}
      </Section>
      <Section tone="card" eyebrow="Supporting capabilities" title="Applied where the diagnosis points.">
        <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
          {CAPABILITIES.map((c) => (
            <li key={c} className="bg-paper-2 p-5 font-medium">
              {c}
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand source="services" />
    </>
  );
}
