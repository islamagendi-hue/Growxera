"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureAttribution, CONSENT_EVENT, track } from "@/lib/analytics/client";

/** Captures UTM/referrer attribution on every navigation and records page views (when consented). */
export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution();
    track("page_viewed", { path: pathname });
  }, [pathname]);
  useEffect(() => {
    // Record the page the visitor was on when they accepted analytics.
    const onConsent = () => track("page_viewed", { path: window.location.pathname, after_consent: true });
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);
  return null;
}
