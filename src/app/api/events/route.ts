import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { eventSchema } from "@/lib/server/schemas";
import { insert } from "@/lib/server/store";

/** First-party analytics sink. Clients only call this after analytics consent. No IPs are stored. */
export async function POST(req: Request) {
  if (!rateLimit(`evt:${clientKey(req)}`, 120, 60_000)) return new Response(null, { status: 429 });
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const e = parsed.data;
  try {
    await insert("analytics_events", {
      event: e.event,
      anonymous_id: e.anonymousId,
      diagnostic_session_id: typeof e.props.sessionId === "string" ? e.props.sessionId : null,
      properties: e.props,
      page_path: e.path ?? null,
      utm_source: e.attribution.utm_source ?? null,
      utm_medium: e.attribution.utm_medium ?? null,
      utm_campaign: e.attribution.utm_campaign ?? null,
      utm_content: e.attribution.utm_content ?? null,
      utm_term: e.attribution.utm_term ?? null,
      referrer: e.attribution.referrer ?? null,
      landing_page: e.attribution.landing_page ?? null,
      client_ts: e.ts ?? null,
    });
  } catch (err) {
    console.error("[events] store failed", err);
  }
  return new Response(null, { status: 204 });
}
