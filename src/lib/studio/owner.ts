import "server-only";
/**
 * The studio is private to one person. Access requires a signed-in Growx Era account
 * with a verified email equal to STUDIO_OWNER_EMAIL (server-only env). Anyone else gets a 404, so the
 * studio's existence isn't revealed. If the variable is missing, nobody gets in.
 */
import { notFound, redirect } from "next/navigation";
import { type Account, currentAccount, normalizeEmail } from "@/lib/server/auth";

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
  return account!;
}
