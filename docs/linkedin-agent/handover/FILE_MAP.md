# File map: LinkedIn Growth Studio

Paths are relative to the repository root, at commit `e430e71` unless marked WIP.

## Core logic (`src/lib/studio/`)

| File | Responsibility |
|---|---|
| `workflow.ts` | Statuses and allowed transitions, `contentHash`, `idempotencyKey`, `normalizeText`, `publishedFingerprint`, `isLinkedInContentUrl` |
| `repo.ts` | All state changes: `createDraft`, `getAction`, `hasValidApproval`, `listActions`, `addVersion`, `approve`, `reject`, `requestRevision`, `reopen`, `recordManualExecution`, `verifyExecution`, `markBlocked`, `markFailed`, `findPublishedMatch`, `transition`, `load`, `audit` |
| `import.ts` | Buffer snapshot import (`snapshotSchema`, `importSnapshot`), reconciliation |
| `assets.ts` | Media copy and verify (`secureAssets`, `getObject`, allow-list) |
| `linkedin.ts` | LinkedIn OAuth, token and key encryption, `connectionState`, `postingCredentials`, `postToLinkedIn`, `toLittleText`, `readBackPost`, `saveAppKeys`, `linkedInConfig` |
| `publish.ts` | `publishAction`, `publishDue`, `resolveUnknown`, `LATE_LIMIT_MS` |
| `owner.ts` | Owner gate (`isOwner`, `requireOwner`, `ownerOrThrow`, `studioStorageError`) |
| `grok.ts` | xAI client, budget enforcement, `verifyGrok` |
| `capabilities.ts` | Capability register shown in the UI |
| `stats.ts`, `time.ts` | History stats; Riyadh time helpers |
| `studio.test.ts` | All studio tests (156 total in the repo run) |

### Added on 11 Oct 2026 (PRs #18–#20, not merged)

| File | Responsibility |
|---|---|
| `switch.ts` | All-publishing switch (P2): blocks manual and automatic publishing |
| `autopublish.ts` | Automatic switch, per-post authorization, submission window T − 60 s … T − 10 s, holding missed posts, switch setters |
| `access.ts`, `access.test.ts` | Studio sign-in (password + TOTP), sessions, lockout, setup links |
| `crypto.ts` | AES-GCM, scrypt, TOTP, base32 |
| `host.ts`, `owner-email.ts` | Studio host rules; owner email |
| `export.ts`, `export.test.ts` | Weekly backup export, validation, isolated restore |
| `src/proxy.ts` | 404 for studio paths off the studio host |
| `src/app/access/*` | Sign-in and setup pages and actions |
| `src/app/studio/export/*` | Backup page and download |
| `scripts/studio-setup-link.mjs` | One-time setup link (gated on production) |
| `supabase/migrations/20261014000000_studio_access.sql`, `20261015000000_publishing_controls.sql` | New tables (not applied) |
| `.github/workflows/ci.yml` | CI |
| `docs/studio/*` | Plan, risks, roadmap, tests, operations and deployment runbooks, scheduling architecture, gates, log |

## Pages and routes (`src/app/`)

| Path | Responsibility |
|---|---|
| `studio/layout.tsx` | Studio shell, owner check, storage and LinkedIn warning banners |
| `studio/page.tsx` | Overview |
| `studio/queue/page.tsx`, `studio/queue/[id]/page.tsx` | Approval queue and item (review, edit, publish, verify) |
| `studio/import/page.tsx` | Import and media |
| `studio/capabilities/page.tsx` | Capabilities, LinkedIn connection, key entry, Grok check |
| `studio/actions.ts` | All studio server actions |
| `studio/assets/[id]/route.ts` | Owner-only media download |
| `studio/linkedin/connect/route.ts`, `studio/linkedin/callback/route.ts` | LinkedIn OAuth |
| `api/studio/publish-due/route.ts` | Scheduler endpoint |

## Shared with the site

| Path | Responsibility |
|---|---|
| `src/lib/server/store.ts` | Database access (Table union, `selectAll`, `rpc`) |
| `src/lib/server/auth.ts` | Site magic-link auth, used by the studio gate today |
| `src/app/layout.tsx`, `src/components/site/HideOnLanding.tsx` | Hide chrome and analytics on `/studio` |
| `src/components/studio/StudioUi.tsx` | Nav, status badge, notices |
| `src/config/site.ts` | `SITE.url` (default LinkedIn redirect base) |

## Database (`supabase/`)

| Path | Responsibility |
|---|---|
| `migrations/20261010000000_linkedin_studio.sql` | Milestone 1 tables |
| `migrations/20261011000000_linkedin_studio_hardening.sql` | Grants, constraints, `li_assets`, bucket |
| `migrations/20261012000000_linkedin_publishing.sql` | `li_linkedin_connection`, `li_check_cron_secret()` |
| `migrations/20261013000000_linkedin_app_keys.sql` | `li_linkedin_app` |
| `activation/2026-10-10_studio_activation.sql` | One-paste activation with backup and guard |

## Documentation (`docs/linkedin-agent/`)

| Path | Content |
|---|---|
| `PLAN.md` | Version 1 plan and decisions (partly stale) |
| `ACTIVATION.md` | Activation runbook and rollback (progress section stale) |
| `BUFFER_MIGRATION.md` | Buffer retirement checklist (partly unticked) |
| `LINKEDIN_PUBLISHING.md` | Direct publishing setup |
| `handover/*` | This handover |

## Config

| Path | Content |
|---|---|
| `.env.example` | Variable names and purposes (no values) |
| `.gitignore` | Ignores `.env*`, `.data`, `/content/buffer-snapshots/`, `/content/private/` |
| `package.json` | Next 16.3.8, React 19.2.8, zod 4, Vitest 5; scripts |
| `AGENTS.md` / `CLAUDE.md` | Note that this Next.js version differs from older docs |

## Not in Git

| Location | Content |
|---|---|
| `content/buffer-snapshots/` (git-ignored, this container only) | Private exports: 5 JSON files and `assets/` |
| `git stash@{0}` (this container only) | WIP: `src/proxy.ts`, `src/lib/studio/{access,crypto,host,owner-email}.ts`, `src/app/access/*`, `supabase/migrations/20261014000000_studio_access.sql`, edits to `owner.ts`, `linkedin.ts`, `layout.tsx`, `HideOnLanding.tsx`, `StudioUi.tsx`, `store.ts`, routes, and `qrcode` in `package.json` |
