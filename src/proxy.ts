import { NextResponse, type NextRequest } from "next/server";
import { isStudioHost, isStudioPath, redirectsRootToStudio } from "@/lib/studio/host";

/**
 * Keeps the private studio on its own address (src/lib/studio/host.ts):
 * - studio host, "/": goes to the studio;
 * - studio paths on any other host (www.growxera.com, Vercel previews): plain 404.
 * This only hides the studio. Every studio page, action and route still checks the signed-in
 * owner itself. Nothing else on the site passes through here (see matcher).
 */
export function proxy(req: NextRequest) {
  const host = req.headers.get("host");
  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    return redirectsRootToStudio(host) ? NextResponse.redirect(new URL("/studio", req.url), 307) : NextResponse.next();
  }
  if (isStudioPath(pathname) && !isStudioHost(host)) {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/studio", "/studio/:path*", "/access", "/access/:path*"],
};
