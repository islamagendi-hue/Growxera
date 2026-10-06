import Link from "next/link";
import { CASE_STUDIES } from "@/content/case-studies";
import { CaseStudyPlaceholders } from "./CaseStudyPlaceholders";

/** Real case studies when available, otherwise clearly marked placeholders. */
export function CaseStudyCards({ limit }: { limit?: number }) {
  const cases = limit ? CASE_STUDIES.slice(0, limit) : CASE_STUDIES;
  if (!cases.length) return <CaseStudyPlaceholders limit={limit ?? 4} />;
  return (
    <ul className="grid gap-6 lg:grid-cols-2">
      {cases.map((c) => (
        <li key={c.slug}>
          <Link href={`/case-studies/${c.slug}`} className="group block h-full border border-line bg-card p-6 transition-colors hover:border-ink sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
              {[c.sector, c.market].filter(Boolean).join(" · ")}
            </p>
            <h3 className="mt-5 text-h3 font-semibold">{c.title}</h3>
            {c.growthLever && (
              <p className="mt-3 text-sm text-ink-2">
                <span className="font-medium text-ink">Growth lever:</span> {c.growthLever}
              </p>
            )}
            <dl className={`mt-6 grid gap-px border border-line bg-line ${c.metrics.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {c.metrics.slice(0, 4).map((m) => (
                <div key={m.label} className="bg-card p-3">
                  <dt className="text-xs text-ink-3">{m.label}</dt>
                  <dd className="tabular mt-1 font-mono text-xl font-medium">{m.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-ink-2 group-hover:text-ink">
              Read the case <span aria-hidden>→</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
