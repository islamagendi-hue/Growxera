# Implementation status

As of 11 Oct 2026. Nothing below is merged or deployed. Production still runs `main` (`8542b1e`).

## Branches

| Branch | Head | PR | Contents |
|---|---|---|---|
| `claude/linkedin-brand-growth-agent-wu375g` | `4715694` | #17 | Handover; signed-out 404 |
| `claude/studio-m1-publishing-safeguards` | `f596a93` | #18 | Publishing switches, per-post confirmation, submission window |
| `claude/studio-m1-agent-host-auth` | `ee4ac16` | #19 | agent.growxera.com sign-in, fragment setup links |
| `claude/studio-m1-ops` | `79939be` | #20 | Weekly export, CI, studio docs |
| `claude/studio-m2-product` | see `git log` | none yet | Product build on top of #20 (this round) |

## Done this round (`claude/studio-m2-product`)

| Commit | Change |
|---|---|
| `0c6b64f` | Dashboard; New post and draft submission; per-post publishing status; fix of the "approval publishes" text; `lib/studio/insights.ts`; CI on studio branch pushes |
| `c3f3715` | Calendar, Activity, Settings, searchable and filterable Posts list; labels |
| `cf3c236` | Playwright E2E suite + CI job; status panel shows the last approved version; dashboard and nav polish |
| `2070a06` | Verified file uploads (image or PDF, 4 MB) on new posts and edits |

## Test results

**Local, on the latest commit:**

| Check | Result |
|---|---|
| Unit tests | `npx vitest run`: **216 passed**, 0 skipped |
| End-to-end | `npx playwright test`: **17 passed**, 1 skipped (screenshots run only on request) |
| Types | `npx tsc --noEmit`: pass |
| Lint | `npx eslint src scripts`: pass |
| Build | `npx next build`: pass |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities. The full audit lists 5 high advisories in lint tooling only (see PRODUCT_AUDIT §5) |

**CI (GitHub Actions, push to `claude/studio-m2-product`):**
- `cf3c236`: run 38121288501, **success** (unit + build job and E2E job).
- Later commits: see the Actions tab. The final report states the result for the exact head.

**Previews:** Vercel builds every branch. Studio pages answer 404 on preview hosts by design, so the previews prove the build and the public site. Studio screens are verified by the E2E suite.

**Not verified live:**
- LinkedIn posting (API or OAuth), and the timed scheduler against LinkedIn: tested only against a fake LinkedIn API;
- Supabase storage uploads: tested on the local store; the same code path as the media copy already used in production;
- restore into Supabase.

## Outstanding

| Item | Type | Owner action |
|---|---|---|
| Batch A (go live on agent.growxera.com) | Gate | Approve when ready ([DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)) |
| Include `claude/studio-m2-product` in batch A, or merge it after | Gate | Decide; a PR can be opened for review on request |
| B1–B3 (LinkedIn connection, live tests, scheduler) | Gates | Later |
| Restore script, large files, analytics upload, engagement inbox, newsletter, daily report | Build | Analytics needs a sample LinkedIn export from the owner |

## Blockers

- **Analytics upload:** a real LinkedIn analytics export file is needed (format unknown).
- **Everything live:** the approval gates above.
