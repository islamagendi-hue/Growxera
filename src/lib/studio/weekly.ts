import "server-only";
/**
 * Weekly plan (owner decision 12 Oct 2026: one-click weekly approval).
 *
 * Every week the studio prepares the next week's posts by itself: a topic (the backlog first,
 * else one Grok proposes from what works and what's already covered) → Grok draft (writer.ts)
 * → quality gates → house-style design → planned at the next free best slot → "ready for review".
 * Nothing is approved or published here. The owner then approves the whole week with one click
 * (approveWeek), which approves each exact version and schedules it for automatic publishing;
 * publishing itself still goes through every lock (both switches, the 60–10 s window, no late
 * posts, no duplicates, no retry on an unknown outcome).
 */
import { inList, select } from "@/lib/server/store";
import { uploadAsset } from "./assets";
import { authorizeAutoPublish, leadTimeOk } from "./autopublish";
import { designText, renderDesign } from "./design";
import { generate, grokStatus } from "./grok";
import { addVersion, approve, audit, getAction, submitForReview } from "./repo";
import { WorkflowError } from "./workflow";
import { addTopic, closestPublished, listTopics, recentOpenings, SIMILAR_AT, writeTopic, type Topic } from "./writer";

export const PLANNER = "weekly-planner";
export const POSTS_PER_WEEK = 7;
const HORIZON_DAYS = 8;
/** Grok drafts per call: a serverless call has 60 s; the hourly cron fills the week over a few runs. */
export const MAX_PER_RUN = 2;

/**
 * One post a day, Riyadh time, alternating the account's two strongest hours (12:00 and 22:00),
 * with the strongest days (Sunday, Thursday) at noon.
 */
export const SLOTS: { day: number; hour: number }[] = [
  { day: 0, hour: 12 },
  { day: 1, hour: 22 },
  { day: 2, hour: 12 },
  { day: 3, hour: 22 },
  { day: 4, hour: 12 },
  { day: 5, hour: 22 },
  { day: 6, hour: 12 },
];

/** The weekly Behind the Number issue: prepared for Wednesday 10:00 Riyadh, published by hand (no API). */
export const NEWSLETTER_SLOT = { day: 3, hour: 10 };

const RIYADH_MS = 3 * 3_600_000;

/** Slot instants (UTC ISO) more than 2 hours after `from` and within `days`. */
export function upcomingSlots(from: Date, days = HORIZON_DAYS, slots = SLOTS): string[] {
  const out: string[] = [];
  const local = new Date(from.getTime() + RIYADH_MS);
  for (let d = 0; d <= days; d++) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + d));
    for (const s of slots) {
      if (day.getUTCDay() !== s.day) continue;
      const t = new Date(day.getTime() + s.hour * 3_600_000 - RIYADH_MS);
      if (t.getTime() > from.getTime() + 2 * 3_600_000 && t.getTime() <= from.getTime() + days * 86_400_000) out.push(t.toISOString());
    }
  }
  return out.sort();
}

