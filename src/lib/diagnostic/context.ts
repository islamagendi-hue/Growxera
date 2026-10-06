/**
 * Business context taxonomy for the Growth Diagnostic:
 *
 *   Industry → Business model → Business type → Category → Geography → City
 *
 * This is data. To add an industry, model, type or category, add a node here;
 * the dependent dropdowns, validation, benchmarks and recommendations all read
 * from it. Each business type declares the revenue model the scoring engine
 * uses (`revenueModel`), so the questions that follow adapt automatically.
 */
import type { Answers, BusinessModel } from "./types";

export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

export interface BusinessTypeNode extends Choice {
  revenueModel: BusinessModel;
  /** Categories for this type. Empty when the type is specific enough already. */
  categories: Choice[];
}

export interface ModelNode extends Choice {
  types: BusinessTypeNode[];
}

export interface IndustryNode extends Choice {
  models: ModelNode[];
}

export interface GeographyNode extends Choice {
  currency: string;
  cities: Choice[];
}

const c = (value: string, label: string, hint?: string): Choice => ({ value, label, ...(hint ? { hint } : {}) });
const other = c("other", "Other");

const RETAIL_CATEGORIES: Choice[] = [
  c("fashion", "Fashion & apparel"),
  c("perfume", "Perfumes & fragrance"),
  c("beauty", "Beauty & cosmetics"),
  c("home", "Home & furniture"),
  c("electronics", "Electronics & gadgets"),
  c("grocery", "Food & grocery"),
  c("health", "Health & supplements"),
  c("kids", "Kids & toys"),
  c("sports", "Sports & outdoors"),
  c("jewellery", "Jewellery & accessories"),
  c("pets", "Pet supplies"),
  c("books", "Books, gifts & stationery"),
  other,
];

const SAAS_B2B_CATEGORIES: Choice[] = [
  c("crm_sales", "CRM & sales"),
  c("hr", "HR & payroll"),
  c("finance", "Finance & accounting"),
  c("pos_retail", "POS & retail tech"),
  c("logistics", "Logistics & fleet"),
  c("martech", "Marketing tech"),
  c("edtech", "Education tech"),
  c("healthtech", "Healthcare tech"),
  c("proptech", "Property tech"),
  c("devtools", "Developer & IT tools"),
  other,
];

