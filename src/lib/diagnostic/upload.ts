/**
 * Reads an orders or sales export (CSV) and derives diagnostic metrics from it.
 *
 * Runs in the browser: the raw file never leaves the visitor's device. Only the
 * derived numbers (which the visitor reviews before using) and a small summary
 * are sent with the diagnostic. Pure and deterministic, so it is unit-tested.
 *
 * Accepted: a CSV (comma, semicolon or tab separated) with one row per order and
 * at least a date column and an amount column. A customer column (id, email or
 * phone) unlocks new-customer and repeat-rate metrics. Exports from Shopify,
 * Salla, Zid, WooCommerce, POS systems or a spreadsheet saved as CSV work.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 200_000;

/** Diagnostic answers a file can fill in, by question id. */
export const UPLOAD_METRICS = [
  "monthlyRevenue",
  "monthlyOrders",
  "monthlyNewCustomers",
  "aov",
  "dealSize",
  "arpa",
  "grossMargin",
  "marketingSpend",
  "paidSpend",
  "cac",
  "ltv",
  "monthlyTraffic",
  "monthlyLeads",
  "conversionRate",
  "repeatRate",
  "monthlyChurn",
] as const;
export type UploadMetric = (typeof UPLOAD_METRICS)[number];
export type UploadMetrics = Partial<Record<UploadMetric, number>>;

export interface UploadSummary {
  /** "orders": one row per order; "metrics": a sheet of monthly or summary figures. */
  kind: "orders" | "metrics";
  fileName: string;
  rows: number;
  validRows: number;
  from: string;
  to: string;
  /** Full calendar months used for the monthly averages. */
  monthsUsed: number;
  columns: { date: string; amount: string; customer?: string };
}

export type UploadResult =
  | { ok: true; summary: UploadSummary; metrics: UploadMetrics; warnings: string[] }
  | { ok: false; error: string };

const SYNONYMS = {
  date: ["date", "order date", "order_date", "created at", "created_at", "createdat", "day", "paid at", "paid_at", "processed at", "transaction date", "invoice date", "التاريخ", "تاريخ الطلب", "تاريخ"],
  amount: ["total", "order total", "order_total", "total price", "total_price", "amount", "revenue", "net sales", "net_sales", "gross sales", "sales", "grand total", "grand_total", "subtotal", "value", "price", "المبلغ", "الإجمالي", "الاجمالي", "المجموع", "قيمة الطلب"],
  customer: ["customer id", "customer_id", "customer", "customer email", "customer_email", "email", "phone", "mobile", "client", "client id", "buyer", "العميل", "رقم العميل", "البريد الإلكتروني", "الجوال"],
  order: ["order id", "order_id", "order", "order number", "order_number", "name", "id", "invoice", "invoice number", "رقم الطلب"],
} as const;

const norm = (s: string) => s.trim().toLowerCase().replace(/^﻿/, "").replace(/["']/g, "").replace(/\s+/g, " ");

/** Minimal RFC 4180 CSV parser with quote handling. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const counts = { ",": (firstLine.match(/,/g) ?? []).length, ";": (firstLine.match(/;/g) ?? []).length, "\t": (firstLine.match(/\t/g) ?? []).length };
  const sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ",") as string;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) break;
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function findColumn(header: string[], kind: keyof typeof SYNONYMS): number {
  const h = header.map(norm);
  for (const syn of SYNONYMS[kind]) {
    const i = h.indexOf(syn);
    if (i !== -1) return i;
  }
  for (const syn of SYNONYMS[kind]) {
    const i = h.findIndex((x) => x.includes(syn) && syn.length > 3);
    if (i !== -1) return i;
  }
  return -1;
}

/** Parses "1,250.50", "SAR 1.250,50", "١٢٥٠" and "(30.00)" (negative). Undefined if not a number. */
export function parseAmount(raw: string): number | undefined {
  let s = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".").replace(/٬/g, ",");
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot && s.length - lastComma - 1 <= 2) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -n : n;
}

