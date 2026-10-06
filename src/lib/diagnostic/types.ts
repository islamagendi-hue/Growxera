/**
 * Shared types for the Growx Era Growth Diagnostic.
 * Pure types only: safe to import from client and server code.
 */

export const DIMENSIONS = [
  "market",
  "value",
  "acquisition",
  "activation",
  "retention",
  "expansion",
  "scale",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const BUSINESS_MODELS = ["ecommerce", "leadgen", "subscription", "other"] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

/** Sentinel stored when the user answers "I don't know". Never coerced into a number. */
export const UNKNOWN = "unknown" as const;

export type AnswerValue = number | string | string[];
export type Answers = Record<string, AnswerValue | undefined>;

export type Level = "high" | "medium" | "low";

export interface SignalResult {
  id: string;
  label: string;
  /** Human-readable rendering of the input that produced this signal. */
  display: string;
  score: number;
  weight: number;
}

export interface DimensionScore {
  dimension: Dimension;
  /** 0–100. When no signals are available this is a neutral 50 and `hasData` is false. */
  score: number;
  /** Share (0–1) of this dimension's signal weight that the user could answer. */
  confidence: number;
  hasData: boolean;
  signals: SignalResult[];
}

export interface Opportunity {
  id: string;
  dimension: Dimension;
  title: string;
  summary: string;
  impact: Level;
  confidence: Level;
  effort: Level;
  /** The weakest inputs behind this opportunity, shown as evidence. */
  evidence: SignalResult[];
}

export interface Estimate {
  id: "conversion" | "aov" | "retention" | "cac";
  dimension: Dimension;
  title: string;
  available: boolean;
  /** Plain-language scenario, e.g. "Conversion improves from 1.0% to 1.1–1.25%". */
  scenario?: string;
  /** Monthly figures in the report currency. */
  monthlyLow?: number;
  monthlyHigh?: number;
  /** Whether the figure is incremental revenue or cost saved. */
  kind?: "revenue" | "savings";
  assumptions?: string[];
  /** Why the estimate is unavailable. */
  missing?: string[];
}

export interface BusinessContextSnapshot {
  industry?: string;
  segment?: string;
  businessType?: string;
  category?: string;
  geography?: string;
  city?: string;
  /** Human-readable, e.g. "E-commerce & retail · B2C · Own brand (D2C) · Perfumes & fragrance · Riyadh, Saudi Arabia". */
  label: string;
}

export interface BenchmarkSnapshot {
  metric: string;
  label: string;
  unit: "%" | "x";
  value: number;
  low: number;
  high: number;
  higherIsBetter: boolean;
  position: "worse" | "within" | "better" | "outlier";
  basis: string;
  explanation: string;
}

export interface RecommendationSnapshot {
  id: string;
  dimension: Dimension;
  title: string;
  body: string;
  evidence: string[];
  impact: Level;
  effort: Level;
  gap: number;
  relevance: number;
  score: number;
  caseStudy?: string;
  link?: { href: string; label: string };
}

export interface DiagnosticReport {
  scoringVersion: string;
  generatedAt: string;
  businessModel: BusinessModel;
  currency: string;
  overallScore: number;
  stage: { id: string; label: string; description: string };
  dimensions: DimensionScore[];
  strongest: Dimension;
  weakest: Dimension;
  bottleneck: Dimension;
  bottleneckExplanation: string;
  /** Priority (impact × severity × dependency) per dimension, for transparency. */
  priorities: Record<Dimension, number>;
  opportunities: Opportunity[];
  estimates: Estimate[];
  estimatedOpportunity: { monthlyLow: number; monthlyHigh: number } | null;
  dataConfidence: Level;
  /** Added in scoring 2026.10-v2. Older stored reports don't have these. */
  context?: BusinessContextSnapshot;
  benchmarkVersion?: string;
  benchmarks?: BenchmarkSnapshot[];
  /** Ranked, at most 10. */
  recommendations?: RecommendationSnapshot[];
}

/** The part of the report shown before the lead form. */
export type ReportPreview = Pick<
  DiagnosticReport,
  | "scoringVersion"
  | "businessModel"
  | "currency"
  | "overallScore"
  | "stage"
  | "strongest"
  | "weakest"
  | "bottleneck"
  | "bottleneckExplanation"
  | "dataConfidence"
  | "context"
> & { dimensions: Pick<DimensionScore, "dimension" | "score" | "confidence" | "hasData">[] };
