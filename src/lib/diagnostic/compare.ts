/**
 * Historical comparison between two saved diagnostics.
 *
 * Each saved report is an immutable snapshot; this only reads them. Reports
 * made with a different scoring version are still compared, but flagged, since
 * questions and weights may have changed between them.
 */
import { DIMENSION_LABELS } from "./config";
import type { BenchmarkSnapshot, DiagnosticReport, Dimension, RecommendationSnapshot } from "./types";

export interface DimensionChange {
  dimension: Dimension;
  label: string;
  before: number | null;
  after: number | null;
  delta: number | null;
}

export interface MetricChange {
  id: string;
  label: string;
  before: string;
  after: string;
  /** Change in that metric's 0–100 signal score; positive is an improvement. */
  delta: number;
}

export interface BenchmarkMove {
  metric: string;
  label: string;
  before: BenchmarkSnapshot["position"] | null;
  after: BenchmarkSnapshot["position"];
  value: number;
  previousValue: number | null;
  unit: "%" | "x";
}

export interface Comparison {
  before: { generatedAt: string; overallScore: number; stage: string; bottleneck: Dimension };
  after: { generatedAt: string; overallScore: number; stage: string; bottleneck: Dimension };
  overallDelta: number;
  sameScoringVersion: boolean;
  dimensions: DimensionChange[];
  improved: MetricChange[];
  declined: MetricChange[];
  benchmarkMoves: BenchmarkMove[];
  newRecommendations: RecommendationSnapshot[];
  resolvedRecommendations: RecommendationSnapshot[];
}

const RANK: Record<BenchmarkSnapshot["position"], number> = { worse: 0, within: 1, better: 2, outlier: 3 };

/** A metric must move by at least this many signal points to count as improved or declined. */
export const METRIC_CHANGE_THRESHOLD = 3;

export function compareReports(before: DiagnosticReport, after: DiagnosticReport): Comparison {
  const prevDims = new Map(before.dimensions.map((d) => [d.dimension, d]));
  const dimensions: DimensionChange[] = after.dimensions.map((d) => {
    const p = prevDims.get(d.dimension);
    const b = p?.hasData ? p.score : null;
    const a = d.hasData ? d.score : null;
    return { dimension: d.dimension, label: DIMENSION_LABELS[d.dimension], before: b, after: a, delta: a !== null && b !== null ? a - b : null };
  });

  // Signals are keyed by id across all dimensions; the same signal can appear in two
  // dimensions with the same value, so keep the first.
  const signals = (r: DiagnosticReport) => {
    const m = new Map<string, { label: string; display: string; score: number }>();
    for (const d of r.dimensions) for (const s of d.signals) if (!m.has(s.id)) m.set(s.id, s);
    return m;
  };
  const sb = signals(before);
  const improved: MetricChange[] = [];
  const declined: MetricChange[] = [];
  for (const [id, s] of signals(after)) {
    const p = sb.get(id);
    if (!p) continue;
    const delta = s.score - p.score;
    const change = { id, label: s.label, before: p.display, after: s.display, delta };
    if (delta >= METRIC_CHANGE_THRESHOLD) improved.push(change);
    else if (delta <= -METRIC_CHANGE_THRESHOLD) declined.push(change);
  }
  improved.sort((x, y) => y.delta - x.delta);
  declined.sort((x, y) => x.delta - y.delta);

  const prevBench = new Map((before.benchmarks ?? []).map((b) => [b.metric, b]));
  const benchmarkMoves: BenchmarkMove[] = (after.benchmarks ?? [])
    .map((b) => {
      const p = prevBench.get(b.metric);
      return { metric: b.metric, label: b.label, before: p?.position ?? null, after: b.position, value: b.value, previousValue: p?.value ?? null, unit: b.unit };
    })
    .filter((m) => m.before === null || RANK[m.before] !== RANK[m.after] || m.previousValue !== m.value);

  const prevRecs = new Set((before.recommendations ?? []).map((r) => r.id));
  const nextRecs = new Set((after.recommendations ?? []).map((r) => r.id));

  return {
    before: { generatedAt: before.generatedAt, overallScore: before.overallScore, stage: before.stage.label, bottleneck: before.bottleneck },
    after: { generatedAt: after.generatedAt, overallScore: after.overallScore, stage: after.stage.label, bottleneck: after.bottleneck },
    overallDelta: after.overallScore - before.overallScore,
    sameScoringVersion: before.scoringVersion === after.scoringVersion,
    dimensions,
    improved,
    declined,
    benchmarkMoves,
    newRecommendations: (after.recommendations ?? []).filter((r) => !prevRecs.has(r.id)),
    resolvedRecommendations: (before.recommendations ?? []).filter((r) => !nextRecs.has(r.id)),
  };
}
