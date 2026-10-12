# LinkedIn Growth Studio: current state snapshot

Updated **11 Oct 2026**. The plan and gates are in [docs/studio/](../../studio/MASTER_PLAN.md). The original audit of 10 Oct is [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md), a historical snapshot.

**Evidence labels:**
- **[V]** verified on 11 Oct (read-only queries and API calls, or local commands on the stated commit).
- **[R]** reported by the owner, not independently verified.
- **[U]** unknown.

## Code

| Item | State |
|---|---|
| `main` | `8542b1e` (PR #16). Production deploys from `main` [R] |
| Open PR stack (all drafts except #17; none merged) | [#17](https://github.com/islamagendi-hue/Growxera/pull/17) handover docs + 404 → [#18](https://github.com/islamagendi-hue/Growxera/pull/18) publishing locks → [#19](https://github.com/islamagendi-hue/Growxera/pull/19) agent.growxera.com sign-in → [#20](https://github.com/islamagendi-hue/Growxera/pull/20) backup export, CI and docs |
| Preserved WIP | Branch `claude/studio-wip-agent-host` @ `3ca1de7` (identical to the stash; the stash is kept) [V] |
| Checks on `claude/studio-m1-ops` | `tsc`, `eslint`, 189/189 tests, `next build`: pass [V]. Local only |

## Production (read-only, 11 Oct) [V]

| Item | State |
|---|---|
| Studio URL | Still www.growxera.com/studio (site login). agent.growxera.com isn't configured: DNS is at Unstoppable Domains; Vercel reports the domain "misconfigured" |
| Content | 58 history posts, 57 metrics |
| Migrated queue | **19 approved** (owner, 10 Oct 20:43–21:08 UTC, before direct publishing existed), 17 ready for review, 1 draft, 1 rejected. 20 approval records |
| Planned times of the 19 | 3 per day on 11–14 Oct, then 15, 26–31 Oct |
| Executions / LinkedIn connections / keys in studio | 0 / 0 / 0 |
| Media | 49/49 verified in the private bucket |
| Scheduler | Active every 5 min; it publishes nothing ("LinkedIn isn't set up") |
| Security | All `li_*` tables RLS on, 0 browser grants |
| Grok | Not configured; budget $0 by owner decision |
| Buffer | 0 scheduled; 37 drafts; LinkedIn channel connected; an X channel present (locked); last sent 10 Oct 18:30 UTC |

## Why the PRs matter before anything is connected

**Without PR #18**, connecting LinkedIn would have made the scheduler publish the 19 approved posts at their planned times. PR #18 makes that impossible:
- a global switch, OFF by default;
- per-post authorization;
- no late posting.

## Blockers (see [docs/studio/APPROVAL_GATES.md](../../studio/APPROVAL_GATES.md))

- **Batch A (go live on agent.growxera.com):** merge and deploy, two migrations, domain and DNS, setup link, LinkedIn redirect URL.
- **Batch B (first real post):** connect, a live test, then activation.
