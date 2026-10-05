import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { path: "/", priority: 1 },
    { path: "/diagnostic", priority: 0.9 },
    { path: "/how-we-work", priority: 0.7 },
    { path: "/services", priority: 0.7 },
    { path: "/contact", priority: 0.5 },
    { path: "/privacy", priority: 0.2 },
  ].map(({ path, priority }) => ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency: "monthly", priority }));
}
