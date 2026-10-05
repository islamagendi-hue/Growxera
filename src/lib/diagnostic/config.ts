/**
 * Growth Diagnostic configuration.
 *
 * Everything here is an INITIAL assumption, owned by Growx Era, and meant to be
 * tuned as real diagnostics accumulate. Change numbers here, bump
 * SCORING_VERSION, and the engine, UI and stored reports follow; no component
 * code needs to change.
 *
 * Benchmark curves are Growx Era working heuristics for scoring, not published
 * industry statistics. They should be calibrated against real client data.
 */
import type { BusinessModel, Dimension, Level } from "./types";

/** Stored with every report so historical scores stay interpretable after tuning. */
export const SCORING_VERSION = "2026.10-v1";

/** Overall Growth Score weighting. Must sum to 1. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  market: 0.1,
  value: 0.1,
  acquisition: 0.15,
  activation: 0.15,
  retention: 0.15,
  expansion: 0.15,
  scale: 0.2,
};

export const DIMENSION_LABELS: Record<Dimension, string> = {
  market: "Market",
  value: "Value",
  acquisition: "Acquisition",
  activation: "Activation",
  retention: "Retention",
  expansion: "Expansion",
  scale: "Scale",
};

export const DIMENSION_DESCRIPTIONS: Record<Dimension, string> = {
  market: "Who you serve, and whether demand is there.",
  value: "Why customers choose you, and the margin it earns.",
  acquisition: "How efficiently you win new customers.",
  activation: "How well interest turns into revenue.",
  retention: "Whether customers come back.",
  expansion: "How much each customer is worth over time.",
  scale: "Whether growth is getting healthier as it grows.",
};

/** Growth stages by overall score (inclusive lower bound). Ordered high → low. */
export const GROWTH_STAGES: { id: string; min: number; label: string; description: string }[] = [
  {
    id: "engine",
    min: 90,
    label: "Growth Engine",
    description: "Growth is systematic, measurable and compounding.",
  },
  {
    id: "optimized",
    min: 75,
    label: "Growth Optimized",
    description: "A working growth system with specific areas left to sharpen.",
  },
  {
    id: "emerging",
    min: 60,
    label: "Growth Emerging",
    description: "Real traction, but the system is not yet consistent across the funnel.",
  },
  {
    id: "constrained",
    min: 40,
    label: "Growth Constrained",
    description: "Growth is being held back by one or more structural bottlenecks.",
  },
  {
    id: "foundation",
    min: 0,
    label: "Growth Foundation",
    description: "The fundamentals of a growth system still need to be put in place.",
  },
];

/** Neutral score used for a dimension the user could not answer at all. */
export const NEUTRAL_SCORE = 50;

/**
 * Piecewise-linear curves: [inputValue, score] points, ascending by input.
 * Values outside the range clamp to the end points.
 */
export type Curve = [number, number][];

export const CURVES = {
  grossMargin: {
    ecommerce: [[15, 15], [30, 45], [45, 70], [60, 90], [75, 100]],
    leadgen: [[20, 20], [35, 45], [50, 70], [65, 90], [80, 100]],
    subscription: [[40, 20], [60, 50], [75, 80], [85, 95]],
    other: [[15, 15], [30, 45], [45, 70], [60, 90]],
  } satisfies Record<BusinessModel, Curve>,
  /** First-order contribution ÷ CAC (AOV × margin ÷ CAC). */
  firstOrderCacCoverage: [[0.2, 15], [0.5, 40], [1, 70], [1.5, 88], [2.5, 100]] as Curve,
  ltvToCac: [[1, 20], [2, 50], [3, 80], [5, 100]] as Curve,
  channelCount: [[0, 10], [1, 35], [2, 60], [3, 80], [4, 90]] as Curve,
  ecommerceConversion: [[0.3, 10], [0.8, 35], [1.5, 60], [2.5, 80], [4, 95]] as Curve,
  addToCart: [[2, 20], [5, 50], [8, 75], [12, 95]] as Curve,
  checkoutCompletion: [[25, 15], [40, 45], [55, 70], [70, 90], [80, 100]] as Curve,
  leadToQualified: [[10, 20], [25, 50], [40, 75], [60, 95]] as Curve,
  qualifiedToCustomer: [[5, 15], [15, 45], [25, 70], [40, 95]] as Curve,
  signupToActivation: [[15, 15], [30, 45], [50, 75], [70, 95]] as Curve,
  trialToPaid: [[3, 15], [8, 45], [15, 70], [25, 95]] as Curve,
  visitorToCustomer: [[0.5, 15], [2, 45], [5, 70], [10, 90]] as Curve,
  repeatRate: [[5, 10], [15, 35], [25, 55], [40, 80], [55, 95]] as Curve,
  /** Lower churn is better, so scores descend. */
  monthlyChurn: [[1, 95], [3, 75], [5, 55], [8, 35], [12, 15]] as Curve,
  /** Share of economics metrics the business knows (0–1): measurement maturity. */
  metricsKnown: [[0, 10], [0.4, 40], [0.7, 70], [1, 95]] as Curve,
};

