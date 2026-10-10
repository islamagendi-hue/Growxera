import { timingSafeEqual } from "node:crypto";
import { publishDue } from "@/lib/studio/publish";
import { studioStorageError } from "@/lib/studio/owner";

/**
 * Scheduler entry point: publishes approved posts whose planned time has come.
 * Called every few minutes by a cron job with `Authorization: Bearer <CRON_SECRET>`.
 * Without CRON_SECRET set, the endpoint doesn't exist (404). It never publishes anything
 * that isn't approved; see src/lib/studio/publish.ts.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function run(req: Request) {
  if (!authorized(req)) return new Response("Not found", { status: 404 });
  if (studioStorageError()) return Response.json({ ran: false, reason: "storage not configured" }, { status: 503 });
  try {
    const r = await publishDue("scheduler");
    // Counts and ids only: no post text in logs or responses.
    return Response.json({
      ran: r.ran,
      reason: r.reason ?? null,
      published: r.published.map((p) => ({ actionId: p.actionId, verified: p.verified })),
      failed: r.failed.map((x) => x.actionId),
      blockedLate: r.blockedLate,
      waiting: r.waiting,
    });
  } catch (err) {
    console.error("[studio] scheduler failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ ran: false, reason: "error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
