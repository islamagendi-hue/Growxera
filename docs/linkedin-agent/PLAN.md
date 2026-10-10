# LinkedIn Growth Studio: Version 1 plan

Status: **Milestone 1 built and hardened; waiting for production activation** ([ACTIVATION.md](ACTIVATION.md)). Updated 10 Oct 2026.

The studio is a private tool for one person: it prepares content and engagement for **the owner's personal LinkedIn account**, and nothing is published without the owner's explicit approval. It is hosted inside the Growxera app only to reuse its login, database and deployment. It publishes nothing on growxera.com or on any company page, is invisible to everyone else (404), is not linked from the site, and is excluded from search engines and analytics.

Labels: **VERIFIED** = tested in this project. **UNVERIFIED** = documented, not yet tested with this app. **UNAVAILABLE** = not offered to this app.

---

## 1. Decisions (owner, 10 Oct 2026)

| # | Decision |
| --- | --- |
| D1 | Scheduled posts that were never explicitly approved go through the approval queue individually. Preserve content, dates and status; delete nothing. |
| D2 | Grok is the primary writing and conversation model. The integration stays disabled until a key and a spending limit are set. No silent substitution of another model. |
| D3 | Automated posting and commenting through Claude in Chrome is retired. Approval first; copy-and-open for anything without an authorized API. |
| D4 | The studio lives at `/studio` inside the existing Growxera app (same auth, Supabase, Vercel). No new project or service. |
| D5 (revised) | **Buffer is retired.** No Buffer integration in the studio. Buffer was used once, read-only, to export history and the queue; then it is disconnected (see [BUFFER_MIGRATION.md](BUFFER_MIGRATION.md)). |
| D6 | The existing content standard and historical posts are the voice baseline. The new requirements win on approval, security and execution. |

Scope: LinkedIn only. No Facebook, no X.

---

## 2. Verified findings

