import { currentAccount } from "@/lib/server/auth";
import { clientKey, rateLimit } from "@/lib/server/rate-limit";
import { advisorQuestionSchema } from "@/lib/server/schemas";
import { askAdvisor } from "@/lib/server/advisor";

/** A question for a real advisor, about a report or working together. */
export async function POST(req: Request) {
  if (!rateLimit(`advisor:${clientKey(req)}`, 6, 10 * 60_000)) {
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }
  const parsed = advisorQuestionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[i.path.length - 1]), i.message]));
    return Response.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
  }
  if (parsed.data.company_url) return Response.json({ ok: true });
  const account = await currentAccount();
  if (!account && !parsed.data.consentProcessing) {
    return Response.json({ error: "Please check the highlighted fields.", fields: { consentProcessing: "Please agree so we can reply." } }, { status: 422 });
  }
  try {
    const result = await askAdvisor({ account, ...parsed.data });
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[advisor] failed", err);
    return Response.json({ error: "We couldn't send your question. Please try again." }, { status: 503 });
  }
}
