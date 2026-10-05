"use client";
import Script from "next/script";
import { useSyncExternalStore } from "react";
import { analyticsAllowed, CONSENT_EVENT } from "@/lib/analytics/client";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CONSENT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Loads Google Analytics 4 only when NEXT_PUBLIC_GA4_ID is set AND the visitor accepted analytics. */
export function GoogleAnalytics() {
  const allowed = useSyncExternalStore(subscribe, analyticsAllowed, () => false);
  if (!GA4_ID || !allowed) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(GA4_ID)});`}
      </Script>
    </>
  );
}
