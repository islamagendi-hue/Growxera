/** Brand and site-wide settings. Public values only: never put secrets here. */
export const SITE = {
  name: "Growx Era",
  wordmark: { left: "GROWX", right: "ERA" },
  title: "Growx Era — Growth & Transformation Partner",
  description:
    "Growx Era helps ambitious businesses diagnose growth bottlenecks, build growth systems, and unlock their next stage of growth.",
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  /** External scheduling link (Calendly, Cal.com, HubSpot…). Falls back to /contact. */
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL || "",
  contactEmail: "hello@growxera.com",
  /** wa.me number in international format without "+", e.g. 9665XXXXXXXX. */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "",
};

/** Main menu: the product first, kept short. Services, Lab and Insights live in the footer. */
export const NAV = [
  { href: "/diagnostic", label: "Growth Diagnostic" },
  { href: "/how-we-work", label: "How it works" },
  { href: "/case-studies", label: "Case studies" },
  { href: "/advisor", label: "Talk to an advisor" },
];

export const ACCOUNT_NAV = [
  { href: "/account", label: "My account" },
  { href: "/account/reports", label: "Previous reports" },
  { href: "/account/progress", label: "My progress" },
];
