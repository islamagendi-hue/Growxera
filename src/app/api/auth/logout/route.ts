import { cookies } from "next/headers";
import { revokeSession, SESSION_COOKIE, SIGNED_IN_HINT_COOKIE } from "@/lib/server/auth";

export async function POST() {
  const jar = await cookies();
  try {
    await revokeSession(jar.get(SESSION_COOKIE)?.value);
  } catch (err) {
    console.error("[auth] logout failed", err);
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT_COOKIE);
  return Response.json({ ok: true });
}
