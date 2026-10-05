import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { INSIGHTS } from "@/content/insights";

export const metadata: Metadata = {
  title: "Insights",
  description: "Practical articles on growth diagnosis, tracking, experimentation and retention for businesses in KSA and the GCC.",
  alternates: { canonical: "/insights" },
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Insights() {
  return (
    <>
      <PageHero eyebrow="Insights" title="Notes from the growth bench." lead="Practical thinking on diagnosis, tracking, experimentation and retention. No fluff, no recycled listicles." />
      <Section>
        <ul className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {INSIGHTS.map((a) => (
            <li key={a.slug}>
              <Link href={`/insights/${a.slug}`} className="group flex h-full flex-col bg-paper p-6 transition-colors hover:bg-paper-2 sm:p-8">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
                  {a.topic} · {a.readMinutes} min read
                </p>
                <h2 className="mt-5 text-h3 font-semibold leading-snug">{a.title}</h2>
                <p className="mt-3 flex-1 leading-relaxed text-ink-2">{a.description}</p>
                <p className="mt-6 text-sm text-ink-3">
                  {fmt(a.date)} · <span className="text-ink group-hover:underline">Read</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand source="insights" />
    </>
  );
}
