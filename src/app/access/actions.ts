"use server";
/** Sign-in, first-time setup and sign-out for the studio (see src/lib/studio/access.ts). */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessError, completeSetup, sessionCookie, signIn, signOut, signOutEverywhere, studioOwner } from "@/lib/studio/access";
import { isStudioHost } from "@/lib/studio/host";
import { studioStorageError } from "@/lib/studio/owner";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard() {
  const h = await headers();
  // Only on the studio's own address, never on the website's.
  if (!isStudioHost(h.get("host")) || studioStorageError()) redirect("/");
  // On Vercel, x-real-ip is set by the platform (not the browser), so it can't be spoofed to dodge the lockout.
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return { ip, userAgent: h.get("user-agent") };
}

export async function signInAction(form: FormData) {
  const { ip, userAgent } = await guard();
  let error: string | null = null;
  try {
    const token = await signIn({ email: str(form, "email"), password: str(form, "password"), code: str(form, "code"), ip, userAgent });
    (await cookies()).set(sessionCookie(token));
  } catch (err) {
    error = err instanceof AccessError ? err.message : "Sign-in failed. Try again.";
    if (!(err instanceof AccessError)) console.error("[studio] sign-in failed", err instanceof Error ? err.name : "unknown");
  }
  redirect(error ? `/access?error=${encodeURIComponent(error)}` : "/studio");
}

export async function setupAction(form: FormData) {
  const { userAgent } = await guard();
  const token = str(form, "token");
  let error: string | null = null;
  try {
    const session = await completeSetup({
      token,
      sealed: str(form, "sealed"),
      password: str(form, "password"),
      confirm: str(form, "confirm"),
      code: str(form, "code"),
      userAgent,
    });
    (await cookies()).set(sessionCookie(session));
  } catch (err) {
    error = err instanceof AccessError ? err.message : "Setup failed. Nothing was saved.";
    if (!(err instanceof AccessError)) console.error("[studio] setup failed", err instanceof Error ? err.name : "unknown");
  }
  redirect(error ? `/access/setup?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error)}` : "/studio");
}

export async function signOutAction() {
  await signOut();
  redirect("/access");
}

export async function signOutEverywhereAction() {
  if (!(await studioOwner())) redirect("/access");
  await signOutEverywhere();
  redirect("/access");
}
