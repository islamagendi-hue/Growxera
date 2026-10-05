/**
 * Experimentation Lab: a library of growth experiment ideas by business model.
 *
 * These are hypotheses to test, not results. Nothing here claims an outcome;
 * each idea names the metric that decides whether it worked.
 */

export const EXPERIMENT_MODELS = [
  { id: "app", label: "Mobile app" },
  { id: "saas", label: "SaaS & subscription" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "marketplace", label: "Marketplace" },
  { id: "food", label: "Food & delivery" },
  { id: "edtech", label: "EdTech" },
  { id: "leadgen", label: "Lead gen & B2B" },
  { id: "services", label: "Multi-branch services" },
] as const;

export const EXPERIMENT_STAGES = [
  { id: "acquisition", label: "Acquisition" },
  { id: "activation", label: "Activation" },
  { id: "retention", label: "Retention" },
  { id: "monetization", label: "Monetization" },
  { id: "referral", label: "Referral" },
] as const;

export type ExperimentModel = (typeof EXPERIMENT_MODELS)[number]["id"];
export type ExperimentStage = (typeof EXPERIMENT_STAGES)[number]["id"];
export type Effort = "low" | "medium" | "high";

export interface Experiment {
  id: number;
  model: ExperimentModel;
  stage: ExperimentStage;
  title: string;
  /** "If we …, then …, because …" in short form. */
  hypothesis: string;
  /** The metric that decides the test. */
  metric: string;
  effort: Effort;
}

type Row = [ExperimentStage, string, string, string, Effort];

