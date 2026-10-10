/**
 * Approval-first workflow rules for the LinkedIn Growth Studio. Pure functions only,
 * so they are easy to test and identical on every code path that changes state.
 *
 *   draft → ready_for_review → approved → executed → verified
 *                │                 │          └→ failed
 *                ├→ rejected        └→ blocked
 *                └→ needs_revision → (new version) → ready_for_review
 *
 * An approval binds to the SHA-256 of the exact content reviewed. Any edit creates a
 * new version with a new hash, which voids the approval (see repo.addVersion).
 */
import { createHash } from "node:crypto";

export const STATUSES = [
  "draft",
  "ready_for_review",
  "approved",
  "executed",
  "verified",
  "rejected",
  "needs_revision",
  "failed",
  "blocked",
] as const;
export type Status = (typeof STATUSES)[number];

export type ActionKind = "publish_post" | "publish_newsletter" | "reply" | "comment";
export type Channel = "linkedin_api" | "manual";

export const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  approved: "Approved",
  executed: "Executed",
  verified: "Verified",
  rejected: "Rejected",
  needs_revision: "Needs revision",
  failed: "Failed",
  blocked: "Blocked",
};

/** Every allowed status change. Anything else is refused. */
const TRANSITIONS: Record<Status, readonly Status[]> = {
  draft: ["ready_for_review", "rejected", "blocked"],
  // Blocked: can't proceed (e.g. a migrated post that already appears as published).
  ready_for_review: ["approved", "rejected", "needs_revision", "blocked"],
  // Approved content can be executed, blocked by a missing capability, or sent back by an edit.
  approved: ["executed", "failed", "blocked", "ready_for_review", "rejected"],
  // "Executed" is not proof: it still has to be verified, or it failed verification.
  executed: ["verified", "failed"],
  verified: [],
  rejected: ["ready_for_review"],
  needs_revision: ["ready_for_review", "rejected"],
  // A failure is never retried silently: it goes back to review after a person looks at it.
  failed: ["ready_for_review", "rejected"],
  // Never straight to approved: a blocked item goes back to review first.
  blocked: ["ready_for_review", "rejected"],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export class WorkflowError extends Error {}

export function assertTransition(from: Status, to: Status) {
  if (!canTransition(from, to)) throw new WorkflowError(`Not allowed: ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}.`);
}

export interface VersionContent {
  text: string;
  assets: { type: string; url: string; title?: string | null }[];
  target_at: string | null;
}

/**
 * Canonical hash of what will be published. Line endings are normalised so the
 * same text pasted from different systems hashes the same; everything else counts.
 */
export function contentHash(v: VersionContent): string {
  const canonical = JSON.stringify({
    text: v.text.replace(/\r\n/g, "\n"),
    assets: v.assets.map((a) => ({ type: a.type, url: a.url, title: a.title ?? null })),
    target_at: v.target_at ? new Date(v.target_at).toISOString() : null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Text compared for duplicate detection: whitespace and case don't matter. */
export const normalizeText = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Fingerprint of what a reader sees: normalised text plus the media, but not the time.
 * Matching text alone is not treated as the same post: the media must match too.
 */
export function publishedFingerprint(text: string, assets: { url: string }[]): string {
  const media = assets.map((a) => a.url).sort();
  return createHash("sha256").update(JSON.stringify([normalizeText(text), media])).digest("hex");
}

/** Idempotency key for executing an action: one execution per action per approved content. */
export const idempotencyKey = (actionId: string, hash: string) => `${actionId}:${hash}`;

/** Accepts only links to a LinkedIn post, article or comment, for manual verification. */
export function isLinkedInContentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !/(^|\.)linkedin\.com$/.test(u.hostname)) return false;
    return /^\/(feed\/update\/urn:li:(share|activity|ugcPost):\d+|posts\/[^/]+|pulse\/[^/]+)/.test(u.pathname);
  } catch {
    return false;
  }
}
