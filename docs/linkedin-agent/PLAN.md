# LinkedIn Growth Agent: Version 1 plan

Status: **proposal, awaiting approval**. Nothing in this document has been implemented. Inspection date: 10 Oct 2026.

Labels used throughout: **VERIFIED** means checked in this session. **UNVERIFIED** means it is documented or reported but not confirmed for this account. **ASSUMPTION** means my inference.

---

## 1. Repository and infrastructure findings

### This repository (`islamagendi-hue/Growxera`)

| Item | Finding | Status |
| --- | --- | --- |
| Framework | Next.js 16.3.8 (App Router), React 19.2, TypeScript, Tailwind 4, zod, Vitest | VERIFIED |
| Purpose today | The public Growx Era website and Growth Diagnostic, with accounts, report history, advisor booking and self-service deletion | VERIFIED |
| Data | Supabase Postgres accessed **server-only** through REST `fetch` with the service-role key (`src/lib/server/store.ts`). RLS is on with no policies. Dev falls back to `.data/*.jsonl`. | VERIFIED |
| Auth | Own magic-link auth: hashed one-time tokens and hashed `gx_session` HttpOnly cookies (`src/lib/server/auth.ts`, `accounts.ts`) | VERIFIED |
| Email | Resend through `fetch` (`src/lib/server/email.ts`) | VERIFIED |
| Conventions | Migrations in `supabase/migrations/`, docs in `docs/`, rate limiting, content rule "no invented results" already in README | VERIFIED |
| LLM / LinkedIn code | None. No Grok, Anthropic or LinkedIn code or env vars in `.env.example` or `src/` | VERIFIED |
| Vercel | Team "Growxera…" has projects `growx-era` and `leanapp.io`. Env var listing for `growx-era` returned 404 through the connector, so production env names are **not** confirmed | Projects VERIFIED, envs UNVERIFIED |

**Reusable as is:** server-only Supabase store, session auth, Resend, rate limiter, zod schemas, the deletion pattern, the migration and docs conventions, and the Vercel deployment.

### Your existing LinkedIn operation (found in your synced Claude skills and connectors)

You already run a working pipeline that the brief does not mention:

| Component | What it does today | Status |
| --- | --- | --- |
| **Buffer** (connector, org "My organization", LinkedIn channel `islamgendi`) | Publishes posts. 95 LinkedIn posts visible: **51 native posts** you published yourself (Feb to Sep 2026), 6 sent via Buffer, **37 scheduled** through 31 Oct, 1 draft | VERIFIED |
| Buffer analytics | Returns impressions, reach, reactions, comments, shares and engagement rate for your personal posts (last 30 days: 12 posts, 2,201 impressions, 1,156 reach, 9 reactions, 2 comments) | VERIFIED |
| Canva (connector) | Post images and carousels. Export URLs expire after about 1 hour | Connector present. Behaviour per your skill notes |
| Google Drive (connector) | Newsletter issue Docs | Connector present |
| Claude in Chrome extension | Schedules newsletter articles and posts approved comments/replies in your own browser | Per skill notes, not verified here |
| Content standard, learning memory, performance logs, 30 newsletter issues | Live in a claude.ai project (`/mnt/project-files/...`) | **Not reachable from this repo session** |

### Conflicts with the new brief that need your decision

1. **Approval model.** The Buffer skill says Claude owns the queue and should "act on the data and report results, not proposals" (10 Oct 2026). The new brief makes approval mandatory for every external action. **37 posts are currently scheduled without per-item approval under the new rule.** I have not touched them.
2. **Browser automation.** The engagement and newsletter skills have Claude in Chrome post comments and schedule articles inside LinkedIn. LinkedIn's User Agreement prohibits using bots or other automated methods to add content or comments. Your brief also rules out unauthorized browser automation. I recommend retiring the *posting* part of that workflow (see section 7).
3. **Buffer is not in your listed setup, but it is already in use** and is currently the only working authorized path to publish *and* to read personal-post analytics. Keeping it adds no new service. Replacing it would mean building and getting approval for a LinkedIn developer app.
4. **Historical claims.** Some earlier native posts contain specific results (for example "Churn: Down 40%, CAC: Down 60%"). The audit treats these as *unverified claims attributed to you* until you confirm them. They will not be reused as facts.