export const INDUSTRIES: IndustryNode[] = [
  {
    ...c("ecommerce", "E-commerce & retail"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          { ...c("online_retail", "Online retail", "Your own store selling many brands"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("d2c_brand", "Own brand (D2C)", "Selling your own brand directly"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("omnichannel", "Stores + online", "Physical branches and an online store"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("subscription_box", "Subscription box", "Recurring product deliveries"), revenueModel: "subscription", categories: RETAIL_CATEGORIES },
        ],
      },
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [
          {
            ...c("wholesale", "Wholesale & distribution"),
            revenueModel: "leadgen",
            categories: [c("fnb_supply", "Food & beverage supply"), c("industrial", "Industrial & construction"), c("office", "Office & business supplies"), c("medical_supply", "Medical supplies"), c("retail_supply", "Retail goods"), other],
          },
          { ...c("b2b_store", "B2B online store", "Businesses order online"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
        ],
      },
      {
        ...c("marketplace", "Marketplace", "Connecting buyers and sellers"),
        types: [
          { ...c("product_marketplace", "Product marketplace"), revenueModel: "ecommerce", categories: [c("general", "General"), ...RETAIL_CATEGORIES] },
          { ...c("resale", "Resale & second-hand"), revenueModel: "ecommerce", categories: [c("fashion", "Fashion"), c("electronics", "Electronics"), c("cars", "Cars"), c("general", "General"), other] },
        ],
      },
    ],
  },
  {
    ...c("saas", "SaaS & software"),
    models: [
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [
          { ...c("smb_saas", "SaaS for small businesses", "Self-serve or light sales"), revenueModel: "subscription", categories: SAAS_B2B_CATEGORIES },
          { ...c("enterprise_saas", "Enterprise software", "Sales-led, annual contracts"), revenueModel: "leadgen", categories: SAAS_B2B_CATEGORIES },
        ],
      },
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          {
            ...c("consumer_subscription", "Consumer subscription app"),
            revenueModel: "subscription",
            categories: [c("productivity", "Productivity"), c("fitness", "Health & fitness"), c("learning", "Learning"), c("entertainment", "Entertainment & media"), c("personal_finance", "Personal finance"), c("dating", "Social & dating"), other],
          },
        ],
      },
    ],
  },
  {
    ...c("apps", "Mobile apps & on-demand"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          {
            ...c("on_demand", "On-demand service app", "Customers book or order a service"),
            revenueModel: "other",
            categories: [c("car_services", "Car services"), c("home_services", "Home services"), c("delivery", "Delivery"), c("mobility", "Mobility & rides"), c("beauty_home", "Beauty at home"), c("health_home", "Healthcare at home"), other],
          },
          { ...c("transactional_app", "Shopping or ordering app"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
        ],
      },
      {
        ...c("marketplace", "Marketplace", "Connecting providers and customers"),
        types: [
          {
            ...c("services_marketplace", "Services marketplace"),
            revenueModel: "other",
            categories: [c("home_services", "Home services"), c("freelance", "Freelance & professional"), c("tutoring", "Tutoring"), c("health", "Health & wellness"), c("events", "Events & venues"), other],
          },
        ],
      },
    ],
  },
  {
    ...c("services", "Professional & B2B services"),
    models: [
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [
          {
            ...c("agency", "Agency or consultancy"),
            revenueModel: "leadgen",
            categories: [c("marketing", "Marketing & creative"), c("it", "IT & software services"), c("consulting", "Management consulting"), c("legal_accounting", "Legal & accounting"), c("recruitment", "Recruitment & HR"), c("engineering", "Engineering & construction"), other],
          },
          {
            ...c("managed_service", "Managed or outsourced service", "Ongoing monthly contracts"),
            revenueModel: "subscription",
            categories: [c("it_managed", "Managed IT"), c("facilities", "Facilities & cleaning"), c("logistics", "Logistics"), c("bpo", "Customer service & back office"), other],
          },
        ],
      },
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          {
            ...c("consumer_services", "Consumer services"),
            revenueModel: "leadgen",
            categories: [c("home_services", "Home services"), c("events", "Events & weddings"), c("legal", "Legal"), c("travel", "Travel"), other],
          },
        ],
      },
    ],
  },
  {
    ...c("healthcare", "Healthcare & clinics"),
    models: [
      {
        ...c("b2c", "B2C", "Patients and consumers"),
        types: [
          {
            ...c("clinic", "Clinic or medical centre"),
            revenueModel: "leadgen",
            categories: [c("dental", "Dental"), c("derma", "Dermatology & aesthetics"), c("general", "General practice"), c("physio", "Physiotherapy"), c("fertility", "Fertility"), c("ophthalmology", "Eye care"), c("mental", "Mental health"), other],
          },
          { ...c("pharmacy", "Pharmacy & health retail"), revenueModel: "ecommerce", categories: [c("pharmacy", "Pharmacy"), c("supplements", "Supplements"), c("optics", "Optics"), other] },
        ],
      },
    ],
  },
  {
    ...c("beauty", "Beauty & wellness"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          { ...c("salon", "Salon, spa or barber"), revenueModel: "other", categories: [c("salon", "Hair & beauty salon"), c("spa", "Spa"), c("barber", "Barber"), c("nails", "Nails"), other] },
          { ...c("fitness", "Gym or studio", "Memberships"), revenueModel: "subscription", categories: [c("gym", "Gym"), c("studio", "Boutique studio"), c("ladies_gym", "Ladies' gym"), other] },
        ],
      },
    ],
  },
  {
    ...c("fnb", "Food & beverage"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          { ...c("restaurant", "Restaurant or café"), revenueModel: "other", categories: [c("qsr", "Quick service"), c("casual", "Casual dining"), c("fine", "Fine dining"), c("cafe", "Café & bakery"), c("cloud_kitchen", "Cloud kitchen"), other] },
          { ...c("food_brand", "Packaged food or drinks brand"), revenueModel: "ecommerce", categories: [c("snacks", "Snacks"), c("coffee", "Coffee & tea"), c("healthy", "Healthy & diet"), c("dates_sweets", "Dates & sweets"), other] },
        ],
      },
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [{ ...c("catering", "Catering & food supply"), revenueModel: "leadgen", categories: [c("corporate", "Corporate catering"), c("events", "Event catering"), c("supply", "Food supply"), other] }],
      },
    ],
  },
  {
    ...c("education", "Education & training"),
    models: [
      {
        ...c("b2c", "B2C", "Learners and parents"),
        types: [
          { ...c("online_courses", "Online courses"), revenueModel: "ecommerce", categories: [c("professional", "Professional skills"), c("languages", "Languages"), c("tech", "Tech & coding"), c("test_prep", "Test preparation"), other] },
          { ...c("tutoring", "Tutoring or training centre"), revenueModel: "leadgen", categories: [c("k12", "School tutoring"), c("languages", "Languages"), c("professional", "Professional training"), other] },
          { ...c("edtech_subscription", "Learning app (subscription)"), revenueModel: "subscription", categories: [c("k12", "School"), c("languages", "Languages"), c("professional", "Professional"), other] },
        ],
      },
      {
        ...c("b2b", "B2B", "Selling to organisations"),
        types: [{ ...c("corporate_training", "Corporate training"), revenueModel: "leadgen", categories: [c("leadership", "Leadership"), c("sales", "Sales"), c("tech", "Tech & digital"), c("compliance", "Compliance"), other] }],
      },
    ],
  },
  {
    ...c("real_estate", "Real estate"),
    models: [
      {
        ...c("b2c", "B2C", "Buyers and tenants"),
        types: [
          { ...c("brokerage", "Brokerage"), revenueModel: "leadgen", categories: [c("residential", "Residential"), c("commercial", "Commercial"), c("rentals", "Rentals"), other] },
          { ...c("developer", "Developer"), revenueModel: "leadgen", categories: [c("off_plan", "Off-plan"), c("ready", "Ready units"), c("mixed", "Mixed use"), other] },
        ],
      },
    ],
  },
  {
    ...c("automotive", "Automotive"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          { ...c("dealership", "Dealership"), revenueModel: "leadgen", categories: [c("new", "New cars"), c("used", "Used cars"), c("luxury", "Luxury"), other] },
          { ...c("car_services", "Maintenance & car services"), revenueModel: "other", categories: [c("maintenance", "Maintenance"), c("detailing", "Car wash & detailing"), c("tyres", "Tyres & parts fitting"), other] },
          { ...c("parts", "Parts & accessories"), revenueModel: "ecommerce", categories: [c("parts", "Parts"), c("accessories", "Accessories"), other] },
        ],
      },
    ],
  },
  {
    ...c("financial", "Financial services"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [{ ...c("consumer_finance", "Consumer financial product"), revenueModel: "leadgen", categories: [c("lending", "Lending & BNPL"), c("insurance", "Insurance"), c("payments", "Payments & wallets"), c("investing", "Investing"), other] }],
      },
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [{ ...c("business_finance", "Business financial product"), revenueModel: "leadgen", categories: [c("lending", "Business lending"), c("payments", "Payments & POS"), c("insurance", "Insurance"), other] }],
      },
    ],
  },
  {
    ...c("other", "Other industry"),
    models: [
      {
        ...c("b2c", "B2C", "Selling to consumers"),
        types: [
          { ...c("sell_online", "Sell products online"), revenueModel: "ecommerce", categories: [] },
          { ...c("leads", "Generate enquiries and close sales"), revenueModel: "leadgen", categories: [] },
          { ...c("subscriptions", "Subscriptions or memberships"), revenueModel: "subscription", categories: [] },
          { ...c("in_person", "Walk-in or booked visits"), revenueModel: "other", categories: [] },
        ],
      },
      {
        ...c("b2b", "B2B", "Selling to businesses"),
        types: [
          { ...c("leads", "Generate enquiries and close deals"), revenueModel: "leadgen", categories: [] },
          { ...c("subscriptions", "Recurring contracts"), revenueModel: "subscription", categories: [] },
        ],
      },
    ],
  },
];

