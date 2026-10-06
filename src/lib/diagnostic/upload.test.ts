import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { analyseFile, analyseMetricRows, analyseOrders, parseAmount, parseCsv, parseDate, readXlsx } from "./upload";

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

describe("metrics sheets", () => {
  it("reads one row per month and averages the last three", () => {
    const rows = parseCsv("Month,Revenue,Orders,New customers,Conversion rate\n2026-05,100000,500,200,0.02\n2026-06,300000,1000,300,0.02\n2026-07,300000,1000,300,0.03\n2026-08,300000,1000,300,0.025");
    const res = analyseMetricRows("m.csv", rows);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.kind).toBe("metrics");
    expect(res.metrics.monthlyRevenue).toBe(300000);
    expect(res.metrics.monthlyOrders).toBe(1000);
    expect(res.metrics.monthlyNewCustomers).toBe(300);
    expect(res.metrics.aov).toBe(300);
    expect(res.metrics.conversionRate).toBe(2.5);
  });

  it("reads metric names down the first column, in Arabic too", () => {
    const res = analyseMetricRows("m.csv", parseCsv("المبيعات الشهرية,450000\nالإنفاق التسويقي,50000\nالزيارات,40000\nهامش الربح,45%"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.monthlyRevenue).toBe(450000);
    expect(res.metrics.marketingSpend).toBe(50000);
    expect(res.metrics.monthlyTraffic).toBe(40000);
    expect(res.metrics.grossMargin).toBe(45);
  });

  it("explains a file with nothing it recognises", () => {
    const res = analyseMetricRows("m.csv", parseCsv("Colour,Size\nred,4"));
    expect(res.ok).toBe(false);
  });
});

/** Builds a minimal .xlsx (a zip with deflated entries) for tests. */
function xlsx(rows: (string | number)[][]): Uint8Array {
  const strings: string[] = [];
  const sheet = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) => {
            const ref = `${String.fromCharCode(65 + ci)}${ri + 1}`;
            if (typeof v === "number") return `<c r="${ref}"><v>${v}</v></c>`;
            strings.push(v);
            return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
          })
          .join("")}</row>`,
    )
    .join("");
  const files: Record<string, string> = {
    "xl/workbook.xml": `<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<sst>${strings.map((t) => `<si><t>${t.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheet}</sheetData></worksheet>`,
  };
  const enc = new TextEncoder();
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(enc.encode(name));
    const data = deflateRawSync(Buffer.from(enc.encode(text)));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt16LE(nameBytes.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

describe("Excel files", () => {
  it("reads the first sheet of an .xlsx", async () => {
    const rows = await readXlsx(xlsx([["Month", "Revenue & sales"], ["Jan", 1000]]));
    expect(rows).toEqual([["Month", "Revenue & sales"], ["Jan", "1000"]]);
  });

  it("analyses a metrics sheet saved as Excel", async () => {
    const res = await analyseFile("numbers.xlsx", xlsx([["Month", "Revenue", "Orders", "Ad spend"], ["Jul", 200000, 800, 20000], ["Aug", 260000, 1000, 26000]]));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metrics.monthlyRevenue).toBe(230000);
    expect(res.metrics.monthlyOrders).toBe(900);
    expect(res.metrics.paidSpend).toBe(23000);
  });

  it("analyses an orders export saved as Excel, with Excel date serials", async () => {
    // 46204 = 2026-07-01 in Excel's 1900 date system.
    const rows: (string | number)[][] = [["Date", "Total", "Customer"]];
    for (let d = 0; d < 92; d++) rows.push([46204 + d, 100, `c${d % 40}`]);
    const res = await analyseFile("orders.xlsx", xlsx(rows));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.kind).toBe("orders");
    expect(res.metrics.aov).toBe(100);
  });

  it("gives a clear error for a broken file", async () => {
    const res = await analyseFile("x.xlsx", new Uint8Array([0x50, 0x4b, 1, 2, 3]));
    expect(res.ok).toBe(false);
  });
});
