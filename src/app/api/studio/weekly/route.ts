import { timingSafeEqual } from "node:crypto";
import { studioDataBlocked } from "@/lib/server/deployment";
import { rpc } from "@/lib/server/store";
import { studioStorageError } from "@/lib/studio/owner";
import { prepareWeek } from "@/lib/studio/weekly";

/**
 * Weekly-plan entry point, called hourly by a cron job with `Authorization: Bearer <secret>` (the
 * same secret as the publishing scheduler). Prepares drafts for the owner's one-click weekly
 * approval; never approves or publishes. Without the right secret the endpoint doesn't exist (404).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: Request): Promise<boolean> {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (given.length < 32 || given.length > 256) return false;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && secret.length >= 32 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return true;
  try {
    return (await rpc<boolean>("li_check_cron_secret", { token: given })) === true;
  } catch {
    return false;
  }
}

async function run(req: Request) {
  if (studioDataBlocked()) return new Response("Not found", { status: 404 });
  if (!(await authorized(req))) return new Response("Not found", { status: 404 });
  if (studioStorageError()) return Response.json({ ran: false, reason: "storage not configured" }, { status: 503 });
  try {
    const r = await prepareWeek();
    // Counts and ids only: no post text in logs or responses.
    return Response.json({ ran: r.ran, reason: r.reason ?? null, prepared: r.prepared, skipped: r.skipped.length });
  } catch (err) {
    console.error("[studio] weekly plan failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ ran: false, reason: "error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
