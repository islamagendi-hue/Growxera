/**
 * Studio data (the li_* tables and the studio's file bucket) is production data. Vercel builds
 * every pushed branch as a public preview, and previews receive the same database settings, so a
 * preview (or `vercel dev`) running any branch's code could otherwise read or change it.
 *
 * Rule: on Vercel, only the production deployment may touch studio data. A non-production
 * deployment gets access only when it declares its own separate database (STUDIO_DATABASE=isolated,
 * set on that environment together with that database's URL and key). Outside Vercel (local
 * development, CI) VERCEL_ENV is unset and nothing changes.
 *
 * Pure module: read at call time so tests can vary the environment.
 */
export function studioDataBlocked(env: Record<string, string | undefined> = process.env): string | null {
  const vercelEnv = env.VERCEL_ENV?.trim();
  if (!vercelEnv || vercelEnv === "production") return null;
  if (env.STUDIO_DATABASE?.trim() === "isolated") return null;
  return `Studio data is available only on the production deployment; this is a ${vercelEnv} deployment. Nothing was read or changed.`;
}

/** Studio tables and functions all start with li_. */
export const isStudioTable = (name: string) => name.startsWith("li_");
