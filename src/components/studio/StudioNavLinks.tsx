"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const STUDIO_NAV = [
  { href: "/studio", label: "Dashboard" },
  { href: "/studio/queue", label: "Posts" },
  { href: "/studio/calendar", label: "Calendar" },
  { href: "/studio/new", label: "New post" },
  { href: "/studio/activity", label: "Activity" },
  { href: "/studio/capabilities", label: "Integrations" },
  { href: "/studio/import", label: "Import" },
  { href: "/studio/export", label: "Backup" },
  { href: "/studio/settings", label: "Settings" },
];

/** The studio's main navigation; marks the current section. Scrolls sideways on narrow screens. */
export function StudioNavLinks() {
  const path = usePathname();
  const active = (href: string) => (href === "/studio" ? path === "/studio" : path === href || path.startsWith(`${href}/`));
  return (
    <ul className="-mx-1 flex gap-1 overflow-x-auto whitespace-nowrap pb-1 text-sm">
      {STUDIO_NAV.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`block px-2 py-1 font-medium underline-offset-4 hover:underline ${active(n.href) ? "bg-ink text-paper hover:no-underline" : ""}`}
          >
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
