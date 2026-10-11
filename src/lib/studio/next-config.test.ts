import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("next.config", () => {
  it("marks every response on the studio's address noindex and unframeable, and only there", async () => {
    const rules = (await nextConfig.headers!()) ?? [];
    const studio = rules.filter((r) => r.has?.some((h) => h.type === "host" && h.value === "agent.growxera.com"));
    expect(studio).toHaveLength(1);
    expect(studio[0].source).toBe("/:path*");
    expect(studio[0].headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    // Never framed (clickjacking of the publish controls), no studio URLs in referrers.
    expect(studio[0].headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(studio[0].headers).toContainEqual({ key: "Content-Security-Policy", value: "frame-ancestors 'none'" });
    expect(studio[0].headers).toContainEqual({ key: "Referrer-Policy", value: "same-origin" });
    // No header rule applies to every host.
    expect(rules.every((r) => r.has?.length)).toBe(true);
  });

  it("server-action bodies stay below the platform's 4.5 MB request cap and above the 4 MB upload limit", () => {
    const limit = String(nextConfig.experimental?.serverActions?.bodySizeLimit);
    const mb = Number(limit.replace(/mb$/, ""));
    expect(mb).toBeGreaterThan(4);
    expect(mb).toBeLessThan(4.5);
  });
});

describe("routes that act on a plain GET", () => {
  it("accept navigations from the studio itself or typed by the owner, never from another site", async () => {
    const { startedHere } = await import("./request");
    const req = (site?: string) => new Request("https://agent.growxera.com/studio/export/download", { headers: site ? { "sec-fetch-site": site } : {} });
    expect(startedHere(req("same-origin"))).toBe(true);
    expect(startedHere(req("none"))).toBe(true);
    expect(startedHere(req())).toBe(true);
    expect(startedHere(req("cross-site"))).toBe(false);
    expect(startedHere(req("same-site"))).toBe(false); // www.growxera.com is a different origin
  });
});
