import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/ui/CtaBand";
import { Container } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { INSIGHTS, getInsight } from "@/content/insights";

export function generateStaticParams() {
  return INSIGHTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const a = getInsight((await params).slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: `/insights/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.description, publishedTime: a.date },
  };
}

export default async function InsightPage({ params }: PageProps<"/insights/[slug]">) {
  const a = getInsight((await params).slug);
  if (!a) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
    mainEntityOfPage: `${SITE.url}/insights/${a.slug}`,
  };
  return (
    <>
      <article>
        <Container className="py-[3.4375rem] sm:py-[5.5625rem]">
          <Link href="/insights" className="text-sm text-ink-3 hover:text-ink">
            ← Insights
          </Link>
          <p className="eyebrow mt-10">
            {a.topic} · {a.readMinutes} min read
          </p>
          <h1 className="mt-6 max-w-[22ch] text-h2 font-semibold">{a.title}</h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-2">{a.description}</p>
          <div className="mt-12 max-w-[68ch] space-y-10 border-t border-line pt-10">
            {a.sections.map((s, i) => (
              <section key={i}>
                {s.heading && <h2 className="text-h3 font-semibold">{s.heading}</h2>}
                {s.paragraphs.map((p) => (
                  <p key={p} className="mt-4 text-[1.0625rem] leading-[1.75] text-ink-2">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Container>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </article>
      <CtaBand source={`insight_${a.slug}`} />
    </>
  );
}
