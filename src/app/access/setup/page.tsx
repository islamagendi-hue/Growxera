import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MIN_PASSWORD } from "@/lib/studio/access";
import { isStudioHost } from "@/lib/studio/host";
import { SetupFlow } from "./SetupFlow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up sign-in", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * One-time page: choose the password and pair the authenticator app. The link's token is in the
 * #fragment (src/lib/studio/setup-link.ts), so this server render never sees it. A token in the
 * query string (?token=, the old format) is refused without being looked up.
 */
export default async function SetupPage({ searchParams }: PageProps<"/access/setup">) {
  if (!isStudioHost((await headers()).get("host"))) notFound();
  const legacyLink = (await searchParams).token !== undefined;
  return <SetupFlow minPassword={MIN_PASSWORD} legacyLink={legacyLink} />;
}
