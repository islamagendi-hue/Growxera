import type { Metadata } from "next";
import { AccountNav } from "@/components/account/AccountNav";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div>
      <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:px-10">
        <AccountNav />
      </div>
      {children}
    </div>
  );
}
