import { updateProfile } from "@/lib/server/accounts";
import { currentAccount } from "@/lib/server/auth";
import { profileSchema } from "@/lib/server/schemas";

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return Response.json({ error: "Please log in again." }, { status: 401 });
  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return Response.json({ error: "Please check the highlighted fields.", fields }, { status: 422 });
  }
  try {
    await updateProfile(account, parsed.data);
  } catch (err) {
    console.error("[account] profile update failed", err);
    return Response.json({ error: "We couldn't save your changes. Please try again." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
