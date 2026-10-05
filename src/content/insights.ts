/**
 * Insights (blog). Practical, opinion-led articles. Do not cite statistics or
 * client results here unless they come from a real, approved source.
 */
export interface Insight {
  slug: string;
  title: string;
  description: string;
  /** ISO date. */
  date: string;
  readMinutes: number;
  topic: string;
  sections: { heading?: string; paragraphs: string[] }[];
}

export const INSIGHTS: Insight[] = [
  {
    slug: "find-your-one-growth-bottleneck",
    title: "Find your one growth bottleneck before you spend another riyal",
    description: "Most growth problems are one constraint showing up everywhere. How to find it, and why fixing anything else first wastes money.",
    date: "2026-10-05",
    readMinutes: 5,
    topic: "Diagnosis",
    sections: [
      {
        paragraphs: [
          "When growth slows, the instinct is to do more of everything: more ads, more content, a new website, a new CRM. Each of these can help, but if they do not touch the one thing that is actually holding the business back, the money mostly leaks out of the funnel somewhere else.",
          "A growth system behaves like a chain. Market, value, acquisition, activation, retention, expansion and scale all depend on each other, and the weakest link sets the pace for the whole system.",
        ],
      },
      {
        heading: "Why the obvious problem is often the wrong one",
        paragraphs: [
          "Rising acquisition costs are the most common complaint we hear. Yet when CAC rises, the cause is often downstream: a checkout that loses half its buyers, or customers who never come back. Paying more to fill a leaking bucket makes CAC look worse every month.",
          "The reverse also happens. A team works hard on conversion rate when the real constraint is that the business is reaching the wrong customers in the first place.",
        ],
      },
      {
        heading: "A simple way to find the constraint",
        paragraphs: [
          "Score each part of the funnel honestly, then ask two questions for every weak area: how bad is it, and how much value is already flowing into it? Strong acquisition feeding weak conversion is a bigger bottleneck than weak conversion with almost no traffic.",
          "Multiply severity by impact by that dependency, and the area with the highest result is where the next riyal, hour and experiment should go. That is exactly how the Growx Era Growth Diagnostic ranks bottlenecks.",
        ],
      },
      {
        heading: "What to do this week",
        paragraphs: [
          "Write down your conversion rate at each step, your repeat purchase or churn rate, and your CAC. If you do not know one of them, that gap is your first finding: you cannot fix what you cannot see. Then pick the single weakest step and run one experiment on it before touching anything else.",
        ],
      },
    ],
  },
  {
    slug: "tracking-before-scaling",
    title: "Fix your tracking before you scale your ad budget",
    description: "Scaling paid media on broken attribution is the fastest way to waste a budget. What a proper event map looks like, and how to check yours.",
    date: "2026-10-05",
    readMinutes: 6,
    topic: "Analytics",
    sections: [
      {
        paragraphs: [
          "Every scaling decision rests on numbers: which channel brings customers, which campaign pays back, which experiment won. If those numbers are wrong, every decision built on them is a guess, however confident the dashboard looks.",
          "In mobile apps especially, broken attribution and missing postbacks are common. Ad platforms then optimise towards the wrong users, and teams cut the channels that were actually working.",
        ],
      },
      {
        heading: "Start with an event map, not a tool",
        paragraphs: [
          "Before installing anything, list the moments that matter in your funnel: first visit, sign-up, first key action, purchase, repeat purchase, referral. For each one, write its exact name, when it fires and which properties it carries, such as value, currency and channel.",
          "This map becomes the contract between marketing, product and engineering. Without it, the same event ends up named three different ways in three tools.",
        ],
      },
      {
        heading: "Then implement and QA end to end",
        paragraphs: [
          "Implement events in your analytics, your attribution tool and your CRM from the same map. Then test each one on a real device or browser: does it fire once, with the right properties, and does it reach every destination?",
          "Finally, reconcile. Purchases in analytics should roughly match orders in your backend. A large gap means the data is not ready to drive spend yet.",
        ],
      },
      {
        heading: "The payoff",
        paragraphs: [
          "Clean tracking does not grow a business by itself, but it makes everything else work: budgets move to channels that truly pay back, experiments have a clear winner, and cohort analysis shows where customers drop off. It is the first thing we set up on every engagement.",
        ],
      },
    ],
  },
  {
    slug: "weekly-experimentation-cadence",
    title: "How to run 8–10 growth experiments a month without chaos",
    description: "A lightweight experimentation system: one backlog, ICE prioritisation, a weekly rhythm and a learning log that compounds.",
    date: "2026-10-05",
    readMinutes: 5,
    topic: "Experimentation",
    sections: [
      {
        paragraphs: [
          "Most teams do not lack ideas. They lack a system that turns ideas into tested learnings at a steady pace. Without one, experiments are launched on gut feel, results are never written down, and the same failed idea gets tried again a year later.",
        ],
      },
      {
        heading: "One backlog, scored with ICE",
        paragraphs: [
          "Keep every idea in one backlog. Score each from 1 to 10 on Impact (how much it could move the target metric), Confidence (how sure you are it will work) and Ease (how quickly it can ship). Work from the top.",
          "Each idea needs a hypothesis and a decision metric before it is allowed into a sprint: if we do X, metric Y will move, because Z. Our Experimentation Lab has over a hundred ideas written this way to start from.",
        ],
      },
      {
        heading: "A weekly rhythm",
        paragraphs: [
          "Once a week, review the experiments that finished, decide what ships, and pick the next ones from the backlog. Keep the meeting short and focused on decisions, not status updates.",
          "Run tests long enough to reach a meaningful sample, and agree the stopping rule before launch so nobody calls a winner after two good days.",
        ],
      },
      {
        heading: "A learning log that compounds",
        paragraphs: [
          "Record every result, wins and losses alike, with what you expected and what happened. Over time this log becomes the team's most valuable growth asset: a map of what works for your customers, in your market.",
        ],
      },
    ],
  },
];

export function getInsight(slug: string) {
  return INSIGHTS.find((i) => i.slug === slug);
}