/** Reasons a draft can't go into the weekly plan; empty means it passes. */
export function qualityProblems(text: string, similarityScore: number | null): string[] {
  const p: string[] = [];
  if (text.length < 400) p.push("too short");
  if (text.length > 3000) p.push("longer than LinkedIn allows");
  if (similarityScore !== null && similarityScore >= SIMILAR_AT) p.push(`too similar to a published post (${Math.round(similarityScore * 100)}%)`);
  if (/\b(as an ai|language model|lorem ipsum)\b/i.test(text)) p.push("contains assistant boilerplate");
  if (/\{\{|\bTODO\b|\[(insert|name|company|number)[^\]]*\]/i.test(text)) p.push("contains placeholders");
  if ((text.match(/#\w+/g) ?? []).length > 5) p.push("too many hashtags");
  return p;
}

async function proposeTopic(): Promise<string> {
  const covered = await recentOpenings(40);
  const r = await generate({
    purpose: "topic_proposal",
    maxOutputTokens: 60,
    system:
      "You plan LinkedIn content for Islam Gendi, a growth strategist (growth economics for SaaS, apps and e-commerce: CAC, payback, retention, pricing, funnels, attribution). Reply with ONE topic line, max 120 characters, no quotes, no numbering.",
    prompt: `Propose one fresh, specific topic. Don't repeat these already-published angles:\n${covered.map((c) => `- ${c}`).join("\n")}`,
  });
  const topic = r.text.split("\n")[0].replace(/^["'\-\d.\s]+|["']$/g, "").trim().slice(0, 200);
  if (topic.length < 3) throw new WorkflowError("Grok didn't propose a usable topic.");
  return topic;
}

async function nextTopic(format: "post" | "newsletter" = "post"): Promise<Topic> {
  const unused = (await listTopics()).filter((t) => !t.draft_action_id && t.format === format);
  if (unused.length) return unused[unused.length - 1]; // oldest first
  return addTopic({ text: await proposeTopic(), angle: null, format }, PLANNER);
}

interface PlannedRow {
  id: string;
  status: string;
  draft_id: string;
}

export const riyadhDate = (iso: string) => new Date(new Date(iso).getTime() + RIYADH_MS).toISOString().slice(0, 10);

/** Riyadh days that already have a post approved or waiting for review (one post a day at most). */
async function takenSlots(): Promise<Set<string>> {
  const actions = await select<PlannedRow>("li_actions", [inList("status", ["approved", "ready_for_review"])], { columns: "id,status,draft_id" });
  const out = new Set<string>();
  for (const a of actions) {
    const d = await getAction(a.id);
    if (d?.current.target_at && d.action.kind === "publish_post") out.add(riyadhDate(d.current.target_at));
  }
  return out;
}

export interface PrepareResult {
  ran: boolean;
  reason?: string;
  prepared: { actionId: string; targetAt: string }[];
  skipped: { actionId?: string; reason: string }[];
}

/** Fills the free slots of the coming week with drafts waiting for the owner's weekly approval. */
export async function prepareWeek(now = new Date()): Promise<PrepareResult> {
  const result: PrepareResult = { ran: false, prepared: [], skipped: [] };
  if (!grokStatus().enabled) return { ...result, reason: "Grok isn't enabled." };
  const taken = await takenSlots();
  const free = upcomingSlots(now).filter((s) => !taken.has(riyadhDate(s)));
  const need = Math.min(MAX_PER_RUN, free.length);
  result.ran = true;
  for (const targetAt of free.slice(0, need)) {
    let actionId: string | undefined;
    try {
      const topic = await nextTopic();
      const written = await writeTopic(topic.id, PLANNER);
      actionId = written.actionId;
      const d = (await getAction(actionId))!;
      const score = written.similar?.score ?? (await closestPublished(d.current.text))?.score ?? null;
      const problems = qualityProblems(d.current.text, score);
      if (problems.length) {
        result.skipped.push({ actionId, reason: problems.join(", ") });
        await audit(PLANNER, "weekly.draft_rejected", "li_actions", actionId, { problems });
        continue;
      }
      const t = designText(d.current.text);
      const png = new Uint8Array(await (await renderDesign(t, "portrait")).arrayBuffer());
      const file = await uploadAsset(png, `Design: ${t.lineA}`.slice(0, 200), PLANNER);
      await addVersion(actionId, { text: d.current.text, assets: [file], target_at: targetAt }, PLANNER, "Weekly plan: design and planned time");
      await submitForReview(actionId, PLANNER);
      result.prepared.push({ actionId, targetAt });
      await audit(PLANNER, "weekly.prepared", "li_actions", actionId, { targetAt, topic: topic.text.slice(0, 120) });
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown";
      result.skipped.push({ actionId, reason });
      await audit(PLANNER, "weekly.failed", "li_actions", actionId ?? null, { reason }).catch(() => undefined);
      if (/budget|not enabled|could not be reached/i.test(reason)) break;
    }
  }
  // The week's newsletter issue, unless one is already planned in the coming week (only when no post was written this run).
  if (result.prepared.length + result.skipped.length >= MAX_PER_RUN) return result;
  try {
    const nlSlot = upcomingSlots(now, HORIZON_DAYS, [NEWSLETTER_SLOT])[0];
    const planned = await select<PlannedRow & { kind: string }>("li_actions", [inList("status", ["approved", "ready_for_review"])], { columns: "id,status,draft_id,kind" });
    let hasIssue = false;
    for (const a of planned.filter((p) => p.kind === "publish_newsletter")) {
      const d = await getAction(a.id);
      if (d?.current.target_at && new Date(d.current.target_at) > now) hasIssue = true;
    }
    if (nlSlot && !hasIssue) {
      const topic = await nextTopic("newsletter");
      const written = await writeTopic(topic.id, PLANNER);
      const d = (await getAction(written.actionId))!;
      const t = designText(d.current.text, { eyebrow: "BEHIND THE NUMBER" });
      const png = new Uint8Array(await (await renderDesign(t, "landscape")).arrayBuffer());
      const cover = await uploadAsset(png, `Cover: ${t.lineA}`.slice(0, 200), PLANNER);
      await addVersion(written.actionId, { text: d.current.text, assets: [cover], target_at: nlSlot }, PLANNER, "Weekly plan: newsletter cover and planned time");
      await submitForReview(written.actionId, PLANNER);
      result.prepared.push({ actionId: written.actionId, targetAt: nlSlot });
      await audit(PLANNER, "weekly.prepared", "li_actions", written.actionId, { targetAt: nlSlot, newsletter: true });
    }
  } catch (err) {
    result.skipped.push({ reason: `newsletter: ${err instanceof Error ? err.message.slice(0, 180) : "unknown"}` });
  }
  return result;
}

export interface WeekItem {
  actionId: string;
  opening: string;
  targetAt: string;
  hasImage: boolean;
  newsletter: boolean;
}

/** Posts waiting for review with a planned time in the coming week: what "Approve the week" covers. */
export async function weekBatch(now = new Date()): Promise<WeekItem[]> {
  const actions = await select<PlannedRow>("li_actions", [inList("status", ["ready_for_review"])], { columns: "id,status,draft_id" });
  const out: WeekItem[] = [];
  for (const a of actions) {
    const d = await getAction(a.id);
    if (!d || !["publish_post", "publish_newsletter"].includes(d.action.kind) || !d.current.target_at) continue;
    const t = new Date(d.current.target_at).getTime();
    if (!leadTimeOk(d.current.target_at, now) || t > now.getTime() + HORIZON_DAYS * 86_400_000) continue;
    out.push({
      actionId: a.id,
      opening: d.current.text.split("\n")[0].slice(0, 120),
      targetAt: d.current.target_at,
      hasImage: d.current.assets.length > 0,
      newsletter: d.action.kind === "publish_newsletter",
    });
  }
  return out.sort((x, y) => x.targetAt.localeCompare(y.targetAt));
}

/** The owner's one click: approves each listed version exactly as shown and schedules it. */
export async function approveWeek(expected: string[], actor: string, now = new Date()): Promise<{ scheduled: number; skipped: string[] }> {
  const batch = await weekBatch(now);
  const ids = new Set(batch.map((b) => b.actionId));
  if (!expected.length || expected.some((id) => !ids.has(id))) {
    throw new WorkflowError("The week's list changed since you opened it. Review the list again.");
  }
  let scheduled = 0;
  const skipped: string[] = [];
  for (const id of expected) {
    try {
      const d = (await getAction(id))!;
      await approve(id, d.current.id, d.current.content_hash, actor);
      // Newsletters can't be published through LinkedIn's API: approved, then posted by hand.
      if (d.action.kind === "publish_post") await authorizeAutoPublish(id, d.current.id, d.current.content_hash, actor, now);
      scheduled++;
    } catch (err) {
      skipped.push(`${id.slice(0, 8)}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  await audit(actor, "weekly.approved", "li_actions", null, { scheduled, skipped: skipped.length });
  return { scheduled, skipped };
}
