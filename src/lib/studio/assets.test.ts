import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { eq, select } from "@/lib/server/store";
import { getObject, MAX_UPLOAD_BYTES, sniffType, uploadAsset, UPLOAD_PREFIX, type AssetRow } from "./assets";

const ME = "owner@example.com";
const original = process.env.GX_DATA_DIR;
beforeEach(() => vi.stubEnv("GX_DATA_DIR", path.join(os.tmpdir(), `gx-assets-${crypto.randomUUID()}`)));
afterEach(() => {
  vi.unstubAllEnvs();
  if (original) process.env.GX_DATA_DIR = original;
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");

describe("studio uploads", () => {
  it("detects the real file type from its bytes", () => {
    expect(sniffType(PNG)).toBe("image/png");
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffType(PDF)).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffType(new TextEncoder().encode("MZ executable"))).toBeNull();
  });

  it("stores the file privately, verifies it by checksum, and reuses the same bytes", async () => {
    const a = await uploadAsset(PNG, null, ME);
    const hash = createHash("sha256").update(PNG).digest("hex");
    expect(a).toEqual({ url: `${UPLOAD_PREFIX}${hash}.png`, type: "image", title: null });
    const [row] = await select<AssetRow>("li_assets", [eq("original_url", a.url)]);
    expect(row).toMatchObject({ sha256: hash, content_type: "image/png", bytes: PNG.length, storage_path: `media/${hash}.png` });
    expect(row.verified_at).toBeTruthy();
    expect(Buffer.from((await getObject(row.storage_path!))!)).toEqual(Buffer.from(PNG));
    await uploadAsset(PNG, null, ME);
    expect(await select("li_assets", [eq("original_url", a.url)])).toHaveLength(1);
  });

  it("gives PDFs a title and refuses empty, oversized and unknown files", async () => {
    expect((await uploadAsset(PDF, null, ME)).title).toBe("Document");
    expect(await uploadAsset(PDF, "  My deck ", ME)).toMatchObject({ type: "document", title: "My deck" });
    await expect(uploadAsset(new Uint8Array(), null, ME)).rejects.toThrow(/empty/);
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PNG);
    await expect(uploadAsset(big, null, ME)).rejects.toThrow(/larger than 4 MB/);
    await expect(uploadAsset(new TextEncoder().encode("<svg/>"), null, ME)).rejects.toThrow(/Only PNG, JPEG, GIF, WebP images and PDF/);
    // The second PDF has the same bytes: the stored copy is reused, so one upload is logged.
    expect((await select<{ event: string }>("li_audit_log", [eq("event", "assets.uploaded")])).length).toBe(1);
  });
});
