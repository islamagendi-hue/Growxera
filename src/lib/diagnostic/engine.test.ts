import { describe, expect, it } from "vitest";
import { DIMENSION_WEIGHTS } from "./config";
import { buildReport, overallScore, priorities, stageFor } from "./engine";
import { buildEstimates, roughen } from "./estimates";
import { sanitizeAnswers } from "./questions";
import { interpolate, scoreDimension } from "./scoring";
import { DIMENSIONS, UNKNOWN, type Answers, type Dimension, type DimensionScore } from "./types";

function dims(scores: Partial<Record<Dimension, number>>, fallback = 70): DimensionScore[] {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    score: scores[dimension] ?? fallback,
    confidence: 1,
    hasData: true,
    signals: [],
  }));
}

const top = (p: Record<Dimension, number>) => DIMENSIONS.reduce((a, b) => (p[b] > p[a] ? b : a));

export const ecommerce: Answers = {
  industry: "ecommerce",
  segment: "b2c",
  businessType: "online_retail",
  category: "fashion",
  geography: "SA",
  city: "riyadh",
  businessAge: "3to5",
  monthlyRevenue: 500000,
  monthlyNewCustomers: 900,
  monthlyOrders: 2500,
  icpClarity: "broad",
  differentiation: "service",
  aov: 200,
  grossMargin: 45,
  marketingSpend: 80000,
  cac: UNKNOWN,
  ltv: UNKNOWN,
  payback: UNKNOWN,
  monthlyTraffic: 250000,
  channels: ["meta", "google", "tiktok"],
  paidSpend: 70000,
  topChannelShare: "50to70",
  acquisitionTrend: "up",
  conversionRate: 1,
  addToCartRate: UNKNOWN,
  checkoutCompletion: UNKNOWN,
  repeatRate: 12,
  purchaseFrequency: "1",
  crmUsage: "basic",
  ownedChannels: ["whatsapp"],
  loyalty: "no",
  reactivation: "none",
  upsell: "sometimes",
  crossSell: "no",
  bundles: "one",
  recurringRevenue: "none",
  pricingReview: "gt12m",
  growthRate: "10to30",
  cacTrend: "up_fast",
  marginTrend: "stable",
  analytics: "partial",
  experimentation: "adhoc",
};

