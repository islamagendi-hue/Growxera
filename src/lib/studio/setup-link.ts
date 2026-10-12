/**
 * Setup links carry the one-time token in the URL fragment: https://<studio host>/access/setup#token=…
 * Browsers never send the fragment to the server, so the token isn't in the page request, the
 * Referer header or any request log. The setup page reads it in the browser, removes it from the
 * address bar at once, and posts it to the server in a request body. Pure module (browser + server).
 */
const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/** The token from a location hash such as "#token=abc…", or null. */
export function tokenFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return value && TOKEN.test(value) ? value : null;
}

export const setupLink = (origin: string, token: string) => `${origin}/access/setup#token=${token}`;
