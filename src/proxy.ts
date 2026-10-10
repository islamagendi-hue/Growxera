import { NextResponse, type NextRequest } from "next/server";
import { isStudioHost, isStudioPath } from "@/lib/studio/host";

/**
 * Keeps the private studio on its own address:
 * - studio host, "/": goes to the studio;
 * - studio paths on any other host (www.growxera.com, previews): plain 404.
 * Nothing else on the site passes through here (see matcher).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const onStudioHost = isStudioHost(req.headers.get("host"));
  if (pathname === "/") {
    return onStudioHost && req.headers.get("host")?.startsWith("localhost") !== true
      ? NextResponse.redirect(new URL("/studio", req.url), 307)
      : NextResponse.next();
  }
  if (isStudioPath(pathname) && !onStudioHost) {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/studio", "/studio/:path*", "/access", "/access/:path*"],
};
