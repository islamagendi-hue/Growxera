import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { riyadhSlot, summarize } from "./performance";

describe("account performance", () => {
  it("reads weekday and hour in Riyadh time", () => {
    expect(riyadhSlot("2026-10-11T21:30:00.000Z")).toEqual({ day: 1, hour: 0 }); // Sunday 21:30 UTC = Monday 00:30 Riyadh
  });

  it("ranks days and hours by engagement, hides one-off samples, keeps the best snapshot per post", () => {
    const c = (id: string, at: string) => ({ id, text: `Hook ${id}\nbody`, published_at: at });
    const content = [c("a", "2026-10-04T09:00:00Z"), c("b", "2026-10-11T09:00:00Z"), c("x", "2026-10-06T15:00:00Z"), c("y", "2026-10-13T15:00:00Z"), c("solo", "2026-10-07T05:00:00Z"), { id: "z", text: "no date", published_at: null }];
    const m = (id: string, imp: number, rx: number, cm = 0) => ({ content_id: id, impressions: imp, reactions: rx, comments: cm });
    const p = summarize(content, [m("a", 100, 1), m("a", 900, 20, 4), m("b", 500, 10), m("x", 200, 2), m("y", 300, 4), m("solo", 9999, 99)]);
    expect(p.posts).toBe(5);
    expect(p.byDay[0]).toMatchObject({ label: "Sunday", posts: 2, avgEngagement: 17 });
    expect(p.byHour.map((h) => h.label)).toEqual(["12:00", "18:00"]); // "08:00" has one post: hidden
    expect(p.top[0]).toMatchObject({ id: "solo", engagement: 99 });
    expect(p.top[1]).toMatchObject({ id: "a", engagement: 24, opening: "Hook a" });
  });
});
