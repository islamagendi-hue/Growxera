import type { Metadata } from "next";
import { CaseStudyPlaceholders } from "@/components/home/CaseStudyPlaceholders";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "How Growx_era diagnoses growth bottlenecks and what changes as a result.",
  alternates: { canonical: "/case-studies" },
  // Placeholder content: keep out of search results until real cases are published.
  robots: { index: false, follow: true },
};

export default function CaseStudies() {
  return (
    <>
      <PageHero
        eyebrow="Case studies"
        title="Problem → Diagnosis → Intervention → Result."
        lead="Case studies will be published here as engagements complete and clients approve them. Each leads with quantified business impact."
      />
      <Section>
        <CaseStudyPlaceholders limit={4} />
      </Section>
      <CtaBand source="case_studies" />
    </>
  );
}
