"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics/client";

type Variant = "primary" | "secondary" | "ghost" | "inverse";

const styles: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-accent-ink",
  secondary: "border border-ink/80 text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink",
  inverse: "bg-paper text-ink hover:bg-accent-bright",
};

export const buttonClass = (variant: Variant = "primary", extra = "") =>
  `inline-flex min-h-12 items-center justify-center gap-2 text-[0.95rem] font-medium transition-colors duration-200 ${variant === "ghost" ? "" : "px-6"} ${styles[variant]} ${extra}`;

/** A link styled as a button that records `cta_clicked` (and `booking_started` for booking CTAs). */
export function CtaLink({
  variant = "primary",
  cta,
  booking,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; cta: string; booking?: boolean }) {
  const href = typeof props.href === "string" ? props.href : "";
  const external = /^https?:\/\//.test(href);
  return (
    <Link
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={buttonClass(variant, className)}
      onClick={(e) => {
        track("cta_clicked", { cta, href });
        if (booking) track("booking_started", { cta, href });
        props.onClick?.(e);
      }}
    >
      {children}
      {variant !== "ghost" && <span aria-hidden className="rtl:-scale-x-100">→</span>}
    </Link>
  );
}
