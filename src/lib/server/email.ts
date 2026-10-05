import "server-only";
/**
 * Sends the Growth Diagnostic report to the person who requested it, via Resend
 * (https://resend.com). Configure on the server only:
 *   RESEND_API_KEY      — API key from Resend
 *   REPORT_FROM_EMAIL   — verified sender, e.g. "Growx Era <hello@growxera.com>"
 * Without RESEND_API_KEY nothing is sent and the site works as before.
 */
import { SITE } from "@/config/site";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import type { DiagnosticReport, Level } from "@/lib/diagnostic/types";
import { formatMoney } from "@/lib/format";

const LEVEL: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Public link to the full report on the site; anyone with the link can open it. */
export const reportUrl = (leadId: string) => `${SITE.url}/report/${leadId}`;

export function reportEmail(name: string, report: DiagnosticReport, leadId?: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  const ctaUrl = leadId ? reportUrl(leadId) : SITE.bookingUrl || `${SITE.url}/contact`;
  const opp = report.estimatedOpportunity;
  const oppLine = opp
    ? `${formatMoney(opp.monthlyLow, report.currency)} – ${formatMoney(opp.monthlyHigh, report.currency)} per month`
    : null;
  const dims = report.dimensions
    .map(
      (d) =>
        `<tr><td style="padding:6px 0;color:#3d4541">${esc(DIMENSION_LABELS[d.dimension])}${d.dimension === report.bottleneck ? " <strong style=\"color:#a8492a\">(bottleneck)</strong>" : ""}</td>` +
        `<td style="padding:6px 0;text-align:right;font-family:monospace;color:#0e1311">${d.hasData ? d.score : "–"}</td></tr>`,
    )
    .join("");
  const opps = report.opportunities
    .slice(0, 3)
    .map(
      (o, i) =>
        `<tr><td style="padding:14px 0;border-top:1px solid #e4e0d6"><div style="font-size:12px;color:#6b726e;font-family:monospace">0${i + 1} · Impact ${LEVEL[o.impact]} · Confidence ${LEVEL[o.confidence]} · Effort ${LEVEL[o.effort]}</div>` +
        `<div style="font-size:17px;font-weight:600;color:#0e1311;margin-top:4px">${esc(o.title)}</div>` +
        `<div style="font-size:14px;color:#3d4541;margin-top:4px;line-height:1.6">${esc(o.summary)}</div></td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:Dubai,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbfaf6;border:1px solid #e4e0d6">
<tr><td style="padding:28px 32px;border-bottom:1px solid #e4e0d6;font-weight:700;font-size:18px;color:#0e1311">GROWX <span style="color:#0f6b4f">ERA</span></td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 16px;font-size:16px;color:#0e1311">Hi ${esc(first)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3d4541">Here is your Growth Diagnostic report. It is a preliminary diagnosis based on your answers, a starting point for a deeper look, not financial advice.</p>
<div style="font-size:12px;color:#6b726e;font-family:monospace;letter-spacing:.08em">YOUR GROWTH SCORE</div>
<div style="font-size:64px;font-weight:700;line-height:1;color:#0e1311;margin:6px 0">${report.overallScore}<span style="font-size:20px;color:#6b726e">/100</span></div>
<div style="font-size:16px;font-weight:600;color:#0f6b4f">${esc(report.stage.label)}</div>
<p style="margin:6px 0 24px;font-size:14px;color:#3d4541;line-height:1.6">${esc(report.stage.description)}</p>
<div style="background:#f4e2da;border-left:3px solid #a8492a;padding:16px 18px;margin-bottom:24px">
<div style="font-size:12px;color:#6b726e;font-family:monospace;letter-spacing:.08em">PRIMARY BOTTLENECK</div>
<div style="font-size:20px;font-weight:700;color:#0e1311;margin-top:4px">${esc(DIMENSION_LABELS[report.bottleneck])}</div>
<p style="margin:8px 0 0;font-size:14px;color:#3d4541;line-height:1.6">${esc(report.bottleneckExplanation)}</p></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:24px">${dims}</table>
${oppLine ? `<div style="font-size:12px;color:#6b726e;font-family:monospace;letter-spacing:.08em">ESTIMATED OPPORTUNITY</div><div style="font-size:20px;font-weight:700;color:#0e1311;margin:4px 0 4px">${esc(oppLine)}</div><p style="margin:0 0 24px;font-size:12px;color:#6b726e">An estimate from your inputs and conservative assumptions, not a forecast or guarantee.</p>` : ""}
<div style="font-size:12px;color:#6b726e;font-family:monospace;letter-spacing:.08em">TOP OPPORTUNITIES</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">${opps}</table>
<a href="${esc(ctaUrl)}" style="display:inline-block;background:#0e1311;color:#f4f2ec;text-decoration:none;padding:14px 22px;font-size:15px;font-weight:600">Talk through your results →</a>
${leadId ? `<p style="margin:12px 0 0;font-size:12px;color:#6b726e;line-height:1.6">This button opens your full report on our site. Anyone you forward this email to can open it too.</p>` : ""}
<p style="margin:24px 0 0;font-size:14px;color:#3d4541;line-height:1.6">Reply to this email if you have any questions.<br>The Growx Era team</p>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e4e0d6;font-size:12px;color:#6b726e;line-height:1.6">You received this because you requested your Growth Diagnostic report on ${esc(SITE.url.replace(/^https?:\/\//, ""))}. <a href="${esc(SITE.url)}/privacy" style="color:#6b726e">Privacy notice</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${first},`,
    "",
    "Here is your Growth Diagnostic report (a preliminary diagnosis, not financial advice).",
    "",
    `Growth Score: ${report.overallScore}/100 — ${report.stage.label}`,
    `Primary bottleneck: ${DIMENSION_LABELS[report.bottleneck]}`,
    report.bottleneckExplanation,
    "",
    ...report.dimensions.map((d) => `${DIMENSION_LABELS[d.dimension]}: ${d.hasData ? d.score : "–"}`),
    ...(oppLine ? ["", `Estimated opportunity: ${oppLine} (an estimate, not a guarantee)`] : []),
    "",
    "Top opportunities:",
    ...report.opportunities.slice(0, 3).map((o, i) => `${i + 1}. ${o.title}: ${o.summary}`),
    "",
    `Talk through your results: ${ctaUrl}`,
    "",
    "The Growx Era team",
  ].join("\n");

  return { subject: `Your Growth Score: ${report.overallScore}/100 · ${DIMENSION_LABELS[report.bottleneck]} is your bottleneck`, html, text };
}

/** Returns true when the email was accepted by the provider. Never throws. */
export async function sendReportEmail(to: string, name: string, report: DiagnosticReport, leadId?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const { subject, html, text } = reportEmail(name, report, leadId);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REPORT_FROM_EMAIL || `Growx Era <${SITE.contactEmail || "hello@growxera.com"}>`,
        to: [to],
        reply_to: SITE.contactEmail || undefined,
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.error("[email] report send failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[email] report send failed", err);
    return false;
  }
}
