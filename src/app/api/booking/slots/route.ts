import { openSlots } from "@/lib/server/advisor";

export const dynamic = "force-dynamic";

/** Open review slots for the next three weeks (Riyadh time). */
export async function GET() {
  try {
    return Response.json({ slots: await openSlots() });
  } catch (err) {
    console.error("[booking] slots failed", err);
    return Response.json({ error: "We couldn't load available times." }, { status: 503 });
  }
}
