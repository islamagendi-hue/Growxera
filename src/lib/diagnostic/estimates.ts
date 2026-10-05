/**
 * Opportunity calculator.
 *
 * Every estimate is a range built from the user's own inputs and the scenario
 * assumptions in config.ts. When the inputs needed are missing, the estimate is
 * returned as unavailable with the list of what's missing. We never fill gaps
 * with invented numbers.
 */
import { UPLIFT_ASSUMPTIONS as U } from "./config";
import { derive, getModel, num } from "./scoring";
import type { Answers, Estimate } from "./types";

const pct = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 100) / 100}%`;

/** Rounds to 2 significant figures so we don't imply false precision. */
export function roughen(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / magnitude) * magnitude;
}

function range(low: number, high: number) {
  return { monthlyLow: roughen(low), monthlyHigh: roughen(high) };
}

function conversionEstimate(a: Answers): Estimate {
  const model = getModel(a);
  const d = derive(a);
  const revenue = num(a, "monthlyRevenue");
  const base: Estimate = { id: "conversion", dimension: "activation", title: "Conversion improvement", available: false };

  if (model === "leadgen") {
    const close = num(a, "qualifiedToCustomer");
    const missing = [!revenue && "monthly revenue", close === undefined && "qualified → customer rate"].filter(Boolean) as string[];
    if (missing.length || !revenue || close === undefined || close <= 0) return { ...base, title: "Close-rate improvement", missing: missing.length ? missing : ["a non-zero close rate"] };
    const [lo, hi] = U.closeRateRelative;
    return {
      ...base,
      title: "Close-rate improvement",
      available: true,
      kind: "revenue",
      scenario: `Close rate improves from ${pct(close)} to ${pct(close * (1 + lo))}–${pct(close * (1 + hi))}`,
      ...range(revenue * lo, revenue * hi),
      assumptions: ["Lead volume and deal size stay the same.", "Revenue scales in proportion to close rate."],
    };
  }

  if (model === "subscription") {
    const trial = num(a, "trialToPaid");
    const signups = num(a, "monthlyLeads");
    const arpu = d.aov;
    const title = "Trial-to-paid improvement";
    const missing = [
      signups === undefined && "monthly sign-ups",
      trial === undefined && "trial → paid rate",
      !arpu && "revenue per customer",
    ].filter(Boolean) as string[];
    if (missing.length || !signups || !trial || !arpu) return { ...base, title, missing: missing.length ? missing : ["non-zero sign-ups and trial → paid rate"] };
    const [lo, hi] = U.conversionRelative;
    const newCustomers = signups * (trial / 100);
    return {
      ...base,
      title,
      available: true,
      kind: "revenue",
      scenario: `Trial → paid improves from ${pct(trial)} to ${pct(trial * (1 + lo))}–${pct(trial * (1 + hi))}`,
      ...range(newCustomers * lo * arpu, newCustomers * hi * arpu),
      assumptions: [
        "Sign-up volume and revenue per customer stay the same.",
        "Counts only the first month of each additional subscription, so the real value compounds beyond this.",
      ],
    };
  }

  const cr = model === "ecommerce" ? d.conversionRate : num(a, "visitorToCustomer");
  const missing = [!revenue && "monthly revenue", cr === undefined && "conversion rate (or traffic and orders)"].filter(Boolean) as string[];
  if (missing.length || !revenue || cr === undefined || cr <= 0) return { ...base, missing: missing.length ? missing : ["a non-zero conversion rate"] };
  const [lo, hi] = U.conversionRelative;
  return {
    ...base,
    available: true,
    kind: "revenue",
    scenario: `Conversion improves from ${pct(cr)} to ${pct(cr * (1 + lo))}–${pct(cr * (1 + hi))}`,
    ...range(revenue * lo, revenue * hi),
    assumptions: ["Traffic and average order value stay the same.", "Revenue scales with conversion rate."],
  };
}

function aovEstimate(a: Answers): Estimate {
  const revenue = num(a, "monthlyRevenue");
  const aov = derive(a).aov;
  const base: Estimate = { id: "aov", dimension: "expansion", title: "Average order value", available: false };
  const missing = [!revenue && "monthly revenue", !aov && "average order value"].filter(Boolean) as string[];
  if (missing.length || !revenue || !aov) return { ...base, missing };
  const [lo, hi] = U.aovRelative;
  return {
    ...base,
    available: true,
    kind: "revenue",
    scenario: `Average order value rises ${Math.round(lo * 100)}–${Math.round(hi * 100)}% through bundles, upsells and pricing`,
    ...range(revenue * lo, revenue * hi),
    assumptions: ["Order volume stays the same.", `Current average order value: ${Math.round(aov).toLocaleString("en-US")}.`],
  };
}

function retentionEstimate(a: Answers): Estimate {
  const model = getModel(a);
  const base: Estimate = { id: "retention", dimension: "retention", title: "Retention & purchase frequency", available: false };
  const revenue = num(a, "monthlyRevenue");

  if (model === "subscription") {
    const churn = num(a, "monthlyChurn");
    const missing = [!revenue && "monthly revenue", churn === undefined && "monthly churn"].filter(Boolean) as string[];
    if (missing.length || !revenue || churn === undefined || churn <= 0) return { ...base, title: "Churn reduction", missing: missing.length ? missing : ["a non-zero churn rate"] };
    const [lo, hi] = U.churnReductionRelative;
    const lost = revenue * (churn / 100);
    return {
      ...base,
      title: "Churn reduction",
      available: true,
      kind: "revenue",
      scenario: `Monthly churn falls from ${pct(churn)} to ${pct(churn * (1 - hi))}–${pct(churn * (1 - lo))}`,
      ...range(lost * lo, lost * hi),
      assumptions: ["Revenue retained in the first month only; compounding over later months is not counted."],
    };
  }

  const customers = num(a, "monthlyCustomers");
  const repeat = num(a, "repeatRate");
  const aov = derive(a).aov;
  const missing = [
    !customers && "customers per month",
    repeat === undefined && "repeat customer rate",
    !aov && "average order value",
  ].filter(Boolean) as string[];
  if (missing.length || !customers || repeat === undefined || !aov) return { ...base, missing };
  const [lo, hi] = U.repeatRatePoints;
  const cap = (p: number) => Math.min(100, repeat + p);
  return {
    ...base,
    available: true,
    kind: "revenue",
    scenario: `Repeat rate improves from ${pct(repeat)} to ${pct(cap(lo))}–${pct(cap(hi))}`,
    ...range(customers * ((cap(lo) - repeat) / 100) * aov, customers * ((cap(hi) - repeat) / 100) * aov),
    assumptions: ["Each additional repeat customer makes one more purchase at current order value."],
  };
}

function cacEstimate(a: Answers): Estimate {
  const base: Estimate = { id: "cac", dimension: "acquisition", title: "Acquisition efficiency", available: false };
  const spend = num(a, "paidSpend") ?? num(a, "marketingSpend");
  const cac = num(a, "cac");
  const missing = [!spend && "marketing spend", !cac && "customer acquisition cost"].filter(Boolean) as string[];
  if (missing.length || !spend) return { ...base, missing };
  const [lo, hi] = U.cacReductionRelative;
  return {
    ...base,
    available: true,
    kind: "savings",
    scenario: `CAC falls ${Math.round(lo * 100)}–${Math.round(hi * 100)}% for the same customer volume`,
    ...range(spend * lo, spend * hi),
    assumptions: ["Shown as monthly spend saved at the same volume; it could instead fund more growth."],
  };
}

export function buildEstimates(answers: Answers): Estimate[] {
  return [conversionEstimate(answers), aovEstimate(answers), retentionEstimate(answers), cacEstimate(answers)];
}

/** Sum of the revenue estimates (savings are reported separately). */
export function totalRevenueOpportunity(estimates: Estimate[]) {
  const revenue = estimates.filter((e) => e.available && e.kind === "revenue");
  if (!revenue.length) return null;
  return {
    monthlyLow: roughen(revenue.reduce((s, e) => s + (e.monthlyLow ?? 0), 0)),
    monthlyHigh: roughen(revenue.reduce((s, e) => s + (e.monthlyHigh ?? 0), 0)),
  };
}
