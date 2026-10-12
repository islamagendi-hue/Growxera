import "server-only";
/**
 * The studio is private to one person and lives on its own address (see host.ts). Access
 * requires the studio's own sign-in (email + password + authenticator code, see access.ts)
 * with the email in STUDIO_OWNER_EMAIL. On the website's address every studio path is a 404
 * (src/proxy.ts), so the website gives no sign it exists.
 */
import { redirect } from "next/navigation";
import { studioDataBlocked } from "@/lib/server/deployment";
import { storageMode } from "@/lib/server/store";
import { studioOwner } from "./access";

export { ownerEmail } from "./owner-email";

/**
 * Without a database the store silently stores nothing (production without Supabase env vars),
 * which would make imports and approvals look successful while saving nothing. The studio
 * refuses to work in that mode instead.
 */
export function studioStorageError(mode: typeof storageMode = storageMode, env: Record<string, string | undefined> = process.env): string | null {
  if (mode === "disabled") {
    return "The studio's database is not configured for this deployment (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Nothing can be saved, so the studio is switched off here.";
  }
  // A preview shares the production database: the studio stays off there (deployment.ts).
  return mode === "supabase" ? studioDataBlocked(env) : null;
}

/** For pages: sends anyone who isn't signed in to the studio's sign-in page. */
export async function requireOwner(): Promise<{ email: string }> {
  const owner = await studioOwner();
  if (!owner) redirect("/access");
  return owner;
}

/** For server actions and route handlers: throws unless the owner is signed in. */
export async function ownerOrThrow(): Promise<{ email: string }> {
  const owner = await studioOwner();
  if (!owner) throw new Error("Not found");
  // Never accept a write that would be silently dropped.
  const storage = studioStorageError();
  if (storage) throw new Error(storage);
  return owner;
}
