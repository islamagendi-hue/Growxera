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
  problem: string;
  diagnosis: string;
  intervention: string[];
  result: string;
  businessImpact: string;
  /** Period the results were measured over, e.g. "Q1–Q2 2026". */
  period?: string;
}

export const CASE_STUDIES: CaseStudy[] = [];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
