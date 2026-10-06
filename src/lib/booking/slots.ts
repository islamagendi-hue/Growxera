/**
 * Availability for the free 30-minute review. Pure and client-safe: the server
 * removes taken slots and re-validates every booking against these rules.
 *
 * Hours are in Riyadh time (UTC+3, no daylight saving), as set by Growx Era:
 *   Saturday 10:00–24:00 · Sunday–Thursday 19:00–24:00 · Friday closed.
 * Change WEEKLY_HOURS to change availability; nothing else needs editing.
 */
export const BOOKING_TIMEZONE = "Asia/Riyadh";
const TZ_OFFSET_MINUTES = 180;

export const SLOT_MINUTES = 30;
/** Earliest bookable slot, so a specialist can read the report first. */
export const MIN_NOTICE_HOURS = 4;
export const HORIZON_DAYS = 21;

/** Day of week (0 = Sunday … 6 = Saturday) → [start, end] in minutes after local midnight. */
export const WEEKLY_HOURS: Record<number, [number, number][]> = {
  0: [[19 * 60, 24 * 60]],
  1: [[19 * 60, 24 * 60]],
  2: [[19 * 60, 24 * 60]],
  3: [[19 * 60, 24 * 60]],
  4: [[19 * 60, 24 * 60]],
  5: [],
  6: [[10 * 60, 24 * 60]],
};

export interface Slot {
  /** ISO timestamp (UTC). */
  start: string;
  /** Local date in Riyadh, YYYY-MM-DD, for grouping. */
  day: string;
  /** Local time in Riyadh, HH:MM. */
  time: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** All open slots between now + notice and the horizon, minus taken ones. */
export function availableSlots(now: Date, taken: Iterable<string> = []): Slot[] {
  const takenSet = new Set([...taken].map((t) => new Date(t).toISOString()));
  const earliest = now.getTime() + MIN_NOTICE_HOURS * 3_600_000;
  // Local (Riyadh) midnight of today, expressed in UTC ms.
  const localNow = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const todayLocalMidnightUtc =
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - TZ_OFFSET_MINUTES * 60_000;
  const out: Slot[] = [];
  for (let d = 0; d <= HORIZON_DAYS; d++) {
    const dayStartUtc = todayLocalMidnightUtc + d * 86_400_000;
    const local = new Date(dayStartUtc + TZ_OFFSET_MINUTES * 60_000);
    const dow = local.getUTCDay();
    const day = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
    for (const [from, to] of WEEKLY_HOURS[dow] ?? []) {
      for (let m = from; m + SLOT_MINUTES <= to; m += SLOT_MINUTES) {
        const startMs = dayStartUtc + m * 60_000;
        if (startMs < earliest) continue;
        const start = new Date(startMs).toISOString();
        if (takenSet.has(start)) continue;
        out.push({ start, day, time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}` });
      }
    }
  }
  return out;
}

export function isBookable(start: string, now: Date, taken: Iterable<string> = []): boolean {
  const iso = new Date(start).toISOString();
  return availableSlots(now, taken).some((s) => s.start === iso);
}

/** "Saturday 11 October, 19:30 (Riyadh time)". */
export function formatSlot(start: string): string {
  const d = new Date(start);
  const date = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: BOOKING_TIMEZONE });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: BOOKING_TIMEZONE });
  return `${date}, ${time} (Riyadh time)`;
}
