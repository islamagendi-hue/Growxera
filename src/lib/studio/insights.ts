import "server-only";
/**
 * What the dashboard, calendar and activity pages show: every post's state, why it can or
 * can't be published, what needs the owner, and a readable activity history. Read-only.
 *
 * Everything is loaded in a few whole-table reads (the studio holds tens to hundreds of posts),
 * then classified by the pure functions below, which the tests exercise directly. Nothing here
 * changes state or decides to publish: that stays in publish.ts and autopublish.ts.
 */
import { select, selectAll } from "@/lib/server/store";
import { autoPublishSwitch, isAutoAuthorized, type AuthorizationRow, type SwitchState } from "./autopublish";
import { connectionState, type ConnectionState } from "./linkedin";
import { hasValidApproval, type ActionDetail, type ActionRow, type ApprovalRow, type DraftRow, type ExecutionRow, type VersionRow } from "./repo";
import { publishingSwitch, type PublishingState } from "./switch";
import { toRiyadhInput } from "./time";
import type { Status } from "./workflow";

// ── Per-post state ──────────────────────────────────────────────────────────

export interface PostState {
  action: ActionRow;
  draft: DraftRow;
  current: VersionRow;
  /** First line of the text, shortened, for lists. */
  title: string;
  approvalValid: boolean;
  /** Confirmed for automatic publishing (G1): the latest authorization covers this exact version and time. */
  autoAuthorized: boolean;
  /** Returned to review because it missed its submission window (G2). */
  held: boolean;
  /** Sent to LinkedIn but the answer was unclear: the owner must check. Never retried. */
  unknownOutcome: boolean;
  /** Published but not yet confirmed live. */
  unverified: boolean;
  /** Waiting for review or approved, but its planned time has passed. */
  overdue: boolean;
  /** Approved with a planned time, but not confirmed for automatic publishing (for example the 19 approvals of 10 Oct). */
  awaitingAutoConfirmation: boolean;
  publishedUrl: string | null;
}