export const GEOGRAPHIES: GeographyNode[] = [
  { ...c("SA", "Saudi Arabia"), currency: "SAR", cities: [c("riyadh", "Riyadh"), c("jeddah", "Jeddah"), c("dammam", "Dammam & Khobar"), c("makkah", "Makkah"), c("madinah", "Madinah"), c("abha", "Abha & south"), c("multiple", "Several cities"), other] },
  { ...c("AE", "United Arab Emirates"), currency: "AED", cities: [c("dubai", "Dubai"), c("abu_dhabi", "Abu Dhabi"), c("sharjah", "Sharjah"), c("multiple", "Several emirates"), other] },
  { ...c("QA", "Qatar"), currency: "QAR", cities: [] },
  { ...c("KW", "Kuwait"), currency: "KWD", cities: [] },
  { ...c("BH", "Bahrain"), currency: "BHD", cities: [] },
  { ...c("OM", "Oman"), currency: "OMR", cities: [] },
  { ...c("EG", "Egypt"), currency: "EGP", cities: [c("cairo", "Cairo"), c("giza", "Giza"), c("alexandria", "Alexandria"), c("multiple", "Several cities"), other] },
  { ...c("GCC", "Several GCC countries"), currency: "USD", cities: [] },
  { ...c("MENA", "Wider MENA"), currency: "USD", cities: [] },
  { ...c("EU", "Europe"), currency: "EUR", cities: [] },
  { ...c("NA", "North America"), currency: "USD", cities: [] },
  { ...c("OTHER", "Other / international"), currency: "USD", cities: [] },
];

