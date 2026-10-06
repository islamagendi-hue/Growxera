import { safeRedirect } from "@/lib/server/auth";
import { sendSignInLink } from "@/lib/server/accounts";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { authRequestSchema } from "@/lib/server/schemas";

/**
 * Starts passwordless login or signup by emailing a one-time link.
 * Always answers the same way when the input is valid, so it can't be used to
 * find out which emails have accounts.
 */
export async function POST(req: Request) {
  if (!rateLimit(`auth:${clientKey(req)}`, 10, 10 * 60_000)) {
    return Response.json({ error: "Too many requests. Please wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = authRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return Response.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
  }
  const data = parsed.data;
  if (data.mode === "signup" && data.company_url) return Response.json({ ok: true });
  try {
    await sendSignInLink({
      mode: data.mode,
      email: data.email,
      name: data.mode === "signup" ? data.name : undefined,
      company: data.mode === "signup" ? data.company : undefined,
      next: data.next ? safeRedirect(data.next) : undefined,
    });
  } catch (err) {
    console.error("[auth] request failed", err);
    return Response.json({ error: "We couldn't send the link right now. Please try again." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
