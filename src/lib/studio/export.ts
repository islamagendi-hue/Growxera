import "server-only";
/**
 * Weekly backup export (owner decision G3: stay on Supabase Free, owner downloads and keeps a copy).
 *
 * One JSON file with every studio table the owner's work lives in, a SHA-256 per table and for
 * the whole file, and the list of what was left out on purpose. It never contains secrets:
 * - LinkedIn: the encrypted access token and the encrypted client secret are dropped (the
 *   connection must be made again after a restore anyway);
 * - studio sign-in: password hash, authenticator secret, sessions, setup links and sign-in
 *   attempts are not exported at all (a new setup link recreates them).
 * Media files are not inside the file: li_assets lists each file's storage path and SHA-256;
 * the files stay in the private bucket and the original sources (OPERATIONS_RUNBOOK.md).
 *
 * validateExport() re-checks a file. restoreExport() loads a file into an EMPTY store, and only
 * into an isolated one (local store, or a database explicitly marked as a restore target): it is
 * for recovery drills and disaster recovery, never for overwriting live data.
 */
import { createHash } from "node:crypto";
import { eq, insert, select, selectAll, storageMode, type Table } from "@/lib/server/store";
import { audit } from "./repo";

export const EXPORT_FORMAT = "growxera-studio-export";
export const EXPORT_VERSION = 1;

/** Order matters for restore (referenced rows first). */
export const EXPORTED: { table: Table; drop?: string[]; order?: string }[] = [
  { table: "li_content" },
  { table: "li_metrics_snapshots" },
  { table: "li_drafts" },
  { table: "li_draft_versions" },
  { table: "li_actions" },
  { table: "li_approvals" },
  { table: "li_executions" },
  { table: "li_publish_authorizations" },
  { table: "li_assets" },
  { table: "li_settings", order: "key" },
  { table: "li_llm_usage" },
  { table: "li_audit_log" },
  { table: "li_linkedin_connection", drop: ["access_token_enc"] },
  { table: "li_linkedin_app", drop: ["client_secret_enc"] },
];

export const NOT_EXPORTED: { table: string; why: string }[] = [
  { table: "li_access_credentials", why: "password hash and authenticator secret; recreated with a setup link" },
  { table: "li_access_sessions", why: "sign-in sessions" },
  { table: "li_access_setup_tokens", why: "one-time setup links" },
  { table: "li_access_attempts", why: "sign-in attempts (security log)" },
];

/** Keys that must never appear anywhere in an export file. */
const FORBIDDEN_KEYS = ["access_token_enc", "client_secret_enc", "password_hash", "totp_secret_enc", "token_hash"];

type Row = Record<string, unknown>;

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: number;
  generated_at: string;
  tables: Record<string, { count: number; sha256: string; rows: Row[]; missing?: true }>;
  dropped_columns: Record<string, string[]>;
  not_exported: { table: string; why: string }[];
  media_note: string;
  sha256: string;
}

