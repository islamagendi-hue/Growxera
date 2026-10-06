"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/reports", label: "My reports" },
  { href: "/account/progress", label: "My progress" },
  { href: "/diagnostic", label: "New diagnostic" },
  { href: "/account/profile", label: "My profile" },
  { href: "/specialist", label: "Talk to a specialist" },
];

export function AccountNav() {
  const path = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const active = (href: string) => (href === "/account" ? path === href : path.startsWith(href));
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 print:hidden">
      <ul className="flex min-w-max gap-1 border-b border-line text-sm">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 ${active(i.href) ? "border-ink font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {i.label}
            </Link>
          </li>
        ))}
        <li className="ml-auto">
          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
              router.replace("/");
              router.refresh();
            }}
            className="inline-flex min-h-11 items-center px-3 text-ink-3 hover:text-ink"
          >
            {leaving ? "Logging out…" : "Log out"}
          </button>
        </li>
      </ul>
    </nav>
  );
}
