/**
 * Benchmarks: the expected range for a metric, given the business context.
 *
 * These are Growx Era working ranges, assembled from engagement experience and
 * commonly cited ranges for each business type. They are not a published
 * industry survey, are labelled as such in the report, and are meant to be
 * recalibrated as real diagnostics accumulate (bump BENCHMARK_VERSION).
 *
 * Resolution order for a metric: category → business type → revenue model.
 * A result is never judged "good" or "bad" by itself:
 *   worse   → below the expected range (above it, for lower-is-better metrics)
 *   within  → inside the range
 *   better  → better than the range
 *   outlier → far better than the range: a special case to understand, not a win to bank
 */
import { contextOf, typeNode } from "./context";
import { derive, getModel, num } from "./scoring";
import type { Answers, BusinessModel } from "./types";

export const BENCHMARK_VERSION = "2026.10-b1";

export type BenchmarkPosition = "worse" | "within" | "better" | "outlier";

interface Range {
  low: number;
  high: number;
}

interface MetricDef {
  label: string;
  unit: "%" | "x";
  /** False for metrics where a lower value is better (churn). */
  higherIsBetter: boolean;
  /** Which revenue models the metric applies to. */
  models: BusinessModel[];
  byModel: Partial<Record<BusinessModel, Range>>;
  byType?: Record<string, Range>;
  byCategory?: Record<string, Range>;
  value: (a: Answers) => number | undefined;
}

const r = (low: number, high: number): Range => ({ low, high });

export const BENCHMARKS: Record<string, MetricDef> = {
  conversionRate: {
    label: "Conversion rate",
    unit: "%",
    higherIsBetter: true,
    models: ["ecommerce"],
    byModel: { ecommerce: r(1, 2.5) },
    byCategory: {
      fashion: r(1, 2.2),
      perfume: r(1.5, 3),
      beauty: r(1.5, 3),
      electronics: r(0.8, 1.8),
      home: r(0.6, 1.5),
      grocery: r(2.5, 5),
      jewellery: r(0.5, 1.2),
      health: r(1.5, 3),
    },
    value: (a) => derive(a).conversionRate,
  },
  addToCartRate: {
    label: "Add-to-cart rate",
    unit: "%",
    higherIsBetter: true,
    models: ["ecommerce"],
    byModel: { ecommerce: r(5, 10) },
    value: (a) => num(a, "addToCartRate"),
  },
  checkoutCompletion: {
    label: "Checkout completion",
    unit: "%",
    higherIsBetter: true,
    models: ["ecommerce"],
    byModel: { ecommerce: r(45, 65) },
    value: (a) => num(a, "checkoutCompletion"),
  },
  repeatRate: {
    label: "Repeat customer rate",
    unit: "%",
    higherIsBetter: true,
    models: ["ecommerce", "leadgen", "other"],
    byModel: { ecommerce: r(20, 35), leadgen: r(15, 35), other: r(30, 50) },
    byType: { clinic: r(35, 55), salon: r(45, 65), restaurant: r(35, 55), car_services: r(35, 55), on_demand: r(30, 50) },
    byCategory: { grocery: r(35, 55), beauty: r(25, 40), perfume: r(25, 40), electronics: r(10, 20), health: r(30, 45), pets: r(35, 55) },
    value: (a) => num(a, "repeatRate"),
  },
  monthlyChurn: {
    label: "Monthly churn",
    unit: "%",
    higherIsBetter: false,
    models: ["subscription"],
    byModel: { subscription: r(3, 7) },
    byType: { consumer_subscription: r(5, 10), fitness: r(3, 6), managed_service: r(1, 3), subscription_box: r(6, 12), edtech_subscription: r(5, 10) },
    value: (a) => num(a, "monthlyChurn"),
  },
  leadToQualified: {
    label: "Lead → qualified",
    unit: "%",
    higherIsBetter: true,
    models: ["leadgen"],
    byModel: { leadgen: r(25, 45) },
    value: (a) => num(a, "leadToQualified"),
  },
  qualifiedToCustomer: {
    label: "Close rate (qualified → customer)",
    unit: "%",
    higherIsBetter: true,
    models: ["leadgen"],
    byModel: { leadgen: r(15, 30) },
    byType: { enterprise_saas: r(15, 25), clinic: r(30, 50), dealership: r(10, 20), brokerage: r(5, 15), developer: r(5, 15) },
    value: (a) => num(a, "qualifiedToCustomer"),
  },
  signupToActivation: {
    label: "Sign-up → activation",
    unit: "%",
    higherIsBetter: true,
    models: ["subscription"],
    byModel: { subscription: r(25, 45) },
    value: (a) => num(a, "signupToActivation"),
  },
  trialToPaid: {
    label: "Trial → paid",
    unit: "%",
    higherIsBetter: true,
    models: ["subscription"],
    byModel: { subscription: r(8, 20) },
    byType: { consumer_subscription: r(3, 10) },
    value: (a) => num(a, "trialToPaid"),
  },
  visitorToCustomer: {
    label: "Visitor → customer",
    unit: "%",
    higherIsBetter: true,
    models: ["other"],
    byModel: { other: r(2, 6) },
    value: (a) => {
      const traffic = num(a, "monthlyTraffic");
      const fresh = num(a, "monthlyNewCustomers");
      return num(a, "visitorToCustomer") ?? (traffic && fresh ? Math.min(100, (fresh / traffic) * 100) : undefined);
    },
  },
  grossMargin: {
    label: "Gross margin",
    unit: "%",
    higherIsBetter: true,
    models: ["ecommerce", "leadgen", "subscription", "other"],
    byModel: { ecommerce: r(35, 55), leadgen: r(40, 65), subscription: r(65, 80), other: r(30, 55) },
    byType: { restaurant: r(55, 70), wholesale: r(15, 30), salon: r(50, 70), enterprise_saas: r(70, 85), agency: r(40, 60) },
    byCategory: { electronics: r(15, 30), grocery: r(20, 35), perfume: r(45, 65), beauty: r(50, 70), fashion: r(45, 60) },
    value: (a) => num(a, "grossMargin"),
  },
  ltvToCac: {
    label: "LTV : CAC",
    unit: "x",
    higherIsBetter: true,
    models: ["ecommerce", "leadgen", "subscription", "other"],
    byModel: { ecommerce: r(3, 5), leadgen: r(3, 5), subscription: r(3, 5), other: r(3, 5) },
    value: (a) => {
      const ltv = num(a, "ltv");
      const cac = derive(a).cac;
      return ltv && cac ? ltv / cac : undefined;
    },
  },
};

