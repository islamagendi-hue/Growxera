# LinkedIn Growth Studio: project handover and current-state audit

- **Audit:** 10 Oct 2026, ~21:50 UTC. Repository `islamagendi-hue/Growxera` (public). Branch `claude/linkedin-brand-growth-agent-wu375g` at `e430e71`; `main` at `8542b1e`.
- **Scope:** documentation only. Nothing was implemented, merged, deployed, migrated, imported or published during the audit.
- **Companion files:**
  - [CURRENT_STATE.md](CURRENT_STATE.md)
  - [REQUIREMENTS_REGISTER.md](REQUIREMENTS_REGISTER.md)
  - [DECISIONS_LOG.md](DECISIONS_LOG.md)
  - [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
  - [FILE_MAP.md](FILE_MAP.md)

## How evidence is labelled

| Label | Meaning |
|---|---|
| **[V-audit]** | Verified during this audit by running the command or reading the code at `e430e71` |
| **[V-session]** | Verified earlier on 10 Oct 2026 in the working session from a tool result (SQL result, GitHub API, HTTP status), with the time. Not re-checked in this audit |
| **[R]** | Reported by the owner, or by the owner's browser extension (Claude in Chrome), from dashboards Claude could not see |
| **[I]** | Inferred from other evidence |
| **[U]** | Unknown |

### Access limits during the audit

- **Supabase:** the owner declined a read-only query, so the database state is the last [V-session] state.
- **Vercel:** the API returns 404 or 403 for the project, so environment variables and deployments come only from [R] reports and from GitHub commit statuses.
- **Network:** growxera.com, LinkedIn and Buffer can't be reached directly from this container. Earlier HTTP checks of growxera.com were made from the database server with `pg_net` [V-session].
- **Buffer:** not queried during the audit.

---

## 1. Executive summary

**What it is.** A private, single-user tool for the owner (Islam Gendi) to plan, write, approve and publish content on **his personal LinkedIn profile**, and to keep its history and performance. It is not a feature of growxera.com and must be invisible to everyone else.

**Where it lives today.** Inside the existing Growxera Next.js app, at `https://www.growxera.com/studio`. It reuses the site's login, Supabase database and Vercel deployment [V-audit]. The owner has since asked to move it to its own address, `linkedin-agent.growxera.com`, with its own email + password + phone-code sign-in. That work exists only as **unpushed, untested** code [V-audit].

### Intended end-to-end workflow

From [PLAN.md](../PLAN.md) and the owner's messages:

1. **History:** import post history and metrics (authorized exports).
2. **Voice and strategy:** build a voice profile and strategy (Milestone 2).
3. **Drafting:** Grok drafts posts in the owner's voice, and Claude does creative work and visuals (Milestones 3 and 6).
4. **Review:** the owner reviews, edits (every edit is a new version) and approves the exact version, including the planned time.
5. **Publish:** the studio publishes at the planned time through LinkedIn's official API. Manual copy-and-open is the fallback.
6. **Verify:** the studio confirms the post is live.
7. **Engagement:** an inbox for comments, with drafted replies (Milestone 5).
8. **Reporting:** a daily report and a learning loop (Milestone 7).
9. **Newsletter:** a manual-publish workflow (Milestone 8).

### Completed (production, as of the last check)

- **Milestone 1** (`/studio`, merged PR #14 [V-audit]):
  - owner-only studio;
  - approval engine (versions, hash-bound approvals, status machine, audit log);
  - Buffer snapshot importer;
  - capability register;
  - Grok client, disabled.
- **Activation:**
  - studio tables created in production [R + V-session];
  - Buffer data imported: 58 history posts, 57 metric snapshots, 38 migrated items [V-session ~20:45];
  - 49 media files copied and verified [V-session 20:41].
- **Buffer publishing stopped:** 36 queued posts moved to Draft, verified; 0 scheduled [V-session 19:00].
- **Direct publishing code** (PR #15, merged [V-audit]):
  - OAuth connect;
  - encrypted token;
  - approval-bound publisher;
  - scheduler endpoint.
- **Production setup for publishing:**
  - migration `20261012000000` applied;
  - pg_cron + pg_net scheduler running every 5 minutes (it currently does nothing because LinkedIn isn't connected) [V-session 21:25–21:35].
- **Keys entered in the studio** (PR #16, merged): LinkedIn keys can be entered on the Capabilities page instead of Vercel. Migration `20261013000000` applied [V-session].

### Partial, unverified or not started

| Item | State |
|---|---|
| LinkedIn direct publishing | Built and tested against a **fake** LinkedIn only. The real connection was never made, so it is **unverified**. Keys are not in Vercel [R]; in-studio key entry unconfirmed [U] |
| PR #17 (404 for signed-out visitors) | Open, not merged |
| Separate subdomain with password + TOTP sign-in | Unpushed WIP in a local stash. No tests. Domain not added in Vercel. LinkedIn redirect URL not updated |
| Draft generation (Grok) | Client exists, but no UI uses it and no key is set. **Not implemented** as a feature |
| Not started (Milestones 2, 3, 5–8) | Voice audit, editorial calendar, engagement inbox, visuals, daily report, learning loop, newsletter workflow |
| Dashboard redesign (owner screenshots) | Not started |

### Most important risks and blockers

1. Unpushed WIP will be lost when this container is reclaimed.
2. Real LinkedIn publishing is unverified, including the API version header, text escaping, and image and PDF posts.
3. The hosting and sign-in model is undecided, and the LinkedIn redirect URL depends on it.
4. The production database has no automatic backups (Free plan) [R].
5. The 36 migrated posts carry planned times from 11 Oct 2026 onwards. Approval refuses past times.
6. Buffer is still connected to LinkedIn [R/U]. Its 36 drafts could be re-scheduled there by mistake.
7. The documentation in `docs/linkedin-agent/` is partly stale (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).

---

## 2. Original vision and requirements history

The full traceable list is in [REQUIREMENTS_REGISTER.md](REQUIREMENTS_REGISTER.md); decisions are in [DECISIONS_LOG.md](DECISIONS_LOG.md). Sources:

- the owner's messages in the working session of 10 Oct 2026;
- `docs/linkedin-agent/PLAN.md`;
- `BUFFER_MIGRATION.md`;
- `ACTIVATION.md`;
- `LINKEDIN_PUBLISHING.md`;
- commit messages and PR bodies (#14–#17).

### Original vision

From the owner's initial brief, as reflected in PLAN.md [V-audit]:

- a "LinkedIn Personal Brand Growth Agent";
- Grok as the writing and conversation engine, Claude for creative work and design;
- an approval-first model;
- a capability matrix of what LinkedIn officially allows;
- a dashboard;
- a learning loop;
- a daily report;
- honest data: no invented analytics or claims.

### Later changes

1. **Decisions D1–D6** (PLAN.md §1). D5 was revised from "investigate the Buffer API" to **"Buffer is retired; no Buffer integration"**.
2. The owner clarified the purpose: the tool is **for publishing from his own LinkedIn account, not on growxera.com**.
3. **Milestone 1 execution rules** (owner's message, quoted in the session):
   - never publish, comment, react, connect or message without explicit approval of that exact action;
   - never claim success without evidence;
   - no private files in the public repo;
   - no secrets in logs or commits;
   - no deleting data or disconnecting integrations without verification and approval;
   - no new paid services without approval;
   - stop for approval before merging, deploying, changing production data, deleting data or publishing.
4. **"I want the system to publish"** (owner, evening of 10 Oct). Direct publishing was built (PR #15) and the scheduler was set up on the owner's instruction ("ادخل نفذ", "go in and do it").
5. **"Nothing on the website related to LinkedIn may be visible to anyone"** (owner). This led to PR #17.
6. **"Move the LinkedIn part to a completely separate link on a subdomain `linkedin-agent`, with email and password"** (owner). The owner chose the name `linkedin-agent.growxera.com` after being told subdomain names are public, and chose **password + authenticator code**. WIP only.

### Explicitly excluded

- Facebook and X.
- Any Buffer integration.
- Automated DMs or connection requests.
- Automated engagement through the Chrome extension (D3).
- Silent model substitution when Grok is unavailable (D2).

### Unresolved or contradictory

| Topic | Conflict |
|---|---|
| Subdomain name vs "nothing LinkedIn-related visible" | The subdomain name itself is public (DNS and certificate logs). The owner accepted this knowingly |
| D4 vs the new request | D4 says "studio at `/studio` inside Growxera, same auth"; the new request asks for a separate address and separate auth. D4 is effectively superseded but not yet implemented |
| Grok as primary writer vs drafting | Grok is the primary writer (D2), but no key exists and no drafting feature has been built |
| Approval-first vs automatic publishing | Reconciled in code: an approval binds the exact text, files **and planned time**, and the scheduler only publishes within 3 hours of that time. The owner did not separately sign off this rule [I] |

---

## 3. Current architecture and infrastructure

### Stack [V-audit]

| Part | Details |
|---|---|
| Framework | Next.js **16.3.8** (App Router; `proxy` replaces middleware in this version) |
| UI and validation | React 19.2.8, TypeScript 5, Tailwind 4, zod 4 |
| Tests | Vitest 5 |
| Analytics | `@vercel/analytics` 2 |
| Runtime used locally | Node 22 |
| Scripts | `dev`, `build`, `lint` (eslint), `test` (`vitest run`), `typecheck` (`tsc --noEmit`) |

- **Unpushed WIP only:** adds `qrcode@1.5.4` (MIT) and `@types/qrcode`.

### Reused Growxera architecture

- **Persistence:** `src/lib/server/store.ts`.
  - Supabase PostgREST with the service-role key, server-only.
  - Local `.data/*.json` in development and tests.
  - Refuses to store anything in production without env vars (`storageMode: "disabled"`).
  - The studio added `selectAll` (pages past PostgREST's 1,000-row cap) and `rpc` (only `li_check_cron_secret`).
- **Site auth:** `src/lib/server/auth.ts`, magic-link accounts with a `gx_session` cookie (30 days). The studio currently relies on it.
- **Site chrome:** `src/app/layout.tsx` with `HideInStudio` and `HideOnLanding` (`src/components/site/HideOnLanding.tsx`), which hide the footer, consent banner, GA and Vercel Analytics on `/studio`. The site header **is still shown** on `/studio` today [V-audit].

### Authentication and authorization (current, on `main`)

`src/lib/studio/owner.ts`:

- `isOwner(account)`: a verified account whose email equals `STUDIO_OWNER_EMAIL`.
- `requireOwner(path)`: used by pages. A signed-out visitor is redirected to `/login?next=…`; a signed-in non-owner gets a 404.
- `ownerOrThrow()`: used by every server action. It also refuses when storage is disabled.
- **Route handlers** (`assets/[id]`, `linkedin/connect`, `linkedin/callback`) check `isOwner(await currentAccount())`. Tests enforce that each page, action and route checks the owner (`studio.test.ts`, "checks the owner on every studio page, server action and route").
- **PR #17** (open) changes `requireOwner()` to return 404 for signed-out visitors too.
- **WIP** (unpushed) replaces all of this with a studio-only session, described below.

### Unpushed WIP design (in `stash@{0}`)

- **`src/proxy.ts`:** returns a plain 404 for `/studio*` and `/access*` on any host except the studio host. On the studio host, `/` redirects to `/studio`.
- **`src/lib/studio/host.ts`:** `STUDIO_HOST` (default `linkedin-agent.growxera.com`; localhost allowed).
- **`src/lib/studio/access.ts`:**
  - one-time setup link (24 h, only its SHA-256 is stored) to set the password and pair the authenticator (the code must be confirmed before saving);
  - sign-in with email + password (scrypt) + TOTP;
  - lockout after 5 failures in 15 minutes;
  - a code can't be reused;
  - session cookie `__Host-gx_studio`: httpOnly, Secure, SameSite=Lax, 7 days; only its hash is stored;
  - a reset revokes all sessions.
- **`src/lib/studio/crypto.ts`:** AES-GCM seal/open, scrypt, TOTP (RFC 6238), base32.
- **Pages:** `src/app/access/page.tsx` (sign-in), `src/app/access/setup/page.tsx` (QR code), `src/app/access/actions.ts`.
- **Migration:** `20261014000000_studio_access.sql`, adding 4 tables.
- **Status:** typechecked while being written, but **no tests and never run** [V-audit: no tests in the stash diff].

### Database additions

See section 6.

### Storage

- **Bucket `li-studio-assets`:** private.
- **What it holds:** content-addressed copies `media/<sha256>.<ext>`.
- **How it is served:** only to the owner, via `src/app/studio/assets/[id]/route.ts` (`Cache-Control: private, no-store`, `nosniff`).

### Server actions

`src/app/studio/actions.ts` [V-audit]:

| Group | Actions |
|---|---|
| Review | `approveAction`, `rejectAction`, `reviseAction`, `reopenAction`, `editAction` |
| Manual publishing | `recordPublishedAction`, `verifyAction`, `failedAction` |
| Import and setup | `importAction`, `checkGrokAction`, `secureAssetsAction` |
| Direct publishing | `publishNowAction`, `resolveUnknownAction`, `publishDueNowAction` |
| LinkedIn connection | `saveLinkedInKeysAction`, `disconnectLinkedInAction` |

### Route handlers

- `src/app/studio/assets/[id]/route.ts`: serves secured media to the owner.
- `src/app/studio/linkedin/connect/route.ts`: OAuth start, with a state cookie.
- `src/app/studio/linkedin/callback/route.ts`: OAuth return.
- `src/app/api/studio/publish-due/route.ts`: the scheduler endpoint.
  - Bearer secret from `CRON_SECRET` env, or the Vault secret checked by the `li_check_cron_secret()` RPC.
  - Returns 404 otherwise.
  - Its responses contain ids and counts only.

### Background process

- **Supabase `pg_cron` job `studio-publish-due`:** runs every 5 minutes. It calls `net.http_post` to `https://www.growxera.com/api/studio/publish-due` with the Vault secret `studio_cron_secret` (generated in the database, never displayed) [V-session].
- **What the endpoint does:** `publishDue()` in `src/lib/studio/publish.ts`. It publishes approved posts whose planned time has come, waits for future ones, and blocks posts more than 3 h late. It does nothing when LinkedIn isn't connected.

### Environment variables

Names and purposes only; no values.

| Variable | Purpose | Set where |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database access. The service key also derives the encryption key for keys entered in the studio | Vercel, all environments [R] |
| `STUDIO_OWNER_EMAIL` | The only email allowed in | Vercel: Production, Preview, Development [R] |
| `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL` | Site (not studio) | Vercel [R] |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn app keys (optional since PR #16; the studio form is the alternative) | **Not set** [R] |
| `LINKEDIN_REDIRECT_URI`, `LINKEDIN_API_VERSION` | Optional overrides (redirect default `<site>/studio/linkedin/callback`; version default `202606`) | Not set [R] |
| `CRON_SECRET` | Optional (the Vault secret is used instead) | Not set [R] |
| `XAI_API_KEY`, `STUDIO_GROK_ENABLED`, `XAI_MODEL`, `XAI_MONTHLY_BUDGET_USD`, `XAI_PRICE_INPUT_PER_MTOK`, `XAI_PRICE_OUTPUT_PER_MTOK` | Grok, disabled unless all are set | Not set [R] |
| `STUDIO_HOST` | WIP only: the studio hostname | n/a |
| A variable named `LINKEDIN` | Created by the owner by mistake. **Not read by any code** | Vercel [R] |

### Vercel

- **Project and team:** project `growx-era` in team "Growxera architects growth systems and builds MV" [V-session via Vercel API list].
- **Git deployments:** Git connected; production branch `main`, so **every push to `main` deploys production** [R].
- **Previews:** build per PR push. GitHub commit statuses show success for `a798d9a` (PR #15), `e16976e` (PR #16) and `e430e71` (PR #17) [V-session].
- **No `vercel.json`** [V-audit].
- **Previews share the production database** ("case A") [R].
- **Deployment protection:** off [R].

### External services

| Service | Use | State |
|---|---|---|
| Supabase | Database, Storage, Vault, pg_cron, pg_net | Free plan [R] |
| LinkedIn | Developer app "App" | Products: Share on LinkedIn (Default Tier) and Sign In with OpenID Connect. Redirect URL `https://www.growxera.com/studio/linkedin/callback`. Scopes listed: openid, profile, w_member_social, email [R] |
| xAI (Grok) | Writing model | Not configured |
| Buffer | None in the studio. Used once, read-only, for the export, and once (approved) to move 36 posts to Draft | — |

Claude does creative work in Claude Code sessions. There is no Claude API integration in the code [V-audit].

---

## 4. Feature inventory

Status labels:

- **Implemented and locally verified:** unit tests and build pass at `e430e71`.
- **Implemented but remotely unverified:** never exercised end to end in production.
- **Partially implemented.**
- **Not implemented.**
- **Blocked.**
- **Unknown.**

| Feature | Intended behavior | Current implementation | Evidence | Status | Remaining work |
|---|---|---|---|---|---|
| Private Studio access | Invisible to everyone but the owner | `/studio` on www. Signed-out visitors are redirected to login (PR #17 makes it 404). Noindex; header still shown | `owner.ts`, `layout.tsx`; HTTP check [V-session 21:37] | Implemented; PR #17 pending | Decide hosting; merge or replace #17 |
| Separate subdomain + password/TOTP | `linkedin-agent.growxera.com`, own sign-in | Unpushed stash | `stash@{0}` | Partially implemented (untested, unpushed) | Tests, PR, Vercel domain, DNS, LinkedIn redirect update |
| Owner-only authorization | Every page, action and route checks the owner | `requireOwner`, `ownerOrThrow`, route checks | Test "checks the owner on every studio page, server action and route" | Implemented and locally verified | Replaced if WIP adopted |
| Dashboard and control interface | Owner screenshots: tabs, KPI cards, sessions grid, Today panel, Control tab, "Prepare now" | Overview with queue counts, history stats and Grok status. Queue, Import, Capabilities pages | `src/app/studio/page.tsx` etc. | Partially implemented | Redesign per the owner's screenshots (not started) |
| Content planning and calendar | Editorial calendar (M3) | None | — | Not implemented | — |
| Draft generation | Grok drafts in the owner's voice | `grok.ts` `generate()` with a budget check; no caller in the app | grep: no callers [V-audit]; Grok tests | Partially implemented (client only). Blocked on the xAI key | Drafting UI, voice profile |
| Editing and versioning | Every edit is an immutable version | `addVersion` (text and planned time editable in the UI; asset changes only in code) | Tests "voids an approval when the content is edited…", "voids approval when an image changes" | Implemented and locally verified | UI to change media |
| Approval workflow | Approve the exact version; reject or revise with a reason | `approve`, `reject`, `requestRevision`, `reopen`; hash-bound; refuses published duplicates and past planned times | Tests in "approval enforcement" | Implemented and locally verified | — |
| Scheduled-time management | Planned time in Riyadh time; overdue flagged | `target_at` per version; `time.ts`; overdue banner; approval refuses past times | Test "reads planned times as Riyadh time" | Implemented and locally verified | 36 migrated items need new times |
| Publishing workflow (manual) | Copy, open LinkedIn, paste the link back | `recordManualExecution` | Execution tests | Implemented and locally verified; never used in production (0 executions) | — |
| Publishing workflow (API) | Post at the planned time once approved | `publish.ts` + `linkedin.ts` + pg_cron | 11 tests with a fake LinkedIn | Implemented but remotely unverified | Connect LinkedIn, then a live test post |
| Published-post verification | Executed ≠ verified | Manual confirmation, or API read-back (often not permitted) | Tests "separates executed from verified", "marks it verified only when LinkedIn returns the same text" | Implemented and locally verified (read-back unverified live) | — |
| Duplicate prevention | Never publish the same content twice | Idempotency key; same-hash and same-link checks; history fingerprint; claim-first transitions | Duplicate and race tests | Implemented and locally verified | — |
| Content history | Published posts with provenance | `li_content` (58 rows) | [V-session] | Implemented and remotely verified (counts) | Refresh from a LinkedIn export (M2) |
| Buffer data migration | Import history, queue and metrics | `import.ts`; production import done via staged SQL with checksums | [V-session ~20:45] | Implemented and remotely verified | — |
| Import validation and idempotency | Per-record zod validation, crash-safe, reconciliation | `import.ts` | Tests in "import safety" | Implemented and locally verified | — |
| Media migration and verification | Copy to the private bucket, SHA-256 checked | `assets.ts` `secureAssets` | 49/49 [V-session 20:41]; test "copies allowed files…" | Implemented and remotely verified | — |
| Analytics and reporting | Real-data analytics, daily report | Lifetime Buffer metrics shown on the Overview (`stats.ts`) | — | Partially implemented | Creator-analytics import (M2), daily report (M7) |
| Grok integration and budget | Disabled until key and budget; no fallback | `grok.ts`, `li_llm_usage` | Grok tests | Implemented and locally verified; disabled in production | Key, budget, UI |
| Claude-assisted creative work | Briefs and visuals by Claude | Outside the app (sessions); no code | — | Not implemented in the app | Decide scope |
| Error handling and recovery | Fail visibly; no silent retry | Failed/blocked states; unknown-outcome flow; `safeLog` | Tests on failures and unknown outcomes | Implemented and locally verified | — |
| Logging and privacy | No post text or secrets in logs | `safeLog` in actions; scheduler returns counts only | Test "never echoes the key in errors" | Implemented and locally verified | — |
| LinkedIn API integration | OAuth, posts, images, PDFs | `linkedin.ts` | Fake-API tests | Implemented but remotely unverified | Live test; API version; PDF posts |
| Facebook / X | Out of scope | None | PLAN.md | Not implemented (excluded) | — |
| Tests, build, lint, typecheck | Green | 156 tests; build OK | [V-audit on `e430e71`] | Implemented and locally verified | No CI workflow in the repo (only Vercel builds) |

---

## 5. Git and deployment state

| Item | Value |
|---|---|
| Repository | `islamagendi-hue/Growxera`, public |
| Working branch | `claude/linkedin-brand-growth-agent-wu375g` |
| Branch head (before the handover commit) | `e430e71c0d31326f3d4e8964f963de39aed57279` |
| `main` | `8542b1ec996002350561e072ac56ec1d41c926bc` |
| Branch vs `main` | 1 commit ahead, 0 behind |
| Open PR | [islamagendi-hue/Growxera#17](https://github.com/islamagendi-hue/Growxera/pull/17): open, not merged, Vercel preview success on `e430e71` |
| Handover commit | Added to the same branch, so it appears in PR #17. Its SHA is reported in the final message |

### Studio history on `main` [V-audit]

| PR | Commit | Content |
|---|---|---|
| #14 | `e230db8` (squash of 11 commits `7a64f3c`…`0dc9c0a`) | Plan; Milestone 1; activation hardening; Buffer stop record; security-review fixes (`5671bf8`); activation runbook and one-paste SQL; progress docs |
| #15 | `7c35777` | Direct publishing (OAuth, publisher, scheduler, migration `20261012000000`, setup guide), then the scheduler secret moved to Vault |
| #16 | `8542b1e` | LinkedIn keys entered on the Capabilities page (migration `20261013000000`) |
| #17 (open) | `e430e71` | Signed-out visitors get a 404 on studio pages |

### CI and checks

- There is no `.github/workflows` [V-audit]. The only automatic check is the Vercel preview build, reported as a GitHub commit status.
- Local results on `e430e71` [V-audit]:
  - `npx tsc --noEmit`: pass, after `npx next typegen`. Stale generated types from the stashed WIP caused a false failure first.
  - `npx eslint src`: pass.
  - `npx vitest run`: 9 files, 156 tests, all pass, none skipped.
  - `npx next build`: pass.

### Vercel

| Item | State |
|---|---|
| Production deployment of `7c35777` (PR #15) | **Inferred live**: the scheduler endpoint (added in PR #15) answered with its JSON on www at 21:25 UTC [V-session] |
| Production deployment of `8542b1e` (PR #16) | Not directly verified [U] |
| Deployment URLs and ids | Not visible (Vercel API 404) [U] |

### Local vs Preview vs Production

- **Local:** the local store (`.data`), no Supabase, no LinkedIn.
- **Preview and Production:** share the production database [R]. A preview of PR #17 can read and write studio data.
- **WIP:** would make previews return 404 for studio paths.

---

## 6. Database and data migration

### Migrations

| File | Adds | Idempotent | Remote execution |
|---|---|---|---|
| `20261010000000_linkedin_studio.sql` | 9 tables: `li_content`, `li_metrics_snapshots`, `li_drafts`, `li_draft_versions`, `li_actions`, `li_approvals`, `li_executions`, `li_llm_usage`, `li_audit_log`. Unique indexes include `li_content(source, source_id)`, `li_drafts(origin, origin_ref)`, `li_draft_versions(draft_id, version)`, `li_actions(draft_id)` and `li_executions(idempotency_key)`. Check constraints on status, kind and source. RLS enabled | Yes (`if not exists`) | Applied via the activation script [R]; tables confirmed [V-session] |
| `20261011000000_linkedin_studio_hardening.sql` | Revokes all from anon and authenticated; hash and version checks (in `do … exception when duplicate_object` blocks); `li_content_external_url_uidx`; table `li_assets`; bucket `li-studio-assets` (private) | Yes | Applied [R]; bucket private [V-session] |
| `supabase/activation/2026-10-10_studio_activation.sql` | One-paste script: wrong-project guard, `backup_20261010` copy of 8 site tables, both migrations in one transaction, verification queries | Guarded | Applied [R]; verification row `li_tables 10, li_without_rls 0, browser_grants 0, bucket_public false, backup_tables 8` [R] |
| `20261012000000_linkedin_publishing.sql` | `li_linkedin_connection` (RLS, grants revoked); function `li_check_cron_secret(text)` (security definer, empty `search_path`, execute only for `service_role`) | Yes | Applied by Claude with the owner's go-ahead; RLS, grants and function privileges verified [V-session ~21:22] |
| Not a repo file | Extensions `pg_cron` and `pg_net`; Vault secret `studio_cron_secret` (generated in the database); cron job `studio-publish-due` | — | Applied [V-session ~21:24] |
| `20261013000000_linkedin_app_keys.sql` | `li_linkedin_app` (RLS, grants revoked) | Yes | Applied; verified [V-session ~21:33] |
| `20261014000000_studio_access.sql` | WIP only, in the stash | — | **Not applied** |

- **Order:** the files run in filename order. `20261012…` needs Supabase Vault (installed by default). The scheduler setup needs `pg_cron` and `pg_net`.
- **Existing schema dependencies:** none on site tables, except the activation script's guard and backup.
- **Supabase migration history:** these files were applied through the activation script and the `apply_migration` tool. Exact entries in `supabase_migrations` were not checked [U].

### RLS and roles

- **RLS:** on for every `li_*` table, with no policies [V-session for `li_linkedin_*`; R for the M1 tables].
- **Grants:** revoked from `anon` and `authenticated`.
- **Access path:** only the server's service role reads and writes.

### Verification

- **Activation:** the queries are in ACTIVATION.md §3 and the activation script.
- **Last known import state** [V-session ~20:45]:

| Table | Rows |
|---|---|
| `li_content` | 58 |
| `li_metrics_snapshots` | 57 |
| `li_drafts` | 38 |
| `li_draft_versions` | 38 |
| `li_actions` | 38 (36 `ready_for_review`, 1 `draft`, 1 `blocked`) |
| `li_approvals` | 0 |
| `li_audit_log` | 43 |

- **Checksums:** four MD5 checksums (history texts, version texts, version hashes, asset URLs) matched the locally generated import.

### Rollback

- **What to run:** ACTIVATION.md "Rollback" for the M1 tables and bucket. For the later objects:

  ```sql
  select cron.unschedule('studio-publish-due');
  drop function public.li_check_cron_secret(text);
  drop table public.li_linkedin_connection, public.li_linkedin_app;
  ```

  Optionally delete the Vault secret.
- **What it removes:** all studio data. Site data is unaffected.
- **Not covered:** these later objects are not in the documented rollback. This audit adds the list above but did not test it [I].

### Shared database

Previews and Production use one database (case A) [R].

### How the import was actually done

- **Normal path (by design):** owner uploads the private files at `/studio/import`.
- **Actual path:** Claude ran the real importer locally against the private files and verified the result. The rows were then transferred into a temporary staging table in production in 9 chunks, each with a verified MD5, and inserted in one transaction. The staging table was dropped. The owner had approved the import ("continue the import").
- **Order:** history file, then scheduled file, then the update file. Re-export files only re-check.
- **Status mapping:**
  - Buffer `scheduled` becomes `ready_for_review`;
  - Buffer `draft` becomes `draft`;
  - a queue item later published by Buffer becomes `blocked`, with a reason;
  - `sending` at export time is skipped.

### Duplicate detection

Two checks, `findPublishedMatch` and `publishedFingerprint` in `workflow.ts` and `repo.ts`:

- **Same text and same media:** "already published", blocked.
- **Same text, different media:** blocked for a check.

### Failure modes

- **Crash mid-import:** repaired on re-run (test "leaves no partial or duplicate records…").
- **Invalid records:** reported and skipped, never silently dropped.
- **No storage configured:** the studio refuses to work.

---

## 7. Buffer and LinkedIn current state

| Item | State | Evidence |
|---|---|---|
| History before migration | 57 published posts (51 native, 6 via Buffer), Feb–Oct 2026, with lifetime metrics | [V-session], BUFFER_MIGRATION.md |
| Queue before migration | 37 scheduled + 1 Buffer draft | [V-session] |
| Post published after the export | 1 queued post was published by Buffer at 18:30 UTC. It was exported separately, imported as history (58th post) and its queue item is **blocked** | [V-session] |
| Converted to Draft | 36 scheduled posts moved to Draft in Buffer at 19:00 UTC (owner-approved), verified identical; 0 scheduled | [V-session 19:00]; **not re-checked since** |
| Buffer connection | Still connected to LinkedIn; retirement steps 7–13 of BUFFER_MIGRATION.md not done | [R/U] |
| Used by the new system | No | [V-audit: test "…never calls Buffer"] |
| Private exports | 5 JSON files + `assets/` (12 thumbnails + `urls.tsv`) in `content/buffer-snapshots/` (git-ignored) **in this container only**. The owner's copy is unconfirmed: the browser extension reported it couldn't find them in Drive | [V-audit] (file names and sizes only), [U] |
| Imported into the studio | 58 history, 57 metrics, 38 migrated items (production database) | [V-session] |
| Real LinkedIn publishing by the studio | **None** (0 executions; LinkedIn not connected) | [V-session] |

### Capabilities

- **Text posts:** "unverified" (self-serve `w_member_social`).
- **Image and PDF posts:** unverified.
- **Unavailable to a self-serve app:** newsletter API, reading own posts and comments, post analytics, profile metrics, DMs.
- The live register is `src/lib/studio/capabilities.ts`, shown at `/studio/capabilities`. It marks text publishing "Available" only after a verified API post.

---

## 8. Media and private assets

| Item | Details |
|---|---|
| Original location | The 37 queued posts' files are in a public bucket `li-assets` of a different Supabase project, `leanapp-staging` (host allow-listed in `src/lib/studio/assets.ts`). The 12 historical thumbnails are in Buffer's S3 media bucket |
| Why it is temporary | A staging project and Buffer's bucket are not durable homes; either can be reset or lose access when Buffer is disconnected |
| Destination | Growxera's private bucket `li-studio-assets`, at content-addressed paths, served only to the owner |
| Workflow | `secureAssets()`: collect every URL referenced by any version and by history; fetch only https URLs on allow-listed hosts; check type and size (≤ 25 MB); store; read back; compare SHA-256; record in `li_assets`. Safe to re-run; failures are recorded with `last_error`, listed, and nothing is deleted |
| Counts | **49** = 37 queued-post files + 12 history thumbnails. Result: 49 copied, 0 failed, then 4 re-runs with 49 already secured [V-session 20:41] |

### Why 37 files come from 38 migrated items

- **The 37:** the 37 scheduled posts each carry exactly one file (34 PNG images + 3 PDF carousels [I from the version data]).
- **The 38th:** the one Buffer draft has no media.
- **The published post:** the post Buffer published at 18:30 is one of the 37, so its image is counted there.

### Protection

- Private bucket, owner-only route, no public URLs.
- Private exports are git-ignored, and the test "public repository hygiene" checks that no snapshot or secret pattern is tracked.
- No private export file appears in git history [V-audit: `git log --all -- content/buffer-snapshots content/private` is empty].
- See section 9 for small public-repo findings.

---

## 9. Security and privacy audit

| Area | Safeguard | Evidence | Remaining risk |
|---|---|---|---|
| Owner authorization | Owner check on every page, action and route; 404 for non-owners | `owner.ts`; enforcement test | Signed-out redirect reveals `/studio` (fixed by PR #17, unmerged). Relies on the site's magic-link email security |
| Sessions | Site `gx_session` cookie (site auth) | `src/lib/server/auth.ts` | Not studio-specific. The WIP adds a host-only studio session with password + TOTP (untested) |
| Database access | Server-only service key; RLS on; no grants for browser roles | Migrations; [V-session] checks | The service key is powerful; anyone with it has full access |
| Secrets | LinkedIn token AES-GCM encrypted with a key derived from the client secret. Keys entered in the studio are encrypted with a key derived from the service-role key. Cron secret in Vault | `linkedin.ts`; test "stores the token encrypted…" | The service-role key derives the encryption key, so someone holding both the database and that key can decrypt |
| Uploads and downloads | Import JSON ≤ 5 MB, zod-validated. Media fetch allow-list, https only, no redirects, type and size checks | `actions.ts`, `assets.ts` | — |
| Private content in logs | `safeLog` strips database response bodies; the scheduler returns ids and counts only | `actions.ts`, `publish-due/route.ts` | Not audited against Vercel's actual logs [U] |
| Public repository | Snapshot paths ignored; hygiene test | `.gitignore`, test | **Low:** `studio.test.ts` contains a real-looking LinkedIn post URN and profile slug. BUFFER_MIGRATION.md quotes the first words of one post. ACTIVATION.md names the Supabase projects. None are secrets |
| Duplicate publishing and races | Claim-first conditional transitions; unique idempotency key; unknown outcomes never retried | `repo.ts`, `publish.ts`; race tests | The idempotency key is unique only in Postgres. The local store does not enforce it (tests rely on the transition claim) |
| CSRF | Server actions (Next.js origin checks); OAuth `state` cookie compared in constant time; SameSite=Lax cookies | `linkedin/connect`, `callback` | Not penetration-tested |
| Scheduler endpoint | 404 without a secret; constant-time env comparison; Vault comparison inside Postgres | `publish-due/route.ts`; test | The Vault comparison is not constant-time (low risk with a 64-hex secret) |
| Fail-safe | Refuses without storage; publishes nothing when not connected; late posts blocked | Tests | — |

Tests show that the code behaves as specified in the tested cases. They do not prove the absence of other flaws.

---

## 10. Testing and verification matrix

| Verification | Command or procedure | Result | Commit | Environment | Proves | Does not prove |
|---|---|---|---|---|---|---|
| Typecheck | `npx next typegen && npx tsc --noEmit` | Pass | `e430e71` | Local | Types are consistent | Runtime behavior |
| Lint | `npx eslint src` | Pass | `e430e71` | Local | Lint rules hold | — |
| Unit tests | `npx vitest run` | 156/156, 0 skipped | `e430e71` | Local (local store, fake LinkedIn, fake Buffer files) | Workflow, approval, import, duplicate, media, publisher and endpoint logic as specified | Real LinkedIn, Supabase or Vercel behavior |
| Build | `npx next build` | Pass | `e430e71` | Local | Production build compiles | Deployment health |
| Preview builds | Vercel commit status | Success | `a798d9a`, `e16976e`, `e430e71` | Vercel | They built | Runtime correctness |
| Import counts and checksums | SQL counts + 4 MD5s | Match | n/a | Production database | Data imported exactly | — |
| Media copy | Audit log `assets.secured` | 49 copied, 0 failed | n/a | Production | Files copied and verified | Long-term durability |
| Scheduler | `net._http_response` | 200, `ran:false` | live `main` | Production | The cron job, secret and endpoint work | Publishing |
| Anonymous exposure | `pg_net` GETs | `/studio` → login page (no LinkedIn text); LinkedIn routes and endpoint 404; sitemap and robots clean | live `main` (before #17) | Production | No LinkedIn text visible anonymously | DNS and certificate exposure of a future subdomain |
| Live LinkedIn post | — | **Not done** | — | — | — | Anything about real publishing |
| WIP subdomain auth | — | **No tests, never run** | stash | — | — | — |

---

## 11. Known issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md), which ranks them by severity with impact, evidence, next action and dependencies.

---

## 12. Decisions required from the owner

**Essential:**

1. **The unpushed WIP** (separate subdomain + password/TOTP sign-in): keep it (commit, test, PR) or drop it. This must be decided before the container is reclaimed.
2. **Hosting and sign-in:** `/studio` on www with site login, or `linkedin-agent.growxera.com` with its own sign-in. The LinkedIn redirect URL and PR #17 depend on this choice.
3. **Publishing mode:** automatic publishing at the approved time (built, unverified), or manual only. This includes accepting LinkedIn's 60-day reconnect.
4. **Who writes drafts:** Grok (needs an xAI key and monthly budget), Claude in sessions, or the owner. D2 currently says Grok.
5. **The 36 migrated posts:** keep, re-time, edit or reject them.
6. **Buffer retirement:** when to disconnect (BUFFER_MIGRATION.md steps 9–13).
7. **Which later milestones to keep:** the scope of the dashboard redesign, analytics, daily report, inbox, visuals and newsletter.

**Optional:**

- Daily report channel (email or in-app).
- Upgrade from the Supabase Free plan for backups. This is a paid service and needs approval.

---

## 13. Clean restart plan (high level)

### Reusable as is

- The approval engine: `workflow.ts` and `repo.ts`, with tests.
- `store.ts` patterns.
- The importer and its reconciliation.
- Media copy.
- The capability register.
- The publisher and LinkedIn client design.
- Migrations `20261010`–`20261013`.

### Worth retaining

- Hash-bound approvals.
- Executed ≠ verified.
- No silent retries.
- Duplicate checks against history.
- Owner-only, noindex, untracked pages.

### May need redesign

- Hosting and sign-in (subdomain decision).
- The dashboard UI (the owner's screenshots).
- Scheduling semantics (late-post rule, re-timing migrated posts).
- How keys are entered (Vercel vs studio form).

### Postpone

- Engagement inbox.
- Newsletter workflow.
- Learning loop.
- Visuals pipeline.

These can wait until publishing is verified and drafting is decided.

### Do not repeat

- Buffer export and import.
- Media copy.
- The activation SQL.
- Stopping the Buffer queue.

### Verify before building further

- A live LinkedIn connection and one test post (text, then image, then PDF).
- The LinkedIn API version header.
- Whether the post read-back is permitted.
- Production deployment of `main`.
- The current Buffer state.
- The current database counts.
- The owner holds private copies of the export files.

---

## 14. Handover artifacts

| File | Content |
|---|---|
| [CURRENT_STATE.md](CURRENT_STATE.md) | One-page status |
| [REQUIREMENTS_REGISTER.md](REQUIREMENTS_REGISTER.md) | Requirements with source and status |
| [DECISIONS_LOG.md](DECISIONS_LOG.md) | Decisions, reasons, final or provisional |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | Outstanding issues and risks |
| [FILE_MAP.md](FILE_MAP.md) | Where everything is |

Existing project documents (partly stale, see KNOWN_ISSUES):

- [PLAN.md](../PLAN.md)
- [ACTIVATION.md](../ACTIVATION.md)
- [BUFFER_MIGRATION.md](../BUFFER_MIGRATION.md)
- [LINKEDIN_PUBLISHING.md](../LINKEDIN_PUBLISHING.md)
