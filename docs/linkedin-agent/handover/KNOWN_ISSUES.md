# Known issues and risks (outstanding only)

As of 10 Oct 2026 ~21:50 UTC, branch head `e430e71`. Labels as in [CURRENT_STATE.md](CURRENT_STATE.md).

## Critical

None confirmed. Nothing is publishing, and no data loss has been observed.

## High

| ID | Issue | Impact | Evidence | Next action | Needs owner / access |
|---|---|---|---|---|---|
| H1 | Subdomain + password/TOTP work exists only as a local git stash and a scratchpad patch in an ephemeral cloud container | Lost when the container is reclaimed | `git stash list` [V-audit] | Decide: commit it to a branch (untested, as WIP) or drop it | Owner decision |
| H2 | Direct LinkedIn publishing has never run against the real API | Publishing may fail in ways the fake-API tests can't show: API version header (default `202606` unverified), text escaping, image and PDF upload, read-back permissions | 0 executions [V-session]; LinkedIn not connected [R] | Connect LinkedIn; one test post (text, then image, then PDF) with explicit approval | Owner (keys, Allow on LinkedIn) |
| H3 | Hosting and sign-in undecided; the LinkedIn redirect URL depends on it | Connecting now on www would need redoing after a move to the subdomain | LinkedIn app redirect = www callback [R]; WIP default = subdomain | Decide before connecting | Owner decision |
| H4 | No database backups (Supabase Free plan). Private export files exist only in this container; the owner's copy is unconfirmed | An irrecoverable loss if the database is damaged and the container is gone | ACTIVATION.md findings [R]; `content/buffer-snapshots/` local [V-audit]; extension couldn't find the files in Drive [R] | Owner stores a private copy of the exports; consider a manual dump | Owner (and approval for any paid plan) |

## Medium

| ID | Issue | Impact | Evidence | Next action | Needs owner / access |
|---|---|---|---|---|---|
| M1 | PR #17 not merged: a signed-out `/studio` redirects to `/login?next=/studio` | Reveals the path exists (no LinkedIn text) | HTTP check [V-session 21:37] | Merge #17, or supersede it with the WIP | Owner approval |
| M2 | The 36 migrated posts have planned times from 11 Oct 2026 | Approval refuses past times; most need re-timing | Version data [V-session]; `approve()` rule | Owner reviews and re-times | Owner |
| M3 | Buffer still connected to LinkedIn, holding 36 drafts | Someone could re-schedule there and publish outside the studio | BUFFER_MIGRATION.md steps 9–13 unchecked; [U] since 19:00 | Read-only re-check, then disconnect with approval | Owner |
| M4 | Docs partly stale | A new reader may act on outdated instructions | See the list below | Update the docs after the plan reset | — |
| M5 | Previews share the production database; previews on public URLs serve the studio (owner-gated) | Preview testing writes production data | ACTIVATION.md case A [R] | Accept, or separate databases | Owner |
| M6 | Site header shown on studio pages | Cosmetic; links to the main site | `src/app/layout.tsx` [V-audit] | Fixed in the WIP | — |
| M7 | Studio security relies on the site's magic-link email login (30-day session) | Whoever controls the owner's email inbox controls the studio and the LinkedIn connection | `src/lib/server/auth.ts` [V-audit] | The WIP adds password + TOTP | Owner decision |
| M8 | The rollback in ACTIVATION.md doesn't cover the later objects (cron job, Vault secret, function, two tables) | An incomplete rollback | [V-audit] | Use the list in PROJECT_HANDOVER.md §6 (untested) | — |
| M9 | No CI workflow; only Vercel builds | Tests don't run automatically on PRs | No `.github/` [V-audit] | Optional: add CI | — |

### M4: stale documentation

- **PLAN.md:**
  - says M4 (publishing) "after a developer app exists", but it was built in PR #15;
  - D4 says `/studio`, which the owner has since asked to move;
  - its architecture diagram says publishing is "not built".
- **ACTIVATION.md:** the progress section stops at step 5a. Import, media and merge are done but unticked.
- **BUFFER_MIGRATION.md:** steps 3–6 are done but unticked.

## Low

| ID | Issue | Impact | Evidence | Next action |
|---|---|---|---|---|
| L1 | Public-repo hygiene | Minor personal and infrastructure identifiers public (none are secrets) | `git grep` [V-audit] | Replace them with fakes if desired |
| L2 | Unused Vercel variable `LINKEDIN` created by mistake | Confusion; if it holds the client secret, it is an unnecessary copy | [R] | Owner deletes it |
| L3 | Vault secret comparison in `li_check_cron_secret` is not constant-time | Negligible with a 64-hex secret | Migration `20261012000000` | Accept |
| L4 | The in-memory rate limiter is per instance | Weak burst protection for site auth | `src/lib/server/rate-limit.ts` | WIP uses a database-backed lockout for the studio |
| L5 | Running `tsc` after switching branches can fail on stale `.next/types` | False failures | [V-audit] | Run `npx next typegen` first |

### L1: what is public

- `src/lib/studio/studio.test.ts` contains a real-looking LinkedIn post URN and profile slug.
- BUFFER_MIGRATION.md quotes the opening words of one post.
- The docs name the Supabase projects.
- `assets.ts` names the staging asset host.

## Unconfirmed

| ID | Item | Why unconfirmed |
|---|---|---|
| U1 | Whether the owner saved LinkedIn keys in the studio (`li_linkedin_app` rows) | Database not queried in the audit |
| U2 | Whether production runs `8542b1e` (PR #16) | Vercel API not accessible |
| U3 | Current Buffer state since 19:00 UTC | Not re-checked |
| U4 | Whether Vercel logs contain any post text | Logs not accessible |
| U5 | Whether LinkedIn allows PDF document posts for personal profiles with this app | Sources disagree; untested |
