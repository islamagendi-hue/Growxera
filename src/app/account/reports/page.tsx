import Link from "next/link";
import { ReportList } from "@/components/account/ReportList";
import { buttonClass } from "@/components/ui/button";
import { listDiagnostics } from "@/lib/server/accounts";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const account = await requireAccount("/account/reports");
  const items = await listDiagnostics(account.id);
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold">My reports</h1>
          <p className="mt-2 text-ink-2">Every diagnostic is saved as it was on the day. New ones never overwrite old ones.</p>
        </div>
        <Link href="/diagnostic" className={buttonClass("primary")}>
          New diagnostic <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="mt-10">
        {items.length ? <ReportList items={items} /> : <p className="text-ink-2">No reports yet. Your first diagnostic will appear here.</p>}
      </div>
    </div>
  );
}
