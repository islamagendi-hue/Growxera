import { cookies } from "next/headers";
import { eraseAccountData } from "@/lib/server/accounts";
import { currentAccount, SESSION_COOKIE, SIGNED_IN_HINT_COOKIE } from "@/lib/server/auth";
import { deleteRequestSchema } from "@/lib/server/schemas";

/**
 * Step two of self-service deletion. Step one is the confirmation panel on the
 * profile page; this route also requires the typed confirmation, so a stray
 * request can't delete anything.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return Response.json({ error: "Request not allowed." }, { status: 403 });
  }
  const account = await currentAccount();
  if (!account) return Response.json({ error: "Please log in again." }, { status: 401 });
  const parsed = deleteRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Type DELETE to confirm." }, { status: 422 });
  try {
    const { diagnostics } = await eraseAccountData(account, parsed.data.scope);
    if (parsed.data.scope === "account") {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
      jar.delete(SIGNED_IN_HINT_COOKIE);
    }
    return Response.json({ ok: true, diagnostics });
  } catch (err) {
    console.error("[account] deletion failed", err);
    return Response.json({ error: "We couldn't finish deleting your data. Please try again, or contact us and we'll do it for you." }, { status: 503 });
  }
}
