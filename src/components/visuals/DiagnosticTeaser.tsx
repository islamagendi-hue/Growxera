import { ScoreBars } from "@/components/diagnostic/ScoreBars";
import { CtaLink } from "@/components/ui/CtaLink";
import { Reveal } from "./Reveal";

/** Side card for articles: a glimpse of the report and a way to get one. Example scores. */
export function DiagnosticTeaser({ source }: { source: string }) {
  return (
    <Reveal className="border border-ink/15 bg-card p-5 shadow-[0_30px_80px_-50px_rgba(14,19,17,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">Growth Diagnostic</p>
        <span className="border border-line px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-3">Illustrative</span>
      </div>
      <p className="mt-4 font-semibold leading-snug">Find your own bottleneck in about 8 minutes.</p>
      <div className="mt-5">
        <ScoreBars
          compact
          highlight="retention"
          data={[
            { dimension: "acquisition", score: 78 },
            { dimension: "activation", score: 61 },
            { dimension: "retention", score: 36 },
            { dimension: "expansion", score: 52 },
          ]}
        />
      </div>
      <div className="mt-6">
        <CtaLink href="/diagnostic" cta={`${source}_diagnose`} className="w-full justify-center">
          Start free diagnostic
        </CtaLink>
      </div>
      <p className="mt-3 text-xs text-ink-3">Free. &ldquo;I don&apos;t know&rdquo; is always an option.</p>
    </Reveal>
  );
}
