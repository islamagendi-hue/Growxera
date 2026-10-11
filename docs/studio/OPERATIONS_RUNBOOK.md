# Operations runbook

## Weekly backup (Supabase Free has no automatic backups)

1. Open https://agent.growxera.com/studio/export, then **Download export (JSON)**.
2. Keep it somewhere private: a personal encrypted drive or password-manager attachment. Not the code repository, not a shared folder.
3. Optional: **Check a saved export** confirms it is complete and unchanged.
4. Keep at least the last 4 weekly files.

### What the export contains

Every studio table:
- content history;
- metrics;
- drafts and all versions;
- actions;
- approvals;
- executions;
- automatic-publishing authorizations;
- media records;
- settings;
- model usage;
- audit log;
- LinkedIn connection metadata.

Each table has a SHA-256 checksum, and so does the whole file.

### Never included

- LinkedIn access token and client secret.
- Password hash, authenticator secret, sessions, setup links, sign-in attempts.
- Media files. They stay in the private bucket `li-studio-assets`; the export lists each file's path and SHA-256. The originals are also kept in their source buckets until Buffer and the staging project are retired.

### Downloading and keeping it safely

- Only the signed-in owner can download it. Everyone else gets 404, and studio paths answer only on agent.growxera.com.
- It is sent as an attachment with `Cache-Control: private, no-store`, so browsers and proxies don't keep a copy.
- No secrets are in it (list below). Every export is validated before download: a file that contains any secret field is refused, not downloaded.
- It does contain private content: unpublished drafts, approvals and metrics. Keep it like a private document.

### Failure reporting

An export that fails its own validation is not downloaded. The page shows the error, and the audit log records `export.failed`. The studio shows a banner when no export has been made in 7 days.

## Restore (disaster recovery, owner-approved)

> **Not supported yet.** Restoring into a Supabase database has never been run, no restore script is shipped, and restoring into production is not supported at all (restore refuses any store that already has studio data). What is tested: building the export, validating it, and a round-trip restore into an empty local store. The steps below are the intended procedure once a restore script exists and has been drilled in a throwaway project (a separate approval).

Restore never overwrites live data. `restoreExport()` refuses a store that already has studio data, and refuses a live database unless `STUDIO_RESTORE_TARGET=isolated` is set.

1. Create an empty Supabase project. This is an approval gate; the Free plan allows two projects.
2. Apply all migrations in `supabase/migrations/` in filename order.
3. With that project's URL and service key in a local shell and `STUDIO_RESTORE_TARGET=isolated`, run a restore script from a checkout. **Limitation:** the script is not shipped yet, and `restoreExport` has been tested only against the local file store in an empty temporary directory, never against a Supabase database. A production restore is not supported: restore refuses any store with studio data.
4. Verify the counts against the file's manifest.
5. Reconnect LinkedIn; issue a new setup link.
6. Media: re-copy from the sources, or from a bucket copy.

## Go-live sequence (batch A)

Each step is owner-approved as part of batch A. Stop at any failed check: every step up to A1 leaves the current studio on www working as today.

**0. Before starting (read-only)**
- Confirm 0 LinkedIn connections, 0 executions, and the cron runs answering `ran:false`.
- Record table counts.
- Confirm Vercel still has `STUDIO_OWNER_EMAIL` and `SUPABASE_SERVICE_ROLE_KEY` for Production; names only, values never read.
- Nothing publishes during the whole sequence: LinkedIn isn't connected, and after A1 both publishing switches are OFF.

**1. A2: migrations** (`20261014000000`, then `20261015000000`)
- Check: the 6 new tables exist, RLS is on, there are 0 grants to anon or authenticated, and existing tables are untouched (counts equal).
- The current production code doesn't use these tables, so the live studio is unaffected.
- If it fails: nothing else is touched. Fix and re-run (both files are idempotent), or drop only the new tables.