---

## 2. LinkedIn capability and permissions matrix

Sources: Microsoft Learn LinkedIn docs, LinkedIn developer product catalog, and the Buffer connector tested in this session. Nothing on the LinkedIn side was tested with a LinkedIn app, because no LinkedIn app or token exists.

| Capability | Official method | Permission / approval | Available to this app | Implementation | Fallback |
| --- | --- | --- | --- | --- | --- |
| Read own profile (name, photo, email) | Sign In with LinkedIn (OpenID) | `openid profile email`, self-serve | Unverified (no app) | Not needed in V1 | Manual profile snapshot pasted once |
| Read my historical posts | `r_member_social` (Posts API) | **Restricted**, select partners only | **No** | Buffer `list_posts` returns native posts on the connected channel | LinkedIn "Get a copy of your data" export (Shares.csv) for anything Buffer misses |
| Publish text / image / PDF-carousel posts | Posts API `w_member_social` (self-serve "Share on LinkedIn") **or** Buffer | `w_member_social` self-serve. Buffer: already authorized | **Yes, via Buffer** (verified). Direct API unverified | Executor creates the Buffer post only after approval | Manual: copy text and upload asset |
| Publish newsletter articles | No public API for member articles/newsletters. Buffer has no article type | n/a | **No** | App prepares title, body, cover, SEO line and a checklist | **Manual publish by you** (about 3 minutes per issue), then mark it done in the app |
| Read comments on my posts | Comments API with `r_member_social` | Restricted | **No** | Buffer gives comment *counts* only | You paste comment text, or use the "Comments" section of the data export |
| Reply to comments on my posts | Comments API `w_member_social` | Self-serve write, but needs the comment URN, which requires a read | **No in practice** | Draft in inbox. One click copies the text and opens the post | Manual post by you |
| Comment on other people's posts | Comments API `w_member_social` on a post URN | Self-serve | Unverified | V1: draft only | Manual post by you from the inbox |
| DMs / connection requests | Messaging API (closed partner program) | Closed | **No**, and out of scope | Never automated | n/a |
| Post analytics (impressions, reach, reactions, comments, shares) | `memberCreatorPostAnalytics` (`r_member_postAnalytics`), Community Management API | Gated partner product | **Yes, via Buffer** (verified). Direct API: No | Daily Buffer metrics sync | Creator analytics XLSX export |
| Followers, profile views | Member follower / profile analytics (Community Management API) | Gated | **No** directly. Buffer exposure unverified | Weekly manual number entry or XLSX upload | Creator analytics export |
| Newsletter subscribers / article views | No API | n/a | **No** | Manual weekly entry | Newsletter analytics page screenshot or values |

Rate limits: Buffer API limits are surfaced on every call (seen: 100 per 15 min, plus daily and monthly windows). The executor stays well inside them and records each call.

---

## 3. Historical content audit plan

### Inputs (smallest set)

| # | Source | How | Who | Status |
| --- | --- | --- | --- | --- |
| 1 | 51 native posts plus the 43 Buffer posts, with per-post metrics | Buffer API, read-only | System | Available now |
| 2 | LinkedIn data export (Settings > Data privacy > Get a copy of your data): `Shares.csv`, `Comments.csv` (comments **you** wrote), `Articles/` (newsletter HTML), `Profile.csv` | You request it (arrives by email within about 24 hours) and upload the ZIP in the app. **Messages and Connections files are discarded on import.** | You, once | Needed |
| 3 | Creator analytics export (Analytics > Post impressions > Export, last 365 days) | XLSX upload | You, once, then optionally weekly | Needed for followers / profile views |
| 4 | Your existing content standard, learning memory, performance and experiment logs, and 30 newsletter issues | Commit them to `content/` in this repo, or share the Drive folder | You, once | Needed (not reachable from here) |
| 5 | Confirmation sheet | A generated list of every factual claim found in your posts (results, employers, numbers) for you to mark *true / do not use* | You, about 15 minutes | Generated after step 1 |

No scraping, no cookie use, no browser automation.

### Audit method