describe("config", () => {
  it("dimension weights sum to 1", () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("dependency-aware bottleneck", () => {
  it("strong acquisition + weak conversion → activation is the bottleneck", () => {
    expect(top(priorities(dims({ acquisition: 90, activation: 35 })))).toBe("activation");
  });
  it("weak acquisition + strong conversion → acquisition is the bottleneck", () => {
    expect(top(priorities(dims({ acquisition: 40, activation: 80 })))).toBe("acquisition");
  });
  it("weak retention with strong acquisition → retention is the bottleneck", () => {
    expect(top(priorities(dims({ acquisition: 85, activation: 70, retention: 25 })))).toBe("retention");
  });
  it("the weakest dimension is not automatically the bottleneck", () => {
    // Expansion is lowest, but retention is barely ahead and has more flowing into it.
    const p = priorities(dims({ acquisition: 85, activation: 80, retention: 32, expansion: 30 }));
    expect(top(p)).toBe("retention");
  });
});

describe("scoring", () => {
  it("interpolates and clamps curves", () => {
    expect(interpolate([[0, 0], [10, 100]], 5)).toBe(50);
    expect(interpolate([[0, 0], [10, 100]], -5)).toBe(0);
    expect(interpolate([[0, 0], [10, 100]], 50)).toBe(100);
  });
  it("excludes unknown answers and lowers confidence instead", () => {
    const known = scoreDimension("activation", { businessModel: "ecommerce", conversionRate: 2, addToCartRate: 6, checkoutCompletion: 50 });
    const partial = scoreDimension("activation", { businessModel: "ecommerce", conversionRate: 2, addToCartRate: UNKNOWN, checkoutCompletion: UNKNOWN });
    expect(known.confidence).toBe(1);
    expect(partial.confidence).toBeLessThan(1);
    expect(partial.signals.map((s) => s.id)).toEqual(["conversionRate"]);
  });
  it("returns a neutral, no-data score when nothing is known", () => {
    const d = scoreDimension("activation", { businessModel: "ecommerce", conversionRate: UNKNOWN });
    expect(d.hasData).toBe(false);
    expect(d.confidence).toBe(0);
  });
  it("overall score ignores dimensions with no data", () => {
    const d = dims({}, 80);
    d[0] = { ...d[0], score: 50, hasData: false, confidence: 0 };
    expect(overallScore(d)).toBe(80);
  });
  it("maps scores to configured stages", () => {
    expect(stageFor(64).label).toBe("Growth Emerging");
    expect(stageFor(39).label).toBe("Growth Foundation");
    expect(stageFor(90).label).toBe("Growth Engine");
  });
});

describe("full report", () => {
  const report = buildReport(sanitizeAnswers(ecommerce).answers, new Date("2026-10-05T00:00:00Z"));

  it("produces seven dimension scores within 0–100", () => {
    expect(report.dimensions).toHaveLength(7);
    for (const d of report.dimensions) expect(d.score).toBeGreaterThanOrEqual(0);
    for (const d of report.dimensions) expect(d.score).toBeLessThanOrEqual(100);
  });

  it("returns up to three opportunities led by the bottleneck", () => {
    expect(report.opportunities.length).toBeGreaterThan(0);
    expect(report.opportunities.length).toBeLessThanOrEqual(3);
    expect(report.opportunities[0].dimension).toBe(report.bottleneck);
  });

  it("uses SAR for Saudi Arabia", () => {
    expect(report.currency).toBe("SAR");
  });

  it("carries the business context, benchmarks and at most ten ranked recommendations", () => {
    expect(report.context?.label).toBe("E-commerce · B2C · Online store · Fashion · Riyadh, Saudi Arabia");
    expect(report.benchmarks?.find((b) => b.metric === "conversionRate")?.position).toBe("within");
    const recs = report.recommendations!;
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
  });

  it("is hedged, never certain", () => {
    expect(report.bottleneckExplanation.startsWith("Based on the information provided")).toBe(true);
  });
});

describe("opportunity calculator", () => {
  it("estimates conversion uplift from revenue and conversion rate", () => {
    const conv = buildEstimates(sanitizeAnswers(ecommerce).answers).find((e) => e.id === "conversion")!;
    expect(conv.available).toBe(true);
    expect(conv.monthlyLow).toBe(50000);
    expect(conv.monthlyHigh).toBe(130000); // 125,000 rounded to 2 significant figures
  });

  it("refuses to estimate without the data", () => {
    const conv = buildEstimates({ businessModel: "ecommerce", monthlyRevenue: UNKNOWN, conversionRate: UNKNOWN }).find((e) => e.id === "conversion")!;
    expect(conv.available).toBe(false);
    expect(conv.missing?.length).toBeGreaterThan(0);
  });

  it("never estimates CAC savings when CAC is unknown", () => {
    const cac = buildEstimates(sanitizeAnswers(ecommerce).answers).find((e) => e.id === "cac")!;
    expect(cac.available).toBe(false);
  });

  it("rounds to two significant figures", () => {
    expect(roughen(123456)).toBe(120000);
    expect(roughen(987)).toBe(990);
  });
});

describe("answer validation", () => {
  it("drops questions hidden for the business model and unknown keys", () => {
    const { answers } = sanitizeAnswers({ ...ecommerce, monthlyChurn: 5, injected: "x" });
    expect(answers.monthlyChurn).toBeUndefined();
    expect((answers as Record<string, unknown>).injected).toBeUndefined();
  });
  it("rejects out-of-range percentages", () => {
    const { errors } = sanitizeAnswers({ ...ecommerce, grossMargin: 140 });
    expect(errors.grossMargin).toBeDefined();
  });
  it("accepts the complete e-commerce answer set and derives the revenue model", () => {
    const { answers, errors } = sanitizeAnswers(ecommerce);
    expect(errors).toEqual({});
    expect(answers.businessModel).toBe("ecommerce");
  });
  it("rejects a category that doesn't belong to the business type", () => {
    const { errors } = sanitizeAnswers({ ...ecommerce, category: "dental" });
    expect(errors.category).toBeDefined();
  });
  it("ignores a client-supplied businessModel that contradicts the business type", () => {
    const { answers } = sanitizeAnswers({ ...ecommerce, businessModel: "subscription" });
    expect(answers.businessModel).toBe("ecommerce");
  });
});