export interface BenchmarkResult {
  metric: string;
  label: string;
  unit: "%" | "x";
  value: number;
  low: number;
  high: number;
  higherIsBetter: boolean;
  position: BenchmarkPosition;
  /** Which level of the taxonomy the range came from, e.g. "Perfumes & fragrance". */
  basis: string;
  explanation: string;
}

/** Far better than the range: more than 1.6× its top (or under its floor ÷ 1.6, for lower-is-better metrics). */
export const OUTLIER_FACTOR = 1.6;

export function position(value: number, range: Range, higherIsBetter: boolean): BenchmarkPosition {
  if (higherIsBetter) {
    if (value < range.low) return "worse";
    if (value <= range.high) return "within";
    return value > range.high * OUTLIER_FACTOR ? "outlier" : "better";
  }
  if (value > range.high) return "worse";
  if (value >= range.low) return "within";
  return value < range.low / OUTLIER_FACTOR ? "outlier" : "better";
}

const fmt = (n: number, unit: "%" | "x") => `${Math.round(n * 10) / 10}${unit === "%" ? "%" : "x"}`;

function explain(def: MetricDef, value: number, range: Range, pos: BenchmarkPosition, basis: string): string {
  const v = fmt(value, def.unit);
  const band = `${fmt(range.low, def.unit)}–${fmt(range.high, def.unit)}`;
  const label = def.label.charAt(0).toLowerCase() + def.label.slice(1);
  switch (pos) {
    case "worse":
      return def.higherIsBetter
        ? `Your ${label} (${v}) is below the expected range for ${basis} (${band}). This is likely holding growth back.`
        : `Your ${label} (${v}) is above the expected range for ${basis} (${band}), which means more customers are lost than is typical.`;
    case "within":
      return `Your ${label} (${v}) is within the expected range for ${basis} (${band}).`;
    case "better":
      return `Your ${label} (${v}) is better than the expected range for ${basis} (${band}). Protect what's working here.`;
    case "outlier":
      return `Your ${label} (${v}) is significantly ${def.higherIsBetter ? "above" : "below"} the current benchmark for ${basis} (${band}). This may indicate a different customer mix, positioning, pricing model or business model, or a difference in how the metric is measured. Worth confirming before building on it.`;
  }
}

/** The range for a metric in this context, with the most specific level that has one. */
export function rangeFor(metric: string, a: Answers): { range: Range; basis: string } | null {
  const def = BENCHMARKS[metric];
  if (!def) return null;
  const model = getModel(a);
  if (!def.models.includes(model)) return null;
  const ctx = contextOf(a);
  const type = typeNode(a);
  const category = type?.categories.find((x) => x.value === ctx.category);
  if (category && def.byCategory?.[category.value]) return { range: def.byCategory[category.value], basis: category.label.toLowerCase() };
  if (type && def.byType?.[type.value]) return { range: def.byType[type.value], basis: type.label.toLowerCase() };
  const range = def.byModel[model];
  if (!range) return null;
  const basis = type ? type.label.toLowerCase() : { ecommerce: "e-commerce", leadgen: "lead-driven businesses", subscription: "subscription businesses", other: "businesses like yours" }[model];
  return { range, basis };
}

export function evaluateBenchmarks(a: Answers): BenchmarkResult[] {
  const out: BenchmarkResult[] = [];
  for (const [metric, def] of Object.entries(BENCHMARKS)) {
    const found = rangeFor(metric, a);
    if (!found) continue;
    const value = def.value(a);
    if (value === undefined || !Number.isFinite(value)) continue;
    const pos = position(value, found.range, def.higherIsBetter);
    out.push({
      metric,
      label: def.label,
      unit: def.unit,
      value: Math.round(value * 100) / 100,
      low: found.range.low,
      high: found.range.high,
      higherIsBetter: def.higherIsBetter,
      position: pos,
      basis: found.basis,
      explanation: explain(def, value, found.range, pos, found.basis),
    });
  }
  return out;
}

/** How far a metric sits from the range, 0 (at or better) to 1 (far below). Used to rank recommendations. */
export function gapOf(b: BenchmarkResult): number {
  if (b.position !== "worse") return 0;
  const g = b.higherIsBetter ? (b.low - b.value) / b.low : (b.value - b.high) / b.high;
  return Math.max(0, Math.min(1, g));
}
