"use server";
/** Sign-in, first-time setup and sign-out for the studio (see src/lib/studio/access.ts). */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AccessError, completeSetup, sessionCookie, signIn, signOut, signOutEverywhere, startSetup, studioOwner } from "@/lib/studio/access";
import { otpauthUri } from "@/lib/studio/crypto";
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

/** The setup page's state: an error message to show, or nothing. */
export interface SetupState {
  error: string | null;
}

export type SetupStart = { ok: true; email: string; qrSvg: string; secret: string; sealed: string } | { ok: false };

/**
 * Step 1 of setup. The token comes from the link's #fragment, which the browser never sends in
 * the page request, and arrives here as form data in a POST body: not in any URL or request log,
 * and not in Next's development log of server-function arguments (which prints plain arguments).
 */
export async function beginSetupAction(form: FormData): Promise<SetupStart> {
  await guard();
  const setup = await startSetup(str(form, "token"));
  if (!setup) return { ok: false };
  const qrSvg = await QRCode.toString(otpauthUri(setup.secret, setup.email, "Growx Era Studio"), { type: "svg", margin: 1, width: 220 });
  return { ok: true, email: setup.email, qrSvg, secret: setup.secret, sealed: setup.sealed };
}

/** Step 2: save the password and authenticator. Errors come back as state, never in a URL. */
export async function setupAction(_prev: SetupState, form: FormData): Promise<SetupState> {
  const { userAgent } = await guard();
  try {
    const session = await completeSetup({
      token: str(form, "token"),
      sealed: str(form, "sealed"),
      password: str(form, "password"),
      confirm: str(form, "confirm"),
      code: str(form, "code"),
      userAgent,
    });
    (await cookies()).set(sessionCookie(session));
  } catch (err) {
    if (!(err instanceof AccessError)) console.error("[studio] setup failed", err instanceof Error ? err.name : "unknown");
    return { error: err instanceof AccessError ? err.message : "Setup failed. Nothing was saved." };
  }
  redirect("/studio");
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
