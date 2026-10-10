import "server-only";
/**
 * The studio is private to one person. Access requires a signed-in Growx Era account
 * with a verified email equal to STUDIO_OWNER_EMAIL (server-only env). Anyone else gets a 404, so the
 * studio's existence isn't revealed. If the variable is missing, nobody gets in.
 */
import { notFound, redirect } from "next/navigation";
import { type Account, currentAccount, normalizeEmail } from "@/lib/server/auth";
import { storageMode } from "@/lib/server/store";

/**
 * Without a database the store silently stores nothing (production without Supabase env vars),
 * which would make imports and approvals look successful while saving nothing. The studio
 * refuses to work in that mode instead.
 */
export function studioStorageError(mode: typeof storageMode = storageMode): string | null {
  return mode === "disabled"
    ? "The studio's database is not configured for this deployment (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Nothing can be saved, so the studio is switched off here."
    : null;
}

export function ownerEmail(): string | null {
  const v = process.env.STUDIO_OWNER_EMAIL?.trim().replace(/^["']|["']$/g, "");
  return v ? normalizeEmail(v) : null;
}

/** The owner's email must match AND have been verified through a sign-in link. */
export function isOwner(account: Pick<Account, "email" | "verified_at"> | null): boolean {
  const owner = ownerEmail();
  return !!owner && !!account && !!account.verified_at && normalizeEmail(account.email) === owner;
}

/** For pages: login redirect when signed out, 404 for anyone but the owner. */
export async function requireOwner(path: string): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!isOwner(account)) notFound();
  return account;
}

/** For server actions and route handlers: throws unless the owner is signed in. */
export async function ownerOrThrow(): Promise<Account> {
  const account = await currentAccount();
  if (!isOwner(account)) throw new Error("Not found");
  // Never accept a write that would be silently dropped.
  const storage = studioStorageError();
  if (storage) throw new Error(storage);
  return account!;
}
