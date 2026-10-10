# Owner approval gates

Nothing on this list happens without the owner's explicit approval of that specific step. Code, tests, docs, branches and draft PRs don't need approval.

## Decided (10–11 Oct 2026)

| Gate | Decision |
|---|---|
| G1 | Historical approvals never auto-publish; each post is reconfirmed individually; history is preserved |
| G2 | Never publish after the planned time; hold for review; new time + new approval |
| G3 | Stay on Supabase Free; weekly export downloaded by the owner |
| Grok | $0/month: no paid calls |

## Pending: batch A, "go live on agent.growxera.com"

These depend on each other; approving them as one batch is recommended.

| # | Exact action | Why | Changes | Risk / reversibility | Cost |
|---|---|---|---|---|---|
| A1 | Merge PR #17 → #18 → #19 → #20 into `main` (production deploys automatically) | Ship the safeguards, sign-in and backup | Studio leaves www.growxera.com (404 there); publishing locks are active | Revert the merge commits; previous Vercel deployment can be promoted | 0 |
| A2 | Apply migrations `20261014000000_studio_access.sql` and `20261015000000_publishing_controls.sql` to project growxera | Tables for sign-in and publishing controls | 6 new tables; nothing existing changes | Additive; rollback SQL in OPERATIONS_RUNBOOK.md | 0 |
| A3 | Add `agent.growxera.com` to Vercel project `growx-era`; add DNS `CNAME agent → cname.vercel-dns.com` at Unstoppable Domains (growxera.com's DNS host) | The studio's own address | New subdomain only | Delete the record and the domain | 0 |
| A4 | Run `scripts/studio-setup-link.mjs --confirm` against production; owner opens the link, sets the password, scans the QR | First sign-in | 1 setup-token row | The link expires in 24 h, single use | 0 |
| A5 | LinkedIn app → Auth: add the redirect URL `https://agent.growxera.com/studio/linkedin/callback` | OAuth on the new host | LinkedIn app setting | Remove the URL | 0 |

Until A1–A4 are done after A1, the studio is reachable nowhere. Doing A2 and A3 first, then A1, then A4, shortens that gap.

## Pending: batch B, "first real post" (after batch A)

| # | Exact action | Notes |
|---|---|---|
| B1 | Owner enters the LinkedIn keys on Capabilities and clicks Connect, then Allow | Connects the account. Nothing is published |
| B2 | One live test: the owner picks a post and clicks **Publish now** | The proposed post, expected result and recovery plan are presented before; the owner checks LinkedIn and confirms |
| B3 | Activate automatic publishing: set `STUDIO_AUTO_PUBLISH_ALLOWED=true` in Vercel (Production) and switch ON in the studio | Only after B2 succeeded. Then each post is scheduled individually |

## Pending: other

| # | Action | Notes |
|---|---|---|
| C1 | Owner reviews the 36 migrated posts (19 approved need reconfirmation for automatic publishing; 17 await review) | In the studio. No bulk actions |
| C2 | Disconnect Buffer | Only after B3 has run reliably for a while |
| C3 | Grok budget > $0 and model choice | Separate approval; confirm model and prices on xAI's pages |
| C4 | Email delivery of the daily report | Provider, permissions and cost to be approved |
| C5 | Remove the unused Vercel variable `LINKEDIN` | Owner housekeeping |