const IDEAS: Record<ExperimentModel, Row[]> = {
  ecommerce: [
    ["acquisition", "Creator UGC vs. studio creative", "Short creator-style videos on Snapchat and TikTok will beat polished studio ads on cost per purchase, because they look native to the feed.", "Cost per purchase", "low"],
    ["acquisition", "Launch on Amazon or Noon", "Listing best sellers on a marketplace will reach shoppers already searching for the category without cannibalising the site.", "Incremental monthly revenue", "medium"],
    ["acquisition", "Ramadan and White Friday pre-launch list", "Collecting WhatsApp opt-ins two weeks before a season will lift day-one sales versus paid traffic alone.", "Season revenue from the list", "low"],
    ["acquisition", "Category landing pages for paid traffic", "Sending ads to a focused category page instead of the homepage will raise conversion from paid sessions.", "Paid session conversion rate", "low"],
    ["activation", "Show Tabby and Tamara on the product page", "Showing the instalment price next to the full price will raise add-to-cart on higher-priced items.", "Add-to-cart rate", "low"],
    ["activation", "Cash on delivery vs. prepaid incentive", "A small prepaid discount will shift orders away from COD and cut failed deliveries without hurting conversion.", "Prepaid share and delivery success rate", "low"],
    ["activation", "Guest checkout with phone-only login", "Removing account creation and using OTP by phone will lift checkout completion.", "Checkout completion rate", "medium"],
    ["activation", "Free shipping threshold test", "Setting free shipping just above current AOV will lift AOV without hurting conversion.", "AOV and conversion rate", "low"],
    ["activation", "Arabic-first product pages", "Native Arabic copy, not translation, will raise conversion for Arabic-language sessions.", "Conversion rate, Arabic sessions", "medium"],
    ["retention", "WhatsApp abandoned-cart flow", "A WhatsApp reminder within an hour will recover more carts than email alone.", "Recovered cart revenue", "low"],
    ["retention", "Replenishment reminders", "Messaging customers when a consumable is likely to run out will raise repeat purchase rate.", "90-day repeat purchase rate", "medium"],
    ["retention", "Post-purchase unboxing sequence", "A how-to-use and care message after delivery will cut returns and lift second orders.", "Return rate and second-order rate", "low"],
    ["retention", "VIP tier for top 10% of customers", "Early access and a dedicated WhatsApp line for top customers will raise their purchase frequency.", "Purchase frequency, top decile", "medium"],
    ["monetization", "Samples with every order", "Including samples of related products will drive full-size purchases of the sampled items.", "Sample-to-purchase rate", "low"],
    ["monetization", "Curated bundles vs. single items", "Pre-built bundles at a small discount will raise AOV more than they reduce margin.", "AOV and contribution margin", "low"],
    ["monetization", "Checkout add-on carousel", "Low-priced add-ons shown at checkout will raise items per order.", "Items per order", "low"],
    ["monetization", "Gift wrapping and gift messages", "A paid gift option before Eid and Ramadan will add revenue and raise conversion for gift shoppers.", "Gift option attach rate", "low"],
    ["monetization", "Subscribe and save", "A recurring delivery option for consumables will create predictable revenue without hurting one-off sales.", "Subscription take-up rate", "high"],
    ["referral", "Give 50, get 50 referral credit", "A double-sided store credit will produce more referred first orders than a one-sided reward.", "Referred first orders", "medium"],
    ["referral", "Share-your-unboxing reward", "Rewarding customers who post their unboxing will generate low-cost UGC and new traffic.", "Posts per 100 orders and referred sessions", "low"],
  ],
  app: [
    ["acquisition", "App Store and Google Play listing tests", "Testing screenshots and the first line of the description will raise store page conversion to install.", "Store page install rate", "low"],
    ["acquisition", "WhatsApp-to-app migration", "Moving customers who already order on WhatsApp into the app with an app-only offer will build a cheap install base.", "Installs from WhatsApp and cost per install", "medium"],
    ["acquisition", "Deferred deep links in ads", "Opening new users straight to the advertised offer after install will raise install-to-first-action rate.", "Install to first key action", "medium"],
    ["acquisition", "Neighbourhood-level targeting", "Concentrating spend in districts with the highest order density will cut CAC.", "CAC by district", "low"],
    ["activation", "Shorter onboarding", "Cutting onboarding to the steps needed for the first order will lift activation.", "Day-1 activation rate", "medium"],
    ["activation", "Ask for push permission after the first win", "Requesting notification permission after the first completed action will raise opt-in versus asking on launch.", "Push opt-in rate", "low"],
    ["activation", "First-order incentive vs. free delivery", "Free delivery on the first order will activate as many users as a discount at a lower cost.", "First-order rate and cost per activation", "low"],
    ["activation", "Pre-filled location and address", "Detecting location and pre-filling the address will cut drop-off in the first order flow.", "First order completion rate", "medium"],
    ["retention", "Push timing by user habit", "Sending pushes at the hour each user usually orders will lift open and order rates.", "Push-driven orders per 1,000 sends", "medium"],
    ["retention", "Repeat-booking reminder", "Reminding users when their usual interval has passed will raise repeat orders.", "30-day repeat rate", "low"],
    ["retention", "Win-back for 30-day inactive users", "A personalised offer on day 30 of inactivity will reactivate more users than a generic blast.", "Reactivation rate", "low"],
    ["retention", "In-app streaks or loyalty points", "Visible progress toward a reward will raise order frequency.", "Orders per active user per month", "high"],
    ["retention", "Rate-the-service loop", "Asking for a rating after each order and following up on low scores will reduce churn.", "Churn among low-score users", "medium"],
    ["monetization", "Monthly plan or bundle", "A prepaid monthly bundle will raise revenue per user and lock in frequency.", "Plan take-up and ARPU", "medium"],
    ["monetization", "Premium tier with priority slots", "A paid priority option at peak times will add revenue without hurting standard bookings.", "Premium attach rate", "medium"],
    ["monetization", "Dynamic add-ons at booking", "Suggesting add-ons based on past orders will raise order value.", "Average order value", "low"],
    ["monetization", "Corporate and B2B accounts", "Offering company accounts will open a higher-volume revenue line.", "B2B revenue per month", "high"],
    ["referral", "Referral loop with incentive tiers", "Escalating rewards for 1, 3 and 5 referrals will raise referrals per referrer.", "Paying users from referral", "medium"],
    ["referral", "Referral prompt after a 5-star rating", "Asking for a referral right after a positive rating will lift share rate.", "Share rate after rating", "low"],
    ["referral", "Family and friends sharing", "Letting users add family members to one account will spread usage inside households.", "Users per account", "high"],
  ],
  saas: [
    ["acquisition", "Free tool as a lead magnet", "A free calculator or template related to the product will bring qualified sign-ups at low cost.", "Sign-ups from the free tool", "medium"],
    ["acquisition", "Comparison pages vs. competitors", "Honest comparison pages will capture high-intent search traffic.", "Organic sign-ups from comparison pages", "medium"],
    ["acquisition", "Arabic product and localised pricing", "An Arabic interface and SAR or AED pricing will raise trial starts from GCC visitors.", "GCC trial start rate", "high"],
    ["acquisition", "Founder-led LinkedIn content", "Weekly founder posts on the problem the product solves will drive demo requests.", "Demo requests attributed to LinkedIn", "low"],
    ["activation", "Single activation milestone", "Guiding every new user to one key action in the first session will raise trial-to-paid.", "Activation milestone rate", "medium"],
    ["activation", "Templates and sample data on sign-up", "Starting users with a ready-made workspace will shorten time to first value.", "Time to first value", "medium"],
    ["activation", "Onboarding checklist", "A visible 4-step checklist will raise the share of trials that complete setup.", "Setup completion rate", "low"],
    ["activation", "Human onboarding call for high-fit trials", "Offering a 15-minute call to high-fit trials will lift their conversion.", "Trial-to-paid, high-fit segment", "medium"],
    ["retention", "Usage-drop alerts", "Contacting accounts whose usage falls 40% will save accounts before they churn.", "Monthly logo churn", "medium"],
    ["retention", "Annual plan nudge at month 3", "Offering annual billing to engaged monthly customers will cut churn.", "Monthly-to-annual conversion", "low"],
    ["retention", "In-product feature discovery", "Highlighting one unused feature per week will raise breadth of use and retention.", "Features used per account", "medium"],
    ["retention", "Cancellation flow with pause option", "Offering pause or downgrade at cancellation will save a share of churning accounts.", "Save rate at cancellation", "low"],
    ["monetization", "Pricing page anchor test", "Adding a higher tier as an anchor will shift sign-ups toward the middle plan.", "Mix of plans sold", "low"],
    ["monetization", "Usage-based add-ons", "Charging for usage above plan limits will grow revenue from heavy users.", "Expansion MRR", "medium"],
    ["monetization", "Seat-based expansion prompts", "Prompting admins to invite teammates will grow seats per account.", "Seats per account", "low"],
    ["monetization", "Free trial vs. freemium", "A 14-day full trial will convert better than a limited free plan for this segment.", "Paid conversions per 100 sign-ups", "high"],
    ["monetization", "Reverse trial", "Giving new users premium for 14 days, then dropping to free, will raise upgrade rate.", "Upgrade rate after trial", "medium"],
    ["referral", "Partner and agency program", "Revenue share for agencies that resell the product will open a new channel.", "Partner-sourced MRR", "high"],
    ["referral", "Powered-by link in shared outputs", "A small branded link on documents users share will drive sign-ups from viewers.", "Sign-ups from shared outputs", "low"],
    ["referral", "Give a month, get a month", "A free month for both sides will raise referred sign-ups.", "Referred paid accounts", "low"],
  ],
  leadgen: [
    ["acquisition", "Lead form ads vs. landing page", "Instant lead forms will lower cost per lead, but a landing page will win on cost per qualified lead.", "Cost per qualified lead", "low"],
    ["acquisition", "Click-to-WhatsApp ads", "Ads that open a WhatsApp chat will produce more conversations than a web form.", "Cost per qualified conversation", "low"],
    ["acquisition", "Industry-specific landing pages", "A landing page per industry will raise conversion over one generic page.", "Landing page conversion rate", "medium"],
    ["acquisition", "Webinar or live demo", "A monthly live session will produce warmer leads than gated content.", "Webinar-to-meeting rate", "medium"],
    ["activation", "Speed to lead under 5 minutes", "Calling or messaging within 5 minutes will raise qualification rate.", "Lead-to-qualified rate", "medium"],
    ["activation", "Shorter form with progressive profiling", "Asking for 3 fields first and the rest later will raise submissions without lowering quality.", "Form completion and qualified rate", "low"],
    ["activation", "Self-booking calendar after form", "Letting leads book a meeting immediately will raise meetings booked.", "Form-to-meeting rate", "low"],
    ["activation", "Lead scoring and routing", "Routing high-score leads to senior reps will raise close rate.", "Close rate by score band", "medium"],
    ["activation", "Proof on the landing page", "Showing real numbers and process near the form will raise conversion.", "Landing page conversion rate", "low"],
    ["retention", "Nurture sequence for not-ready leads", "A 6-week educational sequence will bring back leads that were not ready to buy.", "Re-engaged leads to meeting", "low"],
    ["retention", "Quarterly business review for clients", "Regular reviews with clients will raise renewal and upsell.", "Renewal rate", "medium"],
    ["retention", "Closed-lost re-engagement at 90 days", "Re-contacting lost deals after 90 days will reopen a share of them.", "Reopened opportunities", "low"],
    ["retention", "Onboarding kickoff within 48 hours", "A fast kickoff after signing will reduce early cancellations.", "90-day client retention", "low"],
    ["monetization", "Productised starter package", "A fixed-scope, fixed-price entry offer will shorten sales cycles.", "Sales cycle length and win rate", "medium"],
    ["monetization", "Tiered proposals", "Presenting three options in proposals will raise average deal size.", "Average deal value", "low"],
    ["monetization", "Retainer vs. project pricing", "Offering a retainer alongside project pricing will raise lifetime value.", "Retainer share of new deals", "medium"],
    ["monetization", "Annual prepay discount", "A discount for paying a year upfront will improve cash flow without hurting win rate.", "Prepaid share of deals", "low"],
    ["referral", "Client referral fee", "A clear referral fee for clients and partners will raise referred deals.", "Referred deals per quarter", "low"],
    ["referral", "Co-marketing with complementary firms", "Joint content with non-competing firms will reach their audience at no media cost.", "Leads from co-marketing", "medium"],
    ["referral", "Ask for introductions at project wins", "Asking for two introductions when a client hits a milestone will raise referral volume.", "Introductions per client", "low"],
  ],
  services: [
    ["acquisition", "Google Business Profile per branch", "Complete, active profiles with photos and posts will raise calls and direction requests.", "Calls and direction requests per branch", "low"],
    ["acquisition", "Branch-level radius ads", "Ads targeted around each branch will cut cost per booking versus city-wide targeting.", "Cost per booking by branch", "low"],
    ["acquisition", "Online booking from Instagram and Snapchat", "A booking button in social profiles will turn followers into bookings.", "Bookings from social profiles", "low"],
    ["acquisition", "Off-peak introductory offer", "A first-visit offer valid only at off-peak times will fill idle capacity.", "Off-peak utilisation", "low"],
    ["activation", "WhatsApp booking confirmations", "Confirming and reminding by WhatsApp will cut no-shows.", "No-show rate", "low"],
    ["activation", "Deposit for first-time bookings", "A small refundable deposit will cut no-shows from new customers.", "New-customer no-show rate", "low"],
    ["activation", "Same-day availability shown first", "Showing the earliest slot first will raise booking completion.", "Booking completion rate", "medium"],
    ["activation", "Welcome message after first visit", "A thank-you and next-step message will raise second-visit booking.", "Second-visit rate", "low"],
    ["retention", "Automated rebooking reminder", "Reminding customers at their usual interval will raise repeat bookings.", "Repeat bookings per month", "low"],
    ["retention", "Cohort-based churn review", "Reviewing monthly cohorts by branch will reveal which branches lose customers and why.", "Churn by branch cohort", "medium"],
    ["retention", "Membership or package of visits", "Prepaid packages will raise visit frequency and lock in customers.", "Package take-up and visits per customer", "medium"],
    ["retention", "Service recovery for low ratings", "Calling every customer who rates 3 or below within 24 hours will win back a share of them.", "Return rate after low rating", "low"],
    ["retention", "Birthday and occasion offers", "A personal offer around birthdays will bring lapsed customers back.", "Occasion-offer redemption", "low"],
    ["monetization", "Upsell menu at check-in", "Showing add-on services at check-in will raise revenue per visit.", "Revenue per visit", "low"],
    ["monetization", "Peak and off-peak pricing", "A small peak premium will shift demand and raise revenue per hour.", "Revenue per available hour", "medium"],
    ["monetization", "Retail products at the branch", "Selling related products at checkout will add margin per visit.", "Retail attach rate", "medium"],
    ["monetization", "Corporate packages for local companies", "Bulk packages for employees will add steady volume.", "Corporate revenue per branch", "high"],
    ["referral", "Referral card with every visit", "A bring-a-friend card with a reward for both will raise new customers.", "Referred new customers", "low"],
    ["referral", "Review request after the visit", "Asking happy customers for a Google review will lift rating and local ranking.", "New reviews per month", "low"],
    ["referral", "Branch leaderboard for referrals", "A friendly competition between branch teams will raise referral asks.", "Referrals per branch", "low"],
  ],
  marketplace: [
    ["acquisition", "Seed supply in one city first", "Concentrating supply in one city before expanding will give buyers enough choice to convert.", "Buyer conversion in the launch city", "medium"],
    ["acquisition", "SEO pages for every category and city", "Auto-generated, useful category-by-city pages will capture long-tail search demand.", "Organic sessions to listings", "medium"],
    ["acquisition", "Seller-led promotion kit", "Giving sellers ready-made posts and links will turn their followers into buyers.", "Buyers from seller-shared links", "low"],
    ["acquisition", "Waitlist with invite priority", "A waitlist that moves you up for each invite will build demand before launch.", "Invites per waitlist sign-up", "low"],
    ["activation", "First-listing wizard for sellers", "A guided wizard with photo tips will raise the share of sellers who publish a first listing.", "Seller first-listing rate", "medium"],
    ["activation", "Trust badges on listings", "Verified-seller and rating badges will raise buyer contact or purchase rate.", "Listing-to-contact rate", "low"],
    ["activation", "Instant reply prompts for sellers", "Nudging sellers to reply within 10 minutes will raise transaction rate.", "Inquiry-to-transaction rate", "low"],
    ["activation", "Escrow or buyer protection", "Holding payment until delivery will raise first-time buyer conversion.", "First purchase rate", "high"],
    ["retention", "Saved searches with alerts", "Alerting buyers when new matching listings appear will bring them back.", "Return visits from alerts", "low"],
    ["retention", "Seller performance dashboard", "Showing sellers their views and sales will keep them listing.", "Active sellers month over month", "medium"],
    ["retention", "Re-list reminders for sold-out items", "Prompting sellers to restock popular items will keep supply fresh.", "Re-list rate", "low"],
    ["retention", "Buyer loyalty credit", "A small credit on the next purchase will raise buyer repeat rate.", "Buyer 60-day repeat rate", "low"],
    ["monetization", "Promoted listings", "Paid placement in search will add revenue without hurting buyer experience.", "Promoted revenue and buyer conversion", "medium"],
    ["monetization", "Take-rate test by category", "Adjusting commission by category margin will raise revenue without losing sellers.", "Net revenue and seller churn", "medium"],
    ["monetization", "Seller subscription tier", "A monthly plan with lower fees and tools will attract high-volume sellers.", "Seller plan take-up", "medium"],
    ["monetization", "Delivery as a paid add-on", "Offering integrated delivery will add fee revenue and raise conversion.", "Delivery attach rate", "high"],
    ["referral", "Seller-invites-seller reward", "Rewarding sellers who bring other sellers will grow supply cheaply.", "Sellers acquired by referral", "low"],
    ["referral", "Share-a-listing link", "A one-tap WhatsApp share on every listing will bring new buyers.", "Sessions from shared listings", "low"],
    ["referral", "Buyer referral credit", "A double-sided credit for buyers will grow demand in new areas.", "Referred first purchases", "low"],
    ["referral", "Featured-seller stories", "Publishing seller success stories will attract new sellers.", "Seller sign-ups from stories", "medium"],
  ],
  food: [
    ["acquisition", "Own-app ordering vs. aggregators", "An own-channel discount will move repeat customers off aggregators and save commission.", "Share of orders on own channel", "medium"],
    ["acquisition", "Lunch-hour office targeting", "Ads targeted at office districts before noon will lift weekday lunch orders.", "Weekday lunch orders", "low"],
    ["acquisition", "Food creator tastings", "Inviting local food creators for tastings will drive first orders at lower cost than ads.", "First orders from creator codes", "low"],
    ["acquisition", "Late-night menu", "A short late-night menu will capture demand when competitors are closed.", "Orders after 11pm", "medium"],
    ["activation", "Reorder last meal button", "One-tap reorder on the home screen will raise second-order rate.", "Second-order rate", "low"],
    ["activation", "Photo-first menu", "Real photos on every item will raise item-page conversion.", "Menu conversion rate", "low"],
    ["activation", "Delivery time promise", "Showing an accurate delivery time upfront will raise checkout completion.", "Checkout completion rate", "medium"],
    ["activation", "First order free delivery", "Free delivery on the first order will activate as many customers as a discount, more cheaply.", "First orders per spend", "low"],
    ["retention", "Weekly meal plan subscription", "A weekly plan will lock in frequency for regular customers.", "Plan subscribers and churn", "high"],
    ["retention", "Late-order apology credit", "An automatic credit when an order is late will protect repeat rate.", "Repeat rate after late orders", "low"],
    ["retention", "Ramadan iftar and suhoor bundles", "Seasonal bundles will raise order frequency during Ramadan.", "Ramadan orders per customer", "low"],
    ["retention", "Stamp card in the app", "Every sixth meal free will raise monthly order frequency.", "Orders per customer per month", "low"],
    ["monetization", "Combo upsell at checkout", "Offering a drink and side as a combo will raise basket size.", "Average basket value", "low"],
    ["monetization", "Family and group platters", "Group platters will raise order value on weekends.", "Weekend average order value", "low"],
    ["monetization", "Catering for offices and events", "A catering menu will add large, predictable orders.", "Catering revenue per month", "medium"],
    ["monetization", "Menu engineering by margin", "Featuring high-margin items first will lift gross margin per order.", "Gross margin per order", "low"],
    ["referral", "Gift a meal", "Letting customers send a meal to a friend will bring new customers.", "New customers from gifted meals", "medium"],
    ["referral", "Group order link", "A shared group-order link will introduce the brand to new people in each group.", "New customers from group orders", "medium"],
    ["referral", "Review for dessert", "A free dessert for a review will lift ratings on aggregators.", "Rating and review volume", "low"],
    ["referral", "Office ambassador program", "Rewarding one person per office for organising group orders will grow office accounts.", "Active office accounts", "low"],
  ],
  edtech: [
    ["acquisition", "Free placement test", "A free level test will bring in high-intent learners at low cost.", "Test-to-sign-up rate", "low"],
    ["acquisition", "Parent-targeted ads for junior tracks", "Ads aimed at parents with outcome-focused messages will lower cost per junior enrolment.", "Cost per junior enrolment", "low"],
    ["acquisition", "Free live trial class", "A live trial class will convert better than recorded samples.", "Trial-to-enrolment rate", "medium"],
    ["acquisition", "Teacher-led short videos", "Short lessons from real teachers on TikTok and Instagram will drive organic sign-ups.", "Organic sign-ups", "low"],
    ["activation", "First lesson within 24 hours", "Booking the first lesson inside a day will raise activation.", "Sign-up to first lesson rate", "medium"],
    ["activation", "Goal-setting on sign-up", "Asking learners for a goal and showing a plan will raise week-one completion.", "Week-one lesson completion", "low"],
    ["activation", "Remove friction to first value", "Cutting steps before the first lesson will shorten time to first value.", "Time to first lesson", "medium"],
    ["activation", "Progress report for parents", "Sending parents a progress note after the first week will raise conversion to paid.", "Junior trial-to-paid", "low"],
    ["retention", "Cohort tracking by start month", "Tracking retention by start cohort will surface where learners drop.", "Month-3 retention by cohort", "medium"],
    ["retention", "Streaks and weekly goals", "Visible streaks will raise lessons per week.", "Lessons per active learner", "medium"],
    ["retention", "Behavioural email by activity", "Emails triggered by learner behaviour will lift engagement over a fixed calendar.", "Email engagement and return rate", "low"],
    ["retention", "Teacher check-in after a missed class", "A personal message after a missed class will reduce drop-off.", "Return rate after a missed class", "low"],
    ["monetization", "Term packages vs. monthly", "A discounted term package will raise lifetime value.", "Package share and LTV", "low"],
    ["monetization", "Sibling discount", "A sibling discount will raise enrolments per family.", "Learners per family", "low"],
    ["monetization", "Certificates and exam prep add-on", "A paid exam-prep track will add revenue from advanced learners.", "Add-on attach rate", "medium"],
    ["monetization", "Group vs. 1:1 pricing", "Offering small groups at a lower price will reach a new segment without cannibalising 1:1.", "Group enrolments and 1:1 mix", "medium"],
    ["referral", "Refer a friend, get a free class", "A free class for both sides will raise referred enrolments.", "Referred enrolments", "low"],
    ["referral", "Shareable progress certificate", "A shareable milestone certificate will bring visitors from learners' networks.", "Sessions from shared certificates", "low"],
    ["referral", "School and company partnerships", "Partnering with schools or employers will open group enrolments.", "Partner enrolments", "high"],
    ["referral", "Parent WhatsApp community", "A moderated parent community will drive word of mouth.", "Referrals from community members", "medium"],
  ],
};

export const EXPERIMENTS: Experiment[] = EXPERIMENT_MODELS.flatMap(({ id: model }) =>
  IDEAS[model].map(([stage, title, hypothesis, metric, effort]) => ({ model, stage, title, hypothesis, metric, effort })),
).map((e, i) => ({ id: i + 1, ...e }));

/** "3,17,42" → the experiments, in order, ignoring unknown ids. */
export function parsePlan(ids: string): Experiment[] {
  const byId = new Map(EXPERIMENTS.map((e) => [e.id, e]));
  return [...new Set(ids.split(",").map(Number))].flatMap((id) => byId.get(id) ?? []).slice(0, 40);
}

export function planText(plan: Experiment[]): string {
  return plan.map((e) => `#${String(e.id).padStart(3, "0")} ${e.title} (${e.metric})`).join("\n");
}

/** Pre-filled contact message for a plan chosen in the Experimentation Lab. */
export function planMessage(ids: string): string | undefined {
  const plan = parsePlan(ids);
  if (!plan.length) return undefined;
  return `I'd like help running this experiment plan from the Experimentation Lab:\n${planText(plan)}`.slice(0, 2000);
}