/** Parses ISO dates, "dd/mm/yyyy", "dd-mm-yyyy" and "yyyy/mm/dd". Returns "YYYY-MM-DD" or undefined. */
export function parseDate(raw: string, dayFirst = true): string | undefined {
  const s = raw.trim();
  // Excel stores dates as days since 1899-12-30.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000);
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const [d, mo] = dayFirst ? [+m[1], +m[2]] : [+m[2], +m[1]];
    return valid(y, mo, d);
  }
  const t = Date.parse(s);
  if (Number.isFinite(t)) {
    const d = new Date(t);
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return undefined;
}

function valid(y: number, m: number, d: number): string | undefined {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Day-first unless a value only makes sense month-first (e.g. 04/25/2026). */
function detectDayFirst(values: string[]): boolean {
  for (const v of values.slice(0, 500)) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) return true;
    if (+m[2] > 12) return false;
  }
  return true;
}

export function analyseOrders(fileName: string, text: string): UploadResult {
  return analyseOrderRows(fileName, parseCsv(text));
}

function analyseOrderRows(fileName: string, rows: string[][]): UploadResult {
  if (rows.length < 2) return { ok: false, error: "We couldn't find any rows in this file. Export your orders as CSV with a header row and try again." };
  const header = rows[0];
  const iDate = findColumn(header, "date");
  const iAmount = findColumn(header, "amount");
  const iCustomer = findColumn(header, "customer");
  const iOrder = findColumn(header, "order");
  if (iDate === -1 || iAmount === -1) {
    const missing = [iDate === -1 && "a date column (e.g. “Created at”)", iAmount === -1 && "an amount column (e.g. “Total”)"].filter(Boolean).join(" and ");
    return { ok: false, error: `We couldn't interpret this file: it needs ${missing}. Columns found: ${header.slice(0, 8).map((h) => h.trim()).join(", ")}.` };
  }
  if (rows.length - 1 > MAX_ROWS) return { ok: false, error: `This file has more than ${MAX_ROWS.toLocaleString("en-US")} rows. Export the last 12 months only and try again.` };

  const body = rows.slice(1);
  const dayFirst = detectDayFirst(body.map((r) => r[iDate] ?? ""));
  // Some exports repeat the order on every line item; count each order id once.
  const seenOrders = new Set<string>();
  const orders: { date: string; amount: number; customer?: string }[] = [];
  let invalid = 0;
  let duplicates = 0;
  for (const r of body) {
    const date = parseDate(r[iDate] ?? "", dayFirst);
    const amount = parseAmount(r[iAmount] ?? "");
    if (!date || amount === undefined) {
      invalid++;
      continue;
    }
    const orderId = iOrder !== -1 && iOrder !== iCustomer ? (r[iOrder] ?? "").trim() : "";
    if (orderId) {
      if (seenOrders.has(orderId)) {
        duplicates++;
        continue;
      }
      seenOrders.add(orderId);
    }
    if (amount <= 0) continue;
    const customer = iCustomer !== -1 ? (r[iCustomer] ?? "").trim().toLowerCase() || undefined : undefined;
    orders.push({ date, amount, customer });
  }
  if (orders.length < 10) {
    return { ok: false, error: "We couldn't read enough valid orders in this file (fewer than 10 rows with a date and a positive amount). Check the date and amount columns and try again." };
  }
  const warnings: string[] = [];
  if (invalid / body.length > 0.2) warnings.push(`${invalid.toLocaleString("en-US")} of ${body.length.toLocaleString("en-US")} rows had an unreadable date or amount and were skipped.`);
  if (duplicates > 0) warnings.push(`${duplicates.toLocaleString("en-US")} repeated order lines were counted once.`);

  orders.sort((a, b) => a.date.localeCompare(b.date));
  const from = orders[0].date;
  const to = orders[orders.length - 1].date;
  const month = (d: string) => d.slice(0, 7);
  const byMonth = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const m = byMonth.get(month(o.date)) ?? { revenue: 0, orders: 0 };
    m.revenue += o.amount;
    m.orders += 1;
    byMonth.set(month(o.date), m);
  }
  // Full months only: drop the first and last month when the data starts or ends mid-month.
  let months = [...byMonth.keys()].sort();
  if (months.length > 2) {
    if (from.slice(8) !== "01") months = months.slice(1);
    const lastDay = new Date(Date.UTC(+to.slice(0, 4), +to.slice(5, 7), 0)).getUTCDate();
    if (+to.slice(8) < lastDay - 1) months = months.slice(0, -1);
  }
  const recent = months.slice(-3);
  if (months.length < 2) warnings.push("The file covers less than two months, so monthly figures are approximate.");

  const avg = (k: "revenue" | "orders") => recent.reduce((s, m) => s + byMonth.get(m)![k], 0) / recent.length;
  const metrics: UploadMetrics = {
    monthlyRevenue: Math.round(avg("revenue")),
    monthlyOrders: Math.round(avg("orders")),
  };
  metrics.aov = Math.round((avg("revenue") / Math.max(1, avg("orders"))) * 100) / 100;

  const withCustomer = orders.filter((o) => o.customer);
  if (iCustomer !== -1 && withCustomer.length / orders.length >= 0.8) {
    const firstSeen = new Map<string, string>();
    for (const o of withCustomer) if (!firstSeen.has(o.customer!)) firstSeen.set(o.customer!, month(o.date));
    // A customer's first month in the file is only "new" if the file started earlier.
    const newMonths = recent.filter((m) => m > months[0] || months.length === 1);
    if (newMonths.length) {
      const fresh = newMonths.reduce((s, m) => s + [...firstSeen.values()].filter((v) => v === m).length, 0);
      metrics.monthlyNewCustomers = Math.round(fresh / newMonths.length);
    }
    // Repeat rate over the last 12 months of data.
    const cutoff = new Date(Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 12, +to.slice(8))).toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    for (const o of withCustomer) if (o.date > cutoff) counts.set(o.customer!, (counts.get(o.customer!) ?? 0) + 1);
    if (counts.size >= 20) {
      const repeaters = [...counts.values()].filter((n) => n >= 2).length;
      metrics.repeatRate = Math.round((repeaters / counts.size) * 1000) / 10;
    }
    if (months.length < 6) warnings.push("Repeat rate is based on less than six months of orders, so it is likely understated.");
  } else if (iCustomer === -1) {
    warnings.push("No customer column found, so new customers and repeat rate couldn't be calculated.");
  }

  return {
    ok: true,
    summary: {
      kind: "orders",
      fileName: fileName.slice(0, 120),
      rows: body.length,
      validRows: orders.length,
      from,
      to,
      monthsUsed: recent.length,
      columns: { date: header[iDate].trim(), amount: header[iAmount].trim(), ...(iCustomer !== -1 ? { customer: header[iCustomer].trim() } : {}) },
    },
    metrics,
    warnings,
  };
}

