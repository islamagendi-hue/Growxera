import type { Metadata } from "next";
import { ExperimentLab } from "@/components/lab/ExperimentLab";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHero } from "@/components/ui/PageHero";
import { Section } from "@/components/ui/Section";
import { EXPERIMENTS, EXPERIMENT_MODELS } from "@/content/experiments";

export const metadata: Metadata = {
  title: "Experimentation Lab",
  description: `${EXPERIMENTS.length} growth experiment ideas for e-commerce, mobile apps, SaaS, lead generation and multi-branch services, each with a hypothesis and a decision metric.`,
  alternates: { canonical: "/experimentation-lab" },
};

export default function ExperimentationLab() {
  return (
    <>
      <PageHero
        eyebrow="Experimentation Lab"
        title={`${EXPERIMENTS.length} growth experiments, ready to test.`}
        lead={`A working library of experiment ideas across ${EXPERIMENT_MODELS.length} business models. Each one is a hypothesis with the metric that decides it, not a promised result. Filter by your model and the stage of the funnel you want to move.`}
      />
      <Section>
        <ExperimentLab />
      </Section>
      <Section
        tone="card"
        eyebrow="How we run it"
        title="Ideas are cheap. A testing system is not."
        lead="We prioritise with ICE (impact, confidence, ease), run a weekly testing cadence, and keep every result in one learning log, so wins compound and losses are only paid for once."
      />
      <CtaBand source="experimentation_lab" />
    </>
  );
}
