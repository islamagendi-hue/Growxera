import { eq, selectOne } from "@/lib/server/store";
import { type AssetRow, getObject } from "@/lib/studio/assets";
import { studioOwner } from "@/lib/studio/access";

/** Serves a secured copy of a post image or PDF to the owner only. Everyone else: 404. */
export async function GET(_req: Request, ctx: RouteContext<"/studio/assets/[id]">) {
  const notFound = () => new Response("Not found", { status: 404 });
  if (!(await studioOwner())) return notFound();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const row = await selectOne<AssetRow>("li_assets", [eq("id", id)]);
  if (!row?.storage_path || !row.verified_at) return notFound();
  const body = await getObject(row.storage_path);
  if (!body) return notFound();
  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": row.content_type ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${row.storage_path.split("/").pop()}"`,
    },
  });
}
