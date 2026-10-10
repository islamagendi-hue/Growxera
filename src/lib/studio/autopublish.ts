import "server-only";
/**
 * Automatic publishing has three independent locks. All must be open for the scheduler to post:
 *
 * 1. Global switch, OFF by default. It is on only when BOTH the deployment flag
 *    STUDIO_AUTO_PUBLISH_ALLOWED=true is set (an owner-approved deployment change) AND the owner
 *    switched it on in the studio (li_settings "auto_publish_enabled"). Missing table, missing
 *    row, unreadable value: OFF.
 * 2. Per-post authorization, separate from content approval. Approving content says "this
 *    version may be published"; authorizing says "publish this exact version automatically at
 *    this exact time". It binds to the version and its content hash (text, media, planned time),
 *    so any edit voids it. Approvals that predate this feature have no authorization, so they
 *    never publish automatically until the owner authorizes each one (decision G1).
 * 3. Timing: only from the planned time to ON_TIME_WINDOW_MS after it (the scheduler runs every
 *    5 minutes). Later than that, the post is never published automatically: it is held, back in
 *    review with the reason recorded, and needs a new time and a new approval (decision G2).
 */
import { eq, insert, select, selectOne, update } from "@/lib/server/store";
import { audit, type ActionDetail, load, transition } from "./repo";
import { contentHash, WorkflowError } from "./workflow";

/** How late after its planned time a post may still go out automatically. */
export const ON_TIME_WINDOW_MS = 10 * 60_000;
/** Authorizing needs at least this much time before the planned time. */
export const MIN_LEAD_MS = 5 * 60_000;
export const AUTO_SETTING = "auto_publish_enabled";

export interface AuthorizationRow {
  id: string;
  created_at: string;
  action_id: string;
  version_id: string;
  content_hash: string;
  target_at: string;
  decision: "authorized" | "revoked";
  reason: string | null;
  decided_by: string;
}

const iso = (d = new Date()) => d.toISOString();

// ── Lock 1: the global switch ───────────────────────────────────────────────

export interface SwitchState {
  /** True only when both of the next two are true. */
  enabled: boolean;
  /** Deployment flag STUDIO_AUTO_PUBLISH_ALLOWED=true. */
  deploymentAllowed: boolean;
  /** Owner's setting in the studio. */
  ownerEnabled: boolean;
  /** False when the settings table isn't there (migration not applied): treated as OFF. */
  ready: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

export const deploymentAllowsAutoPublish = () => process.env.STUDIO_AUTO_PUBLISH_ALLOWED?.trim() === "true";

export async function autoPublishSwitch(): Promise<SwitchState> {
  const deploymentAllowed = deploymentAllowsAutoPublish();
  try {
    const row = await selectOne<{ value: unknown; updated_at: string; updated_by: string }>("li_settings", [eq("key", AUTO_SETTING)]);
    const ownerEnabled = row?.value === true;
    return { enabled: deploymentAllowed && ownerEnabled, deploymentAllowed, ownerEnabled, ready: true, changedAt: row?.updated_at ?? null, changedBy: row?.updated_by ?? null };
  } catch {
    return { enabled: false, deploymentAllowed, ownerEnabled: false, ready: false, changedAt: null, changedBy: null };
  }
}

/** Turning it off always works. Turning it on needs the deployment flag. */
export async function setAutoPublish(enabled: boolean, actor: string): Promise<void> {
  if (enabled && !deploymentAllowsAutoPublish()) {
    throw new WorkflowError("Automatic publishing isn't allowed for this deployment yet (it needs the owner-approved deployment setting).");
  }
  const existing = await selectOne<{ key: string }>("li_settings", [eq("key", AUTO_SETTING)]);
  const patch = { value: enabled, updated_at: iso(), updated_by: actor };
  if (existing) await update("li_settings", [eq("key", AUTO_SETTING)], patch);
  else await insert("li_settings", { key: AUTO_SETTING, ...patch });
  await audit(actor, enabled ? "autopublish.switched_on" : "autopublish.switched_off", "li_settings", AUTO_SETTING);
}

// ── Lock 2: per-post authorization ──────────────────────────────────────────

export async function authorizationsFor(actionId: string): Promise<AuthorizationRow[]> {
  try {
    return await select<AuthorizationRow>("li_publish_authorizations", [eq("action_id", actionId)], { order: { col: "created_at", ascending: false } });
  } catch {
    return [];
  }
}

/**
 * Valid only if the latest decision authorizes the current version, with the same hash and
 * planned time, and the content approval is still valid.
 */
export function isAutoAuthorized(d: ActionDetail, auths: AuthorizationRow[]): boolean {
  if (d.action.status !== "approved" || !d.approvalValid || !d.current.target_at) return false;
  const latest = [...auths].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest || latest.decision !== "authorized") return false;
  return (
    latest.version_id === d.current.id &&
    latest.content_hash === d.current.content_hash &&
    contentHash(d.current) === d.current.content_hash &&
    new Date(latest.target_at).getTime() === new Date(d.current.target_at).getTime()
  );
}