1. **Ingest and dedupe** all sources into `li_content` with provenance (`source = buffer | export | manual`, source id, imported_at).
2. **Separate by language and type.** About 10 native posts are in Arabic or are personal (religious, congratulations, job). They are excluded from the English voice model but recorded as positioning signals.
3. **Voice analysis (LLM-assisted plus deterministic stats):** sentence length distribution, opener patterns, argument structure (claim > mechanism > implication > decision rule), vocabulary and banned phrases, use of numbers, questions and CTAs. Every observation cites the post ids it came from.
4. **Topic map** against the 8 pillars: coverage counts, gaps (fintech, mobile lifecycle and pricing are expected to be thin; to be confirmed), and repeated angles (cosine similarity on embeddings or n-gram overlap, whichever needs no new service).
5. **Performance read:** median and IQR per format, length band and time slot, using 7-day numbers only. Old native posts carry lifetime totals and are reported separately. Phrasing is always "associated with", never "caused".
6. **Claim register:** every factual claim about you goes to `li_facts` as *unverified* until you confirm it.
7. **Outputs, for approval:** Audit Report, Voice Profile v1, Brand Knowledge Base v1 (verified facts only), and a Content Strategy v1 with pillar weights, format mix and cadence.

---

## 4. Proposed architecture and data flow

### Principle: extend the existing Growxera app, add no new service

```
                 ┌──────────────── Vercel (existing project) ────────────────┐
 You ──login──▶  │  /studio  (private, owner-only, noindex)                    │
                 │   Overview · Content Studio · Inbox · Topics · Voice ·     │
                 │   Daily Report · Approvals                                 │
                 │                                                            │
                 │  Route handlers (server-only)                               │
                 │   ├─ approve / reject / edit  → approval record + hash      │
                 │   ├─ executor  → Buffer API (only Approved + hash match)    │
                 │   ├─ imports   → data export ZIP, analytics XLSX, paste     │
                 │   └─ cron (Vercel Cron, daily 06:00 Riyadh)                 │
                 │        sync Buffer posts+metrics → learn → plan → draft     │
                 │        → daily report → email via Resend                    │
                 └──────────┬───────────────┬───────────────┬─────────────────┘
                            │               │               │
                 Supabase (existing)   Grok API (xAI)   Buffer API (existing)
                 li_* tables           writing engine   publish + metrics
                            ▲
                 Claude Code routine (existing): creative briefs, carousel/image
                 renders (Playwright or Canva), writes assets + briefs via the
                 same authenticated ingest endpoint. Fallback writer if Grok is unavailable.
```

