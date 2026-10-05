import "server-only";
/**
 * Persistence for diagnostics, leads, consents and analytics events.
 *
 * Production: Supabase Postgres via its REST API, using the service-role key on
 * the server only (RLS is enabled with no public policies, so the browser can
 * never read this data). See supabase/migrations and docs/DATA_MODEL.md.
 *
 * Without Supabase env vars:
 *   - in development, rows are appended to .data/<table>.jsonl for local testing;
 *   - in production, nothing is stored and a warning is logged (no personal data).
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type Table = "diagnostic_sessions" | "leads" | "consent_records" | "analytics_events";

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

export async function insert(table: Table, rows: Record<string, unknown> | Record<string, unknown>[]): Promise<boolean> {
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
    const dir = path.join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    const lines = (Array.isArray(rows) ? rows : [rows]).map((r) => JSON.stringify(r)).join("\n") + "\n";
    await appendFile(path.join(dir, `${table}.jsonl`), lines);
    return true;
  }
  console.warn(`[store] Supabase is not configured; ${table} row not stored.`);
  return false;
}

export async function updateById(table: Table, id: string, patch: Record<string, unknown>): Promise<boolean> {
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreError(`update ${table} failed: ${res.status}`);
    return true;
  }
  if (storageMode === "local") return insert(table, { id, _patch: true, ...patch });
  return false;
}
