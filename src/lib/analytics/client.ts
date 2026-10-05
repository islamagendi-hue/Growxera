"use client";
/**
 * Client-side analytics and attribution.
 *
 * - Attribution (UTMs, referrer, landing page) is captured on arrival and kept in
 *   localStorage so it survives navigation between pages. It is sent only with a
 *   diagnostic or lead the visitor submits.
 * - Events go to window.dataLayer (ready for GTM/GA4) and to /api/events, and only
 *   after the visitor has accepted analytics (see config/privacy.ts).
 */
import { ANALYTICS_REQUIRES_CONSENT, POLICY_VERSION } from "@/config/privacy";
import { ATTRIBUTION_KEYS, type AnalyticsEvent, type Attribution, type AttributionContext } from "./events";

const ATTR_KEY = "gx_attribution";
const ANON_KEY = "gx_anon_id";
const CONSENT_KEY = "gx_consent";
export const CONSENT_EVENT = "gx-consent-change";

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function read<T>(storage: Storage | undefined, key: string): T | undefined {
  try {
    const v = storage?.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, blocked): degrade silently */
  }
}

const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);

export function getAnonymousId(): string {
  let id = read<string>(ls(), ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(ls(), ANON_KEY, id);
  }
  return id;
}

export interface ConsentState {
  analytics: boolean;
  version: string;
  at: string;
}

export function getConsent(): ConsentState | undefined {
  return read<ConsentState>(ls(), CONSENT_KEY);
}

export function setConsent(analytics: boolean) {
  write(ls(), CONSENT_KEY, { analytics, version: POLICY_VERSION, at: new Date().toISOString() });
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function analyticsAllowed(): boolean {
  if (!ANALYTICS_REQUIRES_CONSENT) return true;
  const c = getConsent();
  return !!c?.analytics && c.version === POLICY_VERSION;
}

/** Call once per page load. Keeps first touch; refreshes last touch on campaign or external visits. */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const current: Attribution = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = params.get(k);
    if (v) current[k] = v.slice(0, 200);
  }
  const ref = document.referrer;
  const external = ref && !ref.startsWith(window.location.origin);
  if (external) current.referrer = ref.slice(0, 500);
  const hasCampaign = ATTRIBUTION_KEYS.some((k) => k.startsWith("utm_") && current[k]);
  const ctx = read<AttributionContext>(ls(), ATTR_KEY) ?? {};
  if (!ctx.first || hasCampaign || external) {
    const touch = { ...current, landing_page: window.location.pathname + window.location.search };
    if (!ctx.first) ctx.first = touch;
    ctx.last = touch;
    write(ls(), ATTR_KEY, ctx);
  }
}

export function getAttribution(): AttributionContext {
  return read<AttributionContext>(ls(), ATTR_KEY) ?? {};
}

export function track(event: AnalyticsEvent, props: Props = {}) {
  if (typeof window === "undefined" || !analyticsAllowed()) return;
  const payload = {
    event,
    props,
    anonymousId: getAnonymousId(),
    path: window.location.pathname,
    attribution: getAttribution().last ?? {},
    ts: new Date().toISOString(),
  };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...props });
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  } catch {
    /* analytics must never break the page */
  }
}