// ── Metrics sheets ─────────────────────────────────────────────────────────

/** Header or row labels that name each metric (English and Arabic). Longest match wins. */
const METRIC_NAMES: Record<UploadMetric, string[]> = {
  monthlyRevenue: ["revenue", "monthly revenue", "sales", "total sales", "net sales", "gross sales", "turnover", "الإيرادات", "الايرادات", "المبيعات", "إجمالي المبيعات"],
  monthlyOrders: ["orders", "number of orders", "order count", "transactions", "الطلبات", "عدد الطلبات"],
  monthlyNewCustomers: ["new customers", "new clients", "new buyers", "first-time customers", "customers acquired", "عملاء جدد", "العملاء الجدد"],
  aov: ["aov", "average order value", "avg order value", "basket size", "average basket", "متوسط قيمة الطلب", "متوسط السلة"],
  dealSize: ["deal size", "average deal size", "average deal value", "متوسط قيمة الصفقة"],
  arpa: ["arpa", "arpu", "average revenue per account", "average revenue per user", "mrr per customer"],
  grossMargin: ["gross margin", "margin", "gross margin %", "هامش الربح", "الهامش"],
  marketingSpend: ["marketing spend", "marketing budget", "marketing cost", "marketing", "الإنفاق التسويقي", "ميزانية التسويق", "التسويق"],
  paidSpend: ["ad spend", "ads spend", "paid ads", "advertising", "paid media", "media spend", "الإعلانات", "الإنفاق الإعلاني"],
  cac: ["cac", "customer acquisition cost", "cost per acquisition", "cpa", "تكلفة الاستحواذ", "تكلفة اكتساب العميل"],
  ltv: ["ltv", "clv", "lifetime value", "customer lifetime value", "القيمة الدائمة للعميل"],
  monthlyTraffic: ["visitors", "sessions", "traffic", "website visits", "visits", "users", "الزيارات", "الزوار"],
  monthlyLeads: ["leads", "enquiries", "inquiries", "new leads", "العملاء المحتملين", "الاستفسارات"],
  conversionRate: ["conversion rate", "conversion", "cr", "cvr", "معدل التحويل"],
  repeatRate: ["repeat rate", "repeat purchase rate", "returning customers %", "returning customer rate", "معدل تكرار الشراء"],
  monthlyChurn: ["churn", "churn rate", "monthly churn", "معدل الإلغاء", "معدل التسرب"],
};
const PERCENT_METRICS = new Set<UploadMetric>(["grossMargin", "conversionRate", "repeatRate", "monthlyChurn"]);

