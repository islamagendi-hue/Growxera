# Implementation log (resume here)

## 11 Oct 2026: Milestone 1, local work

| Step | Branch / PR | Commit | Result |
|---|---|---|---|
| Preserve WIP verbatim | `claude/studio-wip-agent-host` (no PR) | `3ca1de7` | Identical to `stash@{0}` (stash kept) |
| Publishing locks (G1, G2) | `claude/studio-m1-publishing-safeguards`, PR #18 (draft, base #17) | `e58f358` | 166 tests pass |
| Agent-host sign-in | `claude/studio-m1-agent-host-auth`, PR #19 (draft, base #18) | `fe0b77b` (WIP) + `8e83478` | 185 tests pass |
| Export and CI | `claude/studio-m1-ops`, PR #20 (draft, base #19) | `3b0d17b` | 189 tests pass |
| Docs | `claude/studio-m1-ops`, PR #20 | see `git log` | — |

**PR stack:** #17 (handover docs + 404) ← #18 ← #19 ← #20. Merge in that order, with owner approval.

## Read-only facts verified on 11 Oct (no changes made)

- **Production database:**
  - 58 history posts, 57 metric snapshots;
  - actions: 19 approved, 17 ready for review, 1 draft, 1 rejected;
  - 20 approval records, 0 executions;
  - 49/49 media copied;
  - 0 LinkedIn connections, 0 keys entered;
  - Vault secret present; cron active every 5 min;
  - RLS on for every `li_*` table, 0 browser grants;
  - backup schema: 8 tables.
- **The 19 approvals:** given 20:43–21:08 UTC on 10 Oct, before direct publishing was deployed (21:24).
- **Buffer:** 0 scheduled, sending or error posts; 37 drafts; LinkedIn channel connected; an X channel exists (locked); last sent 10 Oct 18:30 UTC.
- **Vercel:** `agent.growxera.com` is not configured. growxera.com's DNS is at Unstoppable Domains. Deployment listing is forbidden (403).

## Owner correction, 11 Oct: G2 has no late allowance

- **Change (PR #18, merged up into #19 and #20):** the 10-minute on-time window is removed. `LATE_TOLERANCE_MS = 0`: a scheduler run that starts after the planned time, even by 1 ms, holds the post for review. Changing this needs the owner's approval (APPROVAL_GATES P1).
- **Tests:** 1 ms early waits; exactly on time publishes; 1 ms late and the next 5-minute tick are held; the direct automatic call refuses 1 ms late.
- **Consequence:** with a 5-minute scheduler, nearly every scheduled post will be held (RISK_REGISTER R9). Safe, but automatic publishing is effectively unused until P1 is decided.
- **Review findings documented:** manual Publish now is outside the switch (R15, P2); the go-live order A2 → A3 → A1 → A4 → A5 and the rollback order (code first, tables optional) (R16, runbook); restore tested only on the local store (runbook).

## Owner decisions P1 and P2, 11 Oct

- **P2 implemented (PR #18):** the all-publishing switch (`switch.ts`), OFF by default. It blocks Publish now and automatic publishing. It is checked first in `publishAction`, then inside the LinkedIn client before any upload and right before the post request. Owner-only, confirm box to switch ON, audited. 7 new tests.
- **P1 proposed, not implemented:** [SCHEDULING_ARCHITECTURE.md](SCHEDULING_ARCHITECTURE.md). Facts checked read-only: pg_cron 1.6.4 (supports second schedules), pg_net 0.20.4, runs start 60–100 ms after the tick.
- **Recovery test (PR #19):** a setup link during a global lockout.
- **Docs:** go-live sequence with a check and a way back at each step; rollback precondition after LinkedIn is connected (R17); restore explicitly not supported yet; export download and retention.

## Next steps

1. Owner decisions on batch A ([APPROVAL_GATES.md](APPROVAL_GATES.md)).
2. Meanwhile (no approval needed), M3 groundwork:
   - content model;
   - $0 Grok adapter with mocks;
   - review queue for the 36 posts;
   - calendar.
