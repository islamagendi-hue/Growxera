import Link from "next/link";
import { notFound } from "next/navigation";
import { Delta } from "@/components/account/Delta";
import { formatDate } from "@/components/account/ReportList";
import { PrintButton, ReportView } from "@/components/report/ReportView";
import { compareReports } from "@/lib/diagnostic/compare";
import { toPreview } from "@/lib/diagnostic/engine";
import { getDiagnostic, listDiagnostics } from "@/lib/server/accounts";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function SavedReportPage({ params }: PageProps<"/account/reports/[id]">) {
  const { id } = await params;
  const account = await requireAccount(`/account/reports/${id}`);
  const row = await getDiagnostic(account.id, id);
  if (!row) notFound();

  // The diagnostic saved just before this one, for "since last time".
  const all = await listDiagnostics(account.id);
  const idx = all.findIndex((d) => d.id === row.id);
  const prevSummary = idx >= 0 ? all[idx + 1] : undefined;
  const prev = prevSummary ? await getDiagnostic(account.id, prevSummary.id) : null;
  const c = prev ? compareReports(prev.report, row.report) : null;

  return (
    <ReportView
      preview={toPreview(row.report)}
      report={row.report}
      reportId={row.id}
      generatedAt={row.completed_at}
      actions={
        <>
          <PrintButton />
          <Link href="/account/reports" className="text-ink-2 underline-offset-4 hover:underline">
            All reports
          </Link>
        </>
      }
      notice={
        c && prev ? (
          <div className="flex flex-col gap-3 border border-line bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Since your diagnostic on {formatDate(prev.completed_at)}: <Delta value={c.overallDelta} /> overall, {c.improved.length} metric
              {c.improved.length === 1 ? "" : "s"} improved, {c.declined.length} declined.
            </p>
            <Link href={`/account/progress?from=${prev.id}&to=${row.id}`} className="text-sm font-medium underline underline-offset-4">
              See full comparison →
            </Link>
          </div>
        ) : undefined
      }
    />
  );
}
