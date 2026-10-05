/**
 * Question bank for the Growth Diagnostic.
 *
 * Questions are data: the UI renders them generically, the validator checks
 * answers against them, and the scoring engine reads answers by id. To add a
 * question, define it here, place it on a screen in STEPS, and (optionally)
 * reference it from a signal in scoring.ts.
 */
import { UNKNOWN, type Answers, type AnswerValue, type BusinessModel } from "./types";

export type QuestionType = "choice" | "select" | "multi" | "number" | "currency" | "percent";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: Option[];
  /** Adds an "I don't know" answer stored as UNKNOWN. */
  allowUnknown?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  optional?: boolean;
  showIf?: (answers: Answers) => boolean;
}

export interface Step {
  id: string;
  label: string;
  title: string;
  intro: string;
  /** Each screen is a small group of questions shown together (progressive disclosure). */
  screens: string[][];
}

const model = (a: Answers) => a.businessModel as BusinessModel | undefined;
const isModel =
  (...models: BusinessModel[]) =>
  (a: Answers) =>
    models.includes(model(a) as BusinessModel);

const yesSometimesNo: Option[] = [
  { value: "systematic", label: "Yes, systematically" },
  { value: "sometimes", label: "Sometimes / manually" },
  { value: "no", label: "No" },
];

