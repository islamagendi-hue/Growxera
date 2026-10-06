/**
 * Privacy & consent settings. See docs/PRIVACY_AND_CONSENT.md.
 * Bump POLICY_VERSION whenever the privacy notice or consent wording changes:
 * every stored consent records the version the person agreed to.
 */
export const POLICY_VERSION = "2026-10-06.1";

/** Analytics are opt-in: no analytics events are sent until the visitor accepts. */
export const ANALYTICS_REQUIRES_CONSENT = true;

/** Retention periods, enforced by the SQL function purge_expired_data(). */
export const RETENTION = {
  /** Diagnostics never linked to a lead. */
  anonymousDiagnosticsDays: 180,
  /** Leads with no engagement since capture. */
  leadsDays: 730,
  analyticsEventsDays: 395,
};

export const CONSENT_TEXT = {
  processing:
    "I agree that Growx Era may store my details and diagnostic answers to prepare my report, save it to my account and contact me about it, as described in the Privacy Notice.",
  account:
    "I agree that Growx Era may store my name, email, company and saved diagnostics in my account, and contact me about them, as described in the Privacy Notice.",
  booking:
    "I agree that Growx Era may use my details and diagnostic report to prepare for and hold this call, as described in the Privacy Notice.",
  question:
    "I agree that Growx Era may use my details and diagnostic report to answer my question, as described in the Privacy Notice.",
  marketing: "Send me occasional growth insights by email or WhatsApp. I can unsubscribe at any time.",
  analytics:
    "We use analytics, including Google Analytics, to understand how the site and diagnostic are used and improve them. No advertising cookies.",
};
