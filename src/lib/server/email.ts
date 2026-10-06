import "server-only";
/**
 * Transactional email via Resend (https://resend.com). Configure on the server only:
 *   RESEND_API_KEY      — API key from Resend
 *   REPORT_FROM_EMAIL   — verified sender, e.g. "Growx Era <hello@growxera.com>"
 *   SPECIALIST_EMAIL    — optional; where specialist questions and bookings are sent
 *                         (defaults to NEXT_PUBLIC_CONTACT_EMAIL)
 *
 * Without RESEND_API_KEY nothing is sent. In development, messages are written to
 * .data/outbox/ instead so the sign-in flow can be tested end to end.
 *
 * Every email links back to the site (report, account, booking). Nothing needs downloading.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SITE } from "@/config/site";
import { formatSlot } from "@/lib/booking/slots";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { DiagnosticReport } from "@/lib/diagnostic/types";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const host = () => SITE.url.replace(/^https?:\/\//, "");

/** The link inside an email that signs the person in and opens `next`. */
export const signInUrl = (token: string) => `${SITE.url}/auth/verify?token=${encodeURIComponent(token)}`;

/** Legacy public report link (emails sent before accounts existed). */
export const reportUrl = (leadId: string) => `${SITE.url}/report/${leadId}`;

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const LABEL = (t: string) => `<div style="font-size:12px;color:#6b726e;font-family:monospace;letter-spacing:.08em;text-transform:uppercase">${t}</div>`;
const BUTTON = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#0e1311;color:#f4f2ec;text-decoration:none;padding:14px 22px;font-size:15px;font-weight:600">${esc(label)} →</a>`;

function layout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:Dubai,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbfaf6;border:1px solid #e4e0d6">
<tr><td style="padding:28px 32px;border-bottom:1px solid #e4e0d6;font-weight:700;font-size:18px;color:#0e1311">GROWX <span style="color:#0f6b4f">ERA</span></td></tr>
<tr><td style="padding:32px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e4e0d6;font-size:12px;color:#6b726e;line-height:1.6">${footer} <a href="${esc(SITE.url)}/privacy" style="color:#6b726e">Privacy notice</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

const P = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d4541">${t}</p>`;
const HI = (name: string) => `<p style="margin:0 0 16px;font-size:16px;color:#0e1311">Hi ${esc(firstName(name))},</p>`;
const SMALL = (t: string) => `<p style="margin:16px 0 0;font-size:12px;color:#6b726e;line-height:1.6">${t}</p>`;

// ── Templates ───────────────────────────────────────────────────────────────

export function signInEmail(name: string | null, token: string, minutes: number, isSignup: boolean): Email {
  const url = signInUrl(token);
  const subject = isSignup ? "Confirm your email to open your Growx Era account" : "Your secure Growx Era login link";
  const lead = isSignup ? "Confirm your email to open your account. No password needed." : "Use this secure link to log in. No password needed.";
  const html = layout(
    `${name ? HI(name) : ""}${P(lead)}${BUTTON(url, isSignup ? "Open my account" : "Log in")}${SMALL(
      `The link works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email: nobody can log in without it.`,
    )}`,
    `You received this because someone entered this address on ${esc(host())}.`,
  );
  const text = [name ? `Hi ${firstName(name)},` : "", lead, "", url, "", `The link works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.`]
    .filter((l, i) => l || i > 0)
    .join("\n");
  return { subject, html, text };
}

/** Sent when someone asks to log in with an email that has no account. Reveals nothing on the site itself. */
export function noAccountEmail(): Email {
  const url = `${SITE.url}/signup`;
  const html = layout(
    `${P("Someone asked to log in to Growx Era with this email address, but there's no account for it yet.")}${P(
      "You can create one in a few seconds, or take the free Growth Diagnostic and your account is created with your report.",
    )}${BUTTON(url, "Create my account")}${SMALL("If this wasn't you, you can ignore this email.")}`,
    `You received this because this address was entered on ${esc(host())}.`,
  );
  return {
    subject: "Log in to Growx Era",
    html,
    text: `Someone asked to log in to Growx Era with this email, but there's no account for it yet.\n\nCreate one: ${url}\n\nIf this wasn't you, ignore this email.`,
  };
}

