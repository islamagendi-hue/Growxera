/** The analytics event taxonomy. Shared by client tracking and the /api/events validator. */
export const ANALYTICS_EVENTS = [
  "page_viewed",
  "diagnostic_started",
  "diagnostic_step_viewed",
  "diagnostic_step_completed",
  "diagnostic_abandoned",
  "diagnostic_completed",
  "diagnostic_score_generated",
  "report_viewed",
  "lead_form_started",
  "lead_submitted",
  "cta_clicked",
  "booking_started",
  "diagnostic_upload_read",
  "diagnostic_upload_failed",
  "sign_in_requested",
  "specialist_question_sent",
  "consultation_booked",
  "progress_compared",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_page",
] as const;

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

/** First touch (never overwritten) and last touch (latest campaign visit). */
export interface AttributionContext {
  first?: Attribution;
  last?: Attribution;
}