function metricFor(label: string): UploadMetric | undefined {
  const l = norm(label).replace(/[()%:]/g, " ").replace(/\s+/g, " ").trim();
  if (!l) return undefined;
  let best: { id: UploadMetric; len: number } | undefined;
  for (const id of UPLOAD_METRICS) {
    for (const name of METRIC_NAMES[id]) {
      const n = name.replace(/[()%:]/g, " ").replace(/\s+/g, " ").trim();
      const hit = l === n || (n.length > 3 && (l.startsWith(`${n} `) || l.endsWith(` ${n}`) || l.includes(` ${n} `)));
      if (hit && (!best || n.length > best.len)) best = { id, len: n.length };
    }
  }
  return best?.id;
}

/** Percent metrics written as fractions (0.025) become percentages (2.5). */
function normalise(id: UploadMetric, value: number, raw: string): number {
  if (PERCENT_METRICS.has(id) && !raw.includes("%") && value > 0 && value <= 1) return Math.round(value * 10000) / 100;
  return value;
}

/** Average of the last three values (the most recent months, when rows run oldest → newest). */
const recentAverage = (values: number[]) => {
  const last = values.slice(-3);
  return last.reduce((a, b) => a + b, 0) / last.length;
};

const round = (id: UploadMetric, v: number) => (PERCENT_METRICS.has(id) || id === "aov" ? Math.round(v * 100) / 100 : Math.round(v));

/**
 * Reads a sheet of figures in either layout:
 *   columns: "Month | Revenue | Orders | New customers" with one row per month, or
 *   rows:    "Revenue | 450,000" (optionally one column per month).
 */
