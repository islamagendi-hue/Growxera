import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { studioOwner } from "@/lib/studio/access";
import { isStudioHost } from "@/lib/studio/host";
import { signInAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";

export default async function AccessPage({ searchParams }: PageProps<"/access">) {
  if (!isStudioHost((await headers()).get("host"))) notFound();
  if (await studioOwner()) redirect("/studio");
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-h2 font-semibold">Sign in</h1>
      <Notice error={first(sp.error)} />
      <form action={signInAction} className="mt-6 grid gap-4">
        <label className="text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="username" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          Password
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          6-digit code from your authenticator app
          <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" dir="ltr" className={field} />
        </label>
        <button className={buttonClass("primary")}>Sign in</button>
      </form>
    </div>
  );
}