/** Categorical answer → score lookups. */
export const LOOKUPS: Record<string, Record<string, number>> = {
  icpClarity: { clear: 95, broad: 55, anyone: 20 },
  differentiation: { strong: 95, some: 50, weak: 15 },
  acquisitionTrend: { strong: 95, slow: 70, flat: 45, declining: 15 },
  topChannelShare: { lt40: 90, "40to60": 75, "60to80": 50, gt80: 25 },
  leadResponseTime: { lt5m: 95, lt1h: 75, sameday: 50, gt1d: 15 },
  purchaseFrequency: { "1": 20, "2to3": 50, "4to6": 78, "7plus": 95 },
  crmUsage: { advanced: 95, basic: 45, none: 10 },
  loyalty: { yes: 85, planned: 45, no: 25 },
  reactivation: { structured: 95, occasional: 55, none: 15 },
  upsell: { systematic: 95, sometimes: 55, no: 15 },
  crossSell: { systematic: 95, sometimes: 55, no: 15 },
  bundles: { yes: 85, no: 25 },
  recurringRevenue: { significant: 95, some: 60, none: 25 },
  pricingReview: { recent: 95, old: 50, never: 15 },
  growthRate: { declining: 10, "0to10": 40, "10to30": 65, "30to60": 85, gt60: 95 },
  cacTrend: { decreasing: 95, stable: 70, increasing: 25 },
  marginTrend: { improving: 95, stable: 65, declining: 20 },
  analytics: { reliable: 95, partial: 45, limited: 10 },
  experimentation: { structured: 95, adhoc: 50, none: 10 },
  payback: { first: 100, "1to3": 85, "3to6": 65, "6to12": 40, gt12: 15 },
};

/**
 * Diagnosis: priority = severity × impact × dependency.
 *
 * - severity  = (100 − score) / 100
 * - impact    = revenue leverage of fixing this dimension (below)
 * - dependency = how much value is already flowing into this dimension and would be
 *               released by fixing it. It is computed from the scores of the
 *               dimensions listed in DEPENDENCY_SOURCES: strong acquisition makes
 *               weak conversion a bigger bottleneck, strong conversion makes weak
 *               acquisition the constraint, and so on.
 *               dependency = DEPENDENCY_FLOOR + DEPENDENCY_RANGE × (avg source score / 100)
 */
export const IMPACT_WEIGHTS: Record<Dimension, number> = {
  market: 0.9,
  value: 0.9,
  acquisition: 1,
  activation: 1.1,
  retention: 1.05,
  expansion: 0.9,
  scale: 0.85,
};

export const DEPENDENCY_SOURCES: Record<Dimension, Dimension[]> = {
  // Foundations: if they are weak, everything downstream inherits the problem.
  market: [],
  value: [],
  acquisition: ["activation", "value"],
  activation: ["acquisition"],
  retention: ["acquisition", "activation"],
  expansion: ["retention", "activation"],
  scale: ["acquisition", "activation", "retention"],
};

/** Fixed dependency for foundational dimensions (no sources). */
export const FOUNDATION_DEPENDENCY = 1.25;
export const DEPENDENCY_FLOOR = 0.6;
export const DEPENDENCY_RANGE = 0.8;

/** Bucket thresholds for opportunity impact (on the priority value) and confidence. */
export const IMPACT_THRESHOLDS = { high: 0.45, medium: 0.22 };
export const CONFIDENCE_THRESHOLDS = { high: 0.75, medium: 0.45 };
export const LEVEL_POINTS: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** Opportunity templates per dimension. Effort is Growx Era's default delivery estimate. */
export const OPPORTUNITY_LIBRARY: Record<
  Dimension,
  { title: string | Partial<Record<BusinessModel, string>> & { default: string }; summary: string; effort: Level }
> = {
  market: {
    title: { default: "Market & ICP Focus" },
    summary:
      "Sharpen which customers and segments you prioritise so every channel and message works harder.",
    effort: "medium",
  },
  value: {
    title: { default: "Value Proposition & Positioning" },
    summary:
      "Clarify why customers should choose you and protect margin, instead of competing on price.",
    effort: "medium",
  },
  acquisition: {
    title: { default: "Acquisition Efficiency" },
    summary:
      "Rebalance channel mix and creative so new customers cost less and depend less on one source.",
    effort: "medium",
  },
  activation: {
    title: {
      default: "Conversion Improvement",
      ecommerce: "Conversion Rate Optimization",
      leadgen: "Lead Conversion & Sales Process",
      subscription: "Activation & Onboarding",
    },
    summary: "Convert more of the demand you already pay for into revenue.",
    effort: "medium",
  },
  retention: {
    title: { default: "Retention Optimization" },
    summary:
      "Build lifecycle journeys across CRM, WhatsApp and email so customers come back and acquisition compounds.",
    effort: "medium",
  },
  expansion: {
    title: { default: "Monetization" },
    summary: "Increase revenue per customer through bundles, upsells, cross-sells and pricing.",
    effort: "low",
  },
  scale: {
    title: { default: "Growth Operating System" },
    summary:
      "Put trusted metrics and a regular experimentation cadence in place so growth stays efficient as it scales.",
    effort: "high",
  },
};

/**
 * Opportunity calculator scenario assumptions: [conservative, target].
 * Relative uplifts are fractions of the current value; `points` are percentage points.
 */
export const UPLIFT_ASSUMPTIONS = {
  conversionRelative: [0.1, 0.25] as const,
  closeRateRelative: [0.1, 0.25] as const,
  aovRelative: [0.05, 0.12] as const,
  repeatRatePoints: [3, 8] as const,
  churnReductionRelative: [0.1, 0.25] as const,
  cacReductionRelative: [0.1, 0.2] as const,
};
