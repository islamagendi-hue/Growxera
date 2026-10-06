import { describe, expect, it } from "vitest";
import { compareReports } from "./compare";
import { buildReport } from "./engine";
import { sanitizeAnswers } from "./questions";
import type { Answers } from "./types";

const base: Answers = {
  industry: "ecommerce", segment: "b2c", businessType: "online_retail", category: "fashion", geography: "SA", city: "riyadh",
  monthlyRevenue: 400000, monthlyOrders: 2000, monthlyNewCustomers: 700, monthlyTraffic: 250000,
  conversionRate: 0.8, repeatRate: 12, crmUsage: "none", reactivation: "none", analytics: "limited",
};

describe("historical comparison", () => {
  const october = buildReport(sanitizeAnswers(base).answers, new Date("2026-10-06T10:00:00Z"));
  const november = buildReport(
    sanitizeAnswers({ ...base, conversionRate: 1.6, repeatRate: 24, crmUsage: "campaigns", reactivation: "automated", analytics: "limited" }).answers,
    new Date("2026-11-06T10:00:00Z"),
  );
  const frozen = JSON.stringify(october);
  const c = compareReports(october, november);

  it("shows the overall change", () => {
    expect(c.before.overallScore).toBe(october.overallScore);
    expect(c.after.overallScore).toBe(november.overallScore);
    expect(c.overallDelta).toBe(november.overallScore - october.overallScore);
    expect(c.overallDelta).toBeGreaterThan(0);
  });

  it("shows area-by-area changes", () => {
    const retention = c.dimensions.find((d) => d.dimension === "retention")!;
    expect(retention.delta).toBeGreaterThan(0);
  });

  it("lists improved metrics and benchmark movement", () => {
    expect(c.improved.map((m) => m.id)).toEqual(expect.arrayContaining(["conversionRate", "repeatRate", "crmUsage"]));
    expect(c.declined).toHaveLength(0);
    const conv = c.benchmarkMoves.find((m) => m.metric === "conversionRate")!;
    expect(conv.before).toBe("worse");
    expect(conv.after).toBe("within");
  });

  it("lists recommendations that are new or resolved", () => {
    expect(c.resolvedRecommendations.map((r) => r.id)).toEqual(expect.arrayContaining(["ecom_conversion", "repeat_lifecycle"]));
    expect(c.resolvedRecommendations.map((r) => r.id)).not.toContain("analytics");
  });

  it("never changes the earlier snapshot", () => {
    expect(JSON.stringify(october)).toBe(frozen);
  });

  it("flags comparisons across scoring versions", () => {
    expect(c.sameScoringVersion).toBe(true);
    expect(compareReports({ ...october, scoringVersion: "2026.10-v1" }, november).sameScoringVersion).toBe(false);
  });
});