| Item | Finding | Status |
| --- | --- | --- |
| App | Next.js 16 App Router, Supabase (server-only REST with service key, RLS on with no policies), own magic-link auth, Resend, Vercel | VERIFIED |
| Repository visibility | **Public.** Private data (exports, drafts, metrics, the content standard) must never be committed. `content/buffer-snapshots/` and `content/private/` are git-ignored | VERIFIED |
| Buffer queue | 37 scheduled posts and 1 draft exported read-only on 10 Oct 2026 with text, assets, original dates, status and metrics. **One of the 37 was published by Buffer at 18:30 UTC after the export. The other 36 were moved to Draft in Buffer at 19:00 UTC (owner-approved); 0 remain scheduled** | VERIFIED |
| Post history | 57 published posts with Buffer's lifetime metrics (51 posted natively, 6 through Buffer), Feb to Oct 2026 | VERIFIED |
| Post images | The queued posts' images are in a public bucket of a Supabase project named `leanapp-staging`, not in Buffer and not in Growxera's project. A staging project is not a durable home. This environment's network policy blocked downloading them | VERIFIED |
| Grok API | xAI API is billed separately from SuperGrok/X subscriptions. Current flagship listed at $2 per million input tokens and $6 per million output tokens (third-party trackers; xAI's docs site was unreachable from here). No key configured | UNVERIFIED until a key is checked in the studio |
| LinkedIn direct publishing | Self-serve "Share on LinkedIn" product grants `w_member_social` (post as a member). The developer app must be associated with a LinkedIn Page, but posts go to the personal profile. Document (PDF) posts on personal profiles: sources disagree. Not tested: no LinkedIn app exists | UNVERIFIED |

---

## 3. Capability register

The live version is `/studio/capabilities` (source: `src/lib/studio/capabilities.ts`).

| Capability | Status | Your manual step until available |
| --- | --- | --- |
| Publish text post | UNVERIFIED (Share on LinkedIn, `w_member_social`) | Copy, open LinkedIn, post, paste the link back |
| Publish image / PDF carousel | UNVERIFIED | Same, attaching the asset |
| Publish newsletter article | UNAVAILABLE (no API) | Paste into the article editor, pick the newsletter, schedule, paste the link back |
| Read own posts | UNAVAILABLE (`r_member_social` restricted) | LinkedIn data export when history needs refreshing |
| Read comments on own posts | UNAVAILABLE (restricted) | Paste comment and link into the inbox |
| Post replies / comments | UNVERIFIED (write is self-serve; needs the parent URN) | Copy, open, paste, send, paste the link back |
| Post analytics | UNAVAILABLE to a self-serve app (gated partner API) | Weekly creator-analytics export upload |
| Followers, profile views, subscribers | UNAVAILABLE | Weekly upload or entry |
| DMs, connection requests | UNAVAILABLE, out of scope | None (never automated) |
| Grok | UNVERIFIED (no key) | Create key and limit, add env vars |

Losing Buffer means losing its partner access to post analytics. The replacement is LinkedIn's own creator analytics export, uploaded weekly. It is less convenient but authorized and complete.

---

## 4. Architecture

```
You ─login─▶ growxera.com/studio (owner-only, noindex, no analytics)
               │  Overview · Approval queue · Import · Capabilities   (M1, built)
               │  Content studio · Inbox · Topics · Voice · Daily report (later milestones)
               ▼
        Server actions / route handlers (owner check on every call)
               │                     │                       │
        Supabase (existing)    Grok via xAI API        LinkedIn API (Share on LinkedIn)
        li_* tables            disabled until set      not built until verified (M4)
                                                        → manual copy-and-open meanwhile
```

Claude (in Claude Code sessions) handles creative direction, design briefs and visual rendering; finished assets will be stored in Growxera's Supabase Storage and attached to drafts.

### Data model (migration `20261010000000_linkedin_studio.sql`)

`li_content` (published history with provenance) · `li_metrics_snapshots` (append-only, lifetime vs 7-day flagged) · `li_drafts` + `li_draft_versions` (immutable versions with SHA-256 content hash) · `li_actions` (one proposed external action, status machine) · `li_approvals` (append-only decisions bound to a hash) · `li_executions` (unique idempotency key) · `li_llm_usage` (spend tracking) · `li_audit_log`.

### Approval rules (enforced in `src/lib/studio/repo.ts`, tested in `studio.test.ts`)

- Statuses: Draft → Ready for review → Approved → Executed → Verified; plus Rejected, Needs revision, Failed, Blocked. Illegal transitions are refused.
- Approval binds to the hash of text, assets and planned time. Any edit creates a new version and voids the approval. A tampered stored version also voids it.
- Execution requires a valid approval of the current version. One execution per action per approved content; the same content or the same post link can't be recorded for two items.
- Executed and Verified are separate. Failures stay visible and are never retried automatically.
- Rejection and revision require a reason (input for the learning loop).
- Grok refuses to run, before any API call, if the monthly budget would be exceeded. No fallback model.

---

## 5. Milestones

| M | Scope | Status |
| --- | --- | --- |
| **M1** | Schema, owner-only `/studio`, approval engine, Buffer snapshot import (history, metrics, queue), capability register, Grok client (disabled), tests | **Built.** Needs the setup steps in section 6 to run in production |
| M2 | Voice audit: LinkedIn data export + creator analytics import, claim register, Voice Profile v1, Audit Report and strategy for approval | Next |
| M3 | Content planning and drafting: editorial calendar, Grok drafts in your voice, creative briefs (Claude) | After M2 and Grok key |
| M4 | LinkedIn direct publishing: developer app, OAuth, capability test, executor with idempotency; manual fallback stays | After a LinkedIn developer app exists |
| M5 | Engagement inbox: pasted comments, Grok reply drafts, categories, priority | |
| M6 | Visuals: Claude briefs and rendered assets in Growxera Storage | |
| M7 | Daily report (email), learning loop, experiments, fatigue detection | |
| M8 | Newsletter workflow (manual publish), retention and deletion, runbook | |

---

## 6. What you need to do

### For Milestone 1 (now)

1. **Buffer:** done. Publishing stopped (36 posts moved to Draft, verified). Remaining retirement steps in [BUFFER_MIGRATION.md](BUFFER_MIGRATION.md).
2. **Supabase:** take a backup, then run **both** migrations in order (`20261010000000_linkedin_studio.sql`, then `20261011000000_linkedin_studio_hardening.sql`) in the Growxera project (the one with `accounts` and `leads`), and run the verification query.
3. **Vercel:** add `STUDIO_OWNER_EMAIL` (your login email) to the `growx-era` project for Production and Preview.
4. **Preview first:** on the pull request's Preview deployment, import the four private files in order, confirm the counts, and copy the media. Merge only after that.

Exact clicks, the verification query and the expected numbers are in [ACTIVATION.md](ACTIVATION.md).

### Later, only when that milestone starts

- M2: LinkedIn data export ZIP and creator analytics XLSX; your content standard file.
- M3: xAI key with a spending limit (see `.env.example` for the variables).
- M4: a LinkedIn developer app (needs a LinkedIn Page to associate it with).

---

## 7. Definition of done (Version 1)

1. Voice profile and knowledge base built from authorized history, with citations, approved by you.
2. Original drafts in your voice, with no unverified personal claims.
3. Contextual reply drafts for pasted comments.
4. Creative briefs and rendered visuals stored durably.
5. One interface to review, edit (versioned), approve, reject.
6. Approved actions executed once (API where verified, manual otherwise) and verified; failures visible.
7. Unsupported actions show a manual step and record completion.
8. Every number shows its source; missing data shows "No data".
9. Daily report from stored data, emailed and archived.
10. Learning loop proposes changes as approvals, with an audit trail.
11. Tests cover owner gate, approval invalidation, illegal transitions, duplicate prevention, budget and secret redaction.
12. Runbook for setup, operation, failures and deletion.
