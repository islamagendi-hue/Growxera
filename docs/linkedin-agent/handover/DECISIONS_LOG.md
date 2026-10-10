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

## Open

These are listed in [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md) §12:

- keep or drop the WIP;
- hosting and sign-in model;
- publishing mode and the 60-day reconnect;
- drafting model;
- fate of the 36 migrated posts;
- Buffer disconnect timing;
- scope of later milestones;
- backups and plan upgrade.
