import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/ui/CtaBand";
import { Container } from "@/components/ui/Section";
import { CASE_STUDIES, getCaseStudy } from "@/content/case-studies";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/case-studies/[slug]">): Promise<Metadata> {
  const c = getCaseStudy((await params).slug);
  if (!c) return {};
  return { title: c.title, description: `${[c.sector, c.market].filter(Boolean).join(" · ")}: ${c.result ?? c.title}`, alternates: { canonical: `/case-studies/${c.slug}` } };
}

export default async function CaseStudyPage({ params }: PageProps<"/case-studies/[slug]">) {
  const c = getCaseStudy((await params).slug);
  if (!c) notFound();
  const sections = (
    [
      ["Business type", c.businessType && <p key="t">{c.businessType}</p>],
      ["Problem", c.problem && <p key="p">{c.problem}</p>],
      ["Diagnosis", c.diagnosis && <p key="d">{c.diagnosis}</p>],
      [
        "Solution",
        c.intervention?.length && (
      <ul key="i" className="space-y-2">
        {c.intervention.map((x) => (
          <li key={x} className="flex gap-3">
            <span aria-hidden className="text-accent">→</span>
            {x}
          </li>
        ))}
      </ul>
        ),
      ],
      ["Growth lever", c.growthLever && <p key="g">{c.growthLever}</p>],
      ["Result", c.result && <p key="r">{c.result}</p>],
      ["Business impact", c.businessImpact && <p key="b">{c.businessImpact}</p>],
      ["Stack", c.stack?.length && <p key="s">{c.stack.join(" · ")}</p>],
    ] as [string, React.ReactNode][]
  ).filter(([, body]) => !!body);
  return (
    <>
      <section className="border-b border-line">
        <Container className="py-[3.4375rem] sm:py-[5.5625rem]">
          <p className="eyebrow">
            {["Case study", c.sector, c.market].filter(Boolean).join(" · ")}
          </p>
          <h1 className="mt-6 max-w-[20ch] text-h2 font-semibold">{c.title}</h1>
          {c.role && <p className="mt-6 max-w-2xl leading-relaxed text-ink-2">{c.role}</p>}
          <dl className={`mt-12 grid max-w-3xl grid-cols-2 gap-px border border-line bg-line ${c.metrics.length >= 4 ? "lg:max-w-none lg:grid-cols-4" : c.metrics.length === 3 ? "sm:max-w-none sm:grid-cols-3" : ""}`}>
            {c.metrics.map((m) => (
              <div key={m.label} className="bg-paper p-5">
                <dt className="text-sm text-ink-3">{m.label}</dt>
                <dd className="tabular mt-2 font-mono text-3xl font-medium">{m.value}</dd>
                {m.detail && <dd className="mt-1 text-xs text-ink-3">{m.detail}</dd>}
              </div>
            ))}
          </dl>
          {c.period && <p className="mt-4 text-xs text-ink-3">Measured over {c.period}.</p>}
        </Container>
      </section>
      {sections.length > 0 && (
      <Container className="py-[3.4375rem] sm:py-[5.5625rem]">
        <ol className="divide-y divide-line border-y border-line">
          {sections.map(([title, body], i) => (
            <li key={title} className="grid gap-4 py-10 md:grid-cols-12">
              <p className="font-mono text-sm text-accent md:col-span-2">0{i + 1}</p>
              <h2 className="text-h3 font-semibold md:col-span-3">{title}</h2>
              <div className="leading-relaxed text-ink-2 md:col-span-7">{body}</div>
            </li>
          ))}
        </ol>
      </Container>
      )}
      <CtaBand source={`case_${c.slug}`} />
    </>
  );
}
