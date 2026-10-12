import { timingSafeEqual } from "node:crypto";
import { studioDataBlocked } from "@/lib/server/deployment";
import { rpc } from "@/lib/server/store";
import { publishDue } from "@/lib/studio/publish";
import { studioStorageError } from "@/lib/studio/owner";

/**
 * Scheduler entry point: publishes approved posts whose planned time has come.
 * Called every few minutes by a cron job with `Authorization: Bearer <secret>`.
 * Without the right secret the endpoint doesn't exist (404). It never publishes anything
 * that isn't approved; see src/lib/studio/publish.ts.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Accepts the secret from CRON_SECRET (env) or the one kept in Supabase Vault
 * ('studio_cron_secret', checked by the li_check_cron_secret function).
 */
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
  // Previews share the production database: the scheduler doesn't exist there (deployment.ts).
  if (studioDataBlocked()) return new Response("Not found", { status: 404 });
  if (!(await authorized(req))) return new Response("Not found", { status: 404 });
  if (studioStorageError()) return Response.json({ ran: false, reason: "storage not configured" }, { status: 503 });
  try {
    const r = await publishDue("scheduler");
    // Counts and ids only: no post text in logs or responses.
    return Response.json({
      ran: r.ran,
      reason: r.reason ?? null,
      published: r.published.map((p) => ({ actionId: p.actionId, verified: p.verified })),
      failed: r.failed.map((x) => x.actionId),
      switchOn: r.switchOn,
      held: r.held,
      waiting: r.waiting,
      notAuthorized: r.notAuthorized,
    });
  } catch (err) {
    console.error("[studio] scheduler failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ ran: false, reason: "error" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
