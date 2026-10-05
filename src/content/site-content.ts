/** Site copy that is reused across pages. */
export const SYSTEM_STEPS = [
  { key: "market", label: "Market", verb: "MARKET", text: "Choose the customers and segments worth winning, and confirm the demand is there." },
  { key: "value", label: "Value", verb: "VALUE", text: "Give them a clear reason to choose you, priced to protect margin." },
  { key: "acquisition", label: "Acquisition", verb: "ACQUIRE", text: "Win new customers through channels that scale at a cost you can afford." },
  { key: "activation", label: "Activation", verb: "ACTIVATE", text: "Turn attention into revenue: conversion, onboarding and sales process." },
  { key: "retention", label: "Retention", verb: "RETAIN", text: "Bring customers back with lifecycle, CRM and a reason to stay." },
  { key: "expansion", label: "Expansion", verb: "EXPAND", text: "Grow revenue per customer through bundles, upsells and pricing." },
  { key: "scale", label: "Scale", verb: "SCALE", text: "Compound what works with trusted data, experimentation and healthy economics." },
] as const;

export const BOTTLENECKS = [
  { title: "Acquisition", text: "You are getting attention, but not enough customers." },
  { title: "Conversion", text: "Traffic exists, but revenue isn't following." },
  { title: "Retention", text: "Customers buy once and disappear." },
  { title: "Monetization", text: "Customers exist, but revenue per customer is too low." },
  { title: "GTM", text: "Your market, positioning and channels aren't aligned." },
  { title: "Scale", text: "Revenue is growing, but economics are deteriorating." },
];

export const HOW_WE_WORK = [
  {
    n: "01",
    title: "Diagnose",
    line: "Find the bottleneck.",
    text: "We analyse your funnel, unit economics and operating rhythm to find what is actually holding growth back, and size the opportunity behind it.",
  },
  {
    n: "02",
    title: "Transform",
    line: "Build the growth system.",
    text: "We redesign the parts of the system that matter most: positioning, channels, conversion, lifecycle, pricing and the data underneath them.",
  },
  {
    n: "03",
    title: "Scale",
    line: "Compound what works.",
    text: "We run a disciplined experimentation and reporting cadence with your team so gains hold, and growth gets more efficient as it grows.",
  },
];

export const OFFERINGS = [
  {
    name: "Growth Diagnostic",
    line: "Find the problem.",
    text: "A focused engagement that validates the bottleneck, quantifies the opportunity and gives you a prioritised roadmap.",
    deliverables: ["Funnel and unit-economics review", "Bottleneck and opportunity sizing", "90-day growth roadmap"],
  },
  {
    name: "Growth Transformation",
    line: "Fix the system.",
    text: "We work alongside your team to rebuild the parts of the growth system the diagnostic identified, and install the measurement to prove it.",
    deliverables: ["System redesign across priority dimensions", "Implementation with your team", "Measurement and reporting"],
  },
  {
    name: "Growth Partnership",
    line: "Build and scale with the team.",
    text: "An ongoing partnership: strategy, experimentation and execution oversight, accountable to commercial outcomes.",
    deliverables: ["Quarterly growth strategy", "Experimentation programme", "Leadership-level growth reviews"],
  },
];

export const CAPABILITIES = [
  "GTM",
  "Growth Strategy",
  "Acquisition",
  "CRO",
  "Retention",
  "CRM",
  "Monetization",
  "Analytics",
  "Growth Operations",
  "AI & Automation",
];

export const PROBLEM_ORIGINS = [
  "Market",
  "Positioning",
  "Acquisition",
  "Conversion",
  "Retention",
  "Monetization",
  "Economics",
  "Operating system",
];