- **Private dashboard** at `/studio` in this app. It reuses `gx_session` auth and is restricted to one allowlisted owner email (`STUDIO_OWNER_EMAIL`), so there are no multi-tenant features. The alternative is a separate Vercel project; see decision D4.
- **Writing engine:** Grok through the xAI API, server-side only (`XAI_API_KEY`). It sits behind a small `WritingEngine` interface, so the fallback can be swapped in without UI changes.
- **Creative engine:** Claude in Claude Code routines (already part of your setup). It produces the creative brief JSON plus rendered PNG/PDF using the existing visual system (Space Grotesk / IBM Plex Sans, ink #11161D, blue #1D5FD1, orange #E07A1F, 1080×1350). Assets are stored in Supabase Storage, part of the existing Supabase project. This also fixes the Canva export-URL expiry problem.
- **Publishing and analytics:** Buffer API, already authorized for your LinkedIn profile.

### Data model (new tables, `li_` prefix, separate migration, RLS on with no policies)

| Table | Purpose |
| --- | --- |
| `li_content` | Every post, newsletter issue or comment that exists or existed: text, type, language, published_at, external ids, provenance |
| `li_metrics_snapshots` | Append-only metrics per content item per day (impressions, reach, reactions, comments, shares), with source and `measured_at`. Lifetime vs 7-day flag |
| `li_account_metrics` | Followers, profile views, newsletter subscribers by date, with source (manual / xlsx) |
| `li_drafts` + `li_draft_versions` | Proposed posts, newsletters, replies, comments and visuals. Every edit creates a new immutable version with a SHA-256 `content_hash` |
| `li_actions` | One proposed external action (`publish_post`, `schedule_post`, `reply`, `comment`, `newsletter_manual`, `follow_up`) pointing at an exact draft version, with status and channel (`buffer` / `manual`) |
| `li_approvals` | Append-only: action id, version id, content_hash approved, decision, reason, decided_at |
| `li_executions` | Each execution attempt: idempotency key, request summary (no tokens), external id, result, error, verified_at |
| `li_inbox_items` | Comments and replies you paste or import: author, profile URL, source post, thread context, category, priority, linked reply action |
| `li_voice_profile` | Versioned voice and editorial rules. A change requires your approval and is logged |
| `li_facts` | Brand knowledge base: claim, status (verified / unverified / rejected), source |
| `li_calendar` | Topic, pillar, audience, objective, format, target date, status, linked draft |
| `li_experiments` | Hypothesis, single variable changed, posts in each arm, readout, confounds |
| `li_learning_log` | What the system learned, from which evidence, and whether it changed any rule (rule changes need approval) |
| `li_reports` | The stored daily report JSON plus the data it was computed from |
| `li_audit_log` | Every state change and strategy change, append-only |

---

## 5. Dashboard and approval experience

**Status machine** (enforced server-side; illegal transitions are rejected):

```
Draft → Ready for Review → Approved → Executed → Verified
              │                │          │
              ├→ Rejected       ├→ Blocked  └→ Failed
              └→ Needs Revision ┘ (edit after approval → back to Ready for Review)
```

Execution rules, each with a test:
- The executor runs only when `action.status = Approved` **and** the latest approval's `content_hash` equals the current version's hash. Any edit creates a new version and voids the approval.
- **Idempotency:** each action has a unique key. Before any retry, the executor checks Buffer for an existing post with that key or text and due time. An ambiguous result (timeout) sets the action to `Failed – needs check`. It is never retried silently.
- `Executed` means Buffer accepted the post. `Verified` means Buffer later reports it as `sent` with a LinkedIn link. These are separate states.
- Manual actions (replies, outside comments, newsletter articles) show "Copy text" and "Open on LinkedIn" buttons. You mark them done and paste the URL to verify.
- **Batch approval** applies to routine items (scheduled posts in an approved series). **Individual review** applies to newsletters, replies to sensitive threads, anything with an unverified claim, and anything that mentions a person.

**Screens:** Overview · Content Studio (calendar, drafts, version diff, briefs and visuals) · Engagement Inbox · Topic Intelligence · Learning & Voice · Daily Report. Every metric tile carries a source label (`Buffer, measured 06:00`, `Manual entry 07 Oct`, `Not available`). There are no placeholder numbers: a missing source renders as "No data", not zero.

**Daily report** (stored, shown in the app and emailed via Resend) has the 8 sections from your brief. Every number is tagged *measured*, *estimate* or *unavailable*.

---

## 6. Implementation milestones

Each milestone ends with a working slice, tests, and a Vercel preview.

| M | Scope | Acceptance criteria | Depends on |
| --- | --- | --- | --- |
| **M0** | Decisions D1–D6, credentials in Vercel env | Keys present (names verified, values never logged). Buffer API key works server-side | You |
| **M1** | `li_*` migration, `/studio` owner-only shell, Buffer sync (posts and metrics) | Studio shows the real 95 posts with metrics and source labels. A non-owner session gets 404. Tests: auth gate, sync idempotent | M0 |
| **M2** | Audit: imports (data export ZIP, XLSX, paste), claim register, voice analysis, Audit Report v1 | Report generated from real data with citations to post ids. You approve Voice Profile v1 and Strategy v1 | M1, your exports |
| **M3** | Drafting plus the approval engine: calendar, Grok drafts in your voice, versions, hash-bound approvals, status machine | Edit-after-approve voids approval (test). Illegal transitions are rejected (test). No draft contains a claim outside `li_facts` verified without a label (lint test) | M2, Grok key or fallback |
| **M4** | Executor via Buffer, verification, failure surfacing, duplicate prevention. Migrate the existing 37 queued posts per D1 | An approved post appears in Buffer once. Double-click or retry creates no duplicate (test with a mocked Buffer). A failure is visible in Overview | M3 |
| **M5** | Engagement inbox (paste/import), reply drafts, categories and priority, manual completion flow | A pasted comment produces a contextual draft. Sensitive items are never batch-approvable (test) | M3 |
| **M6** | Creative briefs and visuals (Claude Code routine, rendered and stored in Supabase Storage, attached to Buffer posts) | A carousel PDF/PNG is attached from a durable URL. The brief is shown beside the draft | M4 |
| **M7** | Daily cron: sync → learn → plan → draft → report and email. Learning log, experiments, fatigue detection | The report for day N uses only data in the DB at run time. Proposed rule changes appear as approvals, never auto-applied | M4, M5 |
| **M8** | Newsletter workflow (draft, cover, manual publish checklist, manual metrics) plus hardening: retention and deletion, audit log review, docs | Runbook in `docs/linkedin-agent/`. Security review passes | M7 |

Order rationale: M1 to M4 is the first end-to-end loop (real data → draft → approval → publish → verify). Everything after builds on that loop.

---

## 7. Risks, limitations, required access

### Decisions needed from you (smallest set)

| # | Decision | My recommendation |
| --- | --- | --- |
| **D1** | The 37 posts already scheduled in Buffer under the old "act, don't ask" rule | Leave them running until M4 ships, then bring them into the app as *Ready for Review*. Alternatively, pause them now (I will not do this without your instruction) |
| **D2** | Grok API | Create an xAI Console API key with a spend limit. A SuperGrok or X subscription does **not** include API access. If you decline, the fallback is Claude drafting through the Claude Code routine you already use (no new service, but drafting is not instant in the UI) |
| **D3** | Retire Claude-in-Chrome *posting* of comments, replies and newsletter scheduling | Yes. Replace it with a copy-and-open manual step from the inbox (about 10 seconds per item). This keeps the account clear of LinkedIn's automation rules |
| **D4** | Host the studio inside this Growxera app vs a separate Vercel project | Inside this app: it reuses auth, Supabase, Resend and the deploy. The cost is coupling to the public site |
| **D5** | Buffer API key for server-side use (the connector works in Claude sessions but the app needs its own key from publish.buffer.com/settings/api) | Yes |
| **D6** | Which rules win: your existing `content-standard.md` (no company names, invented numbers labelled, no first-person stories) or the new brief, where they differ | Keep content-standard.md as the base. The audit report lists any conflicts for you to settle |

### Access required

1. xAI API key → Vercel env `XAI_API_KEY` (D2).
2. Buffer API key → `BUFFER_API_KEY` (D5).
3. Confirm `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` exist for production. The Vercel connector could not list them.
4. LinkedIn data export ZIP and creator analytics XLSX (uploaded in the app at M2).
5. Your content files from the claude.ai project (content standard, memory, logs, newsletter issues), committed to `content/` or shared from Drive.

### Limitations that remain in V1

- Comment and reply **text** cannot be read automatically. The inbox depends on you pasting or importing it, or on a data export.
- Replies, outside comments and newsletter articles are **manual-publish**. The system prepares them fully, and you post them in a few seconds.
- Follower, profile-view and newsletter metrics come in manually or by upload, about once a week.
- Buffer metrics lag up to about 24 hours. On the free plan aggregates cover only the last 31 days, so the daily sync stores snapshots to build history.
- Engagement numbers are small (last 30 days: 9 reactions, 2 comments), so most performance comparisons will be directional, not significant. The report will say so.

---

## 8. Definition of done for Version 1

All of the following are demonstrated on the deployed app with real data:

1. The Voice Profile and Knowledge Base are built from authorized sources (Buffer, your data export, your files), with citations, and approved by you.
2. Drafted posts and newsletters pass the content standard checks and contain no unverified personal claims.
3. A pasted comment produces a contextual reply draft with priority and rationale.
4. Visual posts carry a creative brief and a rendered asset stored durably.
5. One `/studio` interface handles review, edit (versioned), approve, reject and batch approve.
6. Approved posts are published via Buffer exactly once and move to Verified with a LinkedIn link. Failures are visible.
7. Unsupported actions show a manual completion step and record your confirmation.
8. Every dashboard number has a source label. Missing data shows "No data".
9. The daily report is generated from stored data, emailed, and archived.
10. The learning loop proposes plan and rule changes as approvals, with an audit trail.
11. Automated tests cover the auth gate, hash-bound approval invalidation, illegal transitions, executor idempotency and duplicate prevention, and secret redaction in logs.
12. A runbook in `docs/linkedin-agent/` covers setup, daily operation, failure handling and data deletion.
