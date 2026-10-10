/** The studio works in Riyadh time (UTC+3, no daylight saving), the owner's time zone. */
import { WorkflowError } from "./workflow";

export const STUDIO_TZ = "Asia/Riyadh";

/** "2026-10-12T17:00" from a datetime-local input, read as Riyadh time → ISO (UTC). */
export function fromRiyadhInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new WorkflowError("That date isn't valid.");
  return new Date(`${value}:00+03:00`).toISOString();
}

/** ISO → value for a datetime-local input, in Riyadh time. */
export function toRiyadhInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);
}

export function formatRiyadh(iso: string | null, withTime = true): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: STUDIO_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(iso));
}

/** True when an ISO time is in the past (request time; pages are rendered per request). */
export const isPast = (iso: string | null, now = new Date()) => !!iso && new Date(iso).getTime() < now.getTime();
