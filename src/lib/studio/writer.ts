import "server-only";
/**
 * Topic → draft, written by Grok in the owner's voice. Never publishes: the result is a studio
 * draft the owner reviews, edits and approves like any other post.
 *
 * - Learns from the account: the best-performing published posts (by reactions and comments) go
 *   into the prompt as style examples.
 * - Doesn't repeat itself: recent published openings go into the prompt as "already covered",
 *   and the finished draft is compared with published history; a close match is flagged on the
 *   draft (similarity score and the post it resembles).
 * - Topics: a backlog the owner keeps in the studio (li_settings key "topic_backlog").
 */
import { eq, insert, select, selectOne, update } from "@/lib/server/store";
import { generate } from "./grok";
import { audit, createDraft } from "./repo";
import { WorkflowError } from "./workflow";

export type WriteFormat = "post" | "newsletter";

export interface WriteInput {
  topic: string;
  angle?: string | null;
  format: WriteFormat;
}

interface PublishedRow {
  id: string;
  text: string;
  published_at: string | null;
}

// ── Learning from the account ───────────────────────────────────────────────

/** The best published posts by engagement (reactions + 2 × comments), with their text. */
export async function topExamples(limit = 3): Promise<string[]> {
  const content = await select<PublishedRow>("li_content", [], { columns: "id,text,published_at" });
  const metrics = await select<{ content_id: string; reactions: number | null; comments: number | null }>("li_metrics_snapshots", [], {
    columns: "content_id,reactions,comments",
  });
  const score = new Map<string, number>();
  for (const m of metrics) score.set(m.content_id, Math.max(score.get(m.content_id) ?? 0, (m.reactions ?? 0) + 2 * (m.comments ?? 0)));
  return content
    .filter((c) => c.text?.trim() && score.has(c.id))
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, limit)
    .map((c) => c.text.trim().slice(0, 1200));
}

/** Openings of the most recent published posts, newest first. */
export async function recentOpenings(limit = 30): Promise<string[]> {
  const content = await select<PublishedRow>("li_content", [], { columns: "id,text,published_at", order: { col: "published_at", ascending: false }, limit });
  return content.map((c) => opening(c.text)).filter(Boolean);
}

const opening = (text: string) => (text ?? "").split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim().slice(0, 160);

// ── Repetition check ────────────────────────────────────────────────────────

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z؀-ۿ]{4,}/g) ?? []).filter((w) => !STOP.has(w)));
const STOP = new Set(["that", "this", "with", "your", "from", "have", "they", "what", "when", "will", "more", "than", "into", "about", "their", "there", "which", "would", "been", "were", "just", "only", "them", "then", "very"]);

/** Jaccard similarity of the meaningful words of two texts, 0…1. */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

export const SIMILAR_AT = 0.35;

