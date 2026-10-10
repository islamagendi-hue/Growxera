import "server-only";
/**
 * Read-only figures for the overview. Each figure says where it came from; when there is
 * no data the caller shows "No data", never zero.
 */
import { selectAll } from "@/lib/server/store";

interface ContentRow {
  id: string;
  published_at: string | null;
  published_via: string | null;
  source: string;
  language: string | null;
}
interface MetricRow {
  content_id: string;
  measured_at: string;
  window_kind: string;
  source: string;
  impressions: number | null;
  reach: number | null;
  reactions: number | null;
  comments: number | null;
}

export interface HistoryStats {
  posts: number;
  native: number;
  viaTool: number;
  firstAt: string | null;
  lastAt: string | null;
  sources: string[];
  metrics: {
    posts: number;
    medianImpressions: number | null;
    medianReach: number | null;
    totalReactions: number;
    totalComments: number;
    measuredAt: string | null;
    source: string | null;
    window: string | null;
  } | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function historyStats(): Promise<HistoryStats> {
  const content = await selectAll<ContentRow>("li_content", [], { columns: "id,published_at,published_via,source,language" });
  const dates = content.map((c) => c.published_at).filter((d): d is string => !!d).sort();
  const metrics = await selectAll<MetricRow>("li_metrics_snapshots", []);
  // Latest snapshot per post.
  const latest = new Map<string, MetricRow>();
  for (const m of metrics) {
    const prev = latest.get(m.content_id);
    if (!prev || prev.measured_at < m.measured_at) latest.set(m.content_id, m);
  }
  const rows = [...latest.values()];
  const nums = (k: "impressions" | "reach") => rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  return {
    posts: content.length,
    native: content.filter((c) => c.published_via === "linkedin_native").length,
    viaTool: content.filter((c) => c.published_via && c.published_via !== "linkedin_native").length,
    firstAt: dates[0] ?? null,
    lastAt: dates.at(-1) ?? null,
    sources: [...new Set(content.map((c) => c.source))],
    metrics: rows.length
      ? {
          posts: rows.length,
          medianImpressions: median(nums("impressions")),
          medianReach: median(nums("reach")),
          totalReactions: rows.reduce((s, r) => s + (r.reactions ?? 0), 0),
          totalComments: rows.reduce((s, r) => s + (r.comments ?? 0), 0),
          measuredAt: rows.map((r) => r.measured_at).sort().at(-1) ?? null,
          source: [...new Set(rows.map((r) => r.source))].join(", "),
          window: [...new Set(rows.map((r) => r.window_kind))].join(", "),
        }
      : null,
  };
}
