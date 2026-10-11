import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("next.config", () => {
  it("marks every response on the studio's address noindex, and only there", async () => {
    const rules = (await nextConfig.headers!()) ?? [];
    const studio = rules.filter((r) => r.has?.some((h) => h.type === "host" && h.value === "agent.growxera.com"));
    expect(studio).toHaveLength(1);
    expect(studio[0].source).toBe("/:path*");
    expect(studio[0].headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
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
