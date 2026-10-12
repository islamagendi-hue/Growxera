import { describe, expect, it } from "vitest";
import { DEFAULT_EYEBROW, DEFAULT_FOOTER, designText, headlineSize, isDesignFormat, renderDesign, splitHook } from "./design";

describe("post design", () => {
  it("splits the opening into a white sentence and an orange rest", () => {
    expect(splitHook("Your conversion rate fell. Your team got better.\n\nThe body…")).toEqual({
      lineA: "Your conversion rate fell.",
      lineB: "Your team got better.",
    });
    expect(splitHook("Partner channels feel free.\nThey are not.\n\nMore")).toEqual({ lineA: "Partner channels feel free.", lineB: "They are not." });
    expect(splitHook("One line only")).toEqual({ lineA: "One line only", lineB: "" });
    expect(splitHook("")).toEqual({ lineA: "", lineB: "" });
  });

  it("uses the house defaults, honours the owner's edits and caps every line", () => {
    const t = designText("A higher margin can still mean a weaker business. Here is why.");
    expect(t).toEqual({ eyebrow: DEFAULT_EYEBROW, lineA: "A higher margin can still mean a weaker business.", lineB: "Here is why.", footer: DEFAULT_FOOTER });
    const edited = designText("x", { eyebrow: "behind the number · issue 2", lineA: "  New   line ", lineB: "", footer: "Growxera" });
    expect(edited).toEqual({ eyebrow: "BEHIND THE NUMBER · ISSUE 2", lineA: "New line", lineB: "", footer: "Growxera" });
    expect(designText("x", { lineA: "a".repeat(500) }).lineA).toHaveLength(140);
  });

  it("shrinks long headlines and accepts only known formats", () => {
    const short = designText("Short. Hook.");
    const long = designText("x", { lineA: "a".repeat(90), lineB: "b".repeat(60) });
    expect(headlineSize(long, "square")).toBeLessThan(headlineSize(short, "square"));
    expect(isDesignFormat("portrait")).toBe(true);
    expect(isDesignFormat("poster")).toBe(false);
  });

  it("renders a PNG of the format's size", async () => {
    const png = new Uint8Array(await (await renderDesign(designText("Your conversion rate fell. Your team got better."), "landscape")).arrayBuffer());
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1920, 1080]);
  }, 30_000);
});
