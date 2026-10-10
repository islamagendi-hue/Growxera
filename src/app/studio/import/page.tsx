import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { requireOwner } from "@/lib/studio/owner";
import { importAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: PageProps<"/studio/import">) {
  await requireOwner("/studio/import");
  const sp = await searchParams;
  return (
    <div className="mt-8 max-w-[72ch]">
      <h1 className="text-h2 font-semibold">Import</h1>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      <section className="mt-8 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">Buffer snapshot (one-off migration)</h2>
        <p className="mt-2 text-sm text-ink-2">
          Upload the private snapshot files you received (they are not in the public repository), in this order:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>
            <span className="font-mono">2026-10-10-history-with-metrics.json</span>: 57 published posts and 1 draft, with Buffer&apos;s metrics.
          </li>
          <li>
            <span className="font-mono">2026-10-10-scheduled-before-pause.json</span>: the 37 scheduled posts. They enter the queue as{" "}
            <em>Ready for review</em>, never approved. Any whose text is already in your history is blocked as a likely duplicate.
          </li>
          <li>
            <span className="font-mono">2026-10-10-update-1839-published-after-export.json</span> and any later update file: posts Buffer
            published after the export. Their queue items are blocked so they can&apos;t be published twice.
          </li>
        </ol>
        <p className="mt-2 text-sm text-ink-2">Re-uploading a file is safe: nothing is duplicated.</p>
        <form action={importAction} className="mt-4">
          <input type="file" name="file" accept="application/json,.json" required className="block text-sm" />
          <button className={buttonClass("primary", "mt-4")}>Import</button>
        </form>
      </section>

      <section className="mt-8 border border-line p-6">
        <h2 className="text-h3 font-semibold">Coming in Milestone 2</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>LinkedIn data export (ZIP): your full post history and the comments you wrote.</li>
          <li>LinkedIn creator analytics export (XLSX): impressions, followers and profile views.</li>
        </ul>
      </section>
    </div>
  );
}
