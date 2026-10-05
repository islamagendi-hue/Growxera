/**
 * Case studies. Add real, client-approved engagements only: never invent
 * clients, numbers or quotes. While this list is empty the site shows clearly
 * marked placeholders instead.
 */
export interface CaseMetric {
  label: string;
  /** e.g. "+38%", "SAR 1.2M", "−22%" */
  value: string;
  /** e.g. "Repeat purchase rate in 6 months" */
  detail?: string;
}

export interface CaseStudy {
  slug: string;
  /** Anonymised name is fine, e.g. "Saudi D2C beauty brand". */
  client: string;
  sector: string;
  /** Leave out when the user has not confirmed it. */
  market?: string;
  title: string;
  /** Up to four headline results, shown on cards. */
  metrics: CaseMetric[];
  /** Narrative sections are optional: only what the client has confirmed is shown. */
  problem?: string;
  diagnosis?: string;
  intervention?: string[];
  result?: string;
  businessImpact?: string;
  /** Who did the work and in what capacity. */
  role?: string;
  /** Tools used. */
  stack?: string[];
  /** Period the results were measured over, e.g. "Q1–Q2 2026". */
  period?: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "car-wash-app-0-to-100k-users",
    client: "On-demand car wash app",
    sector: "Mobile app",
    market: "Riyadh, Saudi Arabia",
    title: "From 0 to 100,000 users in 8 months, with CAC down 70%",
    role: "In-house growth leadership, reporting to the CEO and owning acquisition, activation, retention, monetization and referral.",
    metrics: [
      { label: "Users", value: "0 → 100K", detail: "In 8 months" },
      { label: "CAC", value: "−70%", detail: "SAR 116 → SAR 35" },
      { label: "Activation", value: "28% → 40%", detail: "+43%" },
      { label: "LTV:CAC", value: "4:1", detail: "CAC payback under 1 month" },
    ],
    intervention: [
      "Event mapping and tracking implementation across the funnel, so every result above is measured on reliable data.",
      "Led a cross-functional growth team of 7 across Product, CRM, Content, Engineering, SEO and B2B.",
      "Built a company-wide North Star Metric and growth KPI framework across the full funnel.",
      "Ran a WhatsApp-to-app migration loop as the go-to-market strategy.",
      "ICP-based targeting and creative-market fit optimization in paid acquisition.",
      "Onboarding optimization backed by 15+ A/B tests.",
      "Experimentation system with ICE prioritization, a weekly testing cadence and centralized learning, running 8–10 experiments a month.",
      "Referral loop optimization and incentive design.",
      "Fixed critical Adjust attribution and postback issues so paid media could scale on accurate data.",
      "Owned growth forecasting, budget allocation and KPI planning with the CEO.",
    ],
    result:
      "0 to 100,000 users in 8 months. CAC reduced from SAR 116 to SAR 35 (−70%). Activation lifted from 28% to 40% (+43%). 5,000+ paying users acquired through the referral loop.",
    businessImpact:
      "SAR 2M+ in attributable revenue through acquisition and lifecycle channels, with a sustained 4:1 LTV:CAC and CAC payback under one month.",
    stack: ["Mixpanel", "Adjust", "WebEngage", "Claude", "Google Sheets"],
  },
  {
    slug: "perfume-store-100k-to-700k-monthly",
    client: "Perfume e-commerce store",
    sector: "E-commerce · Perfume",
    title: "A perfume store that grew monthly revenue from SAR 100K to SAR 700K",
    metrics: [
      { label: "Monthly revenue (SAR)", value: "100K → 700K" },
      { label: "Growth", value: "7×" },
      { label: "Sales channels", value: "1 → 3", detail: "Website, Amazon, Meta" },
    ],
    problem:
      "The store sold through a single channel, its own website, so growth was capped by how much traffic that one site could attract and convert.",
    intervention: [
      "Event mapping and tracking implementation across the funnel, so every result above is measured on reliable data.",
      "Opened Amazon as a new sales channel, putting the range in front of shoppers already searching for perfume there.",
      "Launched Meta as an acquisition channel to reach new customers beyond the website's existing traffic.",
      "Introduced samples as a growth lever, lowering the risk of buying a fragrance online without smelling it first.",
    ],
    result: "Monthly revenue grew from SAR 100K to SAR 700K, a 7× increase.",
  },
  {
    slug: "multi-branch-lifecycle-crm",
    client: "Multi-branch service business",
    sector: "Lifecycle & CRM",
    title: "A CRM automation system that lifted repeat bookings by 25% across 6 branches",
    role: "Full lifecycle growth ownership across 6 branches, with cohort-based performance management.",
    metrics: [
      { label: "Repeat bookings", value: "+25%" },
      { label: "Churn", value: "−12%" },
      { label: "New customers from referral", value: "15%" },
      { label: "Branches", value: "6" },
    ],
    intervention: [
      "Event mapping and tracking implementation across the funnel, so every result above is measured on reliable data.",
      "Built a CRM automation system across SMS, email and WhatsApp.",
      "Ran cohort optimization cycles to reduce churn.",
      "Designed segmentation and lifecycle journeys to improve engagement on every channel.",
      "Launched a referral program.",
    ],
    result:
      "Repeat bookings up 25%, churn down 12%, and the referral program contributing 15% of all new customer acquisition.",
    stack: ["HubSpot", "SMS", "Email", "WhatsApp"],
  },
  {
    slug: "edtech-full-funnel-growth",
    client: "EdTech platform",
    sector: "EdTech",
    title: "A full-funnel growth system that lifted conversions by 18%",
    role: "Full-funnel growth ownership across adult and junior learner tracks.",
    metrics: [
      { label: "Conversions", value: "+18%" },
      { label: "Activation rate", value: "+20%" },
      { label: "Email engagement", value: "+15%" },
      { label: "Retention levers found", value: "3" },
    ],
    intervention: [
      "Event mapping and tracking implementation across the funnel, so every result above is measured on reliable data.",
      "Built a full-funnel growth system from acquisition through retention.",
      "Re-engineered the onboarding journey and removed friction in time-to-first-value.",
      "Implemented cohort tracking, which surfaced 3 high-impact retention levers that shaped the next quarter's roadmap.",
      "Behavioral segmentation and message-market fit testing in lifecycle email.",
    ],
    result:
      "Overall conversions up 18%, activation rate up 20%, and lifecycle email engagement up 15%.",
    stack: ["GA4", "Email marketing", "Cohort analytics"],
  },
];

/** Headline numbers for the homepage, taken from the cases above. */
export const TRACK_RECORD = [
  { value: "0 → 100K", label: "Users in 8 months" },
  { value: "−70%", label: "CAC, SAR 116 → SAR 35" },
  { value: "4:1", label: "LTV:CAC sustained" },
  { value: "SAR 2M+", label: "Attributable revenue" },
];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
