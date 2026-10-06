import "server-only";
/**
 * Specialist questions and free 30-minute review bookings. Both are qualified
 * leads: they carry the person's diagnostic so the specialist can read the
 * report before replying or calling.
 */
import { SITE } from "@/config/site";
import { availableSlots, isBookable, SLOT_MINUTES, BOOKING_TIMEZONE } from "@/lib/booking/slots";
import type { DiagnosticReport } from "@/lib/diagnostic/types";
import type { Account } from "./auth";
import { bookingConfirmationEmail, questionReceivedEmail, reportUrl, sendEmail, specialistInbox, specialistTeamEmail } from "./email";
import { eq, gt, inList, insert, select, selectOne, StoreError } from "./store";

export interface Contact {
  name: string;
  email: string;
  company: string;
}

interface DiagnosticRef {
  id: string;
  lead_id: string | null;
  account_id: string | null;
  report: DiagnosticReport;
}

/** The diagnostic a request refers to. Signed-in people can only reference their own. */
async function loadDiagnostic(id: string | undefined, account: Account | null): Promise<DiagnosticRef | null> {
  if (!id) return null;
  const row = await selectOne<DiagnosticRef>("diagnostic_sessions", [eq("id", id)], { columns: "id,lead_id,account_id,report" });
  if (!row) return null;
  if (account && row.account_id && row.account_id !== account.id) return null;
  return row;
}

function contactFor(account: Account | null, contact?: Contact): Contact | null {
  if (account) return { name: account.name, email: account.email, company: account.company };
  return contact ?? null;
}

const TOPICS: Record<string, string> = {
  report: "A question about my report",
  results: "Understanding my results",
  recommendations: "The recommendations",
  work_together: "Working together",
  other: "Something else",
};

export async function askSpecialist(input: {
  account: Account | null;
  contact?: Contact;
  diagnosticSessionId?: string;
  topic: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = contactFor(input.account, input.contact);
  if (!who) return { ok: false, error: "Please add your name, email and company." };
  const diag = await loadDiagnostic(input.diagnosticSessionId, input.account);
  await insert("specialist_requests", {
    kind: "question",
    status: "new",
    account_id: input.account?.id ?? null,
    diagnostic_session_id: diag?.id ?? null,
    name: who.name,
    email: who.email,
    company: who.company,
    topic: TOPICS[input.topic] ?? input.topic,
    message: input.message,
  });
  await Promise.all([
    sendEmail(
      specialistInbox(),
      specialistTeamEmail({ kind: "question", ...who, topic: TOPICS[input.topic], message: input.message, report: diag?.report, reportLink: diag?.lead_id ? reportUrl(diag.lead_id) : null }),
      { replyTo: who.email, tag: "specialist-question" },
    ),
    sendEmail(who.email, questionReceivedEmail(who.name, input.message), { tag: "question-received" }),
  ]);
  return { ok: true };
}

/** Start times already booked from now on. */
export async function takenSlots(now = new Date()): Promise<string[]> {
  const rows = await select<{ slot_start: string }>(
    "specialist_requests",
    [eq("kind", "consultation"), inList("status", ["new", "confirmed"]), gt("slot_start", now.toISOString())],
    { columns: "slot_start" },
  );
  return rows.map((r) => new Date(r.slot_start).toISOString());
}

export async function openSlots(now = new Date()) {
  return availableSlots(now, await takenSlots(now));
}

/** Reminder goes out this long before the call (when the booking is far enough ahead). */
export const REMINDER_HOURS_BEFORE = 3;

export async function bookReview(input: {
  account: Account | null;
  contact?: Contact;
  diagnosticSessionId?: string;
  slotStart: string;
  message?: string;
  now?: Date;
}): Promise<{ ok: true; slotStart: string } | { ok: false; error: string; status: number }> {
  const now = input.now ?? new Date();
  const who = contactFor(input.account, input.contact);
  if (!who) return { ok: false, error: "Please add your name, email and company.", status: 422 };
  const start = new Date(input.slotStart).toISOString();
  if (!isBookable(start, now, await takenSlots(now))) {
    return { ok: false, error: "That time was just taken or is no longer available. Please choose another.", status: 409 };
  }
  const diag = await loadDiagnostic(input.diagnosticSessionId, input.account);
  try {
    await insert("specialist_requests", {
      kind: "consultation",
      status: "new",
      account_id: input.account?.id ?? null,
      diagnostic_session_id: diag?.id ?? null,
      name: who.name,
      email: who.email,
      company: who.company,
      topic: "Free 30-minute review",
      message: input.message || null,
      slot_start: start,
      slot_minutes: SLOT_MINUTES,
      timezone: BOOKING_TIMEZONE,
    });
  } catch (err) {
    // The unique slot index rejects a double booking that slipped past the check above.
    if (err instanceof StoreError && /409|23505|duplicate/i.test(err.message)) {
      return { ok: false, error: "That time was just taken. Please choose another.", status: 409 };
    }
    throw err;
  }
  const myReport = diag && input.account ? `${SITE.url}/account/reports/${diag.id}` : undefined;
  const details = { name: who.name, company: who.company, slotStart: start, reportUrl: myReport, message: input.message };
  const reminderAt = new Date(new Date(start).getTime() - REMINDER_HOURS_BEFORE * 3_600_000);
  await Promise.all([
    sendEmail(who.email, bookingConfirmationEmail(details), { tag: "booking-confirmed" }),
    reminderAt.getTime() - now.getTime() > 3_600_000
      ? sendEmail(who.email, bookingConfirmationEmail(details, true), { scheduledAt: reminderAt.toISOString(), tag: "booking-reminder" })
      : Promise.resolve(false),
    sendEmail(
      specialistInbox(),
      specialistTeamEmail({ kind: "consultation", ...who, message: input.message, slotStart: start, report: diag?.report, reportLink: diag?.lead_id ? reportUrl(diag.lead_id) : null }),
      { replyTo: who.email, tag: "specialist-booking" },
    ),
  ]);
  return { ok: true, slotStart: start };
}
