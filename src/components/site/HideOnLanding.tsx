"use client";
import { usePathname } from "next/navigation";

/** Hides site chrome (the footer) on standalone landing pages such as the diagnostic. */
export function HideOnLanding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/diagnostic") ? null : children;
}
