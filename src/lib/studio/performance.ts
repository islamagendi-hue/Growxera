import "server-only";
/**
 * What works on the account, from the imported history (li_content + li_metrics_snapshots):
 * engagement by weekday and hour (Riyadh time), and the top posts. Small samples are labelled;
 * nothing here is a forecast.
 */
import { select } from "@/lib/server/store";

interface Row {
  id: string;
  text: string;
  published_at: string | null;
}
interface Metric {
  content_id: string;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
}

export interface Bucket {
  key: number;
  label: string;
  posts: number;
  avgEngagement: number;
  avgImpressions: number;
}

export interface Performance {
  posts: number;
  byDay: Bucket[];
  byHour: Bucket[];
  top: { id: string; opening: string; engagement: number; impressions: number; published_at: string }[];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekday (0 = Sunday) and hour in Riyadh (UTC+3, no daylight saving). */
export function riyadhSlot(iso: string): { day: number; hour: number } {
  const t = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  return { day: t.getUTCDay(), hour: t.getUTCHours() };
}

export function summarize(content: Row[], metrics: Metric[], minPosts = 2): Performance {
  const best = new Map<string, Metric>();
  for (const m of metrics) {
    const prev = best.get(m.content_id);
    if (!prev || (m.impressions ?? 0) > (prev.impressions ?? 0)) best.set(m.content_id, m);
  }
  const rows = content
    .filter((c) => c.published_at && best.has(c.id))
    .map((c) => {
      const m = best.get(c.id)!;
      return { ...c, published_at: c.published_at!, engagement: (m.reactions ?? 0) + (m.comments ?? 0), impressions: m.impressions ?? 0 };
    });
  const group = (keyOf: (iso: string) => number, label: (k: number) => string) => {
    const g = new Map<number, { n: number; e: number; i: number }>();
    for (const r of rows) {
      const k = keyOf(r.published_at);
      const v = g.get(k) ?? { n: 0, e: 0, i: 0 };
      g.set(k, { n: v.n + 1, e: v.e + r.engagement, i: v.i + r.impressions });
    }
    return [...g.entries()]
      .filter(([, v]) => v.n >= minPosts)
      .map(([k, v]) => ({ key: k, label: label(k), posts: v.n, avgEngagement: v.e / v.n, avgImpressions: v.i / v.n }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement || b.avgImpressions - a.avgImpressions);
  };
  return {
    posts: rows.length,
    byDay: group((iso) => riyadhSlot(iso).day, (k) => DAYS[k]),
    byHour: group((iso) => riyadhSlot(iso).hour, (k) => `${String(k).padStart(2, "0")}:00`),
    top: [...rows]
      .sort((a, b) => b.engagement - a.engagement || b.impressions - a.impressions)
      .slice(0, 3)
      .map((r) => ({ id: r.id, opening: r.text.split(/\n/)[0].slice(0, 120), engagement: r.engagement, impressions: r.impressions, published_at: r.published_at })),
  };
}

export async function accountPerformance(): Promise<Performance> {
  const [content, metrics] = await Promise.all([
    select<Row>("li_content", [], { columns: "id,text,published_at" }),
    select<Metric>("li_metrics_snapshots", [], { columns: "content_id,impressions,reactions,comments" }),
  ]);
  return summarize(content, metrics);
}
