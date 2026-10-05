import type { Metadata } from "next";
import Link from "next/link";
import { Results } from "@/components/diagnostic/Results";
import { toPreview } from "@/lib/diagnostic/engine";
import type { DiagnosticReport } from "@/lib/diagnostic/types";
import { findReportByLeadId } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Growth Diagnostic report",
  // Reports are shared by link only; keep them out of search engines.
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string): Promise<DiagnosticReport | null> {
  if (!UUID.test(id)) return null;
  try {
    return (await findReportByLeadId(id.toLowerCase())) as DiagnosticReport | null;
  } catch (err) {
    console.error("[report] load failed", err);
    return null;
  }
}

/** A Growth Diagnostic report opened from the link in the report email. */
export default async function ReportPage({ params }: PageProps<"/report/[id]">) {
  const { id } = await params;
  const report = await load(id);
  if (!report) {
    return (
      <section className="mx-auto max-w-[1240px] px-4 py-24 sm:px-6 lg:px-10">
        <p className="eyebrow">Growth Diagnostic</p>
        <h1 className="mt-4 text-h2 font-semibold">We couldn&apos;t find this report.</h1>
        <p className="mt-4 max-w-[54ch] text-ink-2">The link may be incomplete. You can take the diagnostic again in a few minutes.</p>
        <Link href="/diagnostic" className="mt-8 inline-block bg-ink px-5 py-3 font-medium text-paper">
          Take the Growth Diagnostic
        </Link>
      </section>
    );
  }
  return <Results preview={toPreview(report)} report={report} sessionId={id} />;
}
