import { ImageResponse } from "next/og";

export const alt = "Growx_era — Growth & Transformation Partner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0e1311",
          color: "#f4f2ec",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
          GROWX<span style={{ color: "#8fe0b9" }}>_</span>ERA
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: -3 }}>Build Your Next Era of Growth.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(244,242,236,0.7)" }}>
            Growth &amp; Transformation Partner · Growth Diagnostic™
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 20, letterSpacing: 4, color: "rgba(244,242,236,0.55)" }}>
          MARKET → VALUE → ACQUIRE → ACTIVATE → RETAIN → EXPAND → SCALE
        </div>
      </div>
    ),
    size,
  );
}
