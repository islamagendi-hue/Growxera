import { describe, expect, it } from "vitest";
import { analyseOrders, parseAmount, parseCsv, parseDate } from "./upload";

function ordersCsv(opts: { months?: string[]; perMonth?: number; amount?: number; sep?: string } = {}) {
  const { months = ["2026-06", "2026-07", "2026-08", "2026-09"], perMonth = 20, amount = 200, sep = "," } = opts;
  const lines = [["Order ID", "Created at", "Total", "Customer Email"].join(sep)];
  let id = 0;
  months.forEach((m, mi) => {
    for (let i = 0; i < perMonth; i++) {
      // Half the orders come from returning customers c0..c9, the rest are new each month.
      const customer = i < 10 ? `c${i}@x.co` : `m${mi}-${i}@x.co`;
      lines.push([`#${++id}`, `${m}-${String((i % 28) + 1).padStart(2, "0")}`, String(amount), customer].join(sep));
    }
  });
  lines.push(`#1${sep}${months[0]}-01${sep}${amount}${sep}c0@x.co`); // repeated line item
  return lines.join("\n");
}

describe("parsing", () => {
  it("handles quotes, separators and BOM", () => {
    expect(parseCsv('﻿a;b\n"x;1";"he said ""hi"""\n')).toEqual([["﻿a", "b"], ["x;1", 'he said "hi"']]);
    expect(parseCsv("a\tb\r\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("reads amounts in common formats", () => {
    expect(parseAmount("1,250.50")).toBe(1250.5);
    expect(parseAmount("SAR 1.250,50")).toBe(1250.5);
    expect(parseAmount("١٢٥٠")).toBe(1250);
    expect(parseAmount("(30.00)")).toBe(-30);
    expect(parseAmount("n/a")).toBeUndefined();
  });
  it("reads dates day-first by default", () => {
    expect(parseDate("2026-09-03T10:00:00Z")).toBe("2026-09-03");
    expect(parseDate("03/09/2026")).toBe("2026-09-03");
    expect(parseDate("03/09/2026", false)).toBe("2026-03-09");
    expect(parseDate("31/02/1990")).toBeUndefined();
  });
});

describe("analyseOrders", () => {
  it("derives monthly metrics from full months", () => {
    const res = analyseOrders("orders.csv", ordersCsv());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.monthlyOrders).toBe(20);
    expect(res.metrics.monthlyRevenue).toBe(4000);
    expect(res.metrics.aov).toBe(200);
    expect(res.metrics.monthlyNewCustomers).toBe(10);
    expect(res.summary.columns).toMatchObject({ date: "Created at", amount: "Total", customer: "Customer Email" });
    expect(res.warnings.join(" ")).toContain("repeated order lines");
  });

  it("works with semicolon exports", () => {
    const res = analyseOrders("o.csv", ordersCsv({ sep: ";" }));
    expect(res.ok && res.metrics.monthlyOrders).toBe(20);
  });

  it("explains a missing column", () => {
    const res = analyseOrders("o.csv", "Name,Total\nA,10\nB,20");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("date column");
  });

  it("rejects empty and too-small files with a clear error", () => {
    expect(analyseOrders("o.csv", "").ok).toBe(false);
    const res = analyseOrders("o.csv", "Date,Total\n2026-01-01,10\n2026-01-02,20");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/fewer than 10/);
  });

  it("warns when the file is short", () => {
    const res = analyseOrders("o.csv", ordersCsv({ months: ["2026-09"] }));
    expect(res.ok && res.warnings.join(" ")).toContain("less than two months");
  });
});
