"use client";
import { usePathname } from "next/navigation";

/** Hides site chrome (the footer) on standalone pages: the diagnostic landing page and the private studio. */
export function HideOnLanding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/diagnostic") || pathname.startsWith("/studio") ? null : children;
}

/** Hides consent banner and analytics on the private studio: nothing there is tracked. */
export function HideInStudio({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/studio") ? null : children;
}
