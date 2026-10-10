import type { Metadata } from "next";
import { StudioNav } from "@/components/studio/StudioUi";
import { requireOwner } from "@/lib/studio/owner";

export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };

export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  // Pages re-check too; this keeps the shell itself private.
  await requireOwner("/studio");
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-10">
      <StudioNav />
      {children}
    </div>
  );
}