/** Stable JSON: object keys sorted, so the same data always hashes the same. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Row)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Row)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
const sha = (v: unknown) => createHash("sha256").update(canonical(v)).digest("hex");

export async function buildExport(actor: string, now = new Date()): Promise<ExportFile> {
  const tables: ExportFile["tables"] = {};
  const dropped: Record<string, string[]> = {};
  for (const { table, drop, order } of EXPORTED) {
    let rows: Row[];
    let missing = false;
    try {
      rows = await selectAll<Row>(table, [], { order: { col: order ?? "created_at", ascending: true } });
    } catch {
      // A table whose migration isn't applied yet: recorded, not silently skipped.
      rows = [];
      missing = true;
    }
    if (drop?.length) {
      rows = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k))));
      dropped[table] = drop;
    }
    tables[table] = { count: rows.length, sha256: sha(rows), rows, ...(missing ? { missing: true as const } : {}) };
  }
  const file: Omit<ExportFile, "sha256"> = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    generated_at: now.toISOString(),
    tables,
    dropped_columns: dropped,
    not_exported: NOT_EXPORTED,
    media_note: "Media files are not included. li_assets lists each file's storage path and SHA-256; the files are in the private bucket li-studio-assets.",
  };
  const out: ExportFile = { ...file, sha256: sha(file) };
  const check = validateExport(out);
  if (!check.ok) throw new Error(`Export failed its own validation: ${check.errors.join("; ")}`);
  await audit(actor, "export.generated", "li_audit_log", null, {
    counts: Object.fromEntries(Object.entries(tables).map(([t, v]) => [t, v.count])),
    missing: Object.entries(tables).filter(([, v]) => v.missing).map(([t]) => t),
    sha256: out.sha256,
  });
  return out;
}

export interface Validation {
  ok: boolean;
  errors: string[];
  counts: Record<string, number>;
}

function findForbidden(v: unknown, path = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => findForbidden(x, `${path}[${i}]`));
  if (v && typeof v === "object") {
    return Object.entries(v as Row).flatMap(([k, x]) => (FORBIDDEN_KEYS.includes(k) ? [`${path}.${k}`] : findForbidden(x, `${path}.${k}`)));
  }
  return [];
}

/** Checks format, every table's count and hash, the whole-file hash, and that no secret field is present. */
export function validateExport(input: unknown): Validation {
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  const f = input as Partial<ExportFile> | null;
  if (!f || typeof f !== "object" || f.format !== EXPORT_FORMAT) return { ok: false, errors: ["Not a studio export file."], counts };
  if (f.version !== EXPORT_VERSION) errors.push(`Unsupported version ${String(f.version)}.`);
  if (!f.tables || typeof f.tables !== "object") return { ok: false, errors: [...errors, "No tables."], counts };
  for (const { table } of EXPORTED) {
    const t = f.tables[table];
    if (!t || !Array.isArray(t.rows)) {
      errors.push(`Missing table ${table}.`);
      continue;
    }
    counts[table] = t.rows.length;
    if (t.count !== t.rows.length) errors.push(`${table}: count says ${t.count}, file has ${t.rows.length}.`);
    if (t.sha256 !== sha(t.rows)) errors.push(`${table}: contents don't match the checksum (changed or damaged).`);
  }
  const { sha256: stated, ...rest } = f as ExportFile;
  if (stated !== sha(rest)) errors.push("The file's overall checksum doesn't match (changed or damaged).");
  const leaks = findForbidden(f.tables);
  if (leaks.length) errors.push(`Secret fields present: ${leaks.slice(0, 5).join(", ")}.`);
  for (const t of NOT_EXPORTED) if (t.table in f.tables) errors.push(`${t.table} must not be in an export.`);
  return { ok: errors.length === 0, errors, counts };
}

/**
 * Loads a validated export into an empty, isolated store. Refuses a live database unless it was
 * explicitly marked as a restore target (STUDIO_RESTORE_TARGET=isolated), and refuses any store
 * that already holds studio data.
 */
export async function restoreExport(input: unknown): Promise<Record<string, number>> {
  if (storageMode === "disabled") throw new Error("No storage configured.");
  if (storageMode === "supabase" && process.env.STUDIO_RESTORE_TARGET?.trim() !== "isolated") {
    throw new Error("Refusing to restore into a live database. Restore only into an isolated, empty project (see OPERATIONS_RUNBOOK.md).");
  }
  const check = validateExport(input);
  if (!check.ok) throw new Error(`The file isn't valid: ${check.errors.join("; ")}`);
  const f = input as ExportFile;
  for (const { table } of EXPORTED) {
    if ((await select<Row>(table, [], { limit: 1 }).catch(() => [])).length) {
      throw new Error(`The target already has data in ${table}. Restore only into an empty store.`);
    }
  }
  const restored: Record<string, number> = {};
  for (const { table } of EXPORTED) {
    // Rows without their secrets can't work again (LinkedIn must be reconnected): not restored.
    if (table === "li_linkedin_connection" || table === "li_linkedin_app") continue;
    const rows = f.tables[table].rows;
    for (let i = 0; i < rows.length; i += 500) await insert(table, rows.slice(i, i + 500));
    restored[table] = rows.length;
  }
  return restored;
}

/** When the last export was made (from the audit log), for the weekly reminder. */
export async function lastExportAt(): Promise<string | null> {
  try {
    const rows = await select<{ created_at: string }>("li_audit_log", [eq("event", "export.generated")], {
      columns: "created_at",
      order: { col: "created_at", ascending: false },
      limit: 1,
    });
    return rows[0]?.created_at ?? null;
  } catch {
    return null;
  }
}

export const EXPORT_REMINDER_DAYS = 7;
