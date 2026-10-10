import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { MIN_PASSWORD, startSetup } from "@/lib/studio/access";
import { otpauthUri } from "@/lib/studio/crypto";
import { isStudioHost } from "@/lib/studio/host";
import { setupAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up sign-in", robots: { index: false, follow: false }, referrer: "no-referrer" };

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";

/** One-time page (link from Claude, valid 24 h): choose the password and pair the authenticator app. */
export default async function SetupPage({ searchParams }: PageProps<"/access/setup">) {
  if (!isStudioHost((await headers()).get("host"))) notFound();
  const sp = await searchParams;
  const token = first(sp.token) ?? "";
  const setup = await startSetup(token);
  if (!setup) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="text-h2 font-semibold">Link expired</h1>
        <p className="mt-3 text-sm text-ink-2">This setup link has expired or was already used. Ask for a new one.</p>
      </div>
    );
  }
  const uri = otpauthUri(setup.secret, setup.email, "Growx Era Studio");
  const qr = await QRCode.toString(uri, { type: "svg", margin: 1, width: 220 });
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-h2 font-semibold">Set up sign-in</h1>
      <p className="mt-2 text-sm text-ink-2">For {setup.email}. This link works once.</p>
      <Notice error={first(sp.error)} />

      <section className="mt-8">
        <h2 className="font-semibold">1. Scan this with your authenticator app</h2>
        <p className="mt-1 text-sm text-ink-2">Google Authenticator, Microsoft Authenticator or 1Password: add an account, then scan.</p>
        <div className="mt-4 w-[220px] bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-3 text-xs text-ink-3">
          Can&apos;t scan? Enter this key by hand: <code className="break-all font-mono">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
        </p>
      </section>

      <form action={setupAction} className="mt-8 grid gap-4" autoComplete="off">
        <h2 className="font-semibold">2. Choose a password and confirm the code</h2>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="sealed" value={setup.sealed} />
        <label className="text-sm font-medium">
          Password (at least {MIN_PASSWORD} characters)
          <input name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          Password again
          <input name="confirm" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          6-digit code now shown in the app
          <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" dir="ltr" className={field} />
        </label>
        <button className={buttonClass("primary")}>Save and sign in</button>
      </form>
    </div>
  );
}