export const firstLine = (text: string, max = 90) => {
  const line = text.split("\n").find((l) => l.trim())?.trim() ?? "(empty)";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

/** Classifies one post. Pure: the inputs are the rows already loaded. */
export function classify(
  action: ActionRow,
  draft: DraftRow,
  current: VersionRow,
  approvals: ApprovalRow[],
  executions: ExecutionRow[],
  auths: AuthorizationRow[],
  now: Date,
): PostState {
  const approvalValid = hasValidApproval(action, current, approvals);
  const detail = { action, draft, current, versions: [current], approvals, executions, approvalValid } as ActionDetail;
  const autoAuthorized = isAutoAuthorized(detail, auths);
  const latestExec = [...executions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const held = action.status === "ready_for_review" && (action.status_reason ?? "").startsWith("Held:");
  const unknownOutcome = action.status === "executed" && latestExec?.result === "unknown";
  const past = !!current.target_at && new Date(current.target_at).getTime() < now.getTime();
  return {
    action,
    draft,
    current,
    title: firstLine(current.text),
    approvalValid,
    autoAuthorized,
    held,
    unknownOutcome,
    unverified: action.status === "executed" && !unknownOutcome,
    overdue: (action.status === "ready_for_review" || action.status === "approved") && past && !held,
    awaitingAutoConfirmation:
      action.status === "approved" && approvalValid && action.kind === "publish_post" && !!current.target_at && !past && !autoAuthorized,
    publishedUrl: executions.find((e) => e.result === "executed" && e.external_url)?.external_url ?? null,
  };
}

// ── Publishing controls and blockers ────────────────────────────────────────

export interface Controls {
  publishing: PublishingState;
  auto: SwitchState;
  linkedin: ConnectionState;
}

/**
 * Why this post can't be published right now, in plain words, for each path. An empty list for
 * a path means nothing in the studio stops it (the server still re-checks everything on submit).
 */
export function publishBlockers(p: PostState, c: Controls): { manual: string[]; automatic: string[] } {
  const common: string[] = [];
  if (p.action.kind !== "publish_post") common.push("Only posts can be published from the studio; this item is a manual step.");
  if (p.action.status !== "approved") common.push(`It is "${p.action.status.replace(/_/g, " ")}", not approved.`);
  else if (!p.approvalValid) common.push("The approval doesn't cover the current version (it was edited after approval).");
  if (!c.publishing.enabled) common.push("All publishing is switched OFF.");
  if (c.linkedin.state !== "connected") common.push("LinkedIn isn't connected.");
  else if (!c.linkedin.canPost) common.push("The LinkedIn connection doesn't allow posting.");
  if (p.current.assets.length > 1) common.push("Posts with more than one file are published by hand.");

  const automatic = [...common];
  if (!c.auto.enabled) automatic.push("Automatic publishing is switched OFF.");
  if (!p.current.target_at) automatic.push("It has no planned time.");
  else if (p.overdue) automatic.push("Its planned time has passed; it will be held, never published late.");
  if (p.action.status === "approved" && p.approvalValid && !p.autoAuthorized) {
    automatic.push("Not confirmed for automatic publishing (each post is confirmed one by one).");
  }
  return { manual: common, automatic };
}

// ── What needs the owner ────────────────────────────────────────────────────

export type AttentionKind = "unknown_outcome" | "failed" | "held" | "blocked" | "overdue" | "unverified" | "review" | "needs_revision" | "draft";

export const ATTENTION: Record<AttentionKind, { label: string; next: string; rank: number }> = {
  unknown_outcome: { label: "Outcome unknown", next: "Check your LinkedIn profile and record what you find. It is never re-sent automatically.", rank: 0 },
  failed: { label: "Failed", next: "Read the reason, then return it to review or reject it.", rank: 1 },
  held: { label: "Held", next: "It missed its window. Set a new time and approve again.", rank: 2 },
  blocked: { label: "Blocked", next: "Read the reason, then return it to review or reject it.", rank: 3 },
  overdue: { label: "Planned time passed", next: "Set a new time (approval refuses past times), or publish it by hand if still wanted.", rank: 4 },
  unverified: { label: "Not yet verified", next: "Confirm it is live on LinkedIn.", rank: 5 },
  review: { label: "Waiting for your review", next: "Approve, request changes or reject.", rank: 6 },
  needs_revision: { label: "Needs revision", next: "Edit it, then return it to review.", rank: 7 },
  draft: { label: "Draft", next: "Finish it and submit it for review.", rank: 8 },
};

export interface AttentionItem {
  kind: AttentionKind;
  post: PostState;
}

/** Everything that waits for the owner, most urgent first, then by planned time. */
export function attention(posts: PostState[]): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const post of posts) {
    const s = post.action.status;
    const kind: AttentionKind | null = post.unknownOutcome
      ? "unknown_outcome"
      : s === "failed"
        ? "failed"
        : post.held
          ? "held"
          : s === "blocked"
            ? "blocked"
            : post.overdue
              ? "overdue"
              : post.unverified
                ? "unverified"
                : s === "ready_for_review"
                  ? "review"
                  : s === "needs_revision"
                    ? "needs_revision"
                    : s === "draft"
                      ? "draft"
                      : null;
    if (kind) out.push({ kind, post });
  }
  return out.sort(
    (a, b) => ATTENTION[a.kind].rank - ATTENTION[b.kind].rank || (a.post.current.target_at ?? "9").localeCompare(b.post.current.target_at ?? "9"),
  );
}

/** Pipeline stages shown on the dashboard, in workflow order. */
export const PIPELINE: { key: string; label: string; statuses: Status[]; href: string }[] = [
  { key: "draft", label: "Drafts", statuses: ["draft", "needs_revision"], href: "/studio/queue?status=draft" },
  { key: "review", label: "In review", statuses: ["ready_for_review"], href: "/studio/queue?status=ready_for_review" },
  { key: "approved", label: "Approved", statuses: ["approved"], href: "/studio/queue?status=approved" },
  { key: "published", label: "Published, unverified", statuses: ["executed"], href: "/studio/queue?status=executed" },
  { key: "verified", label: "Verified", statuses: ["verified"], href: "/studio/queue?status=verified" },
  { key: "stopped", label: "Failed or blocked", statuses: ["failed", "blocked"], href: "/studio/queue?status=failed" },
];