/** The published post most similar to the text, if any reaches the threshold. */
export async function closestPublished(text: string): Promise<{ score: number; opening: string; published_at: string | null } | null> {
  const content = await select<PublishedRow>("li_content", [], { columns: "id,text,published_at" });
  let best: { score: number; opening: string; published_at: string | null } | null = null;
  for (const c of content) {
    const score = similarity(text, c.text ?? "");
    if (!best || score > best.score) best = { score, opening: opening(c.text), published_at: c.published_at };
  }
  return best && best.score >= SIMILAR_AT ? best : null;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

export function buildPrompt(input: WriteInput, examples: string[], covered: string[]) {
  const voice = [
    "You write for Islam Gendi (Growxera, growth systems): a growth strategist for SaaS, apps and e-commerce founders.",
    "Voice: plain, direct, numbers-first, no hype, no emojis, no hashtags walls (at most 3 relevant hashtags at the end), short paragraphs.",
    "Never invent statistics, client names or quotes. Use clearly hypothetical examples (\"Picture a team that…\") when needed.",
    "Write in English unless the topic is written in Arabic.",
  ].join("\n");
  const shape =
    input.format === "newsletter"
      ? [
          "Format: one issue of the LinkedIn newsletter \"Behind the Number\" (600–900 words).",
          "Sections, each with a short heading: The number · What's happening (recent industry context, no fabricated facts) · Case study (a realistic, clearly hypothetical company) · What it means · One thing to try this week.",
          "Start with a title line, then a one-sentence subtitle.",
        ].join("\n")
      : [
          "Format: one LinkedIn post, 150–220 words.",
          "The first two lines are the hook: a short, surprising statement, then a turn (they become the post's image).",
          "End with one specific question to the reader.",
        ].join("\n");
  const system = `${voice}\n\n${shape}\n\nReturn only the finished text, no preamble, no markdown code fences.`;
  const prompt = [
    `Topic: ${input.topic.trim()}`,
    input.angle?.trim() ? `Angle / notes from Islam: ${input.angle.trim()}` : null,
    examples.length ? `\nHis best-performing posts (match their style, don't copy them):\n${examples.map((e, i) => `--- Example ${i + 1}\n${e}`).join("\n")}` : null,
    covered.length ? `\nAlready published (don't repeat these angles or hooks):\n${covered.map((c) => `- ${c}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, prompt, maxOutputTokens: input.format === "newsletter" ? 1800 : 700 };
}

const cleanOutput = (s: string) => s.replace(/^```[a-z]*\n?|\n?```$/g, "").replace(/\r\n/g, "\n").trim();

// ── Writing ─────────────────────────────────────────────────────────────────

export interface WriteResult {
  actionId: string;
  costUsd: number;
  similar: Awaited<ReturnType<typeof closestPublished>>;
}

export async function writeDraft(input: WriteInput, actor: string): Promise<WriteResult> {
  const topic = input.topic.replace(/\s+/g, " ").trim();
  if (topic.length < 3) throw new WorkflowError("Write the topic first.");
  if (topic.length > 300) throw new WorkflowError("Keep the topic under 300 characters; put details in the angle.");
  const [examples, covered] = await Promise.all([topExamples(), recentOpenings()]);
  const p = buildPrompt({ ...input, topic }, examples, covered);
  const r = await generate({ ...p, purpose: input.format === "newsletter" ? "newsletter_draft" : "post_draft" });
  const text = cleanOutput(r.text);
  if (!text) throw new WorkflowError("Grok returned no text. Nothing was saved.");
  const similar = await closestPublished(text);
  const notes = [
    `Written by Grok from the topic: ${topic}`.slice(0, 200),
    similar ? `Similar to a published post (${Math.round(similar.score * 100)}%): "${similar.opening.slice(0, 60)}"` : null,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 300);
  const { actionId } = await createDraft({
    kind: input.format === "newsletter" ? "newsletter" : "post",
    actionKind: input.format === "newsletter" ? "publish_newsletter" : "publish_post",
    channel: "manual",
    origin: "grok",
    author: actor,
    notes,
    status: "draft",
    content: { text: text.slice(0, input.format === "newsletter" ? 12000 : 3000), assets: [], target_at: null },
  });
  await audit(actor, "draft.generated", "li_actions", actionId, {
    format: input.format,
    model: r.model,
    costUsd: Number(r.costUsd.toFixed(4)),
    similarTo: similar ? Math.round(similar.score * 100) : null,
  });
  return { actionId, costUsd: r.costUsd, similar };
}

// ── Topic backlog ───────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  text: string;
  angle: string | null;
  format: WriteFormat;
  added_at: string;
  draft_action_id: string | null;
}

const TOPICS_KEY = "topic_backlog";

export async function listTopics(): Promise<Topic[]> {
  const row = await selectOne<{ value: unknown }>("li_settings", [eq("key", TOPICS_KEY)]).catch(() => null);
  return Array.isArray(row?.value) ? (row.value as Topic[]) : [];
}

async function saveTopics(topics: Topic[], actor: string): Promise<void> {
  const value = topics.slice(0, 200);
  const at = new Date().toISOString();
  const updated = await update("li_settings", [eq("key", TOPICS_KEY)], { value, updated_at: at, updated_by: actor });
  if (!updated.length) await insert("li_settings", { key: TOPICS_KEY, value, updated_at: at, updated_by: actor });
}

export async function addTopic(input: { text: string; angle?: string | null; format: WriteFormat }, actor: string): Promise<Topic> {
  const text = input.text.replace(/\s+/g, " ").trim();
  if (text.length < 3) throw new WorkflowError("Write the topic first.");
  if (text.length > 300) throw new WorkflowError("Keep the topic under 300 characters; put details in the angle.");
  const topics = await listTopics();
  if (topics.some((t) => t.text.toLowerCase() === text.toLowerCase())) throw new WorkflowError("That topic is already on the list.");
  const topic: Topic = {
    id: crypto.randomUUID(),
    text,
    angle: input.angle?.trim().slice(0, 500) || null,
    format: input.format,
    added_at: new Date().toISOString(),
    draft_action_id: null,
  };
  await saveTopics([topic, ...topics], actor);
  await audit(actor, "topic.added", "li_settings", null, { format: topic.format });
  return topic;
}

export async function removeTopic(id: string, actor: string): Promise<void> {
  const topics = await listTopics();
  if (!topics.some((t) => t.id === id)) throw new WorkflowError("Topic not found.");
  await saveTopics(
    topics.filter((t) => t.id !== id),
    actor,
  );
}

/** Writes the topic's draft and links it to the topic. */
export async function writeTopic(id: string, actor: string): Promise<WriteResult> {
  const topics = await listTopics();
  const topic = topics.find((t) => t.id === id);
  if (!topic) throw new WorkflowError("Topic not found.");
  const result = await writeDraft({ topic: topic.text, angle: topic.angle, format: topic.format }, actor);
  await saveTopics(
    topics.map((t) => (t.id === id ? { ...t, draft_action_id: result.actionId } : t)),
    actor,
  );
  return result;
}
