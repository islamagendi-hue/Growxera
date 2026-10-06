import "server-only";
import { redirect } from "next/navigation";
import { currentAccount, type Account } from "./auth";

/** The signed-in account, or a redirect to login that comes back to `path`. */
export async function requireAccount(path: string): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(path)}`);
  return account;
}