export const QUESTIONS: Question[] = [
  // ── Business ────────────────────────────────────────────────────────────
  {
    id: "businessModel",
    type: "choice",
    label: "How does your business mainly make money?",
    help: "We adapt the questions that follow to your model.",
    options: [
      { value: "ecommerce", label: "E-commerce / DTC", hint: "Customers buy online" },
      { value: "leadgen", label: "Leads & sales", hint: "Services, B2B, bookings, high-ticket" },
      { value: "subscription", label: "SaaS / Subscription", hint: "Recurring plans or memberships" },
      { value: "other", label: "Other", hint: "Marketplace, retail, hybrid" },
    ],
  },
  {
    id: "industry",
    type: "select",
    label: "Industry",
    options: [
      { value: "retail_ecommerce", label: "Retail & E-commerce" },
      { value: "fnb_hospitality", label: "F&B & Hospitality" },
      { value: "healthcare", label: "Healthcare & Clinics" },
      { value: "beauty_wellness", label: "Beauty & Wellness" },
      { value: "education", label: "Education & Training" },
      { value: "real_estate", label: "Real Estate" },
      { value: "b2b_services", label: "Professional & B2B Services" },
      { value: "saas_tech", label: "SaaS & Technology" },
      { value: "financial_services", label: "Financial Services" },
      { value: "automotive", label: "Automotive" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "primaryMarket",
    type: "select",
    label: "Primary market",
    options: [
      { value: "SA", label: "Saudi Arabia" },
      { value: "AE", label: "United Arab Emirates" },
      { value: "QA", label: "Qatar" },
      { value: "KW", label: "Kuwait" },
      { value: "BH", label: "Bahrain" },
      { value: "OM", label: "Oman" },
      { value: "EG", label: "Egypt" },
      { value: "GCC", label: "Multiple GCC markets" },
      { value: "OTHER", label: "Other / International" },
    ],
  },
  {
    id: "businessAge",
    type: "choice",
    label: "How long has the business been operating?",
    options: [
      { value: "lt1", label: "Under 1 year" },
      { value: "1to3", label: "1–3 years" },
      { value: "3to5", label: "3–5 years" },
      { value: "5to10", label: "5–10 years" },
      { value: "gt10", label: "10+ years" },
    ],
  },
  {
    id: "monthlyRevenue",
    type: "currency",
    label: "Average monthly revenue",
    help: "A recent typical month. Rough is fine.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "monthlyCustomers",
    type: "number",
    label: "Customers or orders per month",
    help: "New and returning combined.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "icpClarity",
    type: "choice",
    label: "How clearly is your ideal customer defined?",
    options: [
      { value: "clear", label: "Clearly defined segment we focus on" },
      { value: "broad", label: "Broadly defined" },
      { value: "anyone", label: "We sell to anyone who will buy" },
    ],
  },
  {
    id: "differentiation",
    type: "choice",
    label: "Why do customers choose you over alternatives?",
    options: [
      { value: "strong", label: "A clear reason competitors can't easily match" },
      { value: "some", label: "Mostly price, convenience or availability" },
      { value: "weak", label: "Honestly, it's hard to tell us apart" },
    ],
  },

  // ── Economics ───────────────────────────────────────────────────────────
  {
    id: "aov",
    type: "currency",
    label: "Average order value / revenue per customer",
    help: "Per order for e-commerce; per deal or per month for subscriptions.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "grossMargin",
    type: "percent",
    label: "Gross margin",
    help: "Revenue minus direct costs (product, delivery, fulfilment), as a %.",
    allowUnknown: true,
    min: 0,
    max: 100,
  },
  {
    id: "marketingSpend",
    type: "currency",
    label: "Total monthly marketing spend",
    help: "Paid media, agencies, influencers and tools.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "cac",
    type: "currency",
    label: "Customer acquisition cost (CAC / CPP)",
    help: "Marketing and sales cost to win one new customer.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "ltv",
    type: "currency",
    label: "Customer lifetime value (LTV)",
    help: "Total revenue an average customer brings over their relationship with you.",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "payback",
    type: "choice",
    label: "How long until a new customer pays back their acquisition cost?",
    allowUnknown: true,
    options: [
      { value: "first", label: "On the first purchase" },
      { value: "1to3", label: "1–3 months" },
      { value: "3to6", label: "3–6 months" },
      { value: "6to12", label: "6–12 months" },
      { value: "gt12", label: "Over 12 months" },
    ],
  },

  // ── Acquisition ─────────────────────────────────────────────────────────
  {
    id: "monthlyTraffic",
    type: "number",
    label: "Monthly website / app visits",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "monthlyLeads",
    type: "number",
    label: "Monthly leads or enquiries",
    help: "Form fills, calls, WhatsApp enquiries or sign-ups.",
    allowUnknown: true,
    min: 0,
    showIf: isModel("leadgen", "subscription"),
  },
  {
    id: "channels",
    type: "multi",
    label: "Main acquisition channels today",
    help: "Select all that bring customers consistently.",
    options: [
      { value: "meta", label: "Meta" },
      { value: "google", label: "Google" },
      { value: "tiktok", label: "TikTok" },
      { value: "snapchat", label: "Snapchat" },
      { value: "organic", label: "Organic / SEO" },
      { value: "influencers", label: "Influencers" },
      { value: "partnerships", label: "Partnerships" },
      { value: "sales", label: "Sales team" },
      { value: "referral", label: "Referral / word of mouth" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "paidSpend",
    type: "currency",
    label: "Of that, monthly paid media spend",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "topChannelShare",
    type: "choice",
    label: "Share of new customers from your single biggest channel",
    allowUnknown: true,
    options: [
      { value: "lt40", label: "Under 40%" },
      { value: "40to60", label: "40–60%" },
      { value: "60to80", label: "60–80%" },
      { value: "gt80", label: "Over 80%" },
    ],
  },
  {
    id: "acquisitionTrend",
    type: "choice",
    label: "New customer volume over the last 6 months",
    allowUnknown: true,
    options: [
      { value: "strong", label: "Growing strongly" },
      { value: "slow", label: "Growing slowly" },
      { value: "flat", label: "Flat" },
      { value: "declining", label: "Declining" },
    ],
  },

  // ── Conversion (adaptive) ───────────────────────────────────────────────
  {
    id: "conversionRate",
    type: "percent",
    label: "Website conversion rate",
    help: "Orders ÷ sessions. Typically between 0.5% and 5%.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
  },
  {
    id: "addToCartRate",
    type: "percent",
    label: "Add-to-cart rate",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
  },
  {
    id: "checkoutCompletion",
    type: "percent",
    label: "Checkout completion rate",
    help: "Of people who start checkout, the % who complete it.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
  },
  {
    id: "cartAbandonment",
    type: "percent",
    label: "Cart abandonment rate",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
  },
  {
    id: "leadToQualified",
    type: "percent",
    label: "Lead → qualified lead",
    help: "Share of leads that are a genuine fit.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("leadgen"),
  },
  {
    id: "qualifiedToCustomer",
    type: "percent",
    label: "Qualified lead → customer",
    help: "Your close rate on qualified opportunities.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("leadgen"),
  },
  {
    id: "leadResponseTime",
    type: "choice",
    label: "How fast does a new lead typically get a response?",
    allowUnknown: true,
    options: [
      { value: "lt5m", label: "Under 5 minutes" },
      { value: "lt1h", label: "Within the hour" },
      { value: "sameday", label: "Same day" },
      { value: "gt1d", label: "Next day or later" },
    ],
    showIf: isModel("leadgen"),
  },
  {
    id: "signupToActivation",
    type: "percent",
    label: "Sign-up → activation",
    help: "Share of new sign-ups who reach first real value.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
  },
  {
    id: "trialToPaid",
    type: "percent",
    label: "Trial / free → paid conversion",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
  },
  {
    id: "visitorToCustomer",
    type: "percent",
    label: "Visitor → customer conversion",
    help: "Share of visitors or enquiries that become paying customers.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("other"),
  },

  // ── Retention ───────────────────────────────────────────────────────────
  {
    id: "repeatRate",
    type: "percent",
    label: "Repeat customer rate",
    help: "Share of customers who buy again within 12 months.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: (a) => !isModel("subscription")(a),
  },
  {
    id: "monthlyChurn",
    type: "percent",
    label: "Monthly customer churn",
    help: "Share of paying customers who cancel each month.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
  },
  {
    id: "purchaseFrequency",
    type: "choice",
    label: "How often does a typical customer buy per year?",
    allowUnknown: true,
    options: [
      { value: "1", label: "Once" },
      { value: "2to3", label: "2–3 times" },
      { value: "4to6", label: "4–6 times" },
      { value: "7plus", label: "7+ times" },
    ],
    showIf: (a) => !isModel("subscription")(a),
  },
  {
    id: "crmUsage",
    type: "choice",
    label: "How do you use a CRM today?",
    options: [
      { value: "advanced", label: "Segmentation and automated journeys" },
      { value: "basic", label: "Mainly to store contacts" },
      { value: "none", label: "No CRM" },
    ],
  },
  {
    id: "ownedChannels",
    type: "multi",
    label: "Which channels do you use to talk to existing customers?",
    options: [
      { value: "email", label: "Email" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "sms", label: "SMS" },
      { value: "push", label: "App / push" },
      { value: "none", label: "None yet" },
    ],
  },
  {
    id: "loyalty",
    type: "choice",
    label: "Loyalty or membership programme",
    options: [
      { value: "yes", label: "Yes, active" },
      { value: "planned", label: "Planned" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "reactivation",
    type: "choice",
    label: "Do you run win-back / reactivation campaigns?",
    options: [
      { value: "structured", label: "Yes, structured and regular" },
      { value: "occasional", label: "Occasionally" },
      { value: "none", label: "No" },
    ],
  },

  // ── Growth: monetization ────────────────────────────────────────────────
  { id: "upsell", type: "choice", label: "Do you offer upsells (higher tiers, upgrades)?", options: yesSometimesNo },
  { id: "crossSell", type: "choice", label: "Do you cross-sell related products or services?", options: yesSometimesNo },
  {
    id: "bundles",
    type: "choice",
    label: "Bundles or packages",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "recurringRevenue",
    type: "choice",
    label: "Share of revenue that is recurring or contracted",
    options: [
      { value: "significant", label: "Over 30%" },
      { value: "some", label: "Some" },
      { value: "none", label: "None" },
    ],
  },
  {
    id: "pricingReview",
    type: "choice",
    label: "When did you last test or restructure pricing?",
    options: [
      { value: "recent", label: "In the last 6 months" },
      { value: "old", label: "Over a year ago" },
      { value: "never", label: "Never in a structured way" },
    ],
  },

  // ── Growth: scale ───────────────────────────────────────────────────────
  {
    id: "growthRate",
    type: "choice",
    label: "Revenue growth over the last 12 months",
    allowUnknown: true,
    options: [
      { value: "declining", label: "Declining" },
      { value: "0to10", label: "0–10%" },
      { value: "10to30", label: "10–30%" },
      { value: "30to60", label: "30–60%" },
      { value: "gt60", label: "60%+" },
    ],
  },
  {
    id: "cacTrend",
    type: "choice",
    label: "Acquisition cost is…",
    allowUnknown: true,
    options: [
      { value: "decreasing", label: "Decreasing" },
      { value: "stable", label: "Stable" },
      { value: "increasing", label: "Increasing" },
    ],
  },
  {
    id: "marginTrend",
    type: "choice",
    label: "Margins are…",
    allowUnknown: true,
    options: [
      { value: "improving", label: "Improving" },
      { value: "stable", label: "Stable" },
      { value: "declining", label: "Declining" },
    ],
  },
  {
    id: "analytics",
    type: "choice",
    label: "How much do you trust your growth data?",
    options: [
      { value: "reliable", label: "Reliable dashboards the team trusts" },
      { value: "partial", label: "Partial: numbers often disagree" },
      { value: "limited", label: "Limited or none" },
    ],
  },
  {
    id: "experimentation",
    type: "choice",
    label: "Does the team run structured growth experiments?",
    options: [
      { value: "structured", label: "Yes, on a regular cadence" },
      { value: "adhoc", label: "Ad hoc" },
      { value: "none", label: "No" },
    ],
  },
];

export const QUESTION_MAP: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export const STEPS: Step[] = [
  {
    id: "business",
    label: "Business",
    title: "Your business",
    intro: "A few basics so the diagnosis reflects your model and market.",
    screens: [
      ["businessModel", "industry", "primaryMarket"],
      ["businessAge", "monthlyRevenue", "monthlyCustomers"],
      ["icpClarity", "differentiation"],
    ],
  },
  {
    id: "economics",
    label: "Economics",
    title: "Unit economics",
    intro: "If you don't know a number, say so. We never ask you to guess.",
    screens: [
      ["aov", "grossMargin", "marketingSpend"],
      ["cac", "ltv", "payback"],
    ],
  },
  {
    id: "acquisition",
    label: "Acquisition",
    title: "How customers find you",
    intro: "Where demand comes from, and how concentrated it is.",
    screens: [
      ["monthlyTraffic", "monthlyLeads", "channels"],
      ["paidSpend", "topChannelShare", "acquisitionTrend"],
    ],
  },
  {
    id: "conversion",
    label: "Conversion",
    title: "Turning interest into revenue",
    intro: "Only the metrics that matter for your model.",
    screens: [
      [
        "conversionRate",
        "addToCartRate",
        "leadToQualified",
        "qualifiedToCustomer",
        "signupToActivation",
        "trialToPaid",
        "visitorToCustomer",
      ],
      ["checkoutCompletion", "cartAbandonment", "leadResponseTime"],
    ],
  },
  {
    id: "retention",
    label: "Retention",
    title: "Keeping customers",
    intro: "Retention is where acquisition spend compounds, or leaks.",
    screens: [
      ["repeatRate", "monthlyChurn", "purchaseFrequency", "crmUsage"],
      ["ownedChannels", "loyalty", "reactivation"],
    ],
  },
  {
    id: "growth",
    label: "Growth",
    title: "Monetization and scale",
    intro: "How much each customer is worth, and whether growth is getting healthier.",
    screens: [
      ["upsell", "crossSell", "bundles", "recurringRevenue", "pricingReview"],
      ["growthRate", "cacTrend", "marginTrend"],
      ["analytics", "experimentation"],
    ],
  },
];

export function isVisible(q: Question, answers: Answers): boolean {
  return q.showIf ? q.showIf(answers) : true;
}

export function visibleScreenQuestions(screen: string[], answers: Answers): Question[] {
  return screen.map((id) => QUESTION_MAP[id]).filter((q): q is Question => !!q && isVisible(q, answers));
}

/** Returns an error message, or null when the answer is acceptable. */
export function validateAnswer(q: Question, value: AnswerValue | undefined): string | null {
  const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty) return q.optional ? null : "Please answer, or choose “I don't know”.";
  if (value === UNKNOWN) return q.allowUnknown ? null : "Please choose an answer.";
  switch (q.type) {
    case "number":
    case "currency":
    case "percent": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number.";
      if (q.min !== undefined && value < q.min) return `Must be at least ${q.min}.`;
      if (q.max !== undefined && value > q.max) return `Must be at most ${q.max}.`;
      return null;
    }
    case "choice":
    case "select":
      return typeof value === "string" && q.options?.some((o) => o.value === value) ? null : "Choose an option.";
    case "multi":
      return Array.isArray(value) && value.every((v) => q.options?.some((o) => o.value === v))
        ? null
        : "Choose one or more options.";
  }
}

/**
 * Validates and normalises a full answer set (used server-side).
 * Drops unknown keys and answers to questions hidden for this business model.
 */
export function sanitizeAnswers(input: unknown): { answers: Answers; errors: Record<string, string> } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  // businessModel first: visibility of other questions depends on it.
  const ordered = [QUESTION_MAP.businessModel, ...QUESTIONS.filter((q) => q.id !== "businessModel")];
  for (const q of ordered) {
    if (!isVisible(q, answers)) continue;
    let v = raw[q.id] as AnswerValue | undefined;
    if (typeof v === "string" && v !== UNKNOWN && ["number", "currency", "percent"].includes(q.type)) {
      const n = Number(v);
      v = Number.isFinite(n) ? n : v;
    }
    const err = validateAnswer(q, v);
    if (err) errors[q.id] = err;
    else if (v !== undefined) answers[q.id] = v;
  }
  return { answers, errors };
}

export const CURRENCY_BY_MARKET: Record<string, string> = {
  SA: "SAR",
  AE: "AED",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  EG: "EGP",
  GCC: "USD",
  OTHER: "USD",
};

export function currencyFor(answers: Answers): string {
  return CURRENCY_BY_MARKET[String(answers.primaryMarket ?? "")] ?? "USD";
}
