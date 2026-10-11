# Risk register and threat model

As of 11 Oct 2026. Severity: Critical / High / Medium / Low.

**Status labels:**
- **Open:** not addressed yet.
- **Mitigated in PR:** fixed in code that isn't merged.
- **Mitigated:** fixed in production.
- **Accepted:** known and left as is, on purpose.

## Threat model (summary)

**Assets to protect:**
- the owner's LinkedIn account (posting rights);
- unpublished drafts and approvals;
- history and metrics;
- the LinkedIn token and client secret;
- sign-in credentials;
- the service-role key.

### Attackers

| Who | Goal | Main defenses |
|---|---|---|
| Anonymous visitor | Find or open the studio | 404 on every non-studio host (proxy) plus a server-side owner check on every page, action and route. noindex. Not linked anywhere |
| Credential guesser | Sign in | Password plus TOTP; per-address and global lockout; no user enumeration (same message for every failure) |
| Someone with the owner's email inbox | Take over through a magic link | Removed (PR #19): website accounts no longer grant studio access |
| Leaked setup link | Reset the credentials | 24 h, single use, SHA-256 stored; a reset revokes all sessions. The owner should keep it private |
| Database dump without env | Read secrets | LinkedIn token encrypted (key derived from the client secret); client secret and TOTP secret encrypted (key derived from the service key); sessions and setup links stored as hashes |
| Holder of the service-role key | Everything | Accepted: the root of trust. It lives only in Vercel env |
| Preview deployment misuse | Use a preview to read or write production data through the studio | Studio 404 on preview hosts (PR #19). Previews still share the production database for the public site's own features |
| Bug or race in the scheduler | Duplicate or unapproved posts | Claim-first transitions, unique idempotency key, three automatic-publishing locks, unknown outcomes never retried |

## Risks

| ID | Risk | Sev. | Status | Evidence / mitigation | Owner action |
|---|---|---|---|---|---|
| R1 | Connecting LinkedIn would have auto-published the 19 approvals made under "manual" semantics | High | Mitigated in PR #18 | Global switch OFF + per-post authorization; legacy approvals excluded. Test "19 legacy approvals…" | Merge (A1) **before** connecting LinkedIn |
| R2 | The unpushed WIP could be lost | High | Mitigated | Branch `claude/studio-wip-agent-host` @ `3ca1de7`; stash kept | — |
| R3 | No backups (Free plan) | High | Mitigated in PR #20 (procedure) | Weekly export with checksums. Media not included; manual restore | Download weekly after go-live |
| R4 | Live LinkedIn behavior unverified (API version `202606`, escaping, image and PDF, read-back) | High | Open | Gate B2 | Approve the live test |
| R5 | Studio reachable on www and previews; the www signed-out redirect reveals it | Medium | Mitigated in PR #19 | Proxy 404 + tests | A1 |
| R6 | Previews share the production database | Medium | Partly mitigated | The studio can't run on previews (PR #19). Separating databases would need a second project (Free allows it), which is a change to production configuration | Optional decision |
| R7 | Global-lockout denial of service | Low | Mitigated in PR #19 | Per-address lock; the global lock needs 50 failures per hour; recovery with a setup link | — |
| R8 | 60-day LinkedIn token; no refresh token | Medium | Accepted | Banner 7 days before expiry; publishing stops cleanly when expired | Reconnect every 60 days |
| R9 | Automatic timing: posts held when the scheduler can't run in the window; LinkedIn's displayed time could fall a moment after T if it is slow to process | Medium | Mitigated in PR #18 (P1); scheduler change pending B3 | Window T − 60 s … T − 10 s, 15-second ticks (B3), pre-send deadline check, request cut off at T, unknown outcomes never retried | Live-validate in B3b |
| R15 | Manual **Publish now** wasn't covered by a global switch | Medium | Mitigated in PR #18 (P2) | The all-publishing switch, OFF by default, blocks manual and automatic publishing; checked in `publishAction` and again in the LinkedIn client before any upload and before the post request; tested, including a direct client call and switching OFF mid-upload | — |
| R17 | Rolling back to today's `main` after LinkedIn is connected: the old scheduler publishes approved posts within 3 h and ignores the new switches | High (only after B1) | Mitigated by procedure | Runbook rollback precondition: unschedule the cron job and disconnect LinkedIn first. Doesn't apply during batch A (0 connections) | Follow the runbook |
| R18 | The setup link is a bearer secret for 24 h | Medium | Mitigated | Single use; only its hash is stored; delivered privately; a used or expired link is refused; a new link signs out every other session | — |
| R16 | After merging #19, the studio is reachable nowhere until the migrations, the domain and the first setup link are done | Medium | Mitigated by sequencing | Order A2 → A3 → A1 → A4 (APPROVAL_GATES); the public site and its sign-in are unaffected; revert the merge or promote the previous deployment | Follow the order |
| R10 | Buffer still connected with 37 drafts | Medium | Accepted until C2 | Read-only check 11 Oct: 0 scheduled | — |
| R11 | Public repository identifiers (a test URN, profile slug, project names) | Low | Open | KNOWN_ISSUES L1 | Optional cleanup |
| R12 | Vault secret comparison not constant-time | Low | Accepted | 64-hex secret | — |
| R13 | Restore not supported yet: never run against a Supabase database; no restore script; production restore unsupported; media binaries not in the export | Medium | Open (stated in the runbook) | Round trip tested on an empty local store only; the export lists each media file's path and SHA-256 | A restore script + drill in a throwaway project (gated) |
| R14 | Docs drift | Low | Mitigated | This doc set; IMPLEMENTATION_LOG.md | — |
| R19 | Server actions accept bodies up to 4.4 MB (raised from 1 MB for studio uploads), site-wide | Low | Accepted | Vercel caps request bodies at 4.5 MB regardless; studio actions are owner-only | — |
| R20 | `npm audit` lists 5 high advisories in lint tooling (`braces` via `eslint-config-next`) | Low | Accepted | Not shipped (`npm audit --omit=dev`: 0); npm's suggested fix is a wrong-major downgrade | Re-check on the next Next.js upgrade |
| R21 | The product build (`claude/studio-m2-product`) is in draft PR #21, not yet reviewed for merge | Medium | Open | CI (unit + E2E) on every push; owner decides whether it joins batch A | Owner decision |
| R22 | Public previews use the production database URL with a service key, and run any pushed branch's code; old previews keep their credentials | **High** | Partly mitigated | #21: studio data refused in code on non-production deployments (SECURITY_REVIEW.md §1, tested, 0 requests in a local preview-mode build) | Owner: V1 Vercel Authentication for previews, V2 Preview service key, before batch A |
| R23 | Cross-site GET could take a backup (silencing the reminder) or start a LinkedIn authorization; studio pages could be framed | Medium | Fixed in #21 | `Sec-Fetch-Site` check; anti-framing headers on the studio host | — |