/** "Your diagnostic report is ready", with a one-time link that signs in and opens the report. */
export function reportReadyEmail(name: string, report: DiagnosticReport, token: string, minutes: number): Email {
  const url = signInUrl(token);
  const top = (report.recommendations ?? []).slice(0, 3);
  const recs = top
    .map(
      (r, i) =>
        `<tr><td style="padding:12px 0;border-top:1px solid #e4e0d6"><div style="font-size:12px;color:#6b726e;font-family:monospace">0${i + 1} · ${esc(DIMENSION_LABELS[r.dimension])}</div><div style="font-size:16px;font-weight:600;color:#0e1311;margin-top:4px">${esc(r.title)}</div></td></tr>`,
    )
    .join("");
  const hours = Math.round(minutes / 60);
  const html = layout(
    `${HI(name)}${P("Your Growth Diagnostic report is ready and saved to your account. Open it any time from this email or by logging in with your email address.")}
${LABEL("Your Growth Score")}
<div style="font-size:56px;font-weight:700;line-height:1;color:#0e1311;margin:6px 0">${report.overallScore}<span style="font-size:18px;color:#6b726e">/100</span></div>
<div style="font-size:16px;font-weight:600;color:#0f6b4f;margin-bottom:20px">${esc(report.stage.label)}</div>
${LABEL("Primary bottleneck")}
<div style="font-size:18px;font-weight:700;color:#0e1311;margin:4px 0 20px">${esc(DIMENSION_LABELS[report.bottleneck])}</div>
${recs ? `${LABEL("Top recommendations")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 24px">${recs}</table>` : ""}
${BUTTON(url, "View report")}
${SMALL(`This button logs you in and opens your report. It works once and expires in ${hours} hours; after that, log in at ${esc(host())}/login with this email.`)}
${P("<br>Want to talk it through? From your report you can ask a specialist a question or book a free 30-minute review.")}
<p style="margin:0;font-size:14px;color:#3d4541;line-height:1.6">The Growx Era team</p>`,
    `You received this because you requested your Growth Diagnostic report on ${esc(host())}.`,
  );
  const text = [
    `Hi ${firstName(name)},`,
    "",
    "Your Growth Diagnostic report is ready and saved to your account.",
    "",
    `Growth Score: ${report.overallScore}/100 — ${report.stage.label}`,
    `Primary bottleneck: ${DIMENSION_LABELS[report.bottleneck]}`,
    ...(top.length ? ["", "Top recommendations:", ...top.map((r, i) => `${i + 1}. ${r.title}`)] : []),
    "",
    `View report: ${url}`,
    `(Works once, expires in ${hours} hours. After that, log in at ${host()}/login.)`,
    "",
    "The Growx Era team",
  ].join("\n");
  return { subject: `Your diagnostic report is ready · Growth Score ${report.overallScore}/100`, html, text };
}

export interface BookingDetails {
  name: string;
  company: string;
  slotStart: string;
  reportUrl?: string;
  message?: string;
}

export function bookingConfirmationEmail(b: BookingDetails, reminder = false): Email {
  const when = formatSlot(b.slotStart);
  const subject = reminder ? `Reminder: your free 30-minute review, ${when}` : `Confirmed: your free 30-minute review, ${when}`;
  const html = layout(
    `${HI(b.name)}${P(
      reminder
        ? "A reminder that your free 30-minute review with a Growx Era specialist is coming up."
        : "Your free 30-minute review with a Growx Era specialist is booked. The specialist will read your diagnostic before the call.",
    )}
${LABEL("When")}<div style="font-size:18px;font-weight:700;color:#0e1311;margin:4px 0 20px">${esc(when)}</div>
${P("We'll send the call link to this email before the session. To change the time, reply to this email.")}
${b.reportUrl ? BUTTON(b.reportUrl, "Open my report") : ""}`,
    `You received this because you booked a review on ${esc(host())}.`,
  );
  const text = [`Hi ${firstName(b.name)},`, "", subject, "", "We'll send the call link before the session. To change the time, reply to this email.", ...(b.reportUrl ? ["", `Your report: ${b.reportUrl}`] : [])].join("\n");
  return { subject, html, text };
}

export function questionReceivedEmail(name: string, question: string): Email {
  const html = layout(
    `${HI(name)}${P("Thanks for your question. A Growx Era specialist will reply by email, usually within one working day.")}
<div style="border-left:3px solid #0f6b4f;padding:4px 0 4px 14px;margin:0 0 20px;font-size:14px;color:#3d4541;line-height:1.6;white-space:pre-wrap">${esc(question)}</div>
${BUTTON(`${SITE.url}/account`, "Go to my account")}`,
    `You received this because you asked a question on ${esc(host())}.`,
  );
  return { subject: "We've received your question", html, text: `Hi ${firstName(name)},\n\nThanks for your question. A specialist will reply by email, usually within one working day.\n\n"${question}"` };
}

/** Internal notification to the specialist team. Plain and complete, so it can be acted on from the inbox. */
export function specialistTeamEmail(input: {
  kind: "question" | "consultation";
  name: string;
  email: string;
  company: string;
  topic?: string | null;
  message?: string | null;
  slotStart?: string | null;
  report?: DiagnosticReport | null;
  reportLink?: string | null;
}): Email {
  const r = input.report;
  const lines = [
    input.kind === "consultation" ? `New free review booked: ${input.slotStart ? formatSlot(input.slotStart) : ""}` : "New question for a specialist",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Company: ${input.company}`,
    ...(input.topic ? [`Topic: ${input.topic}`] : []),
    ...(input.message ? ["", "Message:", input.message] : []),
    ...(r
      ? [
          "",
          "Diagnostic:",
          `Context: ${r.context?.label ?? r.businessModel}`,
          `Growth Score: ${r.overallScore}/100 (${r.stage.label})`,
          `Bottleneck: ${DIMENSION_LABELS[r.bottleneck]}`,
          ...(r.recommendations ?? []).slice(0, 5).map((x, i) => `  ${i + 1}. ${x.title}`),
        ]
      : []),
    ...(input.reportLink ? ["", `Full report: ${input.reportLink}`] : []),
  ];
  const text = lines.join("\n");
  return {
    subject: input.kind === "consultation" ? `Review booked: ${input.company}${input.slotStart ? `, ${formatSlot(input.slotStart)}` : ""}` : `Specialist question: ${input.company}`,
    html: `<pre style="font-family:Menlo,monospace;font-size:13px;white-space:pre-wrap">${esc(text)}</pre>`,
    text,
  };
}

// ── Sending ─────────────────────────────────────────────────────────────────

export interface SendOptions {
  replyTo?: string;
  /** ISO time to deliver at (Resend scheduled sending), e.g. booking reminders. */
  scheduledAt?: string;
  /** Tag for the dev outbox file name. */
  tag?: string;
}

/** Returns true when the provider accepted the email (or it was written to the dev outbox). Never throws. */
export async function sendEmail(to: string, email: Email, opts: SendOptions = {}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV === "production") return false;
    try {
      const dir = path.join(process.env.GX_DATA_DIR || path.join(process.cwd(), ".data"), "outbox");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${Date.now()}-${opts.tag ?? "email"}.json`), JSON.stringify({ to, ...email, ...opts }, null, 1));
      return true;
    } catch {
      return false;
    }
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REPORT_FROM_EMAIL || `Growx Era <${SITE.contactEmail || "hello@growxera.com"}>`,
        to: [to],
        reply_to: opts.replyTo ?? (SITE.contactEmail || undefined),
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(opts.scheduledAt ? { scheduled_at: opts.scheduledAt } : {}),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.error("[email] send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[email] send failed", err);
    return false;
  }
}

/** Where specialist questions and bookings are delivered. */
export const specialistInbox = () => process.env.SPECIALIST_EMAIL?.trim() || SITE.contactEmail || "hello@growxera.com";
