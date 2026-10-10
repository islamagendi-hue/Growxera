import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentAccount } from "@/lib/server/auth";
import { authorizeUrl, linkedInConfig, OAUTH_STATE_COOKIE } from "@/lib/studio/linkedin";
import { isOwner, studioStorageError } from "@/lib/studio/owner";

/** Starts LinkedIn's authorization for the owner. Everyone else: 404. */
export async function GET(req: Request) {
  if (!isOwner(await currentAccount())) return new Response("Not found", { status: 404 });
  const { config } = linkedInConfig();
  if (!config || studioStorageError()) {
    return Response.redirect(new URL(`/studio/capabilities?error=${encodeURIComponent("LinkedIn isn't set up for this deployment.")}#linkedin`, req.url), 303);
  }
  // Random state, kept in a short-lived httpOnly cookie, checked on the way back (CSRF).
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/studio/linkedin",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(config, state), 303);
}
