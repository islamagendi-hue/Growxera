import type { Metadata } from "next";
import { StudioNav } from "@/components/studio/StudioUi";
import { requireOwner, studioStorageError } from "@/lib/studio/owner";

export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  // Pages re-check too; this keeps the shell itself private.
  await requireOwner("/studio");
  const storage = studioStorageError();
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-10">
      <StudioNav />
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
