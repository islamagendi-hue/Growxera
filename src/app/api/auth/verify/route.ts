import { cookies } from "next/headers";
import { recordSignupConsent } from "@/lib/server/accounts";
import { consumeLinkToken, createSession, sessionCookie, signedInHintCookie } from "@/lib/server/auth";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { verifySchema } from "@/lib/server/schemas";

/**
 * Uses a one-time link and signs the person in. Called by /auth/verify with a
 * POST (not the GET of the emailed link), so email security scanners that
 * prefetch links can't use up the token.
 */
export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientKey(req)}`, 20, 10 * 60_000)) {
    return Response.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = verifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  try {
    const result = await consumeLinkToken(parsed.data.token);
    if (!result.ok) return Response.json({ ok: false, reason: result.reason, email: result.email ?? null }, { status: 400 });
    if (result.isNew && result.purpose === "signup") await recordSignupConsent(result.account.id);
    const { token, expires } = await createSession(result.account.id, req.headers.get("user-agent"));
    const jar = await cookies();
    jar.set(sessionCookie(token, expires));
    jar.set(signedInHintCookie(expires));
    return Response.json({ ok: true, redirectTo: result.redirectTo });
  } catch (err) {
    console.error("[auth] verify failed", err);
    return Response.json({ ok: false, reason: "error" }, { status: 503 });
  }
}