**2. A3: domain and DNS**
- Add `agent.growxera.com` to Vercel project `growx-era`. Add the record Vercel asks for at Unstoppable Domains (CNAME `agent`; growxera.com's DNS is there).
- Check: Vercel shows the domain as valid with an issued certificate. `https://agent.growxera.com` answers over HTTPS. `https://www.growxera.com` is unchanged.
- Until A1, the new host serves the current site and the current studio gate. That is harmless.
- If the domain doesn't verify: **don't merge.** The studio stays on www. Remove the record and the domain, or wait for DNS.

**3. A1: merge #17 → #18 → #19 → #20** (production deploys)
- Check, within minutes of the deployment going Ready:
  - `www.growxera.com/studio` → 404;
  - `agent.growxera.com/studio` → the sign-in page;
  - public pages and website sign-in work;
  - the scheduler endpoint (`/api/studio/publish-due`, on www) still answers 200 with `ran:false`;
  - Capabilities later shows "All publishing: OFF" and "Automatic publishing: OFF".
- From here until step 4 is finished, the studio can only be reached through a setup link. The public site is unaffected.
- If any check fails: **promote the previous production deployment in Vercel** (instant; the studio is back on www with today's sign-in), then investigate. Or revert the merges.

**4. A4: setup link**
- Create it immediately after A1 is Ready: `scripts/studio-setup-link.mjs --confirm` with the production URL and service key in a local shell. Alternatively, insert only the link's SHA-256 with the same fields through the Supabase SQL editor.
- The link is valid for 24 hours and works once. Deliver it privately, never in chat logs, issues or commits.
- The owner opens it, sets a password of 12+ characters, scans the QR code, enters the code, and is signed in.
- Check: the owner reaches `/studio` on agent.growxera.com and sees both switches OFF.
- **If the link expires, is used, or is lost:** create a new one. Old links stop at their expiry. Nothing else changes.
- **If setup fails repeatedly:** promote the previous deployment (step 3) and investigate.

**5. A5: LinkedIn redirect URL**
- **Add** the agent.growxera.com callback in the LinkedIn app. Keep the www one, which rollback needs.

**After go-live**
- Download the first weekly export (below).
- Lost authenticator, forgotten password or a lockout: a new setup link (gated). It skips the lockout, replaces the password and authenticator, and signs out every other session (tested).

## Rollback

| What | How |
|---|---|
| **Precondition once LinkedIn is connected (after B1)** | The code on today's `main` publishes approved posts automatically within 3 hours of their time, and it doesn't know the new switches. Before rolling back: (1) `select cron.unschedule('studio-publish-due');` (2) **Disconnect** LinkedIn on Capabilities. During batch A LinkedIn is not connected, so this doesn't apply |
| Code (first) | Promote the previous production deployment in Vercel (instant), or revert the merge commits on GitHub. The studio returns to www with today's sign-in: the website's email link for `STUDIO_OWNER_EMAIL`. No database change is needed: the old code ignores the 6 new tables, and every row the new code writes uses existing status values (a held post is `ready_for_review` with a reason) |
| Migrations `20261014`/`20261015` | `drop table public.li_publish_authorizations, public.li_settings, public.li_access_attempts, public.li_access_setup_tokens, public.li_access_sessions, public.li_access_credentials;` Only **after** the code rollback, and only if wanted: leaving the tables is harmless. Dropping them while PR #19's code is live makes sign-in impossible (recover with a code rollback). Take an export first: dropping deletes the publishing authorizations |
| Scheduler | `select cron.unschedule('studio-publish-due');` |
| Earlier objects | See [ACTIVATION.md](../linkedin-agent/ACTIVATION.md) and handover §6 |

## Incidents

| Situation | Do this |
|---|---|
| Something posted that shouldn't have | 1. Capabilities → **Switch all publishing OFF** (stops manual and automatic publishing, even mid-upload).<br>2. Delete the post on LinkedIn by hand.<br>3. Mark the item failed with a reason.<br>4. Check `li_audit_log` |
| Suspected account compromise | 1. **Sign out everywhere**.<br>2. Disconnect LinkedIn in the studio and remove the app's access in LinkedIn settings.<br>3. Issue a new setup link (gated) to reset the password and authenticator.<br>4. Rotate the LinkedIn client secret (stored tokens become unreadable, so reconnect) |
| Locked out (lockout) | Wait 15 minutes, or 1 hour for the global lock. Or use a new setup link: it skips the lockout, resets the password and authenticator, signs out other sessions and signs you in (tested in `access.test.ts`) |
| Studio unreachable after go-live (domain, DNS or setup problem) | The public site is unaffected. Promote the previous Vercel deployment or revert the merge (owner-approved); the studio is back on www with the current sign-in |
| Lost authenticator | New setup link (gated) |
| Unknown publishing outcome | Open the item, check your LinkedIn activity, record the link or "not on LinkedIn". Never re-sent automatically |
| Post held (missed time) | Edit to a new time, approve, schedule it again |
| LinkedIn connection expired | Capabilities → **Reconnect** |
