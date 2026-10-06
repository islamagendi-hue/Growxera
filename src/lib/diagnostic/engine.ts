/**
 * Diagnosis engine: turns answers into a full DiagnosticReport.
 *
 * Server-side entry point is `buildReport`. Pure and deterministic, so the same
 * answers and SCORING_VERSION always give the same report.
 */
import {
  CONFIDENCE_THRESHOLDS,
  DEPENDENCY_FLOOR,
  DEPENDENCY_RANGE,
  DEPENDENCY_SOURCES,
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  FOUNDATION_DEPENDENCY,
  GROWTH_STAGES,
  IMPACT_THRESHOLDS,
  IMPACT_WEIGHTS,
  LEVEL_POINTS,
  OPPORTUNITY_LIBRARY,
  SCORING_VERSION,
} from "./config";
import { BENCHMARK_VERSION, evaluateBenchmarks } from "./benchmarks";
import { contextOf, describeContext } from "./context";
import { buildEstimates, totalRevenueOpportunity } from "./estimates";
import { buildRecommendations } from "./recommendations";
import { currencyFor } from "./questions";
import { getModel, scoreAll } from "./scoring";
import {
  DIMENSIONS,
  type Answers,
  type BusinessModel,
  type DiagnosticReport,
  type Dimension,
  type DimensionScore,
  type Level,
  type Opportunity,
  type ReportPreview,
} from "./types";

export function overallScore(dimensions: DimensionScore[]): number {
  // Weights are re-normalised over dimensions with data, so a dimension the user
  // could not answer at all neither helps nor hurts the overall score.
  const withData = dimensions.filter((d) => d.hasData);
  const pool = withData.length ? withData : dimensions;
  const totalWeight = pool.reduce((s, d) => s + DIMENSION_WEIGHTS[d.dimension], 0);
  return Math.round(pool.reduce((s, d) => s + d.score * DIMENSION_WEIGHTS[d.dimension], 0) / totalWeight);
}

export function stageFor(score: number) {
  const stage = GROWTH_STAGES.find((s) => score >= s.min) ?? GROWTH_STAGES[GROWTH_STAGES.length - 1];
  return { id: stage.id, label: stage.label, description: stage.description };
}

/** priority = severity × impact × dependency, per dimension. */
export function priorities(dimensions: DimensionScore[]): Record<Dimension, number> {
  const byDim = Object.fromEntries(dimensions.map((d) => [d.dimension, d])) as Record<Dimension, DimensionScore>;
  const out = {} as Record<Dimension, number>;
  for (const dim of DIMENSIONS) {
    const d = byDim[dim];
    const severity = (100 - d.score) / 100;
    const sources = DEPENDENCY_SOURCES[dim];
    const dependency = sources.length
      ? DEPENDENCY_FLOOR + DEPENDENCY_RANGE * (sources.reduce((s, x) => s + byDim[x].score, 0) / sources.length / 100)
      : FOUNDATION_DEPENDENCY;
    // A dimension we know nothing about can't credibly be named the bottleneck.
    const evidence = d.hasData ? 0.6 + 0.4 * d.confidence : 0;
    out[dim] = Math.round(severity * IMPACT_WEIGHTS[dim] * dependency * evidence * 1000) / 1000;
  }
  return out;
}

function level(value: number, thresholds: { high: number; medium: number }): Level {
  return value >= thresholds.high ? "high" : value >= thresholds.medium ? "medium" : "low";
}

function titleFor(dim: Dimension, model: BusinessModel): string {
  const t = OPPORTUNITY_LIBRARY[dim].title;
  return typeof t === "string" ? t : (t[model] ?? t.default);
}

export function buildOpportunities(
  dimensions: DimensionScore[],
  prio: Record<Dimension, number>,
  bottleneck: Dimension,
  model: BusinessModel,
  count = 3,
): Opportunity[] {
  const candidates = dimensions
    .filter((d) => d.hasData && d.score < 85)
    .map((d): Opportunity & { rank: number } => {
      const lib = OPPORTUNITY_LIBRARY[d.dimension];
      const impact = level(prio[d.dimension], IMPACT_THRESHOLDS);
      const confidence = level(d.confidence, CONFIDENCE_THRESHOLDS);
      const evidence = [...d.signals].sort((a, b) => a.score - b.score).slice(0, 2);
      // Impact × Confidence ÷ Effort; the bottleneck is always presented first.
      const rank =
        (d.dimension === bottleneck ? 100 : 0) +
        (LEVEL_POINTS[impact] * LEVEL_POINTS[confidence]) / LEVEL_POINTS[lib.effort] +
        prio[d.dimension];
      return {
        id: `${d.dimension}`,
        dimension: d.dimension,
        title: titleFor(d.dimension, model),
        summary: lib.summary,
        impact,
        confidence,
        effort: lib.effort,
        evidence,
        rank,
      };
    })
    .sort((a, b) => b.rank - a.rank);
  return candidates.slice(0, count).map((o) => {
    const { rank, ...opportunity } = o;
    void rank;
    return opportunity;
  });
}

