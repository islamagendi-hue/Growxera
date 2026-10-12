# Studio architecture and security

## Shape

One Next.js 16 app (Vercel project `growx-era`) serves both the public website (www.growxera.com) and the private studio (agent.growxera.com). One Supabase Postgres project (Free plan) holds all data. The browser never talks to the database: every read and write goes through server code using the service-role key.

```
browser ──HTTPS──► Next.js (Vercel)
                    ├─ src/proxy.ts            studio paths: only on agent.growxera.com (404 elsewhere)
                    ├─ src/app/access/*        sign-in, first setup (fragment token), sign out
                    ├─ src/app/studio/*        pages + server actions (every one checks the owner)
                    ├─ src/app/api/studio/publish-due   scheduler endpoint (Bearer secret, Vault-checked)
                    └─ src/lib/studio/*        all rules and state changes
                         ├─ repo.ts            drafts, versions, approvals, transitions, audit log
                         ├─ insights.ts        read-only: post states, blockers, calendar, activity
                         ├─ switch.ts          all-publishing switch (P2)
                         ├─ autopublish.ts     automatic switch, per-post confirmation, window, holds
                         ├─ publish.ts         the only publishing path (manual + automatic)
                         ├─ linkedin.ts        the only LinkedIn client (re-checks the switch, the deadline, the cut-off)
                         ├─ assets.ts          private media storage, uploads, checksums
                         ├─ access.ts, crypto.ts   password (scrypt), TOTP, sessions, lockout
                         └─ export.ts          weekly backup export and validation
Supabase: Postgres (RLS on, no browser grants) · Storage bucket li-studio-assets (private) · pg_cron + pg_net + Vault (scheduler)
```

## Publishing invariants (each enforced in code and tested)

1. Approval binds to the SHA-256 of text, files and planned time. Any edit creates a new version and voids the approval.
2. The all-publishing switch is OFF by default. It is checked in `publishAction` and again in the LinkedIn client before upload and before the post request.
3. Automatic publishing also needs: the deployment flag, the owner's automatic switch, a per-post confirmation bound to the version, hash and time, and the window T−60 s…T−10 s. The deadline is re-checked right before sending, and the request is cut off at T.
4. A missed window holds the post; it is never published late. An unknown outcome is never retried.
5. One execution per approved version (idempotency key). Duplicate content is refused against history.

## Security model

| Concern | Control |
|---|---|
| Who can use the studio | One owner (`STUDIO_OWNER_EMAIL`), password (scrypt) + TOTP; studio host only; 404 elsewhere |
| Sessions | Random token in an httpOnly, Secure, SameSite=Lax cookie (`__Host-` prefix in production); only its SHA-256 is stored; 7 days; sign out everywhere |
| Brute force | 5 failures per network per 15 minutes; 50 per hour globally; setup-link recovery skips the lockout |
| Setup links | 32 random bytes; SHA-256 stored; single use; short expiry; the token travels in the URL fragment and the POST body only |
| Server actions | Every exported action checks the owner (static test) |
| Database exposure | RLS on every `li_` table, no policies, no anon/authenticated grants (verified against production defaults in a rehearsal) |
| Secrets at rest | LinkedIn token and client secret: AES-256-GCM with HKDF keys from the service-role key; TOTP secret: the same |
| Uploads | Type from the file's bytes (PNG, JPEG, GIF, WebP, PDF only; SVG refused), 4 MB, private bucket, served only to the owner |
| Backups | Export excludes every secret field and sign-in table; validation refuses a file that has one |
| Logs | No post text or tokens in server logs; setup tokens never in URLs |
| Tests near real systems | The E2E run refuses to start if any `.env*` file or credential is present |

## Known limitations

- Previews share the production database (R6). The studio answers 404 on preview hosts, so studio data isn't reachable there.
- Restore into Supabase isn't supported yet (R13).
- Uploads are limited to 4 MB by the platform's request size.
- The 5 dev-only `npm audit` advisories in lint tooling aren't shipped.
