import { describe, expect, it } from "vitest";
import { CONTEXT_OPTIONS, GEOGRAPHIES, INDUSTRIES } from "./context";
import { applyAnswer, QUESTION_MAP, QUESTIONS, STEPS, sanitizeAnswers } from "./questions";
import { LOOKUPS } from "./config";

describe("question bank rules", () => {
  it("every predefined single-choice question has exactly five options", () => {
    for (const q of QUESTIONS.filter((x) => x.type === "choice")) {
      expect(q.options?.length, q.id).toBe(5);
    }
  });

  it("every scored choice option has a score, and every score has an option", () => {
    for (const [id, table] of Object.entries(LOOKUPS)) {
      const q = QUESTION_MAP[id];
      expect(q, id).toBeDefined();
      expect(Object.keys(table).sort(), id).toEqual(q.options!.map((o) => o.value).sort());
    }
  });

  it("no question asks for two metrics at once", () => {
    for (const q of QUESTIONS) expect(q.label, q.id).not.toMatch(/\bor orders\b|customers or|\s\/\s/i);
    expect(QUESTION_MAP.monthlyCustomers).toBeUndefined();
    expect(QUESTION_MAP.monthlyNewCustomers.label).toBe("How many new customers do you acquire per month?");
    expect(QUESTION_MAP.monthlyOrders.label).toBe("How many orders do you receive per month?");
  });

  it("every numeric metric has a help note with what, why and where", () => {
    for (const q of QUESTIONS.filter((x) => ["number", "currency", "percent"].includes(x.type) && x.id !== "paidSpend")) {
      expect(q.info?.what, q.id).toBeTruthy();
      expect(q.info?.why, q.id).toBeTruthy();
    }
  });

  it("every question on a screen exists, and every question is on a screen", () => {
    const placed = STEPS.flatMap((s) => s.screens.flat());
    for (const id of placed) expect(QUESTION_MAP[id], id).toBeDefined();
    for (const q of QUESTIONS) expect(placed, q.id).toContain(q.id);
  });
});

describe("context taxonomy", () => {
  it("every business type maps to a revenue model and unique ids per level", () => {
    for (const i of INDUSTRIES) {
      expect(new Set(i.models.map((m) => m.value)).size).toBe(i.models.length);
      for (const m of i.models) {
        expect(new Set(m.types.map((t) => t.value)).size).toBe(m.types.length);
        for (const t of m.types) expect(["ecommerce", "leadgen", "subscription", "other"]).toContain(t.revenueModel);
      }
    }
    expect(GEOGRAPHIES.find((g) => g.value === "SA")?.cities.map((c) => c.label)).toContain("Riyadh");
  });

  it("dropdowns depend on the level above", () => {
    expect(CONTEXT_OPTIONS.segment({})).toEqual([]);
    const types = CONTEXT_OPTIONS.businessType({ industry: "ecommerce", segment: "b2c" }).map((t) => t.value);
    expect(types).toContain("d2c_brand");
    const cats = CONTEXT_OPTIONS.category({ industry: "ecommerce", segment: "b2c", businessType: "d2c_brand" }).map((c) => c.value);
    expect(cats).toEqual(expect.arrayContaining(["fashion", "perfume", "home", "electronics"]));
  });

  it("changing the industry clears the levels below it", () => {
    let a = applyAnswer({}, "industry", "ecommerce");
    a = applyAnswer(a, "segment", "b2c");
    a = applyAnswer(a, "businessType", "d2c_brand");
    a = applyAnswer(a, "category", "perfume");
    expect(a.businessModel).toBe("ecommerce");
    a = applyAnswer(a, "industry", "saas");
    expect(a.segment).toBeUndefined();
    expect(a.businessType).toBeUndefined();
    expect(a.category).toBeUndefined();
    expect(a.businessModel).toBeUndefined();
  });

  it("city is required only where the geography has cities", () => {
    const base = { industry: "saas", segment: "b2b", businessType: "smb_saas", category: "hr" };
    expect(sanitizeAnswers({ ...base, geography: "SA" }).errors.city).toBeDefined();
    expect(sanitizeAnswers({ ...base, geography: "QA" }).errors.city).toBeUndefined();
  });

  it("adapts questions to the revenue model of the business type", () => {
    const saas = sanitizeAnswers({ industry: "saas", segment: "b2b", businessType: "smb_saas", category: "hr", geography: "AE", city: "dubai", monthlyChurn: 4, repeatRate: 30 });
    expect(saas.answers.businessModel).toBe("subscription");
    expect(saas.answers.monthlyChurn).toBe(4);
    expect(saas.answers.repeatRate).toBeUndefined();
  });
});
