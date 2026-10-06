"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics/client";

import { buttonClass, type Variant } from "./button";

export { buttonClass };

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
