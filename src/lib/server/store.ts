import "server-only";
/**
 * Persistence for diagnostics, leads, consents, analytics events, accounts,
 * sign-in links, sessions and specialist requests.
 *
 * Production: Supabase Postgres via its REST API (PostgREST), using the
 * service-role key on the server only (RLS is enabled with no public policies,
 * so the browser can never read this data). See supabase/migrations and
 * docs/DATA_MODEL.md.
 *
 * Without Supabase env vars:
 *   - in development and tests, rows live in .data/<table>.json so the whole
 *     product (accounts, history, booking) can be exercised locally;
 *   - in production, nothing is stored and a warning is logged (no personal data).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type Table =
  | "diagnostic_sessions"
  | "leads"
  | "consent_records"
  | "analytics_events"
  | "accounts"
  | "auth_tokens"
  | "auth_sessions"
  | "specialist_requests";

type Row = Record<string, unknown>;

// Values pasted into a dashboard often carry stray whitespace or quotes.
const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
const SUPABASE_URL = clean(process.env.SUPABASE_URL)?.replace(/\/$/, "");
const SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const storageMode: "supabase" | "local" | "disabled" =
  SUPABASE_URL && SERVICE_KEY ? "supabase" : process.env.NODE_ENV === "production" ? "disabled" : "local";

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
    ...extra,
  };
}

export class StoreError extends Error {}

// ── Filters ─────────────────────────────────────────────────────────────────

export type Filter =
  | { col: string; op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: string | number | boolean }
  | { col: string; op: "is"; value: null }
  | { col: string; op: "in"; value: (string | number)[] };

export const eq = (col: string, value: string | number | boolean): Filter => ({ col, op: "eq", value });
export const isNull = (col: string): Filter => ({ col, op: "is", value: null });
export const gt = (col: string, value: string | number): Filter => ({ col, op: "gt", value });
export const inList = (col: string, value: (string | number)[]): Filter => ({ col, op: "in", value });

export interface SelectOptions {
  /** PostgREST column list, e.g. "id,created_at,report". Defaults to all columns. */
  columns?: string;
  order?: { col: string; ascending?: boolean };
  limit?: number;
}

function toQuery(filters: Filter[], opts: SelectOptions = {}): string {
  const q = new URLSearchParams();
  for (const f of filters) {
    if (f.op === "is") q.append(f.col, "is.null");
    else if (f.op === "in") q.append(f.col, `in.(${f.value.map((v) => `"${String(v).replace(/"/g, "")}"`).join(",")})`);
    else q.append(f.col, `${f.op}.${String(f.value)}`);
  }
  if (opts.columns) q.set("select", opts.columns);
  if (opts.order) q.set("order", `${opts.order.col}.${opts.order.ascending ? "asc" : "desc"}`);
  if (opts.limit) q.set("limit", String(opts.limit));
  return q.toString();
}

// Comparison used by the local backend: ISO timestamps compare correctly as strings.
function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const v = row[f.col];
    switch (f.op) {
      case "is":
        return v === null || v === undefined;
      case "in":
        return f.value.map(String).includes(String(v));
      case "eq":
        return v !== undefined && v !== null && String(v) === String(f.value);
      case "neq":
        return String(v) !== String(f.value);
      default: {
        if (v === undefined || v === null) return false;
        const c = cmp(v, f.value);
        return f.op === "gt" ? c > 0 : f.op === "gte" ? c >= 0 : f.op === "lt" ? c < 0 : c <= 0;
      }
    }
  });
}

function project(row: Row, columns?: string): Row {
  if (!columns || columns === "*") return row;
  return Object.fromEntries(columns.split(",").map((c) => [c.trim(), row[c.trim()] ?? null]));
}

// ── Local backend (development and tests) ───────────────────────────────────

const dataDir = () => process.env.GX_DATA_DIR || path.join(process.cwd(), ".data");
let queue: Promise<unknown> = Promise.resolve();

/** Serialises local reads/writes so concurrent requests can't lose rows. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function readTable(table: Table): Promise<Row[]> {
  try {
    return JSON.parse(await readFile(path.join(dataDir(), `${table}.json`), "utf8")) as Row[];
  } catch {
    return [];
  }
}

async function writeTable(table: Table, rows: Row[]) {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(path.join(dataDir(), `${table}.json`), JSON.stringify(rows, null, 1));
}

function withDefaults(table: Table, row: Row): Row {
  const out: Row = { ...row };
  if (out.id === undefined && table !== "analytics_events") out.id = crypto.randomUUID();
  if (out.created_at === undefined) out.created_at = new Date().toISOString();
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function insert(table: Table, rows: Row | Row[]): Promise<boolean> {
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreError(`insert ${table} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return true;
  }
  if (storageMode === "local") {
    await locked(async () => {
      const all = await readTable(table);
      all.push(...(Array.isArray(rows) ? rows : [rows]).map((r) => withDefaults(table, r)));
      await writeTable(table, all);
    });
    return true;
  }
  console.warn(`[store] Supabase is not configured; ${table} row not stored.`);
  return false;
}

export async function select<T = Row>(table: Table, filters: Filter[], opts: SelectOptions = {}): Promise<T[]> {
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${toQuery(filters, opts)}`, {
      headers: headers({ Prefer: "" }),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreError(`select ${table} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return (await res.json()) as T[];
  }
  if (storageMode === "local") {
    let rows = (await readTable(table)).filter((r) => matches(r, filters));
    if (opts.order) {
      const { col, ascending } = opts.order;
      rows = rows.sort((a, b) => (ascending ? 1 : -1) * cmp(a[col], b[col]));
    }
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows.map((r) => project(r, opts.columns)) as T[];
  }
  return [];
}

export async function selectOne<T = Row>(table: Table, filters: Filter[], opts: SelectOptions = {}): Promise<T | null> {
  return (await select<T>(table, filters, { ...opts, limit: 1 }))[0] ?? null;
}

/**
 * Updates every row matching all filters and returns the updated rows.
 * Filters are applied atomically by the database, so `update(..., [eq(id), isNull("used_at")])`
 * succeeds for exactly one caller: the basis for single-use sign-in links.
 */
export async function update<T = Row>(table: Table, filters: Filter[], patch: Row): Promise<T[]> {
  if (!filters.length) throw new StoreError("update without filters is not allowed");
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${toQuery(filters)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreError(`update ${table} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return (await res.json()) as T[];
  }
  if (storageMode === "local") {
    return locked(async () => {
      const all = await readTable(table);
      const changed: Row[] = [];
      for (const r of all) {
        if (matches(r, filters)) {
          Object.assign(r, patch);
          changed.push(r);
        }
      }
      if (changed.length) await writeTable(table, all);
      return changed as T[];
    });
  }
  return [];
}

export async function updateById(table: Table, id: string, patch: Row): Promise<boolean> {
  if (storageMode === "disabled") return false;
  await update(table, [eq("id", id)], patch);
  return true;
}

/**
 * Reads the full report behind a legacy shareable link (emails sent before
 * accounts existed). The token is the lead id, a random UUID issued only after
 * the lead form, never the session id.
 */
export async function findReportByLeadId(leadId: string): Promise<unknown | null> {
  if (storageMode === "disabled") return null;
  const row = await selectOne<{ report: unknown }>("diagnostic_sessions", [eq("lead_id", leadId)], { columns: "report" });
  return row?.report ?? null;
}
