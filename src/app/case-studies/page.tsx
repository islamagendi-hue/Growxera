import type { Metadata } from "next";
import { CASE_STUDIES } from "@/content/case-studies";
import { CaseStudyCards } from "@/components/home/CaseStudyCards";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { CaseResultsChart } from "@/components/visuals/CaseCharts";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "How Growx Era diagnoses growth bottlenecks and what changes as a result.",
  alternates: { canonical: "/case-studies" },
  // Keep out of search results until real cases are published.
  robots: { index: CASE_STUDIES.length > 0, follow: true },
};

export default function CaseStudies() {
  return (
    <>
      <PageHero
        eyebrow="Case studies"
        title="Problem → Diagnosis → Solution → Result."
        lead={CASE_STUDIES.length ? "Real growth work across mobile apps, e-commerce, multi-branch services and EdTech in KSA and the GCC. Company names are withheld; every number is as reported." : "Case studies will be published here as engagements complete and clients approve them. Each leads with quantified business impact."}
        aside={CASE_STUDIES.length ? <CaseResultsChart studies={CASE_STUDIES} /> : undefined}
      />
      <Section>
        <CaseStudyCards />
      </Section>
      <CtaBand source="case_studies" />
    </>
  );
}
