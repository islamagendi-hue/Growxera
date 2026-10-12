import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Post visuals in the owner's house style (dark card, small spaced eyebrow, a white line and an
 * orange line, name at the bottom). Rendered on the server from text only: no image service, no
 * cost. The owner previews it on the post page, can edit every line, and attaches it as the post's
 * image, which creates a new version (approval applies again).
 */

export const DESIGN_FORMATS = {
  square: { width: 1200, height: 1200, label: "Square 1200×1200 (feed)" },
  portrait: { width: 1080, height: 1350, label: "Portrait 1080×1350 (feed, tallest)" },
  landscape: { width: 1920, height: 1080, label: "Landscape 1920×1080" },
} as const;
export type DesignFormat = keyof typeof DESIGN_FORMATS;

export const DEFAULT_EYEBROW = "BEHIND THE NUMBER";
export const DEFAULT_FOOTER = "Islam Gendi · Growth Systems";
const MAX_LINE = 140;

export interface DesignText {
  eyebrow: string;
  lineA: string;
  lineB: string;
  footer: string;
}

const clean = (s: string | null | undefined, max = MAX_LINE) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * The post's opening (its first paragraph, as written) split into the white line and the orange
 * line: the first sentence, then the rest of the opening. A one-sentence opening stays white.
 */
export function splitHook(text: string): { lineA: string; lineB: string } {
  const first = (text.split(/\n\s*\n/)[0] ?? "").replace(/\s+/g, " ").trim();
  const m = first.match(/^(.+?[.!?])\s+(.+)$/);
  if (!m) return { lineA: clean(first), lineB: "" };
  return { lineA: clean(m[1]), lineB: clean(m[2]) };
}

export function designText(postText: string, overrides: Partial<Record<keyof DesignText, string | null>> = {}): DesignText {
  const hook = splitHook(postText);
  const pick = (key: keyof DesignText, fallback: string, max?: number) => {
    const v = overrides[key];
    return v === undefined || v === null ? fallback : clean(v, max);
  };
  return {
    eyebrow: pick("eyebrow", DEFAULT_EYEBROW, 60).toUpperCase(),
    lineA: pick("lineA", hook.lineA),
    lineB: pick("lineB", hook.lineB),
    footer: pick("footer", DEFAULT_FOOTER, 80),
  };
}

export const isDesignFormat = (v: string | null | undefined): v is DesignFormat => !!v && v in DESIGN_FORMATS;

/** Headline size that keeps the two lines inside the card for the given format. */
export function headlineSize(t: DesignText, format: DesignFormat): number {
  const { width } = DESIGN_FORMATS[format];
  const chars = Math.max(t.lineA.length + t.lineB.length, 1);
  const base = width >= 1900 ? 112 : width >= 1200 ? 100 : 92;
  if (chars <= 60) return base;
  if (chars <= 100) return Math.round(base * 0.8);
  if (chars <= 160) return Math.round(base * 0.64);
  return Math.round(base * 0.5);
}

// Plus Jakarta Sans (headline) and IBM Plex Sans (small lines), both SIL OFL 1.1 (fonts/LICENSE-*.txt).
const FONT_DIR = path.join(process.cwd(), "src/lib/studio/fonts");
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(path.join(FONT_DIR, "plus-jakarta-sans-latin-700-normal.woff")),
    readFile(path.join(FONT_DIR, "ibm-plex-sans-latin-400-normal.woff")),
  ]).then(([head, body]) => [
    { name: "Jakarta", data: new Uint8Array(head).buffer, weight: 700 as const, style: "normal" as const },
    { name: "Plex", data: new Uint8Array(body).buffer, weight: 400 as const, style: "normal" as const },
  ]));

export async function renderDesign(t: DesignText, format: DesignFormat): Promise<ImageResponse> {
  const { width, height } = DESIGN_FORMATS[format];
  const pad = Math.round(width * 0.073);
  const size = headlineSize(t, format);
  const small = Math.round(Math.min(width, height) * 0.033);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          background: "#11161d",
          fontFamily: "Plex",
        }}
      >
        <div style={{ display: "flex", fontSize: small, letterSpacing: Math.round(small * 0.18), color: "#9aa8ba" }}>{t.eyebrow}</div>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Jakarta", fontSize: size, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1 }}>
          <div style={{ display: "flex", color: "#f5f7fa" }}>{t.lineA}</div>
          {t.lineB ? <div style={{ display: "flex", color: "#e07b24", marginTop: Math.round(size * 0.12) }}>{t.lineB}</div> : null}
        </div>
        <div style={{ display: "flex", fontSize: small, color: "#9aa8ba" }}>{t.footer}</div>
      </div>
    ),
    { width, height, fonts: await loadFonts(), headers: { "Cache-Control": "private, no-store" } },
  );
}
