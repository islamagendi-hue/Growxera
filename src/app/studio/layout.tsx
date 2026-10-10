import type { Metadata } from "next";
import Link from "next/link";
import { StudioNav } from "@/components/studio/StudioUi";
import { connectionState } from "@/lib/studio/linkedin";
import { requireOwner, studioStorageError } from "@/lib/studio/owner";

export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  // Pages re-check too; this keeps the shell itself private.
  await requireOwner();
  const storage = studioStorageError();
  const li = storage ? null : await connectionState();
  const liWarning =
    li?.state === "expired" || li?.state === "unreadable"
      ? "The LinkedIn connection has stopped working, so approved posts are not being published."
      : li?.state === "connected" && li.expiringSoon
        ? `The LinkedIn connection expires in ${li.daysLeft} day${li.daysLeft === 1 ? "" : "s"}. LinkedIn requires reconnecting every 60 days.`
        : null;
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-10">
      <StudioNav />
      {liWarning && (
        <p role="alert" className="mt-6 border border-alert bg-alert-soft p-4 text-sm text-alert">
          {liWarning}{" "}
          <Link href="/studio/capabilities#linkedin" className="font-medium underline underline-offset-4">
            Reconnect
          </Link>
        </p>
      )}
      {storage ? (
        <p role="alert" className="mt-8 border border-alert bg-alert-soft p-6 text-sm text-alert">
          {storage}
        </p>
      ) : (
        children
      )}
    </div>
  );
}
