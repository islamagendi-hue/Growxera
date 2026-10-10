import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { EXPORT_REMINDER_DAYS, EXPORTED, lastExportAt, NOT_EXPORTED } from "@/lib/studio/export";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh, isPast } from "@/lib/studio/time";
import { validateExportAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ExportPage({ searchParams }: PageProps<"/studio/export">) {
  await requireOwner();
  const sp = await searchParams;
  const last = await lastExportAt();
  const due = !last || isPast(new Date(new Date(last).getTime() + EXPORT_REMINDER_DAYS * 86_400_000).toISOString());
  return (
    <div className="mt-8 max-w-[80ch]">
      <h1 className="text-h2 font-semibold">Backup</h1>
      <p className="mt-2 text-ink-2">
        The database plan has no automatic backups, so download this export once a week and keep it somewhere private (not in the
        code repository, not in a shared folder).
      </p>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />
      <p className={`mt-4 text-sm ${due ? "text-alert" : ""}`}>
        {last ? `Last export: ${formatRiyadh(last)}.` : "No export has been made yet."} {due ? "A new export is due." : ""}
      </p>
      <a href="/studio/export/download" className={buttonClass("primary", "mt-4")}>
        Download export (JSON)
      </a>

      <section className="mt-10">
        <h2 className="text-h3 font-semibold">What is in it</h2>
        <p className="mt-1 text-sm text-ink-2">
          {EXPORTED.map((t) => t.table).join(", ")}. Every table carries a SHA-256 checksum, and so does the whole file.
        </p>
        <h3 className="mt-4 font-semibold">Left out on purpose</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
          <li>LinkedIn access token and client secret (reconnect LinkedIn after a restore).</li>
          {NOT_EXPORTED.map((t) => (
            <li key={t.table}>
              {t.table}: {t.why}.
            </li>
          ))}
          <li>Media files: the export lists each file and its checksum; the files stay in the private storage bucket.</li>
        </ul>
      </section>

      <section className="mt-10 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">Check a saved export</h2>
        <p className="mt-1 text-sm text-ink-2">Confirms the file is complete and unchanged. Nothing is imported.</p>
        <form action={validateExportAction} className="mt-4">
          <input type="file" name="file" accept="application/json,.json" required className="text-sm" />
          <button className={buttonClass("secondary", "mt-3 block")}>Check file</button>
        </form>
      </section>
    </div>
  );
}
