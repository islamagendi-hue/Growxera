/**
 * Recommendation engine.
 *
 * Each rule in RULES looks at the answers, the benchmark results and the
 * dimension scores, and fires only when there is a real gap. Rules can be
 * limited to revenue models, industries, business types or categories, and
 * their text uses the business's own numbers. The engine then ranks every
 * fired rule by Impact + Gap + Relevance and keeps the top MAX_RECOMMENDATIONS.
 *
 * To add a recommendation: add a rule. Nothing else needs to change.
 */
import { gapOf, type BenchmarkResult } from "./benchmarks";
import { contextOf, typeNode } from "./context";
import { choice, getModel, list, num } from "./scoring";
import { UNKNOWN, type Answers, type BusinessModel, type Dimension, type DimensionScore, type Level } from "./types";

export const MAX_RECOMMENDATIONS = 10;

/** Ranking weights. Must sum to 1. */
export const RANK_WEIGHTS = { impact: 0.4, gap: 0.35, relevance: 0.25 };

export interface Recommendation {
  id: string;
  dimension: Dimension;
  title: string;
  body: string;
  /** Why this was recommended, from the business's own answers and benchmarks. */
  evidence: string[];
  impact: Level;
  effort: Level;
  /** 0–1 components and the final score, kept for transparency and tests. */
  gap: number;
  relevance: number;
  score: number;
  caseStudy?: string;
  /** A deeper resource on the site, e.g. the Experimentation Lab. */
  link?: { href: string; label: string };
}

interface Input {
  a: Answers;
  model: BusinessModel;
  bench: Record<string, BenchmarkResult>;
  dims: Record<Dimension, DimensionScore>;
  ctx: ReturnType<typeof contextOf>;
  typeLabel?: string;
  categoryLabel?: string;
}

interface Fired {
  gap: number;
  evidence: string[];
  body?: string;
}

