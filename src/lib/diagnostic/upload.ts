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

export interface UploadMetrics {
  monthlyRevenue?: number;
  monthlyOrders?: number;
  aov?: number;
  monthlyNewCustomers?: number;
  repeatRate?: number;
}

export interface UploadSummary {
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
  const rows = parseCsv(text);
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
  metrics.aov = Math.round((metrics.monthlyRevenue! / Math.max(1, metrics.monthlyOrders!)) * 100) / 100;

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
