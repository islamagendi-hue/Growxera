import { studioOwner } from "@/lib/studio/access";
import { designText, isDesignFormat, renderDesign } from "@/lib/studio/design";
import { getAction } from "@/lib/studio/repo";

/** Owner-only preview of a post's design (PNG). Query: format, eyebrow, a, b, footer. Everyone else: 404. */
export async function GET(req: Request, ctx: RouteContext<"/studio/design/[id]">) {
  const notFound = () => new Response("Not found", { status: 404 });
  if (!(await studioOwner())) return notFound();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();
  const d = await getAction(id);
  if (!d) return notFound();
  const q = new URL(req.url).searchParams;
  const format = q.get("format");
  const t = designText(d.current.text, { eyebrow: q.get("eyebrow"), lineA: q.get("a"), lineB: q.get("b"), footer: q.get("footer") });
  return await renderDesign(t, isDesignFormat(format) ? format : "square");
}
