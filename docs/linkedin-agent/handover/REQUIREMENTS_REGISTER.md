# Requirements register

**Sources:**

- **Brief:** the owner's initial project brief, 10 Oct 2026 (session; not in the repository).
- **D1–D6:** PLAN.md §1.
- **M1 rules:** the owner's "Milestone 1" execution message (session).
- **Later:** owner messages later on 10 Oct 2026 (session).
- **PLAN:** [PLAN.md](../PLAN.md).

**Status values:** Met (verified), Met (local tests only), Partial, Not started, Open (conflicting or undecided).

Evidence labels as in [CURRENT_STATE.md](CURRENT_STATE.md).

## Product scope

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| R1 | Private tool for the owner's **personal** LinkedIn account; nothing published on growxera.com or company pages | Brief; Later ("for me, not for Growx Era") | Met | — |
| R2 | LinkedIn only; no Facebook, no X | PLAN | Met | — |
| R3 | Studio invisible to everyone else; not linked; noindex; no analytics | PLAN; Later ("nothing LinkedIn-related visible to anyone") | Partial | Signed-out redirect reveals `/studio` until PR #17 is merged. The header is shown on studio pages |
| R4 | Separate address **agent.growxera.com** (decided 11 Oct; replaces `linkedin-agent`) with email + password + authenticator code | Later; master directive | Partial: built and tested in PR #19, not deployed | DNS (Unstoppable Domains) and Vercel domain gated (APPROVAL_GATES A3) |
| R4b | Automatic publishing only with a global switch + per-post authorization; never late | G1, G2 (11 Oct) | Met (local tests), PR #18 | Not deployed |
| R4c | Weekly owner-downloaded backup on Supabase Free | G3 (11 Oct) | Met (local tests), PR #20 | Not deployed |
| R5 | Dashboard / control room as in the owner's screenshots (tabs, KPI cards, sessions grid, Today panel, Control tab; "Run now" becomes "Prepare now", no automation) | Later (screenshots) | Not started | The screenshots are not in the repository; their content is known only from the session |
| R6 | Voice profile from history; content standard as the voice baseline | Brief; D6 | Not started (M2) | The content standard file is not in the repository (private) |
| R7 | Editorial calendar and drafting in the owner's voice | Brief; PLAN M3 | Not started | — |
| R8 | Engagement inbox (pasted comments, reply drafts) | PLAN M5 | Not started | — |
| R9 | Visuals and creative briefs by Claude, stored durably | Brief; PLAN M6 | Not started in the app | — |
| R10 | Daily report, learning loop, experiments | Brief; PLAN M7 | Not started | Channel undecided |
| R11 | Newsletter "Behind the Number" (manual publish) | PLAN M8 | Not started | No LinkedIn API for articles |

## Approval and safety

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| S1 | Nothing external (post, comment, reply, newsletter, reaction, connection, message) without explicit approval of that exact action | Brief; M1 rules | Met (local tests) | Approval binds text, files and planned time |
| S2 | Any edit to text, images or time voids the approval | Brief | Met (local tests) | — |
| S3 | Executed and verified are separate; never claim success without evidence | M1 rules | Met (local tests) | — |
| S4 | Duplicate prevention, including against published history | Brief | Met (local tests) | — |
| S5 | No fabricated data, analytics or claims; every number shows its source | Brief; PLAN DoD 8 | Partial | Source labels shown on the Overview |
| S6 | No private files, secrets or personal data in the public repository | M1 rules | Met, with low findings | See KNOWN_ISSUES L1 |
| S7 | No secrets in logs, commits, PR comments or docs | M1 rules | Met (as far as checked) | Vercel runtime logs not inspected |
| S8 | No deleting data or disconnecting integrations without verification and approval | M1 rules | Met | Buffer still connected by design until approved |
| S9 | No new paid services without approval | M1 rules | Met | The Free plan has no backups. An upgrade would need approval |
| S10 | Stop for approval before merge, deploy, production data change, deletion or publishing | M1 rules | Met | The owner approved #14, #15 and #16, the migrations and the scheduler in the session |
| S11 | Never run migrations against `leanapp-staging` | M1 rules | Met | — |
| S12 | Don't weaken auth to make tests pass | M1 rules | Met | — |

## Models

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| M-1 | Grok is the primary writing and conversation model; disabled until key and spending limit; no silent substitution | D2 | Met (client, local tests) | No key. Nothing in the app uses it yet |
| M-2 | Claude handles creative work and design | Brief | Not in the app | Happens in Claude Code sessions only |

## Publishing

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| P1 | Build around LinkedIn's officially supported capabilities; don't claim direct publishing until verified | Later (Buffer retirement message) | Met | The capability register stays "Not verified" until a live post |
| P2 | The system itself publishes (not the owner by hand) | Later ("I want the system to publish") | Partial | Built; LinkedIn not connected; unverified |
| P3 | Manual copy-and-open fallback | D3; PLAN | Met (local tests) | — |
| P4 | Scheduled time management | Brief | Met (local tests), PR #18 | G2: no late publishing and no late allowance; the 3-hour limit on `main` is replaced in PR #18 |

## Buffer

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| B1 | Buffer retired; no Buffer integration | D5 (revised) | Met | — |
| B2 | Pause the queue without deleting; preserve content and dates | D1; Later | Met | 36 moved to Draft (owner-approved) |
| B3 | Migration checklist and verified import | Later | Met | Import done in production |
| B4 | Disconnect Buffer only after verification and approval | M1 rules | Open | Not yet done |

## Operations

| ID | Requirement | Source | Status | Notes / open questions |
|---|---|---|---|---|
| O1 | Daily report, real-data analytics, execution verification, duplicate prevention | Brief | Partial | Verification and duplicate prevention are met. Report and analytics not started |
| O2 | Media stored durably, verified | PLAN | Met | 49/49 |