interface Rule {
  id: string;
  dimension: Dimension;
  title: string | ((i: Input) => string);
  body: string | ((i: Input) => string);
  /** 1 (useful) – 3 (high revenue leverage). */
  impact: 1 | 2 | 3;
  effort: Level;
  models?: BusinessModel[];
  industries?: string[];
  types?: string[];
  categories?: string[];
  caseStudy?: string;
  link?: Recommendation["link"];
  when: (i: Input) => Fired | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const is = (i: Input, id: string, ...values: string[]) => {
  const v = choice(i.a, id);
  return v !== undefined && values.includes(v);
};
const unknown = (i: Input, id: string) => i.a[id] === UNKNOWN;

/** Gap from a benchmark that is worse than its range. */
function benchGap(i: Input, metric: string, minGap = 0.3): Fired | null {
  const b = i.bench[metric];
  if (!b || b.position !== "worse") return null;
  return { gap: Math.max(minGap, gapOf(b)), evidence: [b.explanation] };
}

/** Gap from a categorical answer's score (0–100) in LOOKUPS. */
function answerGap(i: Input, id: string, label: string, threshold = 60): Fired | null {
  const signal = Object.values(i.dims)
    .flatMap((d) => d.signals)
    .find((s) => s.id === id);
  if (!signal || signal.score >= threshold) return null;
  return { gap: (100 - signal.score) / 100, evidence: [`${label}: ${signal.display}`] };
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

// ── Rules ───────────────────────────────────────────────────────────────────

export const RULES: Rule[] = [
  // Market & value
  {
    id: "icp",
    dimension: "market",
    title: "Define and document your ideal customer",
    body: (i) =>
      `Pick the one segment of ${i.categoryLabel ? i.categoryLabel.toLowerCase() + " " : ""}customers that buys most often at the best margin, write down who they are and why they buy, and point every channel, offer and message at them first.`,
    impact: 2,
    effort: "low",
    when: (i) => answerGap(i, "icpClarity", "Ideal customer", 60),
  },
  {
    id: "differentiation",
    dimension: "value",
    title: "Give customers a reason to choose you beyond price",
    body: "List the three reasons your best customers stay, test them as headline messages, and build the strongest into the offer (guarantee, speed, expertise, bundle) so you stop competing on discount.",
    impact: 2,
    effort: "medium",
    when: (i) => (is(i, "differentiation", "price", "unclear") ? { gap: is(i, "differentiation", "unclear") ? 0.85 : 0.7, evidence: ["Customers mainly choose you on price, or can't tell you apart"] } : null),
  },
  {
    id: "margin",
    dimension: "value",
    title: "Protect gross margin before scaling spend",
    body: (i) =>
      i.model === "ecommerce"
        ? "Review your lowest-margin best sellers, renegotiate supplier and delivery costs, and steer promotion toward higher-margin products and bundles instead of storewide discounts."
        : "Find the services or clients with the thinnest margin, reprice or repackage them, and stop discounting the work that customers value most.",
    impact: 3,
    effort: "medium",
    when: (i) => benchGap(i, "grossMargin"),
  },
  {
    id: "pricing",
    dimension: "expansion",
    title: "Run a structured pricing test",
    body: "Test one price change on one product line or plan for four weeks against a control, measuring conversion and margin together. Most businesses that haven't tested in a year are under-priced somewhere.",
    impact: 2,
    effort: "low",
    when: (i) => answerGap(i, "pricingReview", "Last pricing review", 50),
  },

  // Acquisition
  {
    id: "channel_concentration",
    dimension: "acquisition",
    title: "Reduce dependence on a single channel",
    body: "Keep the main channel, but set aside 15–20% of budget to test one new channel at a time with a clear CAC target, so a single algorithm change can't stall growth.",
    impact: 2,
    effort: "medium",
    when: (i) => {
      const n = list(i.a, "channels")?.length ?? 0;
      if (is(i, "topChannelShare", "70to90", "gt90")) return { gap: is(i, "topChannelShare", "gt90") ? 0.85 : 0.65, evidence: [`Biggest channel brings ${choice(i.a, "topChannelShare") === "gt90" ? "over 90%" : "70–90%"} of new customers`] };
      if (n === 1) return { gap: 0.7, evidence: ["Only one channel brings customers consistently"] };
      return null;
    },
  },
  {
    id: "ltv_cac",
    dimension: "acquisition",
    title: "Fix the unit economics of acquisition",
    body: (i) =>
      `Your lifetime value covers acquisition cost ${i.bench.ltvToCac ? `${i.bench.ltvToCac.value}x` : "too few times"}. Lift value per customer (repeat, upsell, bundles) and cut wasted spend (audiences and creatives with the worst CAC) until it is back above 3x.`,
    impact: 3,
    effort: "medium",
    when: (i) => benchGap(i, "ltvToCac", 0.5),
  },
  {
    id: "measure_cac",
    dimension: "acquisition",
    title: "Measure acquisition cost per channel",
    body: "Track new customers and spend by channel every week. Without CAC per channel you can't tell which spend to scale and which to cut.",
    impact: 2,
    effort: "low",
    when: (i) => (unknown(i, "cac") && num(i.a, "monthlyNewCustomers") === undefined ? { gap: 0.6, evidence: ["Acquisition cost and new customers per month are both unknown"] } : null),
  },
  {
    id: "cac_rising",
    dimension: "acquisition",
    title: "Refresh creative and audiences to bring CAC down",
    body: "Rising acquisition cost usually means creative fatigue or audiences that are saturated. Ship new creative angles every two weeks, test new audiences against your best customers, and cut the worst 20% of spend.",
    impact: 2,
    effort: "medium",
    caseStudy: "car-wash-app-0-to-100k-users",
    when: (i) => (is(i, "cacTrend", "up", "up_fast") ? { gap: is(i, "cacTrend", "up_fast") ? 0.8 : 0.55, evidence: ["Acquisition cost has been rising over the last 6 months"] } : null),
  },
  {
    id: "top_of_funnel",
    dimension: "acquisition",
    title: "Rebuild the top of the funnel",
    body: "New customer volume is falling. Check which channel dropped first, restore what changed (budget, creative, ranking, partner), and add one new source of demand before optimising further down the funnel.",
    impact: 3,
    effort: "medium",
    when: (i) => (is(i, "acquisitionTrend", "down", "down_fast") ? { gap: is(i, "acquisitionTrend", "down_fast") ? 0.9 : 0.65, evidence: ["New customers declined over the last 6 months"] } : null),
  },
  {
    id: "referral",
    dimension: "acquisition",
    title: "Launch a referral loop",
    body: "Give happy customers a simple reason and reward to bring someone like them, triggered right after a good experience. Referred customers usually cost less and stay longer.",
    impact: 2,
    effort: "medium",
    types: ["on_demand", "services_marketplace", "car_services", "salon", "clinic", "transactional_app", "consumer_subscription", "fitness"],
    caseStudy: "car-wash-app-0-to-100k-users",
    when: (i) => {
      if (list(i.a, "channels")?.includes("referral")) return null;
      const retention = i.dims.retention;
      return retention.hasData && retention.score >= 45 ? { gap: 0.5, evidence: ["Referral isn't one of your consistent channels yet"] } : null;
    },
  },
  {
    id: "marketplaces",
    dimension: "acquisition",
    title: "Open marketplaces as a new sales channel",
    body: (i) =>
      `Shoppers already search for ${i.categoryLabel ? i.categoryLabel.toLowerCase() : "your products"} on Amazon and Noon. Start with your best sellers, price for marketplace fees, and use it to reach demand your own store doesn't.`,
    impact: 2,
    effort: "medium",
    models: ["ecommerce"],
    caseStudy: "perfume-store-100k-to-700k-monthly",
    when: (i) => {
      if (i.ctx.segment === "marketplace" || list(i.a, "channels")?.includes("marketplaces")) return null;
      const n = list(i.a, "channels")?.length ?? 0;
      return n <= 3 ? { gap: 0.5, evidence: ["You don't sell on marketplaces yet"] } : null;
    },
  },
  {
    id: "organic",
    dimension: "acquisition",
    title: "Build an organic search channel",
    body: "Target the 20 searches your best customers make before buying, with one page each. Organic demand compounds and lowers blended CAC as paid costs rise.",
    impact: 1,
    effort: "high",
    when: (i) => {
      const channels = list(i.a, "channels");
      return channels && !channels.includes("organic") ? { gap: 0.45, evidence: ["Organic search isn't bringing customers consistently"] } : null;
    },
  },

  // Activation
  {
    id: "ecom_conversion",
    dimension: "activation",
    title: (i) => `Lift conversion from ${i.bench.conversionRate ? pct(i.bench.conversionRate.value) : "today's rate"}`,
    body: (i) => {
      const extra: Record<string, string> = {
        perfume: " For fragrance, add scent notes, 'smells like' comparisons and samples or a discovery set to lower the risk of buying blind.",
        beauty: " Show shade finders, before/after content and reviews with photos.",
        fashion: " Add size guidance, fit notes, model measurements and easy returns.",
        electronics: " Make specs, warranty and delivery date clear, and offer instalments.",
        home: " Use room photos, dimensions and delivery/assembly details.",
      };
      return `Start with the pages that get the most traffic: clearer offer above the fold, trust signals (reviews, delivery time, returns), and local payment options such as Apple Pay, Tabby or Tamara.${extra[i.ctx.category ?? ""] ?? ""}`;
    },
    impact: 3,
    effort: "medium",
    models: ["ecommerce"],
    caseStudy: "edtech-full-funnel-growth",
    when: (i) => benchGap(i, "conversionRate"),
  },
  {
    id: "checkout",
    dimension: "activation",
    title: "Fix checkout drop-off",
    body: "Cut checkout to the fewest fields, allow guest checkout, show delivery cost early, and add the payment methods your market prefers (Apple Pay, mada, Tabby/Tamara, cash on delivery where it applies). Recover abandoned checkouts by WhatsApp within the hour.",
    impact: 3,
    effort: "low",
    models: ["ecommerce"],
    when: (i) => benchGap(i, "checkoutCompletion"),
  },
  {
    id: "add_to_cart",
    dimension: "activation",
    title: "Strengthen product pages",
    body: "Few visitors add to cart, so the product page isn't convincing. Improve photos and video, put price, delivery and returns next to the button, and test one stronger offer per category.",
    impact: 2,
    effort: "medium",
    models: ["ecommerce"],
    when: (i) => benchGap(i, "addToCartRate"),
  },
  {
    id: "lead_speed",
    dimension: "activation",
    title: "Respond to every new lead within 5 minutes",
    body: "Route new enquiries instantly to whoever is free, with an automatic WhatsApp or email acknowledgement. Response speed is one of the cheapest ways to lift close rate.",
    impact: 3,
    effort: "low",
    models: ["leadgen"],
    when: (i) => answerGap(i, "leadResponseTime", "Lead response time", 70),
  },
  {
    id: "lead_quality",
    dimension: "activation",
    title: "Tighten targeting and lead qualification",
    body: "Too many leads aren't a fit. Add one or two qualifying questions to forms, exclude poor-fit audiences in ads, and feed won and lost deals back into targeting.",
    impact: 2,
    effort: "medium",
    models: ["leadgen"],
    when: (i) => benchGap(i, "leadToQualified"),
  },
  {
    id: "close_rate",
    dimension: "activation",
    title: "Upgrade the sales process to close more qualified leads",
    body: "Map the steps from first call to signed deal, find where qualified leads stall, and fix the biggest one: a clearer proposal, faster follow-up, a demo that shows value, or a lower-risk first package.",
    impact: 3,
    effort: "medium",
    models: ["leadgen"],
    when: (i) => benchGap(i, "qualifiedToCustomer"),
  },
  {
    id: "activation",
    dimension: "activation",
    title: "Redesign onboarding around the first moment of value",
    body: "Define the one action that predicts a user will stay, then remove every step between sign-up and that action. Test onboarding changes weekly against activation rate.",
    impact: 3,
    effort: "medium",
    models: ["subscription"],
    caseStudy: "car-wash-app-0-to-100k-users",
    when: (i) => benchGap(i, "signupToActivation"),
  },
  {
    id: "trial_paid",
    dimension: "activation",
    title: "Convert more trial users into paying customers",
    body: "Trigger the upgrade prompt when a user has just experienced value, not when the trial ends. Add a short sequence that shows what they'll lose, and test annual-plan incentives.",
    impact: 3,
    effort: "medium",
    models: ["subscription"],
    when: (i) => benchGap(i, "trialToPaid"),
  },
  {
    id: "visitor_conversion",
    dimension: "activation",
    title: "Turn more visitors and enquiries into bookings",
    body: "Make booking possible in one step from every page and ad, confirm instantly on WhatsApp, and follow up within the hour with anyone who started but didn't book.",
    impact: 3,
    effort: "low",
    models: ["other"],
    when: (i) => benchGap(i, "visitorToCustomer"),
  },

  // Retention
  {
    id: "repeat_lifecycle",
    dimension: "retention",
    title: "Build post-purchase journeys that bring customers back",
    body: (i) =>
      `Your repeat rate${i.bench.repeatRate ? ` (${pct(i.bench.repeatRate.value)})` : ""} has room to grow. Send a thank-you, a how-to-use message, and a timed reminder when a typical customer would buy again, by WhatsApp or email, segmented by what they bought.`,
    impact: 3,
    effort: "medium",
    caseStudy: "multi-branch-lifecycle-crm",
    when: (i) => benchGap(i, "repeatRate"),
  },
  {
    id: "churn",
    dimension: "retention",
    title: (i) => `Bring monthly churn down from ${i.bench.monthlyChurn ? pct(i.bench.monthlyChurn.value) : "today's level"}`,
    body: "Interview the last ten customers who cancelled, flag accounts whose usage is dropping, and reach them before renewal. Offer pause and downgrade options instead of only cancel.",
    impact: 3,
    effort: "medium",
    models: ["subscription"],
    caseStudy: "multi-branch-lifecycle-crm",
    when: (i) => benchGap(i, "monthlyChurn", 0.4),
  },
  {
    id: "crm",
    dimension: "retention",
    title: "Use your customer data for segmented, automated messages",
    body: "Start with three segments (new, regular, lapsed) and one automated journey for each. That alone usually lifts repeat purchases without extra ad spend.",
    impact: 2,
    effort: "medium",
    caseStudy: "multi-branch-lifecycle-crm",
    when: (i) => answerGap(i, "crmUsage", "CRM use", 60),
  },
  {
    id: "owned_channels",
    dimension: "retention",
    title: "Own a direct channel to your customers",
    body: "Collect WhatsApp opt-in and email at purchase, so you can reach customers again without paying for the same attention twice.",
    impact: 2,
    effort: "low",
    when: (i) => {
      const v = list(i.a, "ownedChannels");
      if (!v) return null;
      const n = v.filter((c) => c !== "none").length;
      return n <= 1 ? { gap: n === 0 ? 0.85 : 0.5, evidence: [n === 0 ? "No direct channel to existing customers" : "Only one direct channel to existing customers"] } : null;
    },
  },
  {
    id: "winback",
    dimension: "retention",
    title: "Launch an automated win-back journey",
    body: "Identify customers who haven't bought in 1.5× their usual cycle and send a personal reason to return. It's the cheapest revenue most businesses leave on the table.",
    impact: 2,
    effort: "low",
    caseStudy: "multi-branch-lifecycle-crm",
    when: (i) => answerGap(i, "reactivation", "Win-back campaigns", 60),
  },
  {
    id: "loyalty",
    dimension: "retention",
    title: "Reward your regulars with a simple loyalty programme",
    body: "Reward the behaviour you want (the next visit or order), keep the rules simple, and measure repeat rate of members against non-members from day one.",
    impact: 1,
    effort: "medium",
    types: ["salon", "restaurant", "car_services", "clinic", "online_retail", "d2c_brand", "omnichannel", "on_demand", "pharmacy"],
    when: (i) => (is(i, "loyalty", "planned", "no") && !is(i, "purchaseFrequency", "1") ? { gap: 0.5, evidence: ["No loyalty programme yet"] } : null),
  },

  // Expansion
  {
    id: "upsell",
    dimension: "expansion",
    title: "Offer upsells at the moment of purchase",
    body: "Add one relevant upgrade or add-on at checkout or proposal stage, and train the team to offer it every time. Measure attach rate weekly.",
    impact: 2,
    effort: "low",
    when: (i) => answerGap(i, "upsell", "Upsells", 60),
  },
  {
    id: "cross_sell",
    dimension: "expansion",
    title: "Cross-sell what customers usually buy next",
    body: "Look at the most common second purchase and recommend it after the first one, in the order confirmation and follow-up messages.",
    impact: 2,
    effort: "low",
    when: (i) => answerGap(i, "crossSell", "Cross-sells", 60),
  },
  {
    id: "bundles",
    dimension: "expansion",
    title: (i) => (i.ctx.category === "perfume" ? "Use bundles, samples and discovery sets" : "Create bundles that raise order value"),
    body: (i) =>
      i.ctx.category === "perfume"
        ? "Discovery sets and samples let customers try before committing to a full bottle, and bundles (perfume + body mist + oud) raise order value without discounting."
        : "Package the products or services customers often buy together at a slightly better price than buying them separately. Bundles lift order value without cutting margin on the core product.",
    impact: 2,
    effort: "low",
    caseStudy: "perfume-store-100k-to-700k-monthly",
    when: (i) => answerGap(i, "bundles", "Bundles", 65),
  },
  {
    id: "recurring",
    dimension: "expansion",
    title: "Add a subscription or replenishment offer",
    body: "For products customers re-buy on a cycle, offer subscribe-and-save or a membership. Predictable revenue also makes acquisition spend easier to justify.",
    impact: 2,
    effort: "medium",
    categories: ["grocery", "health", "pets", "beauty", "perfume", "coffee", "healthy", "supplements", "maintenance", "detailing"],
    when: (i) => (is(i, "recurringRevenue", "none", "lt10") ? { gap: 0.6, evidence: ["Little or no recurring revenue"] } : null),
  },

  // Scale
  {
    id: "analytics",
    dimension: "scale",
    title: "Fix tracking and build one dashboard the team trusts",
    body: "Map the key events from first visit to repeat purchase, fix attribution, and review one weekly dashboard with the same numbers for everyone. Every other recommendation depends on this.",
    impact: 3,
    effort: "medium",
    caseStudy: "car-wash-app-0-to-100k-users",
    when: (i) => answerGap(i, "analytics", "Data reliability", 60),
  },
  {
    id: "experimentation",
    dimension: "scale",
    title: "Start a weekly experimentation cadence",
    body: "Keep a backlog of growth ideas scored by impact, confidence and ease, ship two or three tests a week, and write down what you learn.",
    impact: 2,
    effort: "medium",
    caseStudy: "car-wash-app-0-to-100k-users",
    link: { href: "/experimentation-lab", label: "Browse experiment ideas for your model" },
    when: (i) => answerGap(i, "experimentation", "Experimentation", 60),
  },
  {
    id: "margin_trend",
    dimension: "scale",
    title: "Find out why margins are falling",
    body: "Break margin down by product, channel and customer type for the last 12 months. Falling margin usually comes from discount creep, rising delivery costs or a shift toward low-margin products.",
    impact: 2,
    effort: "low",
    when: (i) => (is(i, "marginTrend", "down", "down_fast") ? { gap: is(i, "marginTrend", "down_fast") ? 0.85 : 0.6, evidence: ["Gross margin declined over the last 12 months"] } : null),
  },
  {
    id: "decline",
    dimension: "scale",
    title: "Diagnose the revenue decline before adding spend",
    body: "Split revenue into new versus returning customers and orders versus order value to see which part fell. Fix that part first; more spend into a leaking system makes it more expensive.",
    impact: 3,
    effort: "low",
    when: (i) => (is(i, "growthRate", "declining") ? { gap: 0.9, evidence: ["Revenue declined over the last 12 months"] } : null),
  },
  {
    id: "core_metrics",
    dimension: "scale",
    title: "Start measuring the core growth metrics",
    body: "Set up a monthly view of revenue, new customers, acquisition cost, margin and repeat rate. You'll get a sharper diagnosis next time, and better decisions every month.",
    impact: 2,
    effort: "low",
    when: (i) => {
      const s = i.dims.scale.signals.find((x) => x.id === "metricsKnown");
      return s && s.score < 50 ? { gap: (100 - s.score) / 100, evidence: [`Core metrics known: ${s.display}`] } : null;
    },
  },
];

// ── Engine ──────────────────────────────────────────────────────────────────

const LEVELS: Level[] = ["low", "medium", "high"];

function relevance(rule: Rule, i: Input): number | null {
  if (rule.models && !rule.models.includes(i.model)) return null;
  if (rule.industries && !rule.industries.includes(i.ctx.industry ?? "")) return null;
  if (rule.types && !rule.types.includes(i.ctx.businessType ?? "")) return null;
  if (rule.categories && !rule.categories.includes(i.ctx.category ?? "")) return null;
  if (rule.categories) return 1;
  if (rule.types || rule.industries) return 0.9;
  if (rule.models) return 0.8;
  return 0.65;
}

export function buildRecommendations(
  answers: Answers,
  dimensions: DimensionScore[],
  benchmarks: BenchmarkResult[],
  bottleneck: Dimension,
  max = MAX_RECOMMENDATIONS,
): Recommendation[] {
  const type = typeNode(answers);
  const ctx = contextOf(answers);
  const input: Input = {
    a: answers,
    model: getModel(answers),
    bench: Object.fromEntries(benchmarks.map((b) => [b.metric, b])),
    dims: Object.fromEntries(dimensions.map((d) => [d.dimension, d])) as Record<Dimension, DimensionScore>,
    ctx,
    typeLabel: type?.label,
    categoryLabel: type?.categories.find((c) => c.value === ctx.category)?.label,
  };

  const fired: Recommendation[] = [];
  for (const rule of RULES) {
    const rel = relevance(rule, input);
    if (rel === null) continue;
    const hit = rule.when(input);
    if (!hit || hit.gap <= 0) continue;
    const impact = rule.impact / 3;
    const bottleneckBoost = rule.dimension === bottleneck ? 0.08 : 0;
    const score = RANK_WEIGHTS.impact * impact + RANK_WEIGHTS.gap * hit.gap + RANK_WEIGHTS.relevance * rel + bottleneckBoost;
    fired.push({
      id: rule.id,
      dimension: rule.dimension,
      title: typeof rule.title === "function" ? rule.title(input) : rule.title,
      body: hit.body ?? (typeof rule.body === "function" ? rule.body(input) : rule.body),
      evidence: hit.evidence,
      impact: LEVELS[rule.impact - 1],
      effort: rule.effort,
      gap: Math.round(hit.gap * 100) / 100,
      relevance: rel,
      score: Math.round(score * 1000) / 1000,
      ...(rule.caseStudy ? { caseStudy: rule.caseStudy } : {}),
      ...(rule.link ? { link: rule.link } : {}),
    });
  }
  return fired.sort((x, y) => y.score - x.score).slice(0, max);
}
