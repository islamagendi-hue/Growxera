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
import { eq, insert, select, selectAll, selectOne, storageMode, update } from "@/lib/server/store";
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
  const versions = await selectAll<{ assets: { url: string }[] }>("li_draft_versions", [], { columns: "assets" });
  const content = await selectAll<{ assets: { url: string }[] }>("li_content", [], { columns: "assets" });
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
  // Refuse oversized files before downloading them when the size is declared.
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) throw new Error(`File too large (${declared} bytes)`);
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

// ── Uploads from the studio ─────────────────────────────────────────────────

/** Largest file the studio accepts from the browser (the hosting platform caps request bodies at 4.5 MB). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Uploaded files are referenced as `studio-upload:<sha256>.<ext>`; the bytes live only in the private bucket. */
export const UPLOAD_PREFIX = "studio-upload:";

/** The real file type from its first bytes; the browser's declared type isn't trusted. */
export function sniffType(b: Uint8Array): string | null {
  const starts = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return null;
}

export interface UploadedAsset {
  url: string;
  type: "image" | "document";
  title: string | null;
}

/**
 * Stores one image or PDF uploaded by the owner in the private bucket, verifies the stored copy
 * by SHA-256, and records it in li_assets as already secured. Same bytes → same reference.
 */
export async function uploadAsset(bytes: Uint8Array, title: string | null, actor: string): Promise<UploadedAsset> {
  if (!bytes.length) throw new UploadError("The file is empty.");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError(`The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const type = sniffType(bytes);
  if (!type) throw new UploadError("Only PNG, JPEG, GIF, WebP images and PDF documents can be attached.");
  const hash = sha(bytes);
  const url = `${UPLOAD_PREFIX}${hash}.${TYPES[type]}`;
  const kind = type === "application/pdf" ? "document" : "image";
  const cleanTitle = title?.trim().slice(0, 200) || (kind === "document" ? "Document" : null);
  const existing = await selectOne<AssetRow>("li_assets", [eq("original_url", url)]);
  if (existing?.verified_at) return { url, type: kind, title: cleanTitle };
  const p = `media/${hash}.${TYPES[type]}`;
  await putObject(p, bytes, type);
  const back = await getObject(p);
  if (!back || sha(back) !== hash) throw new UploadError("The stored copy couldn't be verified. Nothing was attached; try again.");
  const at = new Date().toISOString();
  const row = { storage_path: p, sha256: hash, bytes: bytes.length, content_type: type, copied_at: at, verified_at: at, last_error: null };
  if (existing) await update("li_assets", [eq("id", existing.id)], row);
  else await insert("li_assets", { id: crypto.randomUUID(), created_at: at, original_url: url, ...row });
  await audit(actor, "assets.uploaded", "li_assets", null, { sha256: hash, bytes: bytes.length, type });
  return { url, type: kind, title: cleanTitle };
}

export class UploadError extends Error {}

export async function assetsByUrl(urls: string[]): Promise<Map<string, AssetRow>> {
  if (!urls.length) return new Map();
  const { inList } = await import("@/lib/server/store");
  const rows = await select<AssetRow>("li_assets", [inList("original_url", urls)]);
  return new Map(rows.map((r) => [r.original_url, r]));
}
