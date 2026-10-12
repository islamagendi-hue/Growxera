/**
 * The studio's session cookie is SameSite=Lax, so a top-level link from another site still
 * arrives signed in. Routes that change something on a plain GET (the backup download records
 * "backup taken"; LinkedIn connect starts an authorization) accept only navigations that start
 * on the studio itself, or that the owner typed or bookmarked. Browsers set Sec-Fetch-Site and
 * pages can't forge it; a request without it (an old browser, a script) carries no session.
 */
export function startedHere(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}
