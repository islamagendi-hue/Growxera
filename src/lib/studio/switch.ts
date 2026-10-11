import "server-only";
/**
 * The all-publishing switch (owner decision P2). OFF by default. While it is OFF nothing can be
 * posted to LinkedIn at all: neither automatic publishing nor the owner's "Publish now".
 *
 * It is checked in publishAction() (the only way to publish) and again inside the LinkedIn client
 * right before anything is sent to LinkedIn, so no endpoint, action or direct call can skip it.
 * Missing table, missing row, unreadable or non-boolean value: OFF. Turning it on or off is in
 * autopublish.ts (setPublishing), owner-only and audited.
 *
 * It sits above the other controls; it never replaces them. Publishing still needs a valid
 * approval of the exact version, and either the owner's explicit "Publish now" confirmation or,
 * for automatic publishing, the automatic switch, the per-post authorization and the timing rule.
 */
import { eq, selectOne } from "@/lib/server/store";
import { WorkflowError } from "./workflow";

export const PUBLISHING_SETTING = "publishing_enabled";
export const PUBLISHING_OFF = "All publishing is switched off, so nothing can be posted to LinkedIn. Switch it on in Capabilities first.";

export interface PublishingState {
  enabled: boolean;
  /** False when the settings table isn't there (migration not applied): treated as OFF. */
  ready: boolean;
  changedAt: string | null;
  changedBy: string | null;
}

export async function publishingSwitch(): Promise<PublishingState> {
  try {
    const row = await selectOne<{ value: unknown; updated_at: string; updated_by: string }>("li_settings", [eq("key", PUBLISHING_SETTING)]);
    return { enabled: row?.value === true, ready: true, changedAt: row?.updated_at ?? null, changedBy: row?.updated_by ?? null };
  } catch {
    return { enabled: false, ready: false, changedAt: null, changedBy: null };
  }
}

/** Throws unless all publishing is switched on. */
export async function assertPublishingOn(): Promise<void> {
  if (!(await publishingSwitch()).enabled) throw new WorkflowError(PUBLISHING_OFF);
}
