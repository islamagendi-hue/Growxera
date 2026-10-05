"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ANALYTICS_REQUIRES_CONSENT, CONSENT_TEXT, POLICY_VERSION } from "@/config/privacy";
import { CONSENT_EVENT, getConsent, setConsent } from "@/lib/analytics/client";

const OPEN_EVENT = "gx-open-consent";

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CONSENT_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** True when the visitor hasn't made a choice for the current policy version. */
const needsChoice = () => {
  const c = getConsent();
  return ANALYTICS_REQUIRES_CONSENT && (!c || c.version !== POLICY_VERSION);
};

export function ConsentBanner() {
  const undecided = useSyncExternalStore(subscribe, needsChoice, () => false);
  const [reopened, setReopened] = useState(false);
  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);
  if (!undecided && !reopened) return null;
  const choose = (analytics: boolean) => {
    setConsent(analytics);
    setReopened(false);
  };
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0 print:hidden"
    >
      <div className="border border-ink/15 bg-card p-5 shadow-[0_12px_40px_-12px_rgba(14,19,17,0.35)]">
        <p id="consent-title" className="font-medium">Your privacy</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          {CONSENT_TEXT.analytics}{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy notice
          </Link>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => choose(false)} className="min-h-11 border border-ink/30 px-3 text-sm hover:border-ink">
            Essential only
          </button>
          <button type="button" onClick={() => choose(true)} className="min-h-11 bg-ink px-3 text-sm text-paper hover:bg-accent-ink">
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConsentSettingsButton() {
  return (
    <button
      type="button"
      className="mt-3 text-left text-sm text-ink-2 underline-offset-4 hover:underline"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      Privacy settings
    </button>
  );
}
