import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { currentAccount } from "@/lib/server/auth";
import { exchangeCode, fetchMember, LinkedInError, linkedInConfig, OAUTH_STATE_COOKIE, saveConnection } from "@/lib/studio/linkedin";
import { isOwner, studioStorageError } from "@/lib/studio/owner";
import { audit } from "@/lib/studio/repo";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** LinkedIn sends the owner back here with a one-time code. Everyone else: 404. */
export async function GET(req: Request) {
  const account = await currentAccount();
  if (!isOwner(account)) return new Response("Not found", { status: 404 });
  const back = (kind: "notice" | "error", message: string) =>
    Response.redirect(new URL(`/studio/capabilities?${kind}=${encodeURIComponent(message)}#linkedin`, req.url), 303);

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value ?? "";
  jar.delete({ name: OAUTH_STATE_COOKIE, path: "/studio/linkedin" });
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");

  if (!expected || !same(state, expected)) return back("error", "The LinkedIn sign-in link expired or didn't come from this studio. Try Connect again.");
  if (url.searchParams.get("error")) return back("error", "LinkedIn access wasn't granted. Nothing was connected.");
  const { config } = await linkedInConfig();
  if (!config || !code || studioStorageError()) return back("error", "LinkedIn isn't set up for this deployment.");

  try {
    const token = await exchangeCode(config, code);
    const member = await fetchMember(token.accessToken);
    await saveConnection({ memberUrn: member.urn, memberName: member.name, scopes: token.scopes, accessToken: token.accessToken, expiresIn: token.expiresIn });
    await audit(account!.email, "linkedin.connected", "li_linkedin_connection", null, { member: member.urn, scopes: token.scopes, expiresInDays: Math.round(token.expiresIn / 86_400) });
    return back("notice", `Connected to LinkedIn${member.name ? ` as ${member.name}` : ""}. Nothing has been posted.`);
  } catch (err) {
    const message = err instanceof LinkedInError ? err.message : "Connecting failed. Nothing was saved.";
    if (!(err instanceof LinkedInError)) console.error("[studio] linkedin connect failed", err instanceof Error ? err.name : "unknown");
    return back("error", message);
  }
}
