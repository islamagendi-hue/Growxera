import { CONSENT_TEXT, POLICY_VERSION } from "@/config/privacy";
import { buildReport } from "@/lib/diagnostic/engine";
import { sanitizeAnswers } from "@/lib/diagnostic/questions";
import { sendReportEmail } from "@/lib/server/email";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { leadRequestSchema } from "@/lib/server/schemas";
import { insert, updateById } from "@/lib/server/store";

/** Captures a lead (from the diagnostic gate or the contact form) with its consents. */
export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientKey(req)}`, 8, 60_000)) {
    return Response.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
  }
  const parsed = leadRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.filter((i) => i.path[0] === "lead").map((i) => [String(i.path[1]), i.message]),
    );
    return Response.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
  }
  const data = parsed.data;
  // Honeypot tripped: pretend success, store nothing.
  if (data.company_url) return Response.json({ ok: true });

  let report = null;
  if (data.source === "diagnostic") {
    const { answers, errors } = sanitizeAnswers(data.answers);
    if (Object.keys(errors).length) return Response.json({ error: "Diagnostic answers are incomplete." }, { status: 422 });
    report = buildReport(answers);
  }

  const leadId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { first, last } = data.attribution;
  const touch = last ?? first ?? {};
  const { lead } = data;

  try {
    await insert("leads", {
      id: leadId,
      created_at: now,
      source: data.source,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      phone: lead.phone || null,
      job_title: lead.jobTitle || null,
      website: lead.website || null,
      message: lead.message || null,
      diagnostic_session_id: data.diagnosticSessionId ?? null,
      anonymous_id: data.anonymousId ?? null,
      overall_score: report?.overallScore ?? null,
      bottleneck: report?.bottleneck ?? null,
      consent_processing: true,
      consent_marketing: lead.consentMarketing,
      consent_policy_version: POLICY_VERSION,
      consent_at: now,
      utm_source: touch.utm_source ?? null,
      utm_medium: touch.utm_medium ?? null,
      utm_campaign: touch.utm_campaign ?? null,
      utm_content: touch.utm_content ?? null,
      utm_term: touch.utm_term ?? null,
      referrer: touch.referrer ?? null,
      landing_page: touch.landing_page ?? null,
      first_touch: first ?? null,
    });
    await insert("consent_records", [
      { lead_id: leadId, purpose: "processing", granted: true, policy_version: POLICY_VERSION, wording: CONSENT_TEXT.processing, source: data.source, created_at: now },
      { lead_id: leadId, purpose: "marketing", granted: lead.consentMarketing, policy_version: POLICY_VERSION, wording: CONSENT_TEXT.marketing, source: data.source, created_at: now },
    ]);
    if (data.diagnosticSessionId) {
      await updateById("diagnostic_sessions", data.diagnosticSessionId, { lead_id: leadId });
    }
  } catch (err) {
    console.error("[leads] store failed", err);
    return Response.json({ error: "We couldn't save your details. Please try again." }, { status: 503 });
  }

  const [emailSent] = await Promise.all([
    report ? sendReportEmail(lead.email, lead.name, report, data.diagnosticSessionId ? leadId : undefined) : Promise.resolve(false),
    notify({ leadId, source: data.source, name: lead.name, email: lead.email, company: lead.company, phone: lead.phone, report }),
  ]);

  return Response.json({ ok: true, leadId, report, emailSent });
}

/** Optional: forwards a lead summary to LEAD_WEBHOOK_URL (Slack, Make, Zapier, CRM). */
async function notify(payload: {
  leadId: string;
  source: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  report: ReturnType<typeof buildReport> | null;
}) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return;
  const { report, ...lead } = payload;
  const text = report
    ? `New diagnostic lead: ${lead.name} (${lead.company}), score ${report.overallScore}/100, bottleneck ${report.bottleneck}`
    : `New contact request: ${lead.name} (${lead.company})`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        lead,
        diagnostic: report && {
          overallScore: report.overallScore,
          stage: report.stage.label,
          bottleneck: report.bottleneck,
          estimatedOpportunity: report.estimatedOpportunity,
          currency: report.currency,
        },
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    console.error("[leads] webhook failed", err);
  }
}
