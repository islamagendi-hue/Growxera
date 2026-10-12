"use client";
import { usePathname } from "next/navigation";

const isPrivate = (p: string) => /^\/(studio|access)(\/|$)/.test(p);

/** Hides site chrome (the footer) on standalone pages: the diagnostic landing page and the private studio. */
export function HideOnLanding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/diagnostic") || isPrivate(pathname) ? null : children;
}

/** Hides the site header, consent banner and analytics on the private studio: nothing there is tracked. */
export function HideInStudio({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return isPrivate(pathname) ? null : children;
}
