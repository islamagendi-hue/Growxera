import { buildReport, toPreview } from "@/lib/diagnostic/engine";
import { sanitizeAnswers } from "@/lib/diagnostic/questions";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { diagnosticRequestSchema } from "@/lib/server/schemas";
import { insert } from "@/lib/server/store";

/**
 * Scores a completed diagnostic and stores the session.
 * Returns the preview only; the full report (opportunities, estimates) is
 * returned by /api/leads once the visitor shares their details.
 */
export async function POST(req: Request) {
  if (!rateLimit(`diag:${clientKey(req)}`, 20, 60_000)) {
    return Response.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
  }
  const parsed = diagnosticRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const { answers, errors } = sanitizeAnswers(parsed.data.answers);
  if (Object.keys(errors).length) {
    return Response.json({ error: "Some answers need attention.", fields: errors }, { status: 422 });
  }

  const report = buildReport(answers);
  const id = crypto.randomUUID();
  const { first, last } = parsed.data.attribution;
  const touch = last ?? first ?? {};

  try {
    await insert("diagnostic_sessions", {
      id,
      anonymous_id: parsed.data.anonymousId ?? null,
      status: "completed",
      completed_at: report.generatedAt,
      business_model: report.businessModel,
      industry: answers.industry ?? null,
      primary_market: answers.primaryMarket ?? null,
      currency: report.currency,
      monthly_revenue: typeof answers.monthlyRevenue === "number" ? answers.monthlyRevenue : null,
      answers,
      scores: Object.fromEntries(report.dimensions.map((d) => [d.dimension, d.score])),
      report,
      overall_score: report.overallScore,
      stage: report.stage.id,
      bottleneck: report.bottleneck,
      strongest: report.strongest,
      weakest: report.weakest,
      estimated_opportunity_low: report.estimatedOpportunity?.monthlyLow ?? null,
      estimated_opportunity_high: report.estimatedOpportunity?.monthlyHigh ?? null,
      scoring_version: report.scoringVersion,
      utm_source: touch.utm_source ?? null,
      utm_medium: touch.utm_medium ?? null,
      utm_campaign: touch.utm_campaign ?? null,
      utm_content: touch.utm_content ?? null,
      utm_term: touch.utm_term ?? null,
      referrer: touch.referrer ?? null,
      landing_page: touch.landing_page ?? null,
      first_touch: first ?? null,
    });
  } catch (err) {
    // The visitor still gets their result; the failure is logged for follow-up.
    console.error("[diagnostic] store failed", err);
  }

  return Response.json({ sessionId: id, preview: toPreview(report) });
}
