# LinkedIn Growth Studio: current state snapshot

Audit date: **10 Oct 2026, ~21:50 UTC**. Full report: [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md).

Evidence labels used in all handover files:

- **[V-audit]** verified during this audit (commands run on the stated commit).
- **[V-session]** verified earlier on 10 Oct 2026 from a tool result (database query, GitHub API, HTTP response), with its time. **Not re-checked during the audit**: the owner declined a read-only database query, so the database was not queried again.
- **[R]** reported by the owner or the owner's browser extension. Not independently verified.
- **[I]** inferred from other evidence.
- **[U]** unknown.

## Code and PRs

| Item | State |
|---|---|
| Repository | `islamagendi-hue/Growxera` (**public**) |
| Working branch | `claude/linkedin-brand-growth-agent-wu375g` |
| Branch head before these docs | `e430e71` (one commit ahead of `main`) [V-audit] |
| `main` | `8542b1e` = PR #16 squash merge [V-audit] |
| Open PR | [islamagendi-hue/Growxera#17](https://github.com/islamagendi-hue/Growxera/pull/17) "Studio: 404 for signed-out visitors too". Open, **not merged**. Vercel preview status: success on `e430e71` [V-session 21:39] |
| Merged studio PRs | #14 (`e230db8`, Milestone 1), #15 (`7c35777`, LinkedIn publishing), #16 (`8542b1e`, keys entered in studio) [V-audit] |
| Unpushed work | Separate address `linkedin-agent.growxera.com` with password + authenticator sign-in. **Only in a local git stash (`stash@{0}`) and a patch file in this session's scratchpad. Both are lost when this cloud container is reclaimed.** Not tested, not committed [V-audit] |
| Checks on `e430e71` | `tsc` pass, `eslint` pass, `vitest` 156/156 pass, `next build` pass [V-audit] |

## Production

| Item | State |
|---|---|
| Studio URL today | `https://www.growxera.com/studio`. Owner-only (site magic-link account whose email equals `STUDIO_OWNER_EMAIL`) [V-audit code on `main`] |
| Signed-out visitor to `/studio` | Redirected to `/login?next=/studio` (reveals the path exists). PR #17 would change this to a 404 [V-session 21:37] |
| LinkedIn routes and scheduler endpoint (no auth) | 404 [V-session 21:37] |
| Database | Supabase project "growxera". Previews and Production share it. Free plan, no automatic backups [R + V-session] |
| Studio data | 58 history posts, 57 metric snapshots, 38 migrated items (36 Ready for review, 1 Draft, 1 Blocked), 0 approvals, 0 executions [V-session ~20:45] |
| Media | 49/49 files copied into the private bucket and verified by SHA-256 [V-session 20:41] |
| Scheduler | pg_cron job every 5 min. Calls return `200 {"ran":false,"reason":"LinkedIn isn't set up…"}` [V-session 21:25–21:35] |
| LinkedIn connection | **Not connected.** The app keys are not in Vercel [R]. Entry of keys in the studio not confirmed [U] |
| Grok | Disabled (no `XAI_*` vars) [R]. No drafting UI calls it [V-audit] |
| Buffer | 0 scheduled and 36 moved to Draft at 19:00 UTC [V-session]. Still connected to LinkedIn [R/U]. Not used by the studio [V-audit] |
| LinkedIn posts published by the studio | **None** [V-session: 0 executions] |

## Blockers (details in [KNOWN_ISSUES.md](KNOWN_ISSUES.md))

1. **Unpushed WIP (subdomain + password/TOTP):** at risk of loss. It needs a decision: keep (commit to a branch) or drop.
2. **LinkedIn not connected:** direct publishing is entirely unverified against the real API.
3. **Hosting and sign-in model undecided:** the requested subdomain and the current `/studio` setup conflict, and the LinkedIn redirect URL depends on the choice.
4. **Planned times of the 36 migrated posts start 11 Oct 2026:** approval refuses past times, so most will need new times.
5. **No database backups on the Free plan.** The private export files exist only in this container and with the owner (owner's copies unconfirmed [U]).

## Next safe steps (nothing below changes production)

1. Owner decides on the WIP (see [DECISIONS_LOG.md](DECISIONS_LOG.md), open decisions).
2. Owner gives final requirements; the new plan uses [PROJECT_HANDOVER.md](PROJECT_HANDOVER.md), section 13.
3. Owner keeps a private copy of the export files outside this container and outside the repository.
