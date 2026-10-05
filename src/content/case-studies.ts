/**
 * Case studies. Add real, client-approved engagements only: never invent
 * clients, numbers or quotes. While this list is empty the site shows clearly
 * marked placeholders instead.
 */
export interface CaseMetric {
  label: string;
  /** e.g. "+38%", "SAR 1.2M", "−22%" */
  value: string;
  /** e.g. "Repeat purchase rate in 6 months" */
  detail?: string;
}

export interface CaseStudy {
  slug: string;
  /** Anonymised name is fine, e.g. "Saudi D2C beauty brand". */
  client: string;
  sector: string;
  market: string;
  title: string;
  /** Up to four headline results, shown on cards. */
  metrics: CaseMetric[];
  /** Narrative sections are optional: only what the client has confirmed is shown. */
  problem?: string;
  diagnosis?: string;
  intervention?: string[];
  result?: string;
  businessImpact?: string;
  /** Period the results were measured over, e.g. "Q1–Q2 2026". */
  period?: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "mobile-app-1m-in-3-months",
    client: "Mobile app",
    sector: "Mobile app",
    market: "Saudi Arabia",
    title: "A mobile app that generated SAR 1M in revenue in 3 months",
    metrics: [
      { label: "Revenue", value: "SAR 1M" },
      { label: "Timeframe", value: "3 months" },
    ],
    result: "SAR 1 million in revenue within the first three months.",
  },
];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
