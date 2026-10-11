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
| R9 | No late allowance (G2) with a 5-minute scheduler: a run reaches the app a moment after its tick, so in practice nearly every scheduled post is **held, not published**. Safe (fails closed) but automatic publishing is effectively non-functional | Medium (function, not safety) | Accepted until the owner decides P1 | Held posts are visible with their reason; manual Publish now still works | Owner decides P1 |
| R15 | Manual **Publish now** isn't blocked by the automatic-publishing switch | Medium | Open: owner decision P2 | Needs the signed-in owner (password + authenticator after PR #19), a valid approval of the exact version, a confirm box, and a LinkedIn connection (0 today) | Decide P2 |
| R16 | After merging #19, the studio is reachable nowhere until the migrations, the domain and the first setup link are done | Medium | Mitigated by sequencing | Order A2 → A3 → A1 → A4 (APPROVAL_GATES); the public site and its sign-in are unaffected; revert the merge or promote the previous deployment | Follow the order |
| R10 | Buffer still connected with 37 drafts | Medium | Accepted until C2 | Read-only check 11 Oct: 0 scheduled | — |
| R11 | Public repository identifiers (a test URN, profile slug, project names) | Low | Open | KNOWN_ISSUES L1 | Optional cleanup |
| R12 | Vault secret comparison not constant-time | Low | Accepted | 64-hex secret | — |
| R13 | Export restore not exercised against a real Supabase project | Medium | Open | Round-trip tested on the local store only | Optional drill in a throwaway project (gated) |
| R14 | Docs drift | Low | Mitigated | This doc set; IMPLEMENTATION_LOG.md | — |
