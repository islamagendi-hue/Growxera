import { describe, expect, it } from "vitest";
import { evaluateBenchmarks, gapOf, position, rangeFor } from "./benchmarks";
import { buildRecommendations, MAX_RECOMMENDATIONS, RULES } from "./recommendations";
import { buildReport } from "./engine";
import { sanitizeAnswers } from "./questions";
import { UNKNOWN, type Answers } from "./types";

const perfume = (extra: Answers = {}) =>
  sanitizeAnswers({ industry: "ecommerce", segment: "b2c", businessType: "d2c_brand", category: "perfume", geography: "SA", city: "jeddah", ...extra }).answers;

describe("benchmark positions", () => {
  const range = { low: 1, high: 2.5 };
  it("below, within and above the range", () => {
    expect(position(0.5, range, true)).toBe("worse");
    expect(position(1, range, true)).toBe("within");
    expect(position(2.5, range, true)).toBe("within");
    expect(position(3, range, true)).toBe("better");
  });
  it("far above the range is an outlier, not simply good", () => {
    expect(position(4.5, range, true)).toBe("outlier");
  });
  it("lower-is-better metrics invert", () => {
    const churn = { low: 3, high: 7 };
    expect(position(9, churn, false)).toBe("worse");
    expect(position(5, churn, false)).toBe("within");
    expect(position(2.5, churn, false)).toBe("better");
    expect(position(1, churn, false)).toBe("outlier");
  });
});

describe("benchmark resolution", () => {
  it("uses the most specific range: category first", () => {
    expect(rangeFor("conversionRate", perfume())?.basis).toBe("perfumes & fragrance");
    expect(rangeFor("conversionRate", perfume())?.range).toEqual({ low: 1.5, high: 3 });
  });
  it("falls back to the business type, then the revenue model", () => {
    const clinic = sanitizeAnswers({ industry: "healthcare", segment: "b2c", businessType: "clinic", category: "dental", geography: "SA", city: "riyadh" }).answers;
    expect(rangeFor("qualifiedToCustomer", clinic)?.basis).toBe("clinic or medical centre");
    expect(rangeFor("leadToQualified", clinic)?.range).toEqual({ low: 25, high: 45 });
  });
  it("skips metrics that don't apply to the model", () => {
    expect(rangeFor("monthlyChurn", perfume())).toBeNull();
  });
  it("explains each position in plain words", () => {
    const [below] = evaluateBenchmarks(perfume({ conversionRate: 0.8 }));
    expect(below.position).toBe("worse");
    expect(below.explanation).toContain("below the expected range for perfumes & fragrance");
    const [outlier] = evaluateBenchmarks(perfume({ conversionRate: 9 }));
    expect(outlier.position).toBe("outlier");
    expect(outlier.explanation).toContain("significantly above the current benchmark");
    expect(outlier.explanation).toContain("customer mix, positioning, pricing model or business model");
    expect(gapOf(outlier)).toBe(0);
  });
});

describe("recommendations", () => {
  const weak = perfume({
    monthlyRevenue: 300000,
    monthlyOrders: 1500,
    monthlyNewCustomers: 600,
    monthlyTraffic: 200000,
    conversionRate: 0.7,
    checkoutCompletion: 30,
    addToCartRate: 3,
    repeatRate: 10,
    grossMargin: 30,
    icpClarity: "anyone",
    differentiation: "price",
    crmUsage: "none",
    ownedChannels: ["none"],
    reactivation: "none",
    loyalty: "no",
    upsell: "no",
    crossSell: "no",
    bundles: "no",
    recurringRevenue: "none",
    pricingReview: "never",
    analytics: "limited",
    experimentation: "none",
    channels: ["meta"],
    topChannelShare: "gt90",
    cacTrend: "up_fast",
    acquisitionTrend: "down_fast",
    growthRate: "declining",
    marginTrend: "down_fast",
    cac: UNKNOWN,
  });
  const report = buildReport(weak);

  it("never shows more than ten, ranked by impact + gap + relevance", () => {
    expect(RULES.length).toBeGreaterThan(MAX_RECOMMENDATIONS);
    const all = buildRecommendations(weak, report.dimensions, report.benchmarks!, report.bottleneck, 100);
    expect(all.length).toBeGreaterThan(MAX_RECOMMENDATIONS);
    expect(report.recommendations).toHaveLength(MAX_RECOMMENDATIONS);
    expect(report.recommendations!.map((r) => r.id)).toEqual(all.slice(0, 10).map((r) => r.id));
  });

  it("is specific to the context: perfume gets samples and fragrance advice", () => {
    const all = buildRecommendations(weak, report.dimensions, report.benchmarks!, report.bottleneck, 100);
    expect(all.find((r) => r.id === "bundles")?.title).toBe("Use bundles, samples and discovery sets");
    expect(all.find((r) => r.id === "ecom_conversion")?.body).toContain("discovery set");
    expect(all.some((r) => r.id === "lead_speed")).toBe(false);
  });

  it("does not recommend fixing what is already strong", () => {
    const strong = perfume({ conversionRate: 2.8, repeatRate: 38, crmUsage: "advanced", analytics: "reliable" });
    const r = buildReport(strong);
    const ids = (r.recommendations ?? []).map((x) => x.id);
    expect(ids).not.toContain("ecom_conversion");
    expect(ids).not.toContain("repeat_lifecycle");
    expect(ids).not.toContain("crm");
    expect(ids).not.toContain("analytics");
  });

  it("cites the business's own numbers as evidence", () => {
    const conv = report.recommendations!.find((r) => r.id === "ecom_conversion");
    expect(conv?.title).toBe("Lift conversion from 0.7%");
    expect(conv?.evidence[0]).toContain("0.7%");
  });
});
