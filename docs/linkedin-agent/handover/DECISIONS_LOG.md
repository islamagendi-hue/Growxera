# Decisions log

All dated 10 Oct 2026 unless noted. "Final" means the owner stated it and nothing later contradicts it. "Provisional" means it is in force but conflicts with a later wish or was made by Claude without explicit owner sign-off.

## Made

| # | Decision | Reason | Who | Status |
|---|---|---|---|---|
| D1 | Scheduled posts never explicitly approved go through the approval queue individually; preserve content, dates, status; delete nothing | Approval-first | Owner | Final |
| D2 | Grok is the primary writing/conversation model; disabled until a key and spending limit exist; no silent substitution | Owner preference, cost control | Owner | Final (not yet exercised) |
| D3 | Retire automated posting/commenting through Claude in Chrome | Approval-first; unauthorized automation | Owner | Final |
| D4 | Studio at `/studio` inside the Growxera app (same auth, database, deployment) | Reuse, no new services | Owner | **Superseded in intent** by D16, which isn't implemented yet |
| D5 | Buffer retired; no Buffer integration; used once read-only for export | Owner direction | Owner | Final |
| D6 | The existing content standard and history are the voice baseline; the new requirements win on approval, security and execution | — | Owner | Final |
| D7 | Move the 36 remaining scheduled Buffer posts to Draft (the Buffer API can't pause a queue) | Stop publishing without deleting | Owner approved ("Yes, move all 36 to Draft") | Done |
| D8 | Open a PR only; owner approves merges | Control | Owner | Final |
| D9 | Merge PR #14 | Activation | Owner ("I approve the merge") | Done |
| D10 | Import the migrated data into production | Activation | Owner ("continue the import") | Done |
| D11 | Copy media into the private bucket | Durability | Owner (clicked the button) | Done |
| D12 | The system publishes to LinkedIn itself via the official API | Owner wants automation of approved posts | Owner ("I want the system to publish") | Final; unverified |
| D13 | Approval includes the planned time; the scheduler publishes within 3 h of it, otherwise blocks; approval refuses past times | Reconcile approval-first with automation | Claude (design) | Provisional: no explicit owner sign-off on the 3 h limit |
| D14 | Scheduler on Supabase pg_cron + pg_net (free) with a Vault secret, not Vercel Cron | Free; Vercel Hobby cron frequency limits [I]; no secret copying | Claude, owner approved execution ("go in and do it") | Done |
| D15 | LinkedIn keys can be entered in the studio (encrypted) instead of Vercel | The owner couldn't add Vercel variables | Claude, owner approved | Done (PR #16) |
| D16 | Separate address `linkedin-agent.growxera.com` with its own email + password + authenticator sign-in | Separation and privacy | Owner (chose the name despite the publicity note; chose password + TOTP) | Provisional: WIP unpushed |
| D17 | Signed-out visitors get 404 on studio pages | "Nothing LinkedIn-related visible" | Claude, following the owner's condition | Provisional: PR #17 open |

## Made on 11 Oct 2026 (owner, master directive and approved plan)

| # | Decision | Status |
|---|---|---|
| D18 | Canonical address **agent.growxera.com** (supersedes `linkedin-agent` in D16) with email + password + authenticator sign-in | Final; implemented in PR #19, not deployed |
| D19 (G1) | Historical approvals never auto-publish; each post is confirmed individually for automatic publishing; history preserved | Final; PR #18 |
| D20 (G2) | Never publish after the planned time; hold for review; new time + new approval; no catch-up. **Supersedes D13 (3-hour rule).** No late allowance: a run that starts after the planned time, even by 1 ms, holds the post (`LATE_TOLERANCE_MS = 0`) | Final; PR #18. The earlier 10-min window was removed on the owner's correction (11 Oct). Any tolerance needs explicit owner approval (APPROVAL_GATES P1) |
| D21 (G3) | Stay on Supabase Free; weekly export downloaded by the owner | Final; PR #20 |
| D22 | Grok budget $0/month: no paid calls; mocks only | Final |
| D23 | Buffer stays connected until the replacement is proven and disconnecting is approved | Final |
| D24 | The global switch needs both the deployment flag `STUDIO_AUTO_PUBLISH_ALLOWED=true` and the owner's in-studio switch | Claude design within G1; final unless the owner objects |
| D25 | The global switch governs **automatic** publishing only. Manual **Publish now** is a separate owner-attended action (signed-in owner, valid approval of the exact version, confirm box) and is not blocked by the switch | Claude design; open for owner confirmation (APPROVAL_GATES P2) |

## Open

The current list is in [docs/studio/APPROVAL_GATES.md](../../studio/APPROVAL_GATES.md). The list below, from 10 Oct, is historical. Hosting, publishing mode, the drafting model and backups have since been decided above.

- keep or drop the WIP;
- hosting and sign-in model;
- publishing mode and the 60-day reconnect;
- drafting model;
- fate of the 36 migrated posts;
- Buffer disconnect timing;
- scope of later milestones;
- backups and plan upgrade.
