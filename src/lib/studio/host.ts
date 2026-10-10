/**
 * The studio lives on its own address, agent.growxera.com (owner decision). On every other host
 * (www.growxera.com, Vercel preview URLs) its pages and sign-in return 404, so the website gives
 * no sign it exists and a preview can't be used to reach studio data. Pure module: also used by
 * src/proxy.ts.
 *
 * Env: STUDIO_HOST (hostname only, default agent.growxera.com). localhost is accepted only
 * outside production builds, for local development.
 */
export const DEFAULT_STUDIO_HOST = "agent.growxera.com";
export const STUDIO_HOST = (process.env.STUDIO_HOST?.trim() || DEFAULT_STUDIO_HOST).toLowerCase();
export const STUDIO_ORIGIN = `https://${STUDIO_HOST}`;

/** Paths that belong to the studio (pages, sign-in, its routes). */
export const isStudioPath = (pathname: string) => /^\/(studio|access)(\/|$)/.test(pathname);

const bareHost = (hostHeader: string | null) => (hostHeader ?? "").trim().toLowerCase().replace(/:\d+$/, "");
const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1";

export function isStudioHost(hostHeader: string | null, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  const host = bareHost(hostHeader);
  if (host === STUDIO_HOST) return true;
  return nodeEnv !== "production" && isLocal(host);
}

/** On the studio host, "/" opens the studio (but not on localhost, where "/" is the website). */
export const redirectsRootToStudio = (hostHeader: string | null) => bareHost(hostHeader) === STUDIO_HOST;
