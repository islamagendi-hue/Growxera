import { studioOwner } from "@/lib/studio/access";
import { buildExport } from "@/lib/studio/export";
import { studioStorageError } from "@/lib/studio/owner";
import { audit } from "@/lib/studio/repo";
import { startedHere } from "@/lib/studio/request";

export const dynamic = "force-dynamic";

/** Owner-only download of the weekly backup export (see src/lib/studio/export.ts). Everyone else: 404. */
export async function GET(req: Request) {
  const account = await studioOwner();
  if (!account) return new Response("Not found", { status: 404 });
  if (!startedHere(req)) return new Response("Not found", { status: 404 });
  if (studioStorageError()) return new Response("Storage isn't configured.", { status: 503 });
  try {
    const file = await buildExport(account.email);
    const name = `growxera-studio-export-${file.generated_at.slice(0, 10)}.json`;
    return new Response(JSON.stringify(file), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "unknown";
    console.error("[studio] export failed", err instanceof Error ? err.name : "unknown");
    await audit(account.email, "export.failed", "li_audit_log", null, { error: message }).catch(() => {});
    return new Response(`The export failed and nothing was downloaded: ${message}`, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
