# Implementation status

As of 11 Oct 2026. Nothing below is merged or deployed. Production still runs `main` (`8542b1e`).

## Branches

| Branch | Head | PR | Contents |
|---|---|---|---|
| `claude/linkedin-brand-growth-agent-wu375g` | `4715694` | #17 | Handover; signed-out 404 |
| `claude/studio-m1-publishing-safeguards` | `f596a93` | #18 | Publishing switches, per-post confirmation, submission window |
| `claude/studio-m1-agent-host-auth` | `ee4ac16` | #19 | agent.growxera.com sign-in, fragment setup links |
| `claude/studio-m1-ops` | `f6ac88c` | #20 | Weekly export, CI, studio docs |
| `claude/studio-m2-product` | see the final report | #21 (draft, base #20) | Product build on top of #20 (this round) |

## Done this round (`claude/studio-m2-product`)

| Commit | Change |
|---|---|
| `0c6b64f` | Dashboard; New post and draft submission; per-post publishing status; fix of the "approval publishes" text; `lib/studio/insights.ts`; CI on studio branch pushes |
| `c3f3715` | Calendar, Activity, Settings, searchable and filterable Posts list; labels |
| `cf3c236` | Playwright E2E suite + CI job; status panel shows the last approved version; dashboard and nav polish |
| `2070a06` | Verified file uploads (image or PDF, 4 MB) on new posts and edits |
| `da19fbf`, `9bbc9c5` | Product audit, plan, status, runbook, architecture docs |
| `5a48946` | Audit fixes: honest capability register, accurate publishing texts, error/loading states, damaged-local-store fix, broader E2E |
| `816cdae` | Docs |
| `c9dd5f2` | Readiness round: session counts only on the studio's address; publishing notices name both switches; `noindex` on the studio's address; runbook readiness review; launch verification list |
| security round (see the final report for the hash) | Studio data refused on non-production deployments (preview isolation); cross-site GET checks on backup download and LinkedIn connect; anti-framing and referrer headers on the studio host; SECURITY_REVIEW.md |

## Test results

**Local, on the latest commit:**

| Check | Result |
|---|---|
| Unit tests | `npx vitest run`: **226 passed**, 0 skipped |
| End-to-end | `npx playwright test`: **23 passed**, 1 skipped (screenshots run only on request) |
| Types | `npx tsc --noEmit`: pass |
| Lint | `npx eslint src scripts`: pass |
| Build | `npx next build`: pass; preview-mode `next start` against a request-logging fake database: 0 studio requests reached it (production mode: it did, as expected); `next start` host smoke test: studio paths 404 on www and preview hosts, studio host redirects signed-out visitors to sign-in and sends `noindex`, scheduler 404 without its secret |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities. The full audit lists 5 high advisories in lint tooling only (see PRODUCT_AUDIT §5) |

**CI (GitHub Actions, push to `claude/studio-m2-product`):**
- `cf3c236`: run 38121288501, **success** (unit + build job and E2E job).
- Later commits: see the Actions tab. The final report states the result for the exact head.

**Previews:**
- PR #21's preview builds (Vercel status on the PR).
- Studio pages answer 404 on preview hosts by design, and previews share the production database.
- Preview URLs can't be fetched from this environment (network policy; the connector's fetch returns 403).
- Studio screens are verified by the E2E suite plus a production-build host smoke test (see PRODUCT_AUDIT §1).

**Not verified live:**
- LinkedIn posting (API or OAuth), and the timed scheduler against LinkedIn: tested only against a fake LinkedIn API;
- Supabase storage uploads: tested on the local store; the same code path as the media copy already used in production;
- restore into Supabase.

Before launch, the owner's manual checks are listed in [LAUNCH_VERIFICATION.md](LAUNCH_VERIFICATION.md).

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
