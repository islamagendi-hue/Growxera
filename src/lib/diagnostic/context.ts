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

// Labels name one thing each: no "&" groupings, so people find their exact business.
const RETAIL_CATEGORIES: Choice[] = [
  c("fashion", "Fashion"),
  c("abayas", "Abayas and modest wear"),
  c("perfume", "Perfumes and oud"),
  c("beauty", "Cosmetics"),
  c("skincare", "Skincare"),
  c("home", "Furniture"),
  c("home_decor", "Home decor"),
  c("electronics", "Electronics"),
  c("phones", "Mobile phones"),
  c("grocery", "Grocery"),
  c("health", "Supplements"),
  c("kids", "Kids products"),
  c("toys", "Toys"),
  c("sports", "Sportswear"),
  c("jewellery", "Jewellery"),
  c("watches", "Watches"),
  c("eyewear", "Eyewear"),
  c("pets", "Pet supplies"),
  c("books", "Books"),
  c("gifts", "Gifts and flowers"),
  other,
];

const SAAS_B2B_CATEGORIES: Choice[] = [
  c("crm_sales", "CRM"),
  c("hr", "HR software"),
  c("payroll", "Payroll"),
  c("finance", "Accounting software"),
  c("erp", "ERP"),
  c("pos_retail", "Point of sale (POS)"),
  c("logistics", "Fleet management"),
  c("martech", "Marketing software"),
  c("ecommerce_platform", "E-commerce platform"),
  c("edtech", "Education software"),
  c("healthtech", "Clinic software"),
  c("proptech", "Property software"),
  c("devtools", "Developer tools"),
  c("security", "Cybersecurity"),
  other,
];

const B2C = (hint = "Selling to consumers") => c("b2c", "B2C", hint);
const B2B = (hint = "Selling to businesses") => c("b2b", "B2B", hint);

