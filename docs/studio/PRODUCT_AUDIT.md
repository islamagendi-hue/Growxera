# LinkedIn Growth Studio: product audit

Verified on 11 Oct 2026 against the code, CI and read-only production checks. Each statement says how it was verified:
- **[code]:** read in the repository at the commit named.
- **[test]:** covered by a passing automated test.
- **[e2e]:** exercised in a real browser by the Playwright suite.
- **[prod-read]:** read-only query of production (Supabase SQL, Vercel API, Buffer API).
- **[inferred]:** not directly observable from here.

## 1. Code, previews and production

| Where | Commit | What it contains | Evidence |
|---|---|---|---|
| `main` = production | `8542b1e` (PR #16) | **Old** studio on `www.growxera.com/studio`, website email-link sign-in, 3-hour late-publishing rule, and no publishing switches. Approved posts **would publish automatically once LinkedIn is connected** | [code]; the deployed commit is [inferred]: Vercel's deployment list is forbidden to this session (403) |
| PR #17 | `4715694` | Handover docs; signed-out 404 | [code] |
| PR #18 | `f596a93` | All-publishing switch (P2), automatic switch, per-post confirmation (G1), submission window T−60 s…T−10 s (G2/P1) | [code], [test] |
| PR #19 | `ee4ac16` | agent.growxera.com, password + authenticator sign-in, fragment setup links | [code], [test] |
| PR #20 | `79939be` | Weekly export, CI, studio docs, deployment runbook | [code], [test]; CI ✅ |
| `claude/studio-m2-product`, draft PR #21 (base #20) | see IMPLEMENTATION_STATUS | **This round:** dashboard, posts, calendar, new post, file uploads, activity, settings, error/loading states, E2E suite | [code], [test], [e2e] |

**Previews:**
- Vercel builds every branch, so each preview proves the build and the public site.
- They **can't show studio pages**, because the studio answers only on `agent.growxera.com` and every other host gets a 404 (by design). Previews also share the production database, so studio testing on a preview would touch production data.
- From this environment, preview URLs can't be fetched at all: the network policy blocks `*.vercel.app`, and the Vercel connector's fetch is refused (403).
- Studio screens are therefore verified with:
  - the local E2E suite (`next dev`, local store, Chromium);
  - a production-build smoke test (`next start` with website, preview and studio host headers): the studio, sign-in and setup paths are 404 on the website and preview hosts; on the studio host, signed-out visitors are sent to sign-in; the scheduler is 404 without its secret.

**Production data** [prod-read, 11 Oct 06:40 UTC]:
- posts: 19 approved, 17 ready for review, 1 draft, 1 rejected;
- 0 executions;
- 0 LinkedIn connections and 0 app keys;
- the 6 tables from migrations 20261014/20261015 are **absent**;
- the scheduler runs every 5 minutes and answers `ran:false`;
- website sign-in: 1 verified account, 3 live sessions.
- **Buffer:** LinkedIn channel connected; 0 scheduled, sending, pending or error posts.

## 2. Capability inventory (reviewed stack + this round)

| Area | State | Notes |
|---|---|---|
| Owner sign-in (password + TOTP, lockout, sessions, sign out everywhere, setup-link recovery) | **Works** [test][e2e] | Production still uses the old website sign-in until batch A |
| Error and loading states | **Works** [e2e] | Generic error with a reference and Try again; no internal details |
| Dashboard | **Works** [e2e] | New this round. Shows controls, pipeline, what needs action and why, next 14 days, activity, backup, history |
| Post list: search, status and problem filters | **Works** [e2e] | New filters: needs action, held, missed, not confirmed, confirmed |
| Write a post (text, planned time, note, one image or PDF up to 4 MB) as a draft or for review | **Works** [test][e2e] | New. Files are type-checked from their bytes, stored privately and verified by checksum. PDFs over 4 MB aren't supported (platform request limit) |
| Review: approve exact version, request changes, reject, reopen | **Works** [test][e2e] | — |
| Per-post publishing status (approved version, coverage, every blocker) | **Works** [test][e2e] | New |
| Edit → new version → approval voided | **Works** [test][e2e] | — |
| Calendar (month and agenda, conflicts, missed and held, history) | **Works** [test][e2e] | New. Rescheduling goes through the post's edit (new version, new approval) by design |
| Activity log (categories, problems, links) | **Works** [test][e2e] | New |
| Settings and access | **Works** [e2e] | New |
| All-publishing switch (blocks manual and automatic) | **Works** [test][e2e] | — |
| Automatic publishing (confirmation, window, holds, no retry on unknown outcome) | **Built and tested with a fake LinkedIn** [test] | **Not live:** needs batch A, then B, plus the 15-second scheduler (B3a) and a live test (B3b) |
| Publish now via the LinkedIn API | **Built and tested with a fake LinkedIn** [test] | Never run against LinkedIn: 0 connections |
| Manual publish (copy, open, paste link, verify) | **Works** [test] | — |
| Integrations page (LinkedIn keys, connect, Grok check) | **Works locally** [e2e: page renders] | Real OAuth is untested (external account action) |
| Buffer import and media copy | **Works**: used in production 10 Oct | — |
| Weekly backup export and validation | **Works** [test][e2e] | Restore into Supabase or production is **not supported** (only a local round trip) |
| Analytics and metrics | **Partial** | Frozen import from 10 Oct only; no live feed (LinkedIn doesn't offer one for personal profiles); upload flow not built |
| Grok drafting assistant | **Disabled by decision** ($0 budget) | The client exists, but no UI uses it |
| Engagement inbox (comments, replies), newsletter, daily report | **Missing** | Planned milestones; not started |

## 3. Bugs and weaknesses found in this audit (all fixed, with regression tests)

| Finding | Where | Fix |
|---|---|---|
| The review panel said that once approved, "the studio posts this at the planned time", which is false under G1/P2 | `queue/[id]` | Text corrected; [e2e] checks the blockers shown after approval |
| After an edit, the status panel only said "Not approved" and lost which version was approved | `queue/[id]` | Shows the last approved version and whether it covers the current one [e2e] |
| A new post could never reach review: no UI created posts, and drafts had no submit step | app | New post page, `submitForReview` [test][e2e] |
| New posts couldn't carry media | app | Verified uploads (`uploadAsset`) [test][e2e] |
| The setup token was in the URL query, in the error redirect, and printed by the script | access | Fragment flow, form-data transport, `--out` / `--hash-only` [test][e2e] |
| A setup token appeared in Next's development log of server-function arguments | access | Sent as form data, shown as `{}` [e2e] |
| Dashboard showed a stray "-" for posts without a time; the side column stretched; the phone nav wrapped | dashboard | Fixed (screenshots reviewed) |
| The capability register on Integrations said approved posts publish at their planned time once LinkedIn is connected. It also described the engagement inbox, reply drafting, analytics upload, newsletter preparation and LinkedIn data-export import as existing | Integrations | Corrected; unbuilt items say "Not built yet" [test] |
| A confirmed post said it wouldn't go out only while automatic publishing is OFF, ignoring the all-publishing switch. The manual step blamed "direct publishing isn't verified" and showed "Planned time: -" | post page | Real reasons shown |
| No error or loading state: a database failure showed Next's default error | studio | `error.tsx` (generic message, reference, Try again), `loading.tsx` [e2e] |
| Local development store read a damaged file as empty, so the next write would overwrite it | `store.ts` (dev/test only) | Fails loudly; only a missing file is empty [test][e2e] |
| Backup page didn't say restore is unsupported | Backup | Recovery limits stated |

## 4. Remaining gaps and blockers

| Gap | Blocker | Can be built without approval? |
|---|---|---|
| Go-live on agent.growxera.com | Batch A approval (migrations, DNS, merge, setup link) | No |
| Live LinkedIn posting | Batch B (connect, live test) | No |
| Timed automatic publishing in production | B3a (15-second cron), B3b (live test) | Code done; production step needs approval |
| Files over 4 MB | Needs direct-to-storage signed uploads | Yes (later) |
| Analytics upload (weekly CSV from LinkedIn) | — | Yes |
| Restore script and drill | Drill needs a throwaway Supabase project (approval) | Script yes; drill no |
| Engagement inbox, newsletter, daily report | Scope and priority from the owner | Partly |

## 5. Security and cost notes

- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities. The full audit reports 5 high advisories, all in lint tooling (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`, a regex denial of service). They are not shipped. npm's suggested fix is a downgrade to an older major version, so it isn't applied.
- **Supabase Free:**
  - no automatic backups (weekly export instead);
  - the database and storage are far below the limits at this volume;
  - the planned 15-second cron only calls the app when a confirmed post is due.
- **Vercel:**
  - the studio adds a few server functions;
  - the Hobby plan's cron limits are why pg_cron is used.
- **No paid services were added.** Grok stays at $0.
