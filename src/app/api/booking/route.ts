import { currentAccount } from "@/lib/server/auth";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { bookingSchema } from "@/lib/server/schemas";
import { bookReview } from "@/lib/server/specialist";

/** Books a free 30-minute review in an open slot. */
export async function POST(req: Request) {
  if (!rateLimit(`booking:${clientKey(req)}`, 6, 10 * 60_000)) {
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }
  const parsed = bookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[i.path.length - 1]), i.message]));
    return Response.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
  }
  if (parsed.data.company_url) return Response.json({ ok: true });
  const account = await currentAccount();
  if (!account && !parsed.data.consentProcessing) {
    return Response.json({ error: "Please check the highlighted fields.", fields: { consentProcessing: "Please agree so we can arrange the call." } }, { status: 422 });
  }
  try {
    const result = await bookReview({ account, ...parsed.data, message: parsed.data.message || undefined });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ ok: true, slotStart: result.slotStart });
  } catch (err) {
    console.error("[booking] failed", err);
    return Response.json({ error: "We couldn't book that time. Please try again." }, { status: 503 });
  }
}
