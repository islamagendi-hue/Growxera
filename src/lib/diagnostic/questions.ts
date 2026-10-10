/**
 * Question bank for the Growth Diagnostic.
 *
 * Questions are data: the UI renders them generically, the validator checks
 * answers against them, and the scoring engine reads answers by id. To add a
 * question, define it here, place it on a screen in STEPS, and (optionally)
 * reference it from a signal in scoring.ts.
 *
 * Rules for questions:
 * - One question measures one metric. Never "customers or orders".
 * - Predefined answers have exactly five clear options (plus "I don't know"
 *   where a metric may be unknown). See questions.test.ts.
 * - Metrics carry an info note: what it is, why we ask, where to find it.
 */
import { CONTEXT_CHILDREN, CONTEXT_OPTIONS, currencyForGeography, revenueModelFor, type Choice } from "./context";
import { UNKNOWN, type Answers, type AnswerValue, type BusinessModel } from "./types";

export type QuestionType = "choice" | "select" | "multi" | "number" | "currency" | "percent";

export type Option = Choice;

/** The help note shown behind the (i) next to a question. */
export interface InfoNote {
  what: string;
  why: string;
  where?: string;
  example?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  /** One short line under the label. Longer explanations belong in `info`. */
  help?: string;
  info?: InfoNote;
  options?: Option[];
  /** Options that depend on earlier answers (the business-context dropdowns). */
  optionsFor?: (answers: Answers) => Option[];
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

/** The revenue model: derived from the business type, or a legacy `businessModel` answer. */
export function modelOf(a: Answers): BusinessModel | undefined {
  const derived = revenueModelFor(a);
  if (derived) return derived;
  const m = a.businessModel;
  return m === "ecommerce" || m === "leadgen" || m === "subscription" || m === "other" ? m : undefined;
}

const isModel =
  (...models: BusinessModel[]) =>
  (a: Answers) =>
    models.includes(modelOf(a) as BusinessModel);

export function optionsOf(q: Question, answers: Answers): Option[] {
  return q.optionsFor ? q.optionsFor(answers) : (q.options ?? []);
}

const hasOptions = (id: string) => (a: Answers) => CONTEXT_OPTIONS[id](a).length > 0;

const adoption = (automated: string, systematic: string): Option[] => [
  { value: "automated", label: automated },
  { value: "systematic", label: systematic },
  { value: "sometimes", label: "Sometimes, depending on who handles the sale" },
  { value: "rarely", label: "Rarely" },
  { value: "no", label: "Never" },
];

const trend = (up: string, down: string): Option[] => [
  { value: "down_fast", label: `${down} by more than 10%` },
  { value: "down", label: `${down} slightly (under 10%)` },
  { value: "stable", label: "Roughly stable" },
  { value: "up", label: `${up} slightly (under 10%)` },
  { value: "up_fast", label: `${up} by more than 10%` },
];

export const QUESTIONS: Question[] = [
  // ── Business context ────────────────────────────────────────────────────
  {
    id: "industry",
    type: "select",
    placeholder: "Select your industry…",
    label: "Industry",
    optionsFor: CONTEXT_OPTIONS.industry,
  },
  {
    id: "segment",
    type: "select",
    placeholder: "Select who you sell to…",
    label: "Business model",
    help: "Who you mainly sell to.",
    optionsFor: CONTEXT_OPTIONS.segment,
    showIf: hasOptions("segment"),
  },
  {
    id: "businessType",
    type: "select",
    placeholder: "Select your business type…",
    label: "Business type",
    help: "We adapt the questions that follow to this.",
    optionsFor: CONTEXT_OPTIONS.businessType,
    showIf: hasOptions("businessType"),
  },
  {
    id: "category",
    type: "select",
    placeholder: "Select your category…",
    label: "Category",
    optionsFor: CONTEXT_OPTIONS.category,
    showIf: hasOptions("category"),
  },
  {
    id: "geography",
    type: "select",
    placeholder: "Select your main market…",
    label: "Main market",
    help: "Where most of your customers are.",
    optionsFor: CONTEXT_OPTIONS.geography,
  },
  {
    id: "city",
    type: "select",
    placeholder: "Select your city…",
    label: "City",
    optionsFor: CONTEXT_OPTIONS.city,
    showIf: hasOptions("city"),
  },

  // ── Business basics ─────────────────────────────────────────────────────
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
    label: "What is your average monthly revenue?",
    help: "A recent typical month. Rough is fine.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "Total sales in a month, before costs. Include all channels (website, apps, marketplaces, stores).",
      why: "It sizes every opportunity in your report, so estimates are in your real currency and scale.",
      where: "Your accounting system, Shopify / Salla / Zid admin, POS or bank statements.",
      example: "Last three months were 420K, 510K and 480K → about 470,000.",
    },
  },
  {
    id: "monthlyNewCustomers",
    type: "number",
    label: "How many new customers do you acquire per month?",
    help: "First-time buyers or newly signed clients only.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "People or companies who paid you for the first time this month. Returning customers are not counted.",
      why: "Together with marketing spend it gives your real cost to acquire a customer.",
      where: "Shopify: Customers report (first-time). CRM: deals won. App: first purchases in your analytics.",
      example: "1,200 orders this month, of which 400 from first-time buyers → 400.",
    },
  },
  {
    id: "monthlyOrders",
    type: "number",
    label: "How many orders do you receive per month?",
    help: "All orders or paid transactions, new and returning customers.",
    allowUnknown: true,
    min: 0,
    showIf: isModel("ecommerce", "other"),
    info: {
      what: "The number of completed orders or paid transactions in a month.",
      why: "With revenue it gives your average order value, and with traffic your conversion rate.",
      where: "Your store admin (Orders), POS reports or booking system.",
    },
  },
  {
    id: "icpClarity",
    type: "choice",
    label: "How clearly is your ideal customer defined?",
    options: [
      { value: "documented", label: "One clear segment, written down and used by the whole team" },
      { value: "focused", label: "A few defined segments we prioritise" },
      { value: "general", label: "A general idea of who buys, not written down" },
      { value: "broad", label: "A broad audience with no real priority" },
      { value: "anyone", label: "Anyone who will buy" },
    ],
  },
  {
    id: "differentiation",
    type: "choice",
    label: "Why do customers mainly choose you over alternatives?",
    options: [
      { value: "moat", label: "An advantage competitors can't easily copy" },
      { value: "clear", label: "A clear advantage, but one competitors could copy" },
      { value: "service", label: "Service, convenience or availability" },
      { value: "price", label: "Price" },
      { value: "unclear", label: "Honestly, it's hard to tell us apart" },
    ],
  },

  // ── Economics ───────────────────────────────────────────────────────────
  {
    id: "aov",
    type: "currency",
    label: "What is your average order value?",
    allowUnknown: true,
    min: 0,
    showIf: isModel("ecommerce", "other"),
    info: {
      what: "Average revenue per order: monthly revenue ÷ number of orders.",
      why: "It shows how much each order is worth, and whether bundles and upsells are working.",
      where: "Shopify / Salla / Zid analytics (Average order value) or Google Analytics e-commerce reports.",
      example: "SAR 470,000 revenue ÷ 2,350 orders = SAR 200.",
    },
  },
  {
    id: "dealSize",
    type: "currency",
    label: "What is your average deal value?",
    help: "The value of a typical won deal or first contract.",
    allowUnknown: true,
    min: 0,
    showIf: isModel("leadgen"),
    info: {
      what: "Average revenue from one won customer or contract.",
      why: "It tells us how much you can afford to spend to win a customer.",
      where: "Your CRM (won deals) or invoices for the last quarter.",
    },
  },
  {
    id: "arpa",
    type: "currency",
    label: "What is your average monthly revenue per paying customer?",
    allowUnknown: true,
    min: 0,
    showIf: isModel("subscription"),
    info: {
      what: "Monthly recurring revenue ÷ number of paying customers (often called ARPA or ARPU).",
      why: "It drives lifetime value and how fast acquisition cost is paid back.",
      where: "Your billing system (Stripe, Chargebee, Paddle) or subscription reports.",
      example: "MRR of USD 60,000 across 400 customers = USD 150.",
    },
  },
  {
    id: "grossMargin",
    type: "percent",
    label: "What is your gross margin?",
    help: "Revenue minus direct costs, as a %.",
    allowUnknown: true,
    min: 0,
    max: 100,
    info: {
      what: "The share of revenue left after direct costs: product, delivery, fulfilment, payment fees.",
      why: "Margin decides how much you can spend on growth and still make money on each customer.",
      where: "Your profit & loss statement, or ask your accountant.",
      example: "Revenue 100, cost of goods and delivery 55 → margin 45%.",
    },
  },
  {
    id: "marketingSpend",
    type: "currency",
    label: "What is your total monthly marketing spend?",
    help: "Paid media, agencies, influencers and tools.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "Everything you spend each month to attract customers, including agency fees and influencers.",
      why: "Divided by new customers, it gives your true acquisition cost.",
      where: "Ad accounts (Meta, Google, TikTok, Snapchat) plus agency and influencer invoices.",
    },
  },
  {
    id: "cac",
    type: "currency",
    label: "What does it cost you to acquire one new customer (CAC)?",
    help: "Marketing and sales cost ÷ new customers.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "Customer acquisition cost: total marketing and sales spend ÷ new customers in the same period.",
      why: "Compared with order value and lifetime value, it shows whether growth is profitable.",
      where: "Calculate it from your spend and new customers, or check your marketing dashboard.",
      example: "SAR 80,000 spend ÷ 400 new customers = SAR 200.",
    },
  },
  {
    id: "ltv",
    type: "currency",
    label: "What is your customer lifetime value (LTV)?",
    help: "Total revenue an average customer brings over time.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "The revenue a typical customer brings over their whole relationship with you.",
      why: "LTV ÷ CAC is the clearest single check of whether acquisition pays off.",
      where: "Cohort reports in Shopify, your CRM or billing system. If unsure, choose “I don't know”.",
      example: "Average order SAR 200 × 3 orders over their lifetime = SAR 600.",
    },
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
    label: "How many visits does your website or app get per month?",
    help: "Sessions, not unique people.",
    allowUnknown: true,
    min: 0,
    info: {
      what: "Total visits (sessions) to your website or app in a month.",
      why: "Traffic and orders together show whether the problem is getting people in or converting them.",
      where: "Google Analytics 4 (Reports → Acquisition), Shopify analytics, or your app analytics.",
    },
  },
  {
    id: "monthlyLeads",
    type: "number",
    label: "How many new leads do you receive per month?",
    help: "Form fills, calls, WhatsApp enquiries or sign-ups.",
    allowUnknown: true,
    min: 0,
    showIf: isModel("leadgen", "subscription"),
    info: {
      what: "New enquiries or sign-ups from potential customers in a month.",
      why: "It separates a demand problem (too few leads) from a sales problem (too few closed).",
      where: "Your CRM, form tool, call tracking or WhatsApp Business labels.",
    },
  },
  {
    id: "channels",
    type: "multi",
    label: "Which channels bring you customers consistently today?",
    help: "Select all that apply.",
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
      { value: "marketplaces", label: "Marketplaces (Amazon, Noon…)" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "paidSpend",
    type: "currency",
    label: "How much of that is paid media spend per month?",
    allowUnknown: true,
    min: 0,
  },
  {
    id: "topChannelShare",
    type: "choice",
    label: "What share of new customers comes from your single biggest channel?",
    allowUnknown: true,
    options: [
      { value: "lt30", label: "Under 30%" },
      { value: "30to50", label: "30–50%" },
      { value: "50to70", label: "50–70%" },
      { value: "70to90", label: "70–90%" },
      { value: "gt90", label: "Over 90%" },
    ],
  },
  {
    id: "acquisitionTrend",
    type: "choice",
    label: "How has the number of new customers changed over the last 6 months?",
    allowUnknown: true,
    options: [
      { value: "up_fast", label: "Up by more than 20%" },
      { value: "up", label: "Up 5–20%" },
      { value: "flat", label: "Roughly flat (within 5%)" },
      { value: "down", label: "Down 5–20%" },
      { value: "down_fast", label: "Down by more than 20%" },
    ],
  },

  // ── Conversion (adaptive) ───────────────────────────────────────────────
  {
    id: "conversionRate",
    type: "percent",
    label: "What is your website conversion rate?",
    help: "Orders ÷ sessions.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
    info: {
      what: "The share of visits that end in an order.",
      why: "Conversion multiplies every visit you already pay for. It is often the cheapest lever to pull.",
      where: "Google Analytics 4 (Monetisation → E-commerce purchases) or Shopify / Salla analytics.",
      example: "2,500 orders from 250,000 sessions = 1%.",
    },
  },
  {
    id: "addToCartRate",
    type: "percent",
    label: "What is your add-to-cart rate?",
    help: "Sessions with an add to cart ÷ all sessions.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
    info: {
      what: "The share of visits where someone adds a product to the cart.",
      why: "A low rate points at product pages, pricing or offer; a high rate with low sales points at checkout.",
      where: "Shopify analytics (Online store conversion) or GA4 funnel exploration.",
    },
  },
  {
    id: "checkoutCompletion",
    type: "percent",
    label: "What share of people who start checkout complete it?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("ecommerce"),
    info: {
      what: "Completed orders ÷ checkouts started.",
      why: "Checkout drop-off is revenue you've already won and are losing at the last step.",
      where: "Shopify analytics (Reached checkout vs sessions converted) or GA4 checkout funnel.",
      example: "1,000 checkouts started, 550 completed = 55%.",
    },
  },
  {
    id: "leadToQualified",
    type: "percent",
    label: "What share of leads are qualified (a genuine fit)?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("leadgen"),
    info: {
      what: "Qualified leads ÷ all leads in the same period.",
      why: "A low rate means marketing is attracting the wrong people, which wastes sales time.",
      where: "Your CRM lead status, or a sample of last month's leads.",
    },
  },
  {
    id: "qualifiedToCustomer",
    type: "percent",
    label: "What share of qualified leads become customers?",
    help: "Your close rate.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("leadgen"),
    info: {
      what: "Won deals ÷ qualified leads.",
      why: "Close rate shows how well the sales process turns real demand into revenue.",
      where: "Your CRM pipeline report (won vs qualified).",
      example: "60 qualified leads, 12 won = 20%.",
    },
  },
  {
    id: "leadResponseTime",
    type: "choice",
    label: "How fast does a new lead usually get a first response?",
    allowUnknown: true,
    options: [
      { value: "lt5m", label: "Under 5 minutes" },
      { value: "lt1h", label: "Within the hour" },
      { value: "lt4h", label: "Within 4 hours" },
      { value: "sameday", label: "Same day" },
      { value: "gt1d", label: "Next day or later" },
    ],
    showIf: isModel("leadgen"),
  },
  {
    id: "signupToActivation",
    type: "percent",
    label: "What share of new sign-ups reach first real value (activation)?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
    info: {
      what: "Sign-ups who complete the key action that shows value (first project, first booking, first report).",
      why: "Users who never activate never pay. It is usually the biggest leak in subscription funnels.",
      where: "Product analytics (Mixpanel, Amplitude, PostHog) or your database.",
    },
  },
  {
    id: "trialToPaid",
    type: "percent",
    label: "What share of trial or free users become paying customers?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
    info: {
      what: "Paying customers ÷ trial (or free) users who started in the same period.",
      why: "It is the conversion step that turns usage into revenue.",
      where: "Billing system (Stripe, Chargebee) or product analytics.",
    },
  },
  {
    id: "visitorToCustomer",
    type: "percent",
    label: "What share of visitors or enquiries become paying customers?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("other"),
    info: {
      what: "New paying customers ÷ visitors or enquiries in the same period.",
      why: "It shows how much of the demand you attract turns into revenue.",
      where: "Booking system, POS or app analytics.",
    },
  },

  // ── Retention ───────────────────────────────────────────────────────────
  {
    id: "repeatRate",
    type: "percent",
    label: "What share of customers buy again within 12 months?",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: (a) => !isModel("subscription")(a),
    info: {
      what: "Customers with two or more orders in 12 months ÷ all customers in those 12 months.",
      why: "Repeat customers make acquisition spend compound instead of leak.",
      where: "Shopify (Returning customer rate), Salla / Zid customer reports, or your CRM.",
      example: "10,000 customers last year, 2,200 bought again = 22%.",
    },
  },
  {
    id: "monthlyChurn",
    type: "percent",
    label: "What share of paying customers cancel each month?",
    help: "Monthly customer churn.",
    allowUnknown: true,
    min: 0,
    max: 100,
    showIf: isModel("subscription"),
    info: {
      what: "Customers who cancelled this month ÷ paying customers at the start of the month.",
      why: "Churn caps how big the business can get: above a point, new sales only replace lost ones.",
      where: "Billing system (Stripe, Chargebee, Paddle) churn reports.",
      example: "400 customers on 1 March, 20 cancelled in March = 5%.",
    },
  },
  {
    id: "purchaseFrequency",
    type: "choice",
    label: "How many times does a typical customer buy from you per year?",
    allowUnknown: true,
    options: [
      { value: "1", label: "Once" },
      { value: "2", label: "Twice" },
      { value: "3to4", label: "3–4 times" },
      { value: "5to8", label: "5–8 times" },
      { value: "9plus", label: "9 or more times" },
    ],
    showIf: (a) => !isModel("subscription")(a),
  },
  {
    id: "crmUsage",
    type: "choice",
    label: "How do you use a CRM or customer database today?",
    options: [
      { value: "advanced", label: "Segmented, automated journeys across the customer lifecycle" },
      { value: "campaigns", label: "Regular segmented campaigns, few automations" },
      { value: "basic", label: "Occasional broadcasts to everyone" },
      { value: "storage", label: "Only to store contacts" },
      { value: "none", label: "No CRM or customer database" },
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
    label: "Do you run a loyalty or membership programme?",
    options: [
      { value: "measured", label: "Yes, and we measure its effect on repeat purchases" },
      { value: "active", label: "Yes, but we don't measure its effect" },
      { value: "informal", label: "Informal perks or discounts for regulars" },
      { value: "planned", label: "Planned, not launched" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "reactivation",
    type: "choice",
    label: "Do you run win-back campaigns for customers who stopped buying?",
    options: [
      { value: "automated", label: "Yes, automated" },
      { value: "regular", label: "Yes, regular manual campaigns" },
      { value: "occasional", label: "Occasionally" },
      { value: "rare", label: "Tried once or twice" },
      { value: "none", label: "Never" },
    ],
  },

  // ── Growth: monetization ────────────────────────────────────────────────
  {
    id: "upsell",
    type: "choice",
    label: "How often do you offer upsells (higher tiers, upgrades, add-ons)?",
    options: adoption("Built into the journey and automated", "Offered systematically by the team"),
  },
  {
    id: "crossSell",
    type: "choice",
    label: "How often do you cross-sell related products or services?",
    options: adoption("Built into the journey and automated", "Offered systematically by the team"),
  },
  {
    id: "bundles",
    type: "choice",
    label: "How much do bundles or packages contribute to sales?",
    options: [
      { value: "core", label: "A large share of revenue" },
      { value: "several", label: "Several bundles on offer" },
      { value: "one", label: "One or two bundles" },
      { value: "planned", label: "Planned, not launched" },
      { value: "no", label: "No bundles" },
    ],
  },
  {
    id: "recurringRevenue",
    type: "choice",
    label: "What share of revenue is recurring or contracted?",
    options: [
      { value: "gt50", label: "Over 50%" },
      { value: "30to50", label: "30–50%" },
      { value: "10to30", label: "10–30%" },
      { value: "lt10", label: "Under 10%" },
      { value: "none", label: "None" },
    ],
    showIf: (a) => !isModel("subscription")(a),
  },
  {
    id: "pricingReview",
    type: "choice",
    label: "When did you last test or restructure your pricing?",
    options: [
      { value: "lt3m", label: "In the last 3 months" },
      { value: "3to6m", label: "3–6 months ago" },
      { value: "6to12m", label: "6–12 months ago" },
      { value: "gt12m", label: "Over a year ago" },
      { value: "never", label: "Never in a structured way" },
    ],
  },

  // ── Growth: scale ───────────────────────────────────────────────────────
  {
    id: "growthRate",
    type: "choice",
    label: "How much did revenue grow over the last 12 months?",
    allowUnknown: true,
    options: [
      { value: "declining", label: "It declined" },
      { value: "0to10", label: "0–10%" },
      { value: "10to30", label: "10–30%" },
      { value: "30to60", label: "30–60%" },
      { value: "gt60", label: "Over 60%" },
    ],
  },
  {
    id: "cacTrend",
    type: "choice",
    label: "How has your cost to acquire a customer changed over the last 6 months?",
    allowUnknown: true,
    options: trend("Rising", "Falling"),
  },
  {
    id: "marginTrend",
    type: "choice",
    label: "How has your gross margin changed over the last 12 months?",
    allowUnknown: true,
    options: trend("Improved", "Declined"),
  },
  {
    id: "analytics",
    type: "choice",
    label: "How much do you trust your growth data?",
    options: [
      { value: "reliable", label: "One trusted dashboard the team uses every week" },
      { value: "scattered", label: "Reliable, but scattered across tools" },
      { value: "partial", label: "Numbers often disagree between tools" },
      { value: "manual", label: "Spreadsheets updated by hand" },
      { value: "limited", label: "Little or no tracking" },
    ],
  },
  {
    id: "experimentation",
    type: "choice",
    label: "How often does the team run structured growth experiments?",
    options: [
      { value: "weekly", label: "Every week, with a backlog and documented results" },
      { value: "monthly", label: "A few tests a month" },
      { value: "adhoc", label: "Occasionally, ad hoc" },
      { value: "rare", label: "Once or twice a year" },
      { value: "none", label: "Never" },
    ],
  },
];

export const QUESTION_MAP: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/** Fields that get cleared when their parent context field changes. */
export const DEPENDENT_FIELDS = CONTEXT_CHILDREN;
const AUTO_FILL_ORDER = ["segment", "businessType", "category", "city"];

export const STEPS: Step[] = [
  {
    id: "business",
    label: "Business",
    title: "Your business",
    intro: "Your context sets the right questions, benchmarks and recommendations.",
    screens: [
      // Light screens first: most drop-off was on a single six-question opening screen.
      ["industry", "segment"],
      ["businessType", "category"],
      ["geography", "city"],
      ["businessAge", "monthlyRevenue", "monthlyNewCustomers", "monthlyOrders"],
      ["icpClarity", "differentiation"],
    ],
  },
  {
    id: "economics",
    label: "Economics",
    title: "Unit economics",
    intro: "If you don't know a number, say so. We never ask you to guess.",
    screens: [
      ["aov", "dealSize", "arpa", "grossMargin", "marketingSpend"],
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
      ["checkoutCompletion", "leadResponseTime"],
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
export function validateAnswer(q: Question, value: AnswerValue | undefined, answers: Answers = {}): string | null {
  const empty = value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty) return q.optional ? null : q.type === "select" ? "Please choose an option." : "Please answer, or choose “I don't know”.";
  if (value === UNKNOWN) return q.allowUnknown ? null : "Please choose an answer.";
  const options = optionsOf(q, answers);
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
      return typeof value === "string" && options.some((o) => o.value === value) ? null : "Choose an option.";
    case "multi":
      return Array.isArray(value) && value.every((v) => options.some((o) => o.value === v)) ? null : "Choose one or more options.";
  }
}

/**
 * Validates and normalises a full answer set (used server-side).
 * Drops unknown keys and answers to questions hidden for this business, and
 * derives `businessModel` (the revenue model) from the business type.
 */
export function sanitizeAnswers(input: unknown): { answers: Answers; errors: Record<string, string> } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  // QUESTIONS is ordered so every parent comes before the questions that depend on it.
  for (const q of QUESTIONS) {
    if (!isVisible(q, answers)) continue;
    let v = raw[q.id] as AnswerValue | undefined;
    if (typeof v === "string" && v !== UNKNOWN && ["number", "currency", "percent"].includes(q.type)) {
      const n = Number(v);
      v = Number.isFinite(n) ? n : v;
    }
    const err = validateAnswer(q, v, answers);
    if (err) errors[q.id] = err;
    else if (v !== undefined) answers[q.id] = v;
    if (q.id === "businessType" && !err) {
      const m = revenueModelFor(answers);
      if (m) answers.businessModel = m;
    }
  }
  return { answers, errors };
}

/** Legacy market codes (answers stored before the context taxonomy) still resolve. */
const LEGACY_CURRENCY: Record<string, string> = { SA: "SAR", AE: "AED", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", EG: "EGP" };

export function currencyFor(answers: Answers): string {
  const geo = typeof answers.geography === "string" ? answers.geography : undefined;
  return currencyForGeography(geo) ?? LEGACY_CURRENCY[String(answers.primaryMarket ?? "")] ?? "USD";
}

/** Options for a field, with the first-level children reset when it changes. */
export function applyAnswer(answers: Answers, id: string, v: AnswerValue | undefined): Answers {
  const next = { ...answers };
  if (v === undefined) delete next[id];
  else next[id] = v;
  if (answers[id] !== v) {
    for (const child of DEPENDENT_FIELDS[id] ?? []) delete next[child];
    // A level with only one possible answer is filled in, so nobody picks from a list of one.
    for (const child of AUTO_FILL_ORDER) {
      if (!(DEPENDENT_FIELDS[id] ?? []).includes(child) || next[child] !== undefined) continue;
      const opts = CONTEXT_OPTIONS[child](next);
      if (opts.length !== 1) break;
      next[child] = opts[0].value;
    }
  }
  const m = revenueModelFor(next);
  if (m) next.businessModel = m;
  return next;
}