/** The owner authorizes automatic publishing of exactly this version at its planned time. */
export async function authorizeAutoPublish(actionId: string, versionId: string, hash: string, actor: string, now = new Date()): Promise<void> {
  const d = await load(actionId);
  if (d.action.status !== "approved" || !d.approvalValid) throw new WorkflowError("Approve the content first.");
  if (d.action.kind !== "publish_post") throw new WorkflowError("Only posts can be published automatically.");
  if (versionId !== d.current.id || hash !== d.current.content_hash || contentHash(d.current) !== hash) {
    throw new WorkflowError("The content changed since you opened it. Review the latest version.");
  }
  if (!d.current.target_at) throw new WorkflowError("Set a planned time first.");
  if (!leadTimeOk(d.current.target_at, now)) {
    throw new WorkflowError("The planned time is too close or has passed. Set a later time, then approve again.");
  }
  if (isAutoAuthorized(d, await authorizationsFor(actionId))) throw new WorkflowError("Already scheduled for automatic publishing.");
  await insert("li_publish_authorizations", {
    id: crypto.randomUUID(),
    created_at: iso(now),
    action_id: actionId,
    version_id: d.current.id,
    content_hash: d.current.content_hash,
    target_at: d.current.target_at,
    decision: "authorized",
    reason: null,
    decided_by: actor,
  });
  await audit(actor, "action.autopublish_authorized", "li_actions", actionId, { versionId, targetAt: d.current.target_at });
}

export async function revokeAutoPublish(actionId: string, actor: string, reason: string): Promise<void> {
  const d = await load(actionId);
  const auths = await authorizationsFor(actionId);
  const latest = auths[0];
  if (!latest || latest.decision !== "authorized") throw new WorkflowError("This post isn't scheduled for automatic publishing.");
  await insert("li_publish_authorizations", {
    id: crypto.randomUUID(),
    created_at: iso(),
    action_id: actionId,
    version_id: d.current.id,
    content_hash: d.current.content_hash,
    target_at: d.current.target_at ?? latest.target_at,
    decision: "revoked",
    reason,
    decided_by: actor,
  });
  await audit(actor, "action.autopublish_revoked", "li_actions", actionId, { reason });
}

/** True while the planned time is far enough ahead for authorizing. */
export const leadTimeOk = (targetAt: string | null, now = new Date()) => !!targetAt && new Date(targetAt).getTime() >= now.getTime() + MIN_LEAD_MS;

// ── Lock 3: timing ──────────────────────────────────────────────────────────

export type Timing = "early" | "on_time" | "missed";

export function timing(targetAt: string, at: Date): Timing {
  const due = new Date(targetAt).getTime();
  if (at.getTime() < due) return "early";
  return at.getTime() - due <= ON_TIME_WINDOW_MS ? "on_time" : "missed";
}

/**
 * A post that wasn't published on time is never published late: it goes back to review with the
 * reason recorded, its authorization is revoked, and it needs a new time and a new approval.
 */
export async function holdMissed(actionId: string, actor: string, at: Date): Promise<void> {
  const d = await load(actionId);
  const reason = `Held: its planned time (${d.current.target_at}) passed before it was published, and late posts are never published automatically. Set a new time and approve again.`;
  await transition(d.action, "ready_for_review", reason);
  await insert("li_publish_authorizations", {
    id: crypto.randomUUID(),
    created_at: iso(at),
    action_id: actionId,
    version_id: d.current.id,
    content_hash: d.current.content_hash,
    target_at: d.current.target_at,
    decision: "revoked",
    reason: "Missed its planned time",
    decided_by: "system",
  });
  await audit(actor, "action.held_missed_schedule", "li_actions", actionId, { targetAt: d.current.target_at, at: iso(at) });
}
