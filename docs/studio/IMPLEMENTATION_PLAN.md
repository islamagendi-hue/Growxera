# Implementation plan

Prioritized roadmap from the verified audit ([PRODUCT_AUDIT.md](PRODUCT_AUDIT.md)). The fixed rules are in [MASTER_PLAN.md](MASTER_PLAN.md) and the gates in [APPROVAL_GATES.md](APPROVAL_GATES.md). Status per item is in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

**Legend:**
- **Build:** code work, no approval needed (branches, tests, previews).
- **Gate:** a protected action that needs the owner's explicit approval.

## P0: a usable studio (code complete on `claude/studio-m2-product`)

| # | Item | Acceptance criteria | Depends on |
|---|---|---|---|
| P0.1 | Dashboard | Shows the state of both switches and LinkedIn, the pipeline counts, everything that needs the owner (with the next step), the next 14 days, recent activity, backup age and history. Loading, empty and error states are handled by the server render; a signed-out visitor is redirected | — |
| P0.2 | Write a post | Text up to 3,000 characters, optional planned time (future only), optional note, optional image or PDF. Saved as a draft or into review. Never publishes. Errors keep the text | — |
| P0.3 | Review and approval transparency | Each post shows the approved version, whether the approval covers the current version, whether it is confirmed for automatic publishing, and every reason it can't be published, for each path | — |
| P0.4 | Posts list | Search; status filters; needs-action, held, missed, not-confirmed and confirmed filters; per-post markers | — |
| P0.5 | Calendar | Month grid and phone agenda in Riyadh time; conflicts; missed and held; published history. Changes go through edit (new version, new approval) | — |
| P0.6 | Activity | Audit log in plain words, with filters, links to posts, older entries on demand | — |
| P0.7 | Settings and access | Sessions (no tokens), Sign out everywhere, recovery steps, publishing and data status, the fixed rules | — |
| P0.8 | Verified uploads | Type sniffed from the bytes, 4 MB limit, private storage, SHA-256 verified, covered by the approval hash | — |
| P0.9 | End-to-end tests in CI | The owner's journeys in Chromium with the local store; refuses to run near real credentials | — |

## P1: go live (gates)

| # | Item | Gate | Acceptance criteria |
|---|---|---|---|
| P1.1 | Batch A: migrations, domain and DNS, merge #17–#20 (+ #21 if approved), setup link, LinkedIn redirect URL | **Gate** | [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md): every check passes; www/studio is a 404; agent.growxera.com/studio signs in; both switches OFF |
| P1.2 | Merge the product branch | **Gate** (merge) | Either part of batch A or merged after it. CI green on the exact head; the reviewer accepts |
| P1.3 | B1: connect LinkedIn | **Gate** (external account) | Connection shown as connected with posting permission; nothing published |
| P1.4 | B2: one manual live test with Publish now | **Gate** (live publishing) | All publishing ON only for the test; the post is verified live; latency measured; switched OFF afterwards |
| P1.5 | B3a: 15-second scheduler | **Gate** (production database) | SQL rehearsed in a throwaway database first; rollback is `cron.unschedule` |
| P1.6 | B3b: live test of a timed post | **Gate** | One confirmed post goes out inside T−60 s…T−10 s; a missed one is held |

## P2: next build items (no approval needed to build)

| # | Item | Acceptance criteria | Notes |
|---|---|---|---|
| P2.1 | Restore script for the weekly export | `scripts/` tool that loads a validated export into an **empty** project only, using the existing `restoreExport` safeguards; tested against a local store | Running it against a throwaway Supabase project is a gate |
| P2.2 | Large files (> 4 MB) | Direct-to-storage signed upload, verified after upload | Needs a signed-upload endpoint in the private bucket |
| P2.3 | Analytics upload | Owner uploads LinkedIn's content analytics export; metrics stored with source and date; dashboard shows them labelled | **Blocked:** a real sample export is needed to build the parser honestly |
| P2.4 | Engagement inbox (paste comments, draft replies, record manual replies) | Pasted comments are stored; replies are written by the owner and posted manually; nothing is sent automatically | The LinkedIn API doesn't allow reading or replying for this app type; Grok stays off ($0) |
| P2.5 | Newsletter "Behind the Number" workflow | Draft, review, manual publish with a link record | No API for articles |
| P2.6 | Daily report in the dashboard | A report traceable to records; email delivery is a separate gate (C4) | — |

## Dependencies and order

P0 (done) → P1.1 → P1.2 → P1.3 → P1.4 → P1.5 → P1.6. The P2 items can proceed in parallel, while P1 waits on approvals.