// ── Calendar ────────────────────────────────────────────────────────────────

export interface CalendarEntry {
  /** A planned post, or a post already published (history). */
  type: "planned" | "published";
  at: string;
  title: string;
  post?: PostState;
  url?: string | null;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD, Riyadh
  inMonth: boolean;
  entries: CalendarEntry[];
  /** Two or more planned posts on the same day. */
  conflict: boolean;
}

/** Statuses whose planned time is shown on the calendar. */
const PLANNED: Status[] = ["draft", "ready_for_review", "needs_revision", "approved", "executed", "verified", "blocked", "failed"];

/** Riyadh calendar day of an ISO time. */
export const riyadhDay = (iso: string) => toRiyadhInput(iso).slice(0, 10);

/** A month grid (weeks starting Sunday, the owner's preference) in Riyadh time. */
export function calendarMonth(month: string, posts: PostState[], history: { published_at: string | null; text: string; external_url: string | null }[]): CalendarDay[] {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last.getTime() + (6 - last.getUTCDay()) * 86_400_000);
  const days = new Map<string, CalendarDay>();
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.set(date, { date, inMonth: date.slice(0, 7) === month, entries: [], conflict: false });
  }
  for (const post of posts) {
    if (!post.current.target_at || !PLANNED.includes(post.action.status)) continue;
    // A published post appears once, as history, if its record is in li_content.
    if (post.action.status === "verified" && post.publishedUrl && history.some((h) => h.external_url === post.publishedUrl)) continue;
    days.get(riyadhDay(post.current.target_at))?.entries.push({ type: "planned", at: post.current.target_at, title: post.title, post });
  }
  for (const h of history) {
    if (!h.published_at) continue;
    days.get(riyadhDay(h.published_at))?.entries.push({ type: "published", at: h.published_at, title: firstLine(h.text, 70), url: h.external_url });
  }
  for (const day of days.values()) {
    day.entries.sort((a, b) => a.at.localeCompare(b.at));
    day.conflict = day.entries.filter((e) => e.type === "planned" && !["rejected"].includes(e.post!.action.status)).length > 1;
  }
  return [...days.values()];
}

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

// ── Activity ────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  created_at: string;
  actor: string;
  event: string;
  entity: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
}

export type ActivityCategory = "publishing" | "approvals" | "content" | "controls" | "integrations" | "backup" | "access" | "other";

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, string> = {
  publishing: "Publishing",
  approvals: "Approvals",
  content: "Content",
  controls: "Publishing controls",
  integrations: "Integrations",
  backup: "Backup",
  access: "Sign-in",
  other: "Other",
};

const EVENTS: Record<string, { category: ActivityCategory; text: string; problem?: boolean }> = {
  "draft.created": { category: "content", text: "Post created" },
  "draft.repaired": { category: "content", text: "Incomplete import completed" },
  "version.created": { category: "content", text: "New version saved (any approval no longer applies)" },
  "action.submitted": { category: "content", text: "Submitted for review" },
  "action.approved": { category: "approvals", text: "Approved this exact version" },
  "action.rejected": { category: "approvals", text: "Rejected" },
  "action.needs_revision": { category: "approvals", text: "Changes requested" },
  "action.reopened": { category: "approvals", text: "Returned to review" },
  "action.autopublish_authorized": { category: "approvals", text: "Confirmed for automatic publishing at its planned time" },
  "action.autopublish_revoked": { category: "approvals", text: "Automatic publishing cancelled for this post" },
  "action.executed": { category: "publishing", text: "Published" },
  "action.verified": { category: "publishing", text: "Verified live" },
  "action.failed": { category: "publishing", text: "Publishing failed", problem: true },
  "action.blocked": { category: "publishing", text: "Blocked", problem: true },
  "action.outcome_unknown": { category: "publishing", text: "LinkedIn's answer was unclear; check the profile", problem: true },
  "action.held_missed_schedule": { category: "publishing", text: "Held: missed its submission window", problem: true },
  "scheduler.run": { category: "publishing", text: "Scheduler run" },
  "publishing.switched_on": { category: "controls", text: "All publishing switched ON" },
  "publishing.switched_off": { category: "controls", text: "All publishing switched OFF" },
  "autopublish.switched_on": { category: "controls", text: "Automatic publishing switched ON" },
  "autopublish.switched_off": { category: "controls", text: "Automatic publishing switched OFF" },
  "linkedin.connected": { category: "integrations", text: "LinkedIn connected" },
  "linkedin.disconnected": { category: "integrations", text: "LinkedIn disconnected" },
  "linkedin.app_keys_saved": { category: "integrations", text: "LinkedIn app keys saved" },
  "import.buffer_snapshot": { category: "integrations", text: "Buffer snapshot imported" },
  "assets.secured": { category: "integrations", text: "Media copied to private storage" },
  "export.generated": { category: "backup", text: "Backup export downloaded" },
  "export.failed": { category: "backup", text: "Backup export failed", problem: true },
};