export function analyseMetricRows(fileName: string, rows: string[][]): UploadResult {
  const found = new Map<UploadMetric, { values: number[]; label: string }>();

  // Layout 1: metric names across the first row that has any.
  const headerIndex = rows.slice(0, 10).findIndex((r) => r.filter((c) => metricFor(c)).length >= 1 && r.some((c) => parseAmount(c) === undefined));
  if (headerIndex !== -1) {
    const header = rows[headerIndex];
    header.forEach((h, col) => {
      const id = metricFor(h);
      if (!id || found.has(id)) return;
      const values: number[] = [];
      for (const r of rows.slice(headerIndex + 1)) {
        const v = parseAmount(r[col] ?? "");
        if (v !== undefined && v >= 0) values.push(normalise(id, v, `${h} ${r[col]}`));
      }
      if (values.length) found.set(id, { values, label: h.trim() });
    });
  }
  // Layout 2: metric names down the first column.
  for (const r of rows) {
    const id = metricFor(r[0] ?? "");
    if (!id || found.has(id)) continue;
    const values = r
      .slice(1)
      .map((c) => ({ c, v: parseAmount(c) }))
      .filter((x): x is { c: string; v: number } => x.v !== undefined && x.v >= 0)
      .map((x) => normalise(id, x.v, `${r[0]} ${x.c}`));
    if (values.length) found.set(id, { values, label: r[0].trim() });
  }

  if (!found.size) {
    return {
      ok: false,
      error:
        "We couldn't find figures we recognise in this file. Use an orders export (one row per order with a date and an amount), or a sheet with columns such as Revenue, Orders, New customers, Marketing spend or Visitors.",
    };
  }
  const metrics: UploadMetrics = {};
  const warnings: string[] = [];
  let months = 1;
  for (const [id, { values }] of found) {
    metrics[id] = round(id, recentAverage(values));
    months = Math.max(months, Math.min(3, values.length));
  }
  if (months > 1) warnings.push(`Where the file has several months, we used the average of the last ${months}.`);
  if (metrics.monthlyRevenue && metrics.monthlyOrders && metrics.aov === undefined) {
    metrics.aov = Math.round((metrics.monthlyRevenue / Math.max(1, metrics.monthlyOrders)) * 100) / 100;
  }
  return {
    ok: true,
    summary: {
      kind: "metrics",
      fileName: fileName.slice(0, 120),
      rows: rows.length,
      validRows: found.size,
      from: "",
      to: "",
      monthsUsed: months,
      columns: { date: "", amount: [...found.values()].map((f) => f.label).join(", ").slice(0, 80) },
    },
    metrics,
    warnings,
  };
}

/** Orders export or metrics sheet: picks the right reader. */
export function analyseRows(fileName: string, rows: string[][]): UploadResult {
  if (rows.length < 1) return { ok: false, error: "This file is empty." };
  const header = rows[0] ?? [];
  const looksLikeOrders = rows.length > 10 && findColumn(header, "date") !== -1 && findColumn(header, "amount") !== -1;
  if (looksLikeOrders) {
    const orders = analyseOrderRows(fileName, rows);
    if (orders.ok) return orders;
  }
  return analyseMetricRows(fileName, rows);
}

// ── Excel (.xlsx) ───────────────────────────────────────────────────────────

/** Unzips one entry of an .xlsx (a zip) with the platform's DecompressionStream. */
async function unzipEntries(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("not a zip");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const size = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const local = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataStart, dataStart + size);
    if (method === 0) out.set(name, decoder.decode(data));
    else if (method === 8) {
      const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      out.set(name, await new Response(stream).text());
    }
  }
  return out;
}

const xmlText = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");

const colIndex = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Reads the first worksheet of an .xlsx file into rows of cell text. */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzipEntries(bytes, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    xmlText([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  // The first sheet in workbook order.
  const firstId = files.get("xl/workbook.xml")?.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const target = firstId && files.get("xl/_rels/workbook.xml.rels")?.match(new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1];
  const sheetName = target ? `xl/${target.replace(/^\/?xl\//, "")}` : [...files.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort()[0];
  const sheet = (sheetName && files.get(sheetName)) || "";
  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/t="(\w+)"/)?.[1];
      const inner = c[2] ?? "";
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = "";
      if (type === "s" && v !== undefined) text = shared[+v] ?? "";
      else if (type === "inlineStr") text = xmlText([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      else if (v !== undefined) text = xmlText(v);
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push("");
      row[i] = text;
    }
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    if (rows.length > MAX_ROWS + 1) break;
  }
  return rows;
}

/** Reads a CSV, TSV or Excel file and analyses it. Runs in the browser. */
export async function analyseFile(name: string, bytes: Uint8Array): Promise<UploadResult> {
  try {
    const isXlsx = /\.xlsx$/i.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4b);
    const rows = isXlsx ? await readXlsx(bytes) : parseCsv(new TextDecoder().decode(bytes));
    return analyseRows(name, rows);
  } catch {
    return { ok: false, error: "We couldn't read this file. Save it as .xlsx or .csv and try again." };
  }
}
