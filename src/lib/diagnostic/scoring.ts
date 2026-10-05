/**
 * Dimension scoring.
 *
 * Each dimension is the weighted average of the "signals" the user could answer.
 * Unknown answers are excluded from the score (we never invent a value) and
 * reduce that dimension's confidence instead.
 */
import { CURVES, LOOKUPS, NEUTRAL_SCORE, type Curve } from "./config";
import { QUESTION_MAP } from "./questions";
import {
  DIMENSIONS,
  UNKNOWN,
  type Answers,
  type BusinessModel,
  type Dimension,
  type DimensionScore,
  type SignalResult,
} from "./types";

export function interpolate(curve: Curve, x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    const [x0, y0] = curve[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Numeric answer, or undefined when missing / "I don't know". */
export function num(answers: Answers, id: string): number | undefined {
  const v = answers[id];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function choice(answers: Answers, id: string): string | undefined {
  const v = answers[id];
  return typeof v === "string" && v !== UNKNOWN ? v : undefined;
}

export function list(answers: Answers, id: string): string[] | undefined {
  const v = answers[id];
  return Array.isArray(v) ? v : undefined;
}

export function getModel(answers: Answers): BusinessModel {
  const m = answers.businessModel;
  return m === "ecommerce" || m === "leadgen" || m === "subscription" ? m : "other";
}

/** Derived metrics, computed from other inputs when the user didn't know them. */
export interface Derived {
  aov?: number;
  cac?: number;
  conversionRate?: number;
  checkoutCompletion?: number;
}

export function derive(answers: Answers): Derived {
  const revenue = num(answers, "monthlyRevenue");
  const customers = num(answers, "monthlyCustomers");
  const spend = num(answers, "marketingSpend");
  const traffic = num(answers, "monthlyTraffic");
  const d: Derived = {};

  d.aov = num(answers, "aov") ?? (revenue && customers ? revenue / customers : undefined);
  // CAC from spend ÷ customers overstates true CAC slightly (customers include repeat buyers),
  // so it is only used as a fallback.
  d.cac = num(answers, "cac") ?? (spend && customers ? spend / customers : undefined);
  d.conversionRate =
    num(answers, "conversionRate") ??
    (traffic && customers && traffic > 0 ? Math.min(100, (customers / traffic) * 100) : undefined);
  const abandonment = num(answers, "cartAbandonment");
  d.checkoutCompletion =
    num(answers, "checkoutCompletion") ?? (abandonment !== undefined ? 100 - abandonment : undefined);
  return d;
}

interface SignalDef {
  id: string;
  label: string;
  weight: number;
  /** Applies to this business? Defaults to true. */
  applies?: (a: Answers, m: BusinessModel) => boolean;
  /** Returns [score, display] or undefined when the input is unknown. */
  evaluate: (a: Answers, m: BusinessModel, d: Derived) => [number, string] | undefined;
}

function optionLabel(questionId: string, value: string): string {
  return QUESTION_MAP[questionId]?.options?.find((o) => o.value === value)?.label ?? value;
}

/** Signal from a categorical answer via LOOKUPS. */
function lookup(questionId: string, label: string, weight: number, applies?: SignalDef["applies"]): SignalDef {
  return {
    id: questionId,
    label,
    weight,
    applies,
    evaluate: (a) => {
      const v = choice(a, questionId);
      const score = v !== undefined ? LOOKUPS[questionId]?.[v] : undefined;
      return score === undefined ? undefined : [score, optionLabel(questionId, v!)];
    },
  };
}

/** Signal from a percentage answer via a curve. */
function percent(
  questionId: string,
  label: string,
  weight: number,
  curve: Curve,
  applies?: SignalDef["applies"],
  value?: (a: Answers, d: Derived) => number | undefined,
): SignalDef {
  return {
    id: questionId,
    label,
    weight,
    applies,
    evaluate: (a, _m, d) => {
      const v = value ? value(a, d) : num(a, questionId);
      return v === undefined ? undefined : [interpolate(curve, v), `${round1(v)}%`];
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const is =
  (...models: BusinessModel[]) =>
  (_a: Answers, m: BusinessModel) =>
    models.includes(m);
const not =
  (...models: BusinessModel[]) =>
  (_a: Answers, m: BusinessModel) =>
    !models.includes(m);

function ltvToCac(a: Answers, d: Derived): number | undefined {
  const ltv = num(a, "ltv");
  return ltv && d.cac ? ltv / d.cac : undefined;
}

const ECONOMICS_METRICS = ["monthlyRevenue", "aov", "grossMargin", "marketingSpend", "cac", "ltv", "payback"];

export const SIGNALS: Record<Dimension, SignalDef[]> = {
  market: [
    lookup("icpClarity", "Ideal customer clarity", 3),
    lookup("acquisitionTrend", "New customer trend", 2),
    lookup("growthRate", "Revenue growth (12 months)", 2),
  ],
  value: [
    lookup("differentiation", "Differentiation", 3),
    {
      id: "grossMargin",
      label: "Gross margin",
      weight: 3,
      evaluate: (a, m) => {
        const v = num(a, "grossMargin");
        return v === undefined ? undefined : [interpolate(CURVES.grossMargin[m], v), `${round1(v)}%`];
      },
    },
    lookup("marginTrend", "Margin trend", 1),
    lookup("pricingReview", "Pricing discipline", 1),
  ],
  acquisition: [
    lookup("acquisitionTrend", "New customer trend", 2),
    {
      id: "channels",
      label: "Channel diversification",
      weight: 1.5,
      evaluate: (a) => {
        const v = list(a, "channels");
        if (!v) return undefined;
        return [interpolate(CURVES.channelCount, v.length), `${v.length} active channel${v.length === 1 ? "" : "s"}`];
      },
    },
    lookup("topChannelShare", "Dependence on one channel", 1.5),
    {
      id: "cacEfficiency",
      label: "CAC efficiency",
      weight: 3,
      evaluate: (a, _m, d) => {
        const ratio = ltvToCac(a, d);
        if (ratio !== undefined) return [interpolate(CURVES.ltvToCac, ratio), `LTV:CAC ${round1(ratio)}x`];
        const margin = num(a, "grossMargin");
        if (d.aov && margin !== undefined && d.cac) {
          const coverage = (d.aov * (margin / 100)) / d.cac;
          return [interpolate(CURVES.firstOrderCacCoverage, coverage), `First order covers ${round1(coverage)}x CAC`];
        }
        return undefined;
      },
    },
    lookup("cacTrend", "CAC trend", 1.5),
  ],
  activation: [
    percent("conversionRate", "Conversion rate", 4, CURVES.ecommerceConversion, is("ecommerce"), (_a, d) => d.conversionRate),
    percent("addToCartRate", "Add-to-cart rate", 1, CURVES.addToCart, is("ecommerce")),
    percent(
      "checkoutCompletion",
      "Checkout completion",
      2,
      CURVES.checkoutCompletion,
      is("ecommerce"),
      (_a, d) => d.checkoutCompletion,
    ),
    percent("leadToQualified", "Lead → qualified", 2, CURVES.leadToQualified, is("leadgen")),
    percent("qualifiedToCustomer", "Qualified → customer", 3, CURVES.qualifiedToCustomer, is("leadgen")),
    lookup("leadResponseTime", "Lead response time", 2, is("leadgen")),
    percent("signupToActivation", "Sign-up → activation", 3, CURVES.signupToActivation, is("subscription")),
    percent("trialToPaid", "Trial → paid", 3, CURVES.trialToPaid, is("subscription")),
    percent("visitorToCustomer", "Visitor → customer", 4, CURVES.visitorToCustomer, is("other")),
  ],
  retention: [
    percent("repeatRate", "Repeat customer rate", 4, CURVES.repeatRate, not("subscription")),
    percent("monthlyChurn", "Monthly churn", 4, CURVES.monthlyChurn, is("subscription")),
    lookup("purchaseFrequency", "Purchase frequency", 2, not("subscription")),
    lookup("crmUsage", "CRM maturity", 2),
    {
      id: "ownedChannels",
      label: "Owned customer channels",
      weight: 1.5,
      evaluate: (a) => {
        const v = list(a, "ownedChannels");
        if (!v) return undefined;
        const n = v.filter((c) => c !== "none").length;
        const score = [10, 45, 70, 90][Math.min(n, 3)];
        return [score, n === 0 ? "None" : v.filter((c) => c !== "none").map((c) => optionLabel("ownedChannels", c)).join(", ")];
      },
    },
    lookup("loyalty", "Loyalty programme", 1),
    lookup("reactivation", "Win-back campaigns", 1.5),
  ],
  expansion: [
    lookup("upsell", "Upsells", 2),
    lookup("crossSell", "Cross-sells", 2),
    lookup("bundles", "Bundles / packages", 1.5),
    lookup("recurringRevenue", "Recurring revenue", 1.5, not("subscription")),
    lookup("pricingReview", "Pricing optimization", 2),
    lookup("purchaseFrequency", "Purchase frequency", 1, not("subscription")),
  ],
  scale: [
    lookup("growthRate", "Revenue growth (12 months)", 2.5),
    lookup("cacTrend", "CAC trend", 2),
    lookup("marginTrend", "Margin trend", 2),
    lookup("analytics", "Data reliability", 2),
    lookup("experimentation", "Experimentation cadence", 2),
    lookup("payback", "CAC payback", 1.5),
    {
      id: "metricsKnown",
      label: "Knowledge of core metrics",
      weight: 1,
      evaluate: (a) => {
        const known = ECONOMICS_METRICS.filter((id) => a[id] !== undefined && a[id] !== UNKNOWN).length;
        const share = known / ECONOMICS_METRICS.length;
        return [interpolate(CURVES.metricsKnown, share), `${known} of ${ECONOMICS_METRICS.length} known`];
      },
    },
  ],
};

export function scoreDimension(dimension: Dimension, answers: Answers): DimensionScore {
  const model = getModel(answers);
  const derived = derive(answers);
  const defs = SIGNALS[dimension].filter((s) => (s.applies ? s.applies(answers, model) : true));
  const totalWeight = defs.reduce((sum, s) => sum + s.weight, 0);
  const signals: SignalResult[] = [];
  for (const def of defs) {
    const r = def.evaluate(answers, model, derived);
    if (!r) continue;
    signals.push({ id: def.id, label: def.label, display: r[1], score: Math.round(r[0]), weight: def.weight });
  }
  const answeredWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (answeredWeight === 0) {
    return { dimension, score: NEUTRAL_SCORE, confidence: 0, hasData: false, signals };
  }
  const score = signals.reduce((sum, s) => sum + s.score * s.weight, 0) / answeredWeight;
  return {
    dimension,
    score: Math.round(score),
    confidence: totalWeight ? answeredWeight / totalWeight : 0,
    hasData: true,
    signals,
  };
}

export function scoreAll(answers: Answers): DimensionScore[] {
  return DIMENSIONS.map((d) => scoreDimension(d, answers));
}