const BOTTLENECK_COPY: Record<Dimension, string> = {
  market:
    "the business may not yet be focused on a clearly defined customer and market, which makes every channel and message work harder than it should.",
  value:
    "your offer may not be differentiated or priced strongly enough, which puts pressure on margin and on every stage of the funnel that follows.",
  acquisition:
    "the business appears able to convert and serve customers, but winning new ones efficiently may be the main constraint on growth.",
  activation:
    "demand appears to be reaching the business, but too little of it may be turning into revenue. Fixing conversion multiplies the value of the acquisition you already pay for.",
  retention:
    "your business appears capable of acquiring customers, but the current retention structure may be limiting the compounding effect of that acquisition.",
  expansion:
    "customers are coming and staying, but revenue per customer may be lower than it could be. Bundles, upsells and pricing are likely under-used.",
  scale:
    "the core funnel shows strength, but the economics and operating system behind growth (data, experimentation, CAC and margin trends) may not hold up as you scale.",
};

export function explainBottleneck(bottleneck: Dimension, strongest: Dimension, scores: Record<Dimension, number>): string {
  const base = `Based on the information provided, ${BOTTLENECK_COPY[bottleneck]}`;
  if (strongest === bottleneck) return base;
  return `${base} Your strongest area appears to be ${DIMENSION_LABELS[strongest]} (${scores[strongest]}/100), which is worth protecting while ${DIMENSION_LABELS[bottleneck]} (${scores[bottleneck]}/100) is addressed.`;
}

export function buildReport(answers: Answers, now = new Date()): DiagnosticReport {
  const model = getModel(answers);
  const dimensions = scoreAll(answers);
  const scores = Object.fromEntries(dimensions.map((d) => [d.dimension, d.score])) as Record<Dimension, number>;
  const ranked = dimensions.filter((d) => d.hasData);
  const pool = ranked.length ? ranked : dimensions;
  const strongest = pool.reduce((a, b) => (b.score > a.score ? b : a)).dimension;
  const weakest = pool.reduce((a, b) => (b.score < a.score ? b : a)).dimension;
  const prio = priorities(dimensions);
  const bottleneck = DIMENSIONS.reduce((a, b) => (prio[b] > prio[a] ? b : a));
  const overall = overallScore(dimensions);
  const estimates = buildEstimates(answers);
  const avgConfidence = dimensions.reduce((s, d) => s + d.confidence, 0) / dimensions.length;
  const benchmarks = evaluateBenchmarks(answers);
  const ctx = contextOf(answers);

  return {
    scoringVersion: SCORING_VERSION,
    generatedAt: now.toISOString(),
    businessModel: model,
    currency: currencyFor(answers),
    overallScore: overall,
    stage: stageFor(overall),
    dimensions,
    strongest,
    weakest,
    bottleneck,
    bottleneckExplanation: explainBottleneck(bottleneck, strongest, scores),
    priorities: prio,
    opportunities: buildOpportunities(dimensions, prio, bottleneck, model),
    estimates,
    estimatedOpportunity: totalRevenueOpportunity(estimates),
    dataConfidence: level(avgConfidence, CONFIDENCE_THRESHOLDS),
    context: { ...Object.fromEntries(Object.entries(ctx).filter(([, v]) => v !== undefined)), label: describeContext(answers) },
    benchmarkVersion: BENCHMARK_VERSION,
    benchmarks,
    recommendations: buildRecommendations(answers, dimensions, benchmarks, bottleneck),
  };
}

export function toPreview(r: DiagnosticReport): ReportPreview {
  return {
    scoringVersion: r.scoringVersion,
    businessModel: r.businessModel,
    currency: r.currency,
    overallScore: r.overallScore,
    stage: r.stage,
    strongest: r.strongest,
    weakest: r.weakest,
    bottleneck: r.bottleneck,
    bottleneckExplanation: r.bottleneckExplanation,
    dataConfidence: r.dataConfidence,
    context: r.context,
    dimensions: r.dimensions.map(({ dimension, score, confidence, hasData }) => ({ dimension, score, confidence, hasData })),
  };
}
