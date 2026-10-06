import type { Metadata } from "next";
import Link from "next/link";
import { AdvisorHub } from "@/components/advisor/AdvisorHub";
import { DIMENSION_LABELS } from "@/lib/diagnostic/config";
import { currentAccount } from "@/lib/server/auth";
import { eq, selectOne } from "@/lib/server/store";
import type { DiagnosticReport } from "@/lib/diagnostic/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talk to an advisor",
  description: "Ask a Growx Era advisor about your Growth Diagnostic, or book a free 30-minute review of your report.",
  alternates: { canonical: "/advisor" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The report the visitor came from, if any. Signed-in people can only attach their own. */
async function loadReport(id: string | undefined, accountId: string | null) {
  if (!id || !UUID.test(id)) return null;
  try {
    const row = await selectOne<{ id: string; account_id: string | null; completed_at: string; report: DiagnosticReport }>(
      "diagnostic_sessions",
      [eq("id", id.toLowerCase())],
      { columns: "id,account_id,completed_at,report" },
    );
    if (!row?.report) return null;
    if (row.account_id && row.account_id !== accountId) return null;
    return {
      id: row.id,
      date: row.completed_at,
      score: row.report.overallScore,
      bottleneck: DIMENSION_LABELS[row.report.bottleneck],
      context: row.report.context?.label ?? null,
    };
  } catch {
    return null;
  }
}

export default async function AdvisorPage({ searchParams }: PageProps<"/advisor">) {
  const sp = await searchParams;
  const account = await currentAccount();
  const report = await loadReport(typeof sp.report === "string" ? sp.report : undefined, account?.id ?? null);
  const topic = typeof sp.topic === "string" ? sp.topic.slice(0, 80) : undefined;

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-7">
            <p className="eyebrow">Step 3 · Talk to an advisor</p>
            <h1 className="mt-4 text-h2 font-semibold sm:text-[clamp(2.5rem,5vw,3.75rem)]">Talk to a real growth advisor.</h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-ink-2">
              Not a chatbot. A Growx Era advisor reads your diagnostic first, so the conversation starts from your numbers, not
              from scratch.
            </p>
          </div>
          <ol className="space-y-px self-end border border-line bg-line text-sm lg:col-span-5">
            {[
              ["Complete the diagnostic", "Your score, bottleneck and recommendations."],
              ["View your results", "Saved in your account."],
              ["Ask an advisor", "A written reply by email."],
              ["Book a free 30-minute review", "A call to plan your first moves."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4 bg-paper p-4">
                <span className="font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block font-medium">{t}</span>
                  <span className="block text-ink-3">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {report ? (
        <div className="border-b border-line bg-accent-soft">
          <p className="mx-auto max-w-[1240px] px-4 py-4 text-sm sm:px-6 lg:px-10">
            We&apos;ll share your diagnostic with the advisor: score <strong>{report.score}/100</strong>, bottleneck{" "}
            <strong>{report.bottleneck}</strong>
            {report.context ? ` · ${report.context}` : ""}.
          </p>
        </div>
      ) : (
        <div className="border-b border-line bg-paper-2">
          <p className="mx-auto max-w-[1240px] px-4 py-4 text-sm text-ink-2 sm:px-6 lg:px-10">
            Haven&apos;t run the diagnostic yet? It takes about 8 minutes and makes the conversation far more useful.{" "}
            <Link href="/diagnostic" className="font-medium text-ink underline underline-offset-4">
              Start the diagnostic
            </Link>
            {account ? null : (
              <>
                {" "}
                or{" "}
                <Link href="/login?next=/advisor" className="font-medium text-ink underline underline-offset-4">
                  log in
                </Link>{" "}
                to attach a saved report
              </>
            )}
            .
          </p>
        </div>
      )}

      <AdvisorHub
        signedIn={account ? { name: account.name, email: account.email, company: account.company } : null}
        reportId={report?.id}
        topic={topic}
        bottleneck={report?.bottleneck}
      />
    </>
  );
}
