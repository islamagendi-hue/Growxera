# Security review: preview isolation and attack surface

11 Oct 2026, on `claude/studio-m2-product`. Read-only against hosting; nothing in production was changed. "Verified" means by a test or a local production-build run named here, never on a real deployment.

## 1. Preview / production isolation

**Hosting facts** (Vercel env names and targets read on 11 Oct 06:20 UTC; values never read. A re-read later that day failed: the Vercel connector no longer lists the project):

| Variable | Targets | Meaning |
|---|---|---|
| `SUPABASE_URL` | Production, Preview, Development (one entry) | Previews point at the **production** Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Separate Production and Preview entries | The Preview value is sensitive and unreadable; it is treated as the production key |
| `STUDIO_OWNER_EMAIL` | Production, Preview, Development | — |
| `RESEND_API_KEY`, `REPORT_FROM_EMAIL` | Production, Preview | Previews can send real email |

Preview protection is off, so preview URLs are public. Vercel keeps every deployment, and a deployment's environment values are fixed when it is built, so **changing variables later doesn't change existing previews.**

**What a preview could do before this change:**

| Path | Preview built from #19 or later | Older previews (the old studio, as on `main`) |
|---|---|---|
| Studio pages and sign-in | 404 (not the studio's address) | Reachable at `/studio`, but only with the owner's website sign-in (an email link to the owner's inbox) |
| Studio server actions through any page | Refused: no session on that host (fixed in `c9dd5f2`) | Owner's website sign-in needed |
| Scheduler `/api/studio/publish-due` | Needs the cron secret | Needs the cron secret |
| Website API (diagnostic, leads, sign-in, booking) | Writes the production database: same endpoints as production, but running that branch's code | Same |
| Any code in the branch | Runs with the production key | Same, permanently for that deployment |

So nobody without the owner's credentials or the cron secret could read or change **studio** data through a preview. But every preview runs unreviewed branch code with production credentials. After LinkedIn is connected, an old preview's studio would also offer "Publish now" without the all-publishing switch (P2), if the owner signed in there.

**Fixed in code (this commit), with tests:**
- `src/lib/server/deployment.ts`: on Vercel, only the **production** deployment may touch studio data. Preview and development deployments may do so only if they declare their own database (`STUDIO_DATABASE=isolated`).
- Enforced at the lowest level:
  - every `li_*` read, write and function call in `store.ts` throws before any request;
  - file storage in `assets.ts`;
  - the studio switches itself off (`studioStorageError`);
  - nobody counts as signed in (`studioOwner`);
  - the scheduler answers 404.
- **Tests:** `src/lib/server/deployment.test.ts` stubs `fetch` and checks that no request is sent. Website tables are unaffected.
- **Local production build** configured as a preview, pointed at a fake database that logs every request:
  - studio pages, backup download and scheduler (with a bearer token) were refused;
  - **0 requests reached the database**.
  - The same build as production reached it for the session lookup and the cron-secret check (positive control).
- **Limits:**
  - It protects only deployments built from this code onward; old previews are unchanged.
  - It relies on Vercel exposing `VERCEL_ENV` at runtime: the project setting "Automatically expose System Environment Variables" is on by default. Without it the guard does nothing; it fails open, as before this change.

**Recommended owner actions** (Vercel settings; not executed):

| # | Action | Fixes | When | Reversible |
|---|---|---|---|---|
| V1 | Deployment Protection → **Vercel Authentication** for Preview deployments (Standard Protection, available on Hobby) | Every existing and future preview URL needs a Vercel login. Production domains are unaffected | **Before batch A** | Yes, toggle |
| V2 | Remove `SUPABASE_SERVICE_ROLE_KEY` from the **Preview** environment, or point Preview at a separate project if the free-project limit allows | New previews can't reach production at all (website features on previews stop saving) | Before batch A (recommended) | Yes, re-add |
| V3 | Confirm "Automatically expose System Environment Variables" is on | Keeps the code guard active | Before batch A | — |
| V4 | Optional, later: delete old preview deployments that contain the old studio, or move to Supabase's revocable secret API keys | Old deployments' baked key | Before B1 (connecting LinkedIn) at the latest | Deleting deployments is not reversible |

## 2. Attack surface review

| Surface | Authorization | Cross-site / CSRF | Other | Result |
|---|---|---|---|---|
| Studio server actions (23) | `ownerOrThrow` in each; session counts only on the studio's address | Next compares the Origin host with the request host and rejects a mismatch (a request without Origin passes with a warning; browsers always send it on cross-site POSTs, and a non-browser request carries no session) | Inputs validated; errors logged without bodies (`safeLog`) | OK |
| Sign-in, setup, sign-out actions | `guard()`: studio host only | Origin check (Next) | Lockout: 5 per address per 15 min, 50 per hour overall; single-use TOTP codes; setup tokens 256-bit, hashed, single use, expiring, in the URL fragment | OK |
| `GET /studio/export/download` | Owner | **Was:** a link from another site could take a backup (SameSite=Lax), which records "backup taken" and silences the weekly reminder. **Now:** only navigations started on the studio or typed by the owner (`Sec-Fetch-Site`) [unit + E2E] | Export has no secrets (checked on generate and validate) | **Fixed** |
| `GET /studio/linkedin/connect` | Owner | **Was:** another site could start a LinkedIn authorization. **Now:** same check [unit + E2E] | State cookie; callback checks it in constant time | **Fixed** |
| `GET /studio/linkedin/callback` | Owner + state | Cross-site by design (from LinkedIn), protected by the state | — | OK |
| `GET /studio/assets/[id]` | Owner; verified rows only | Read-only; responses can't be read cross-site | `nosniff`, sniffed types (PNG/JPEG/GIF/WebP/PDF only), `private, no-store` | OK |
| `/api/studio/publish-due` | Cron secret (env or Vault), 32–256 chars, constant-time | — | No post text in responses or logs; previews: 404 (new) | OK |
| Uploads | Owner action | — | 4 MB, type from bytes, content-addressed path, checksum read-back | OK |
| Framing | — | **Was:** no anti-framing headers. **Now:** studio host sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: same-origin`, `nosniff` [unit + build smoke test]. SameSite=Lax already kept cross-site frames signed out; this also covers same-site pages such as www | — | **Fixed** |
| Secrets in Git, logs, docs | — | — | Setup links: fragment, `--out` file 600, `--hash-only`; no secret values in this repository's docs | OK |
| Dependencies | — | — | `npm audit --omit=dev`: 0. 5 high advisories in lint tooling only (not shipped) | OK |

**Not covered here:** the public website's own endpoints (pre-existing; outside the studio). Their exposure on previews is closed by V1/V2.
