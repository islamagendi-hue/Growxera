# Launch verification (manual, owner + Claude)

Everything below was **not** verified on a real deployment. Studio pages can't be opened on previews (404 by design, shared production database), and this environment can't reach growxera.com or `*.vercel.app`. Local checks (unit, E2E, production-build host smoke test) are listed in IMPLEMENTATION_STATUS.md.

Run these during batch A ([DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)), in its step order. Any failure: stop and use that step's way back.

## Before step 1
- [ ] Owner: `https://www.growxera.com/studio` opens with today's sign-in (rollback target works).
- [ ] Claude (read-only SQL): 0 LinkedIn connections, 0 executions, scheduler `ran:false`, post counts recorded.
- [ ] `main` is still `8542b1e`; CI green on the head being merged.

## After step 1 (migrations)
- [ ] Check queries match the runbook (6 tables, RLS on, ACL `postgres` + `service_role` only, 0 policies, counts unchanged).
- [ ] Owner: www/studio still works.

## After step 2 (domain)
- [ ] Vercel shows agent.growxera.com valid with a certificate; padlock in the browser.
- [ ] Owner: www and www/studio unchanged.

## After step 3 (merge, one production deployment)
- [ ] `https://www.growxera.com/studio` and `/access` → 404.
- [ ] `https://agent.growxera.com/` → `/studio` → sign-in page.
- [ ] Public pages, the website sign-in and the diagnostic still work on www.
- [ ] With #21: response headers on agent.growxera.com include `X-Robots-Tag: noindex, nofollow`; www's don't.
- [ ] Scheduler keeps answering 200 `ran:false` (Supabase `net._http_response`).

## After step 4 (setup link, first sign-in)
- [ ] The setup link opens; the address bar loses the `#token=…` at once.
- [ ] Password + authenticator set; signed in on agent.growxera.com.
- [ ] Both switches show OFF (dashboard and Integrations).
- [ ] The link file is deleted; reusing the link is refused.
- [ ] Sign out, then sign in with password + code works. A wrong code is refused.

## Product walk-through (owner, on agent.growxera.com, nothing is published)
- [ ] Dashboard: pipeline counts match the production data (19 approved, 17 in review, 1 draft, 1 rejected). No legacy approval shows as confirmed for automatic publishing (G1); those whose planned time has passed show "Planned time passed".
- [ ] Posts: search and each filter; open a legacy approved post: the status panel lists every blocker (all publishing OFF, LinkedIn not connected, not confirmed).
- [ ] Optional (writes one draft row and one file to production): save a **draft** with a small image; it opens only while signed in. Reject it afterwards.
- [ ] Calendar month and agenda; Activity shows the sign-in setup and the draft.
- [ ] Settings shows this device's session; Backup downloads and validates the weekly export.
- [ ] Phone-sized screen: navigation scrolls, no layout overflow.
- [ ] No confirmation for automatic publishing is given, and no switch is turned on (batch B).

## After step 5 (LinkedIn redirect URL)
- [ ] Both callback URLs are listed in the LinkedIn app. Nothing is connected.

## Not part of launch (separate approvals)
- B1 connect LinkedIn; B2 one manual live post; B3 15-second scheduler (SQL to be rehearsed first), `STUDIO_AUTO_PUBLISH_ALLOWED`, a manually approved live timed test.
- Buffer stays connected.
- Restore into Supabase isn't supported; keep the weekly export.