export interface ActivityItem {
  row: AuditRow;
  category: ActivityCategory;
  text: string;
  problem: boolean;
  /** Short extra detail (a reason, an error, counts), never secrets. */
  note: string | null;
  href: string | null;
}

const noteFor = (row: AuditRow): string | null => {
  const d = row.detail ?? {};
  const pick = (k: string) => (typeof d[k] === "string" || typeof d[k] === "number" ? String(d[k]) : null);
  if (row.event === "scheduler.run") return `${pick("published") ?? 0} published, ${pick("failed") ?? 0} failed, ${pick("held") ?? 0} held`;
  return pick("reason") ?? pick("error") ?? pick("note") ?? null;
};

export function describe(row: AuditRow): ActivityItem {
  const known = EVENTS[row.event];
  const prefix = row.event.split(".")[0];
  const category: ActivityCategory = known?.category ?? (prefix === "access" ? "access" : "other");
  return {
    row,
    category,
    text: known?.text ?? row.event.replace(/[._]/g, " "),
    problem: known?.problem ?? row.event.endsWith(".failed"),
    note: noteFor(row),
    href: row.entity === "li_actions" && row.entity_id ? `/studio/queue/${row.entity_id}` : null,
  };
}

export async function recentActivity(limit = 200): Promise<ActivityItem[]> {
  const rows = await select<AuditRow>("li_audit_log", [], { order: { col: "created_at", ascending: false }, limit });
  return rows.map(describe);
}

// ── Loading ─────────────────────────────────────────────────────────────────

/** Every post with its state, in a handful of reads. */
export async function loadPosts(now = new Date()): Promise<PostState[]> {
  const [actions, drafts, versions, approvals, executions] = await Promise.all([
    selectAll<ActionRow>("li_actions", [], { order: { col: "updated_at", ascending: false } }),
    selectAll<DraftRow>("li_drafts", []),
    selectAll<VersionRow>("li_draft_versions", []),
    selectAll<ApprovalRow>("li_approvals", []),
    selectAll<ExecutionRow>("li_executions", []),
  ]);
  // Missing table (migration not applied yet): no authorizations, so nothing is confirmed.
  const auths = await selectAll<AuthorizationRow>("li_publish_authorizations", []).catch(() => [] as AuthorizationRow[]);
  const group = <T extends { action_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.action_id, [...(m.get(r.action_id) ?? []), r]);
    return m;
  };
  const byDraft = new Map(drafts.map((d) => [d.id, d]));
  const byVersion = new Map(versions.map((v) => [v.id, v]));
  const approvalsBy = group(approvals);
  const execsBy = group(executions);
  const authsBy = group(auths);
  const out: PostState[] = [];
  for (const action of actions) {
    const draft = byDraft.get(action.draft_id);
    const current = draft?.current_version ? byVersion.get(draft.current_version) : undefined;
    if (!draft || !current) continue;
    out.push(classify(action, draft, current, approvalsBy.get(action.id) ?? [], execsBy.get(action.id) ?? [], authsBy.get(action.id) ?? [], now));
  }
  return out;
}

export async function loadControls(): Promise<Controls> {
  const [publishing, auto, linkedin] = await Promise.all([publishingSwitch(), autoPublishSwitch(), connectionState()]);
  return { publishing, auto, linkedin };
}
