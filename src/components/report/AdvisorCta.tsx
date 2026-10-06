"use client";
import Link from "next/link";
import { track } from "@/lib/analytics/client";

/** Where the advisor CTAs point. The report id carries the diagnostic context. */
export function advisorHref(intent: "ask" | "book", reportId?: string, topic?: string) {
  const q = new URLSearchParams();
  if (reportId) q.set("report", reportId);
  if (topic) q.set("topic", topic);
  const qs = q.toString();
  return `/advisor${qs ? `?${qs}` : ""}#${intent}`;
}

/**
 * A quiet, contextual nudge tied to a specific finding: one line explaining why,
 * and two actions. Never a pop-up.
 */
export function AdvisorCta({
  reportId,
  context,
  message = "This appears to be one of your biggest growth gaps.",
  tone = "light",
}: {
  reportId?: string;
  /** Recorded with the click and passed to the advisor as the topic. */
  context: string;
  message?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className={`flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between print:hidden ${dark ? "border-paper/20" : "border-line"}`}>
      <p className={`text-sm ${dark ? "text-paper/70" : "text-ink-2"}`}>{message}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        <Link
          href={advisorHref("ask", reportId, context)}
          onClick={() => track("cta_clicked", { cta: "talk_to_advisor", context })}
          className="underline decoration-current/40 underline-offset-4 hover:decoration-current"
        >
          Talk to an Advisor
        </Link>
        <Link
          href={advisorHref("book", reportId, context)}
          onClick={() => {
            track("cta_clicked", { cta: "book_review", context });
            track("booking_started", { cta: "book_review", context });
          }}
          className={`underline underline-offset-4 ${dark ? "text-accent-bright decoration-accent-bright/50" : "text-accent decoration-accent/40"} hover:decoration-current`}
        >
          Book a Free 30-Minute Review
        </Link>
      </div>
    </div>
  );
}