export const INDUSTRIES: IndustryNode[] = [
  // ── Selling products ──
  {
    ...c("ecommerce", "E-commerce", "Selling online"),
    models: [
      {
        ...B2C(),
        types: [
          { ...c("online_retail", "Online store", "Selling many brands"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("d2c_brand", "Own brand (D2C)", "Selling your own brand directly"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("subscription_box", "Subscription box", "Recurring product deliveries"), revenueModel: "subscription", categories: RETAIL_CATEGORIES },
          { ...c("social_commerce", "Instagram or WhatsApp store", "Selling through social channels"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
        ],
      },
      {
        ...B2B(),
        types: [{ ...c("b2b_store", "B2B online store", "Businesses order online"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES }],
      },
    ],
  },
  {
    ...c("retail", "Retail stores", "Physical shops or showrooms"),
    models: [
      {
        ...B2C(),
        types: [
          { ...c("omnichannel", "Stores and online store"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
          { ...c("stores_only", "Stores only"), revenueModel: "other", categories: RETAIL_CATEGORIES },
        ],
      },
    ],
  },
  {
    ...c("marketplace", "Online marketplace", "Connecting buyers and sellers"),
    models: [
      {
        ...c("marketplace", "Marketplace", "You take a commission or fee"),
        types: [
          { ...c("product_marketplace", "Product marketplace"), revenueModel: "ecommerce", categories: [c("general", "General"), ...RETAIL_CATEGORIES] },
          { ...c("resale", "Second-hand marketplace"), revenueModel: "ecommerce", categories: [c("fashion", "Fashion"), c("electronics", "Electronics"), c("cars", "Cars"), c("general", "General"), other] },
          { ...c("services_marketplace", "Services marketplace"), revenueModel: "other", categories: [c("home_services", "Home services"), c("freelance", "Freelancers"), c("tutoring", "Tutors"), c("health", "Health providers"), c("events", "Event venues"), other] },
        ],
      },
    ],
  },
  {
    ...c("wholesale", "Wholesale distribution", "Supplying other businesses"),
    models: [
      {
        ...B2B(),
        types: [
          {
            ...c("wholesale", "Distributor or wholesaler"),
            revenueModel: "leadgen",
            categories: [c("fnb_supply", "Food supply"), c("beverages", "Beverages"), c("industrial", "Industrial supplies"), c("construction", "Building materials"), c("office", "Office supplies"), c("medical_supply", "Medical supplies"), c("retail_supply", "Consumer goods"), other],
          },
        ],
      },
    ],
  },

  // ── Software and apps ──
  {
    ...c("saas", "SaaS", "Software sold to businesses"),
    models: [
      {
        ...B2B(),
        types: [
          { ...c("smb_saas", "SaaS for small businesses", "Self-serve or light sales"), revenueModel: "subscription", categories: SAAS_B2B_CATEGORIES },
          { ...c("enterprise_saas", "Enterprise software", "Sales-led, annual contracts"), revenueModel: "leadgen", categories: SAAS_B2B_CATEGORIES },
        ],
      },
    ],
  },
  {
    ...c("consumer_apps", "Consumer apps", "Subscription or in-app revenue"),
    models: [
      {
        ...B2C(),
        types: [
          {
            ...c("consumer_subscription", "Subscription app"),
            revenueModel: "subscription",
            categories: [c("productivity", "Productivity"), c("fitness", "Fitness"), c("wellbeing", "Mental wellbeing"), c("learning", "Learning"), c("entertainment", "Entertainment"), c("personal_finance", "Personal finance"), c("dating", "Dating"), c("religious", "Religious"), other],
          },
          { ...c("transactional_app", "Shopping or ordering app"), revenueModel: "ecommerce", categories: RETAIL_CATEGORIES },
        ],
      },
    ],
  },
  {
    ...c("apps", "On-demand services", "Customers book or order through an app"),
    models: [
      {
        ...B2C(),
        types: [
          {
            ...c("on_demand", "On-demand service app"),
            revenueModel: "other",
            categories: [c("car_services", "Car wash"), c("home_services", "Home maintenance"), c("cleaning", "Home cleaning"), c("delivery", "Delivery"), c("mobility", "Ride hailing"), c("beauty_home", "Beauty at home"), c("health_home", "Healthcare at home"), c("laundry", "Laundry"), other],
          },
        ],
      },
    ],
  },
  {
    ...c("fintech", "Fintech", "Payments, lending, wallets"),
    models: [
      {
        ...B2C(),
        types: [{ ...c("consumer_finance", "Consumer financial product"), revenueModel: "leadgen", categories: [c("lending", "Personal lending"), c("bnpl", "Buy now, pay later"), c("payments", "Wallets"), c("investing", "Investing"), c("remittance", "Remittance"), other] }],
      },
      {
        ...B2B(),
        types: [{ ...c("business_finance", "Business financial product"), revenueModel: "leadgen", categories: [c("lending", "Business lending"), c("payments", "Payment processing"), c("pos", "POS terminals"), c("expense", "Expense cards"), other] }],
      },
    ],
  },
  {
    ...c("insurance", "Insurance"),
    models: [
      { ...B2C(), types: [{ ...c("consumer_insurance", "Insurance for individuals"), revenueModel: "leadgen", categories: [c("motor", "Motor"), c("medical", "Medical"), c("travel", "Travel"), c("life", "Life"), other] }] },
      { ...B2B(), types: [{ ...c("business_insurance", "Insurance for companies"), revenueModel: "leadgen", categories: [c("medical", "Employee medical"), c("property", "Property"), c("liability", "Liability"), other] }] },
    ],
  },

  // ── Health and personal care ──
  {
    ...c("healthcare", "Clinics", "Healthcare: medical and dental centres"),
    models: [
      {
        ...B2C("Patients"),
        types: [
          {
            ...c("clinic", "Clinic or medical centre"),
            revenueModel: "leadgen",
            categories: [c("dental", "Dental"), c("derma", "Dermatology"), c("aesthetics", "Cosmetic and aesthetics"), c("general", "General practice"), c("physio", "Physiotherapy"), c("fertility", "Fertility"), c("ophthalmology", "Eye care"), c("mental", "Mental health"), c("pediatrics", "Pediatrics"), c("lab", "Medical lab"), other],
          },
        ],
      },
    ],
  },
  {
    ...c("pharmacy", "Pharmacies", "Healthcare products and medicines"),
    models: [{ ...B2C(), types: [{ ...c("pharmacy", "Pharmacy"), revenueModel: "ecommerce", categories: [c("pharmacy", "Pharmacy chain"), c("supplements", "Supplements"), c("optics", "Optics"), other] }] }],
  },
  {
    ...c("beauty", "Beauty salons", "Salons, spas and barbers"),
    models: [{ ...B2C(), types: [{ ...c("salon", "Salon"), revenueModel: "other", categories: [c("salon", "Women's salon"), c("barber", "Barbershop"), c("spa", "Spa"), c("nails", "Nail studio"), c("lashes", "Lashes and brows"), other] }] }],
  },
  {
    ...c("fitness", "Gyms", "Gyms and fitness studios"),
    models: [{ ...B2C("Members"), types: [{ ...c("fitness", "Gym or studio", "Memberships"), revenueModel: "subscription", categories: [c("gym", "Gym"), c("ladies_gym", "Ladies' gym"), c("studio", "Boutique studio"), c("crossfit", "CrossFit box"), c("martial_arts", "Martial arts"), other] }] }],
  },

  // ── Food ──
  {
    ...c("fnb", "Restaurants", "Restaurants, cafés and cloud kitchens"),
    models: [
      {
        ...B2C(),
        types: [
          { ...c("restaurant", "Restaurant"), revenueModel: "other", categories: [c("qsr", "Quick service"), c("casual", "Casual dining"), c("fine", "Fine dining"), c("cafe", "Café"), c("bakery", "Bakery"), c("specialty_coffee", "Specialty coffee"), c("cloud_kitchen", "Cloud kitchen"), other] },
        ],
      },
    ],
  },
  {
    ...c("food_brands", "Food brands", "Packaged food or drinks"),
    models: [{ ...B2C(), types: [{ ...c("food_brand", "Packaged food or drinks brand"), revenueModel: "ecommerce", categories: [c("snacks", "Snacks"), c("coffee", "Coffee"), c("tea", "Tea"), c("healthy", "Healthy food"), c("dates_sweets", "Dates"), c("chocolate", "Chocolate"), c("water", "Water and juices"), other] }] }],
  },
  {
    ...c("catering", "Catering"),
    models: [{ ...B2B(), types: [{ ...c("catering", "Catering company"), revenueModel: "leadgen", categories: [c("corporate", "Corporate catering"), c("events", "Event catering"), c("supply", "Food supply"), other] }] }],
  },

  // ── Learning ──
  {
    ...c("education", "Online courses", "Courses and learning apps"),
    models: [
      {
        ...B2C("Learners and parents"),
        types: [
          { ...c("online_courses", "Online courses"), revenueModel: "ecommerce", categories: [c("professional", "Professional skills"), c("languages", "Languages"), c("tech", "Coding"), c("test_prep", "Test preparation"), c("quran", "Quran"), other] },
          { ...c("edtech_subscription", "Learning app (subscription)"), revenueModel: "subscription", categories: [c("k12", "School"), c("languages", "Languages"), c("professional", "Professional"), other] },
        ],
      },
    ],
  },
  {
    ...c("training", "Training centres", "Tutoring and in-person training"),
    models: [
      { ...B2C("Learners and parents"), types: [{ ...c("tutoring", "Tutoring or training centre"), revenueModel: "leadgen", categories: [c("k12", "School tutoring"), c("languages", "Languages"), c("professional", "Professional training"), c("kids_activities", "Kids activities"), other] }] },
      { ...B2B("Selling to organisations"), types: [{ ...c("corporate_training", "Corporate training"), revenueModel: "leadgen", categories: [c("leadership", "Leadership"), c("sales", "Sales"), c("tech", "Digital skills"), c("compliance", "Compliance"), other] }] },
    ],
  },
  {
    ...c("schools", "Private schools", "Schools and nurseries"),
    models: [{ ...B2C("Parents"), types: [{ ...c("school", "School or nursery"), revenueModel: "leadgen", categories: [c("nursery", "Nursery"), c("international", "International school"), c("national", "National school"), other] }] }],
  },

  // ── Professional services ──
  {
    ...c("agencies", "Marketing agencies", "Marketing, creative and media"),
    models: [{ ...B2B(), types: [{ ...c("agency", "Agency"), revenueModel: "leadgen", categories: [c("performance", "Performance marketing"), c("marketing", "Branding"), c("social", "Social media"), c("seo", "SEO"), c("production", "Video production"), c("pr", "Public relations"), other] }] }],
  },
  {
    ...c("consulting", "Consulting firms"),
    models: [{ ...B2B(), types: [{ ...c("consultancy", "Consultancy"), revenueModel: "leadgen", categories: [c("consulting", "Management consulting"), c("strategy", "Strategy"), c("hr_consulting", "HR consulting"), c("tech_consulting", "Technology consulting"), other] }] }],
  },
  {
    ...c("it_services", "IT services", "Development, managed IT and outsourcing"),
    models: [
      {
        ...B2B(),
        types: [
          { ...c("it_projects", "Software development", "Project-based"), revenueModel: "leadgen", categories: [c("web", "Websites"), c("apps", "Mobile apps"), c("enterprise", "Enterprise systems"), other] },
          { ...c("managed_service", "Managed or outsourced service", "Ongoing monthly contracts"), revenueModel: "subscription", categories: [c("it_managed", "Managed IT"), c("bpo", "Customer service outsourcing"), c("facilities", "Facility management"), c("cleaning", "Commercial cleaning"), other] },
        ],
      },
    ],
  },
  {
    ...c("legal", "Law firms"),
    models: [{ ...B2B("Companies and individuals"), types: [{ ...c("firm", "Law firm"), revenueModel: "leadgen", categories: [c("corporate_law", "Corporate law"), c("litigation", "Litigation"), c("company_setup", "Company setup"), c("ip", "Trademarks"), other] }] }],
  },
  {
    ...c("accounting", "Accounting firms"),
    models: [{ ...B2B(), types: [{ ...c("firm", "Accounting firm"), revenueModel: "leadgen", categories: [c("bookkeeping", "Bookkeeping"), c("tax", "Tax and zakat"), c("audit", "Audit"), c("cfo", "Outsourced CFO"), other] }] }],
  },
  {
    ...c("recruitment", "Recruitment agencies"),
    models: [{ ...B2B(), types: [{ ...c("recruitment", "Recruitment agency"), revenueModel: "leadgen", categories: [c("executive", "Executive search"), c("staffing", "Staffing"), c("domestic", "Domestic workers"), other] }] }],
  },
  {
    ...c("logistics", "Logistics", "Shipping, delivery and storage"),
    models: [{ ...B2B(), types: [{ ...c("logistics", "Logistics company"), revenueModel: "leadgen", categories: [c("last_mile", "Last-mile delivery"), c("freight", "Freight"), c("warehousing", "Warehousing"), c("fulfilment", "E-commerce fulfilment"), other] }] }],
  },
  {
    ...c("construction", "Construction", "Contracting and fit-out"),
    models: [{ ...B2B(), types: [{ ...c("contractor", "Contractor"), revenueModel: "leadgen", categories: [c("fitout", "Interior fit-out"), c("general", "General contracting"), c("mep", "MEP"), c("solar", "Solar"), other] }] }],
  },

  // ── Consumer services ──
  {
    ...c("home_services", "Home services", "Maintenance, cleaning, moving"),
    models: [{ ...B2C(), types: [{ ...c("consumer_services", "Home service company"), revenueModel: "leadgen", categories: [c("maintenance", "Maintenance"), c("cleaning", "Cleaning"), c("pest", "Pest control"), c("moving", "Moving"), c("ac", "AC services"), other] }] }],
  },
  {
    ...c("events", "Events", "Weddings, corporate and venues"),
    models: [{ ...B2C(), types: [{ ...c("events", "Events company"), revenueModel: "leadgen", categories: [c("weddings", "Weddings"), c("corporate", "Corporate events"), c("venues", "Venues"), c("photography", "Photography"), other] }] }],
  },
  {
    ...c("travel", "Travel agencies", "Trips, Umrah and visas"),
    models: [{ ...B2C(), types: [{ ...c("travel", "Travel agency"), revenueModel: "leadgen", categories: [c("holidays", "Holidays"), c("umrah", "Hajj and Umrah"), c("corporate", "Corporate travel"), c("visas", "Visas"), other] }] }],
  },
  {
    ...c("hospitality", "Hotels", "Hotels and short-stay rentals"),
    models: [{ ...B2C("Guests"), types: [{ ...c("hotel", "Hotel or rental"), revenueModel: "other", categories: [c("hotel", "Hotel"), c("apartments", "Serviced apartments"), c("chalets", "Chalets and resorts"), other] }] }],
  },

  // ── Property and cars ──
  {
    ...c("real_estate", "Real estate brokerage"),
    models: [{ ...B2C("Buyers and tenants"), types: [{ ...c("brokerage", "Brokerage"), revenueModel: "leadgen", categories: [c("residential", "Residential sales"), c("rentals", "Rentals"), c("commercial", "Commercial"), other] }] }],
  },
  {
    ...c("real_estate_dev", "Real estate development"),
    models: [{ ...B2C("Buyers"), types: [{ ...c("developer", "Developer"), revenueModel: "leadgen", categories: [c("off_plan", "Off-plan"), c("ready", "Ready units"), c("mixed", "Mixed use"), other] }] }],
  },
  {
    ...c("automotive", "Car dealerships"),
    models: [{ ...B2C(), types: [{ ...c("dealership", "Dealership"), revenueModel: "leadgen", categories: [c("new", "New cars"), c("used", "Used cars"), c("luxury", "Luxury"), c("leasing", "Leasing"), other] }] }],
  },
  {
    ...c("car_care", "Car services", "Maintenance, wash and parts"),
    models: [
      {
        ...B2C(),
        types: [
          { ...c("car_services", "Workshop or car wash"), revenueModel: "other", categories: [c("maintenance", "Maintenance"), c("detailing", "Car wash"), c("tinting", "Tinting and protection film"), c("tyres", "Tyres"), other] },
          { ...c("parts", "Parts store"), revenueModel: "ecommerce", categories: [c("parts", "Spare parts"), c("accessories", "Car accessories"), other] },
        ],
      },
    ],
  },

  {
    ...c("other", "Other industry"),
    models: [
      {
        ...B2C(),
        types: [
          { ...c("sell_online", "Sell products online"), revenueModel: "ecommerce", categories: [] },
          { ...c("leads", "Generate enquiries and close sales"), revenueModel: "leadgen", categories: [] },
          { ...c("subscriptions", "Subscriptions or memberships"), revenueModel: "subscription", categories: [] },
          { ...c("in_person", "Walk-in or booked visits"), revenueModel: "other", categories: [] },
        ],
      },
      {
        ...B2B(),
        types: [
          { ...c("leads", "Generate enquiries and close deals"), revenueModel: "leadgen", categories: [] },
          { ...c("subscriptions", "Recurring contracts"), revenueModel: "subscription", categories: [] },
        ],
      },
    ],
  },
];

export const GEOGRAPHIES: GeographyNode[] = [
  { ...c("SA", "Saudi Arabia"), currency: "SAR", cities: [c("riyadh", "Riyadh"), c("jeddah", "Jeddah"), c("dammam", "Dammam and Khobar"), c("makkah", "Makkah"), c("madinah", "Madinah"), c("abha", "Abha"), c("multiple", "Several cities"), other] },
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

/** "E-commerce · B2C · Own brand (D2C) · Perfumes and oud · Riyadh, Saudi Arabia". */
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
