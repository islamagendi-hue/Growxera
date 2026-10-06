"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PrintButton, ReportView } from "@/components/report/ReportView";
import { track } from "@/lib/analytics/client";
import type { Answers, DiagnosticReport, ReportPreview } from "@/lib/diagnostic/types";
import { LeadForm } from "./LeadForm";

/** The result screen right after the diagnostic. */
export function Results({
  preview,
  report,
  sessionId,
  answers,
  savedToAccount,
  onUnlocked,
  onRestart,
}: {
  preview: ReportPreview;
  report?: DiagnosticReport;
  sessionId: string;
  answers?: Answers;
  savedToAccount?: boolean;
  onUnlocked?: (r: DiagnosticReport) => void;
  onRestart?: () => void;
}) {
  const unlocked = !!report;
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    const key = `${sessionId}:${unlocked}`;
    if (viewed.current === key) return;
    viewed.current = key;
    track("report_viewed", { sessionId, full: unlocked });
  }, [sessionId, unlocked]);

  const notice = savedToAccount ? (
    <p role="status" className="border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
      Saved to your account. You&apos;ll find it, and how it compares with your earlier diagnostics, in{" "}
      <Link href={`/account/reports/${sessionId}`} className="font-medium underline underline-offset-4">
        My reports
      </Link>
      .
    </p>
  ) : emailedTo ? (
    <p role="status" className="border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
      We&apos;ve emailed a secure link to <strong>{emailedTo}</strong>. Open it to save this report to your account and come
      back to it anytime.
    </p>
  ) : emailFailed ? (
    <p role="status" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
      Your report is below, but we couldn&apos;t send the email just now. You can{" "}
      <Link href="/signup" className="underline underline-offset-4">
        create your account
      </Link>{" "}
      to save future reports.
    </p>
  ) : null;

  return (
    <ReportView
      preview={preview}
      report={report}
      reportId={sessionId}
      notice={notice}
      actions={
        <>
          {unlocked && <PrintButton />}
          {onRestart ? (
            <button type="button" onClick={onRestart} className="text-ink-2 underline-offset-4 hover:underline">
              Start a new diagnostic
            </button>
          ) : (
            <Link href="/diagnostic" className="text-ink-2 underline-offset-4 hover:underline">
              Take the diagnostic
            </Link>
          )}
        </>
      }
      gate={
        <section className="bg-paper-2 print:hidden">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-5">
              <p className="eyebrow">Step 2 · Your full report</p>
              <h2 className="mt-4 text-h2 font-semibold">See your recommendations and how you compare.</h2>
              <ul className="mt-8 space-y-3">
                {[
                  "Up to 10 recommendations, ranked for your business",
                  "Your metrics against the benchmark for businesses like yours",
                  `Estimated revenue opportunity in ${preview.currency}, where your data supports it`,
                  "Saved to your account, so you can track progress over time",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="text-accent">
                      →
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-line bg-card p-6 sm:p-8 lg:col-span-7">
              <LeadForm
                source="diagnostic"
                sessionId={sessionId}
                answers={answers}
                submitLabel="View my report"
                onSuccess={(r, to) => {
                  if (to) setEmailedTo(to);
                  else setEmailFailed(true);
                  if (r) onUnlocked?.(r);
                }}
              />
            </div>
          </div>
        </section>
      }
    />
  );
}