// ── Lookups ─────────────────────────────────────────────────────────────────

const str = (a: Answers, k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);

export function industryNode(a: Answers): IndustryNode | undefined {
  return INDUSTRIES.find((i) => i.value === str(a, "industry"));
}
export function modelNode(a: Answers): ModelNode | undefined {
  return industryNode(a)?.models.find((m) => m.value === str(a, "segment"));
}
export function typeNode(a: Answers): BusinessTypeNode | undefined {
  return modelNode(a)?.types.find((t) => t.value === str(a, "businessType"));
}
export function geographyNode(a: Answers): GeographyNode | undefined {
  return GEOGRAPHIES.find((g) => g.value === str(a, "geography"));
}

/** Options for each context field given the answers above it. */
export const CONTEXT_OPTIONS: Record<string, (a: Answers) => Choice[]> = {
  industry: () => INDUSTRIES,
  segment: (a) => industryNode(a)?.models ?? [],
  businessType: (a) => modelNode(a)?.types ?? [],
  category: (a) => typeNode(a)?.categories ?? [],
  geography: () => GEOGRAPHIES,
  city: (a) => geographyNode(a)?.cities ?? [],
};

/** Each context field and the fields that must be cleared when it changes. */
export const CONTEXT_CHILDREN: Record<string, string[]> = {
  industry: ["segment", "businessType", "category", "businessModel"],
  segment: ["businessType", "category", "businessModel"],
  businessType: ["category", "businessModel"],
  geography: ["city"],
};

/** The revenue model the scoring engine uses, derived from the business type. */
export function revenueModelFor(a: Answers): BusinessModel | undefined {
  return typeNode(a)?.revenueModel;
}

export interface BusinessContext {
  industry?: string;
  segment?: string;
  businessType?: string;
  category?: string;
  geography?: string;
  city?: string;
}

export function contextOf(a: Answers): BusinessContext {
  const pick = (k: keyof BusinessContext) => str(a, k);
  return {
    industry: pick("industry"),
    segment: pick("segment"),
    businessType: pick("businessType"),
    category: pick("category"),
    geography: pick("geography"),
    city: pick("city"),
  };
}

/** "E-commerce & retail · B2C · Own brand (D2C) · Perfumes & fragrance · Riyadh, Saudi Arabia". */
export function describeContext(a: Answers): string {
  const geo = geographyNode(a);
  const city = geo?.cities.find((x) => x.value === str(a, "city"));
  const parts = [
    industryNode(a)?.label,
    modelNode(a)?.label,
    typeNode(a)?.label,
    typeNode(a)?.categories.find((x) => x.value === str(a, "category"))?.label,
    geo ? (city && !["other", "multiple"].includes(city.value) ? `${city.label}, ${geo.label}` : geo.label) : undefined,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function currencyForGeography(code: string | undefined): string | undefined {
  return GEOGRAPHIES.find((g) => g.value === code)?.currency;
}
