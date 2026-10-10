/**
 * The studio lives on its own address (default linkedin-agent.growxera.com). On every other
 * host its pages return 404, so the main site gives no sign it exists. Pure module: also
 * used by src/proxy.ts.
 *
 * Env: STUDIO_HOST (hostname only). Local development (localhost) is always allowed.
 */
export const STUDIO_HOST = (process.env.STUDIO_HOST?.trim() || "linkedin-agent.growxera.com").toLowerCase();
export const STUDIO_ORIGIN = `https://${STUDIO_HOST}`;

/** Paths that belong to the studio (pages, sign-in, its routes). */
export const isStudioPath = (pathname: string) => /^\/(studio|access)(\/|$)/.test(pathname);

export function isStudioHost(hostHeader: string | null): boolean {
  const host = (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "");
  return host === STUDIO_HOST || host === "localhost" || host === "127.0.0.1";
}
