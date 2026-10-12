import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { studioOwner } from "@/lib/studio/access";
import { authorizeUrl, linkedInConfig, OAUTH_STATE_COOKIE } from "@/lib/studio/linkedin";
import { studioStorageError } from "@/lib/studio/owner";
import { startedHere } from "@/lib/studio/request";

/** Starts LinkedIn's authorization for the owner. Everyone else: 404. */
export async function GET(req: Request) {
  if (!(await studioOwner())) return new Response("Not found", { status: 404 });
  if (!startedHere(req)) return new Response("Not found", { status: 404 });
  const { config } = await linkedInConfig();
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
