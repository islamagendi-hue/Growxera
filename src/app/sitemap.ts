import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { CASE_STUDIES } from "@/content/case-studies";
import { INSIGHTS } from "@/content/insights";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { path: "/", priority: 1 },
    { path: "/diagnostic", priority: 0.9 },
    { path: "/how-we-work", priority: 0.7 },
    { path: "/services", priority: 0.7 },
    { path: "/case-studies", priority: 0.7 },
    { path: "/experimentation-lab", priority: 0.7 },
    { path: "/insights", priority: 0.6 },
    ...INSIGHTS.map((a) => ({ path: `/insights/${a.slug}`, priority: 0.5 })),
    ...CASE_STUDIES.map((c) => ({ path: `/case-studies/${c.slug}`, priority: 0.5 })),
    { path: "/ar", priority: 0.8 },
    { path: "/contact", priority: 0.5 },
    { path: "/privacy", priority: 0.2 },
  ].map(({ path, priority }) => ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency: "monthly", priority }));
}
