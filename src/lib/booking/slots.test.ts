import { describe, expect, it } from "vitest";
import { availableSlots, formatSlot, isBookable, MIN_NOTICE_HOURS, SLOT_MINUTES } from "./slots";

// Monday 6 October 2026, 09:00 Riyadh (06:00 UTC).
const now = new Date("2026-10-06T06:00:00.000Z");
const slots = availableSlots(now);
const byDay = (day: string) => slots.filter((s) => s.day === day);

describe("booking hours (Riyadh time)", () => {
  it("weekdays run 19:00 to midnight in 30-minute slots", () => {
    const tue = byDay("2026-10-06");
    expect(tue[0].time).toBe("19:00");
    expect(tue.at(-1)!.time).toBe("23:30");
    expect(tue).toHaveLength(10);
  });

  it("Friday is closed", () => {
    expect(byDay("2026-10-09")).toHaveLength(0);
  });

  it("Saturday runs 10:00 to midnight", () => {
    const sat = byDay("2026-10-10");
    expect(sat[0].time).toBe("10:00");
    expect(sat.at(-1)!.time).toBe("23:30");
    expect(sat).toHaveLength(28);
  });

  it("slots are UTC instants three hours behind Riyadh", () => {
    expect(byDay("2026-10-10")[0].start).toBe("2026-10-10T07:00:00.000Z");
  });

  it(`respects ${MIN_NOTICE_HOURS}h notice`, () => {
    const late = availableSlots(new Date("2026-10-06T17:00:00.000Z")); // 20:00 Riyadh
    expect(late[0].day).toBe("2026-10-07");
    expect(slots.every((s) => new Date(s.start).getTime() >= now.getTime() + MIN_NOTICE_HOURS * 3_600_000)).toBe(true);
  });

  it("removes taken slots and validates bookings", () => {
    const taken = slots[0].start;
    expect(availableSlots(now, [taken]).some((s) => s.start === taken)).toBe(false);
    expect(isBookable(taken, now)).toBe(true);
    expect(isBookable(taken, now, [taken])).toBe(false);
    expect(isBookable("2026-10-09T16:00:00.000Z", now)).toBe(false); // Friday
    expect(isBookable(new Date(new Date(slots[0].start).getTime() + SLOT_MINUTES * 30_000).toISOString(), now)).toBe(false); // off-grid
  });

  it("formats in Riyadh time", () => {
    expect(formatSlot("2026-10-10T16:00:00.000Z")).toBe("Saturday 10 October, 19:00 (Riyadh time)");
  });
});
