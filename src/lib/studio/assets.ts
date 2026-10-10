import "server-only";
/**
 * Durable copies of post media (images, PDF carousels).
 *
 * The migrated posts reference files in another project's public bucket, which may be reset.
 * secureAssets() copies every referenced file into Growxera's own Supabase Storage (private
 * bucket "li-studio-assets", created by migration 20261011000000), checks the copy by
 * SHA-256, and records the mapping in li_assets. Originals are never modified or deleted.
 * Copies are served only to the owner (src/app/studio/assets/[id]/route.ts).
 *
 * Only https URLs on the hosts below are fetched (no arbitrary server-side requests).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, insert, select, selectOne, storageMode, update } from "@/lib/server/store";
import { audit } from "./repo";

export const ASSET_SOURCE_HOSTS = [
  // Public bucket used by the retired Buffer workflow (Supabase project "leanapp-staging").
  "stpnogsoeaofxlnighnt.supabase.co",
  // Buffer's media bucket (thumbnails of historical posts).
  "buffer-updates-media-backfill-bucket.s3.amazonaws.com",
];
export const BUCKET = "li-studio-assets";
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };

export interface AssetRow {
  id: string;
  original_url: string;
  storage_path: string | null;
  sha256: string | null;
  bytes: number | null;
  content_type: string | null;
  copied_at: string | null;
  verified_at: string | null;
  last_error: string | null;
}

export function isAllowedSource(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ASSET_SOURCE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

// ── Storage backend ─────────────────────────────────────────────────────────

const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
const SUPABASE_URL = () => clean(process.env.SUPABASE_URL)?.replace(/\/$/, "");
const KEY = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const localPath = (p: string) => path.join(process.env.GX_DATA_DIR || path.join(process.cwd(), ".data"), "storage", BUCKET, p);

async function putObject(p: string, body: Uint8Array, contentType: string): Promise<void> {
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL()}/storage/v1/object/${BUCKET}/${p}`, {
      method: "POST",
      headers: { apikey: KEY()!, Authorization: `Bearer ${KEY()}`, "Content-Type": contentType, "x-upsert": "false" },
      body: Buffer.from(body),
      cache: "no-store",
    });
    // Content-addressed path: "already exists" means the same bytes are already stored.
    if (!res.ok && res.status !== 409 && !(await res.text().catch(() => "")).includes("already exists")) {
      throw new Error(`Storage upload failed (${res.status})`);
    }
    return;
  }
  if (storageMode === "local") {
    await mkdir(path.dirname(localPath(p)), { recursive: true });
    await writeFile(localPath(p), body);
    return;
  }
  throw new Error("Storage is not configured.");
}

export async function getObject(p: string): Promise<Uint8Array | null> {
  if (storageMode === "supabase") {
    const res = await fetch(`${SUPABASE_URL()}/storage/v1/object/${BUCKET}/${p}`, {
      headers: { apikey: KEY()!, Authorization: `Bearer ${KEY()}` },
      cache: "no-store",
    });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  }
  if (storageMode === "local") return readFile(localPath(p)).then((b) => new Uint8Array(b)).catch(() => null);
  return null;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

// ── Copy and verify ─────────────────────────────────────────────────────────

/** Every distinct media URL referenced by drafts (all versions) or published history. */
export async function referencedAssetUrls(): Promise<string[]> {
  const versions = await select<{ assets: { url: string }[] }>("li_draft_versions", [], { columns: "assets" });
  const content = await select<{ assets: { url: string }[] }>("li_content", [], { columns: "assets" });
  return [...new Set([...versions, ...content].flatMap((r) => (r.assets ?? []).map((a) => a.url)))].sort();
}

export interface SecureReport {
  referenced: number;
  alreadySecured: number;
  copied: number;
  failed: { url: string; error: string }[];
}

async function copyOne(url: string): Promise<{ path: string; hash: string; bytes: number; type: string }> {
  if (!isAllowedSource(url)) throw new Error("Host not on the allowed list.");
  const res = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Source returned ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TYPES[type]) throw new Error(`Unexpected file type "${type || "unknown"}"`);
  const body = new Uint8Array(await res.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) throw new Error(`Unexpected size ${body.length} bytes`);
  const hash = sha(body);
  const p = `media/${hash}.${TYPES[type]}`;
  await putObject(p, body, type);
  const back = await getObject(p);
  if (!back || sha(back) !== hash) throw new Error("Copy could not be verified (checksum mismatch).");
  return { path: p, hash, bytes: body.length, type };
}

/** Copies and verifies every referenced file not yet secured. Safe to run repeatedly. */
export async function secureAssets(actor: string): Promise<SecureReport> {
  const urls = await referencedAssetUrls();
  const report: SecureReport = { referenced: urls.length, alreadySecured: 0, copied: 0, failed: [] };
  for (const url of urls) {
    const row = await selectOne<AssetRow>("li_assets", [eq("original_url", url)]);
    if (row?.verified_at) {
      report.alreadySecured++;
      continue;
    }
    try {
      const c = await copyOne(url);
      const patch = { storage_path: c.path, sha256: c.hash, bytes: c.bytes, content_type: c.type, copied_at: new Date().toISOString(), verified_at: new Date().toISOString(), last_error: null };
      if (row) await update("li_assets", [eq("id", row.id)], patch);
      else await insert("li_assets", { id: crypto.randomUUID(), created_at: new Date().toISOString(), original_url: url, ...patch });
      report.copied++;
    } catch (err) {
      const error = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
      if (row) await update("li_assets", [eq("id", row.id)], { last_error: error });
      else await insert("li_assets", { id: crypto.randomUUID(), created_at: new Date().toISOString(), original_url: url, last_error: error });
      report.failed.push({ url, error });
    }
  }
  await audit(actor, "assets.secured", "li_assets", null, report);
  return report;
}

export async function assetsByUrl(urls: string[]): Promise<Map<string, AssetRow>> {
  if (!urls.length) return new Map();
  const { inList } = await import("@/lib/server/store");
  const rows = await select<AssetRow>("li_assets", [inList("original_url", urls)]);
  return new Map(rows.map((r) => [r.original_url, r]));
}
