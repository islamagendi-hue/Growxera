# Owner approval gates

Nothing on this list happens without the owner's explicit approval of that specific step. Code, tests, docs, branches and draft PRs don't need approval.

## Decided (10–11 Oct 2026)

| Gate | Decision |
|---|---|
| G1 | Historical approvals never auto-publish; each post is reconfirmed individually; history is preserved |
| G2 | Never publish after the planned time; a scheduler delay holds the post for review; new time + new approval. No late allowance (corrected 11 Oct: the 10-minute window is removed) |
| G3 | Stay on Supabase Free; weekly export downloaded by the owner |
| Grok | $0/month: no paid calls |

## Decided 11 Oct (second round)

| # | Decision | State |
|---|---|---|
| P1 | Submission window T − 60 s to T − 10 s; never automatically after the deadline; a missed window holds the post (new time + new approval); an unknown outcome is never retried; we control when the request is sent, not LinkedIn's displayed timestamp; automatic publishing stays disabled until the implementation is complete **and** a manually approved live test validates it | Approved by the owner. Code implemented in PR #18 ([SCHEDULING_ARCHITECTURE.md](SCHEDULING_ARCHITECTURE.md)); the scheduler change is part of B3 |
| P2 | An all-publishing switch, OFF by default, blocks both automatic publishing and Publish now | Implemented in PR #18 (`src/lib/studio/switch.ts`), tested |

## Pending: batch A, "go live on agent.growxera.com"

Approve as one batch. Execute in the order below; each step has a check and a way back. **Final runbook: [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)**, which marks every externally visible (🌐) and irreversible (⛔) step.

| Order | # | Exact action | Changes | Way back | Cost |
|---|---|---|---|---|---|
| 1 | A2 | Apply migrations `20261014000000_studio_access.sql` and `20261015000000_publishing_controls.sql` to project growxera | 6 new tables; nothing existing changes. Production code ignores them | Leave them (harmless), or drop only these 6 tables | 0 |
| 2 | A3 🌐⛔ | Add `agent.growxera.com` to Vercel project `growx-era`; add the DNS record Vercel shows (CNAME `agent`) at Unstoppable Domains; wait until Vercel shows the domain valid with a certificate | New public subdomain. The hostname is recorded permanently in Certificate Transparency logs when the certificate is issued | Remove the record and the domain (the log entry stays) | 0 |
| 3 | A1 🌐⛔ | Collapse the stack (#20 → #19 → #18 → #17 branches; previews only), then **one** merge of #17 into `main`: the only production deployment | Studio leaves www (404 there); sign-in moves to agent.growxera.com; publishing switches OFF. Merge commits stay in the public history | Promote the previous production deployment in Vercel (instant), or revert the merges | 0 |
| 4 | A4 | Create the one-time setup link (2 h, single use, token in the URL fragment, delivered as a private file) right after A1 is live; the owner sets the password and pairs the authenticator | 1 setup-token row | A new link if it expires or is lost | 0 |
| 5 | A5 | LinkedIn app → Auth: **add** `https://agent.growxera.com/studio/linkedin/callback`. Keep the www callback (needed for rollback) | LinkedIn app setting | Remove the added URL | 0 |

Batch A doesn't connect LinkedIn, publish, change Buffer, switch anything ON, or cost anything.

## Pending: batch B, "first real post" (after batch A)

**After B1 (LinkedIn connected), a code rollback needs one step first:** the code on today's `main` publishes approved posts automatically within 3 hours of their time. So before any rollback, unschedule the cron job and disconnect LinkedIn (runbook).

| # | Exact action | Notes |
|---|---|---|
| B1 | Owner enters the LinkedIn keys on Capabilities and clicks Connect, then Allow | Connects the account. Nothing is published |
| B2 | One live test: the owner switches **all publishing ON**, picks a post and clicks **Publish now**, then switches all publishing OFF again | The proposed post, expected result and recovery plan are presented before; the owner checks LinkedIn and confirms. Measures the real latency for P1 |
| B3a | Replace the cron job with the 15-second job (SQL in DEPLOYMENT_RUNBOOK.md, rehearsed first) | Only after B2 succeeded |
| B3b | One **manually approved live test of the timed submission**: the owner authorizes one post; `STUDIO_AUTO_PUBLISH_ALLOWED=true` and both switches ON for the test; the owner checks it went out inside its window | Validates P1 live. Switch OFF again afterwards |
| B3c | Keep automatic publishing on for posts authorized one by one | Only after B3b is confirmed |

## Pending: other

| # | Action | Notes |
|---|---|---|
| C1 | Owner reviews the 36 migrated posts (19 approved need reconfirmation for automatic publishing; 17 await review) | In the studio. No bulk actions |
| C2 | Disconnect Buffer | Only after B3 has run reliably for a while |
| C3 | Grok budget > $0 and model choice | Separate approval; confirm model and prices on xAI's pages |
| C4 | Email delivery of the daily report | Provider, permissions and cost to be approved |
| C5 | Remove the unused Vercel variable `LINKEDIN` | Owner housekeeping |
