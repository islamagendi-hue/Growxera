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

### Failure reporting

An export that fails its own validation is not downloaded. The page shows the error, and the audit log records `export.failed`. The studio shows a banner when no export has been made in 7 days.

## Restore (disaster recovery, owner-approved)

Restore never overwrites live data. `restoreExport()` refuses a store that already has studio data, and refuses a live database unless `STUDIO_RESTORE_TARGET=isolated` is set.

1. Create an empty Supabase project. This is an approval gate; the Free plan allows two projects.
2. Apply all migrations in `supabase/migrations/` in filename order.
3. With that project's URL and service key in a local shell and `STUDIO_RESTORE_TARGET=isolated`, run a restore script from a checkout. **Limitation:** the script is not shipped yet, and `restoreExport` has been tested only against the local file store in an empty temporary directory, never against a Supabase database. A production restore is not supported: restore refuses any store with studio data.
4. Verify the counts against the file's manifest.
5. Reconnect LinkedIn; issue a new setup link.
6. Media: re-copy from the sources, or from a bucket copy.

## Rollback

| What | How |
|---|---|
| Code (first) | Revert the merge commits on GitHub, or promote the previous deployment in Vercel. The studio returns to www with its current sign-in |
| Migrations `20261014`/`20261015` | `drop table public.li_publish_authorizations, public.li_settings, public.li_access_attempts, public.li_access_setup_tokens, public.li_access_sessions, public.li_access_credentials;` Only **after** the code rollback, and only if wanted: leaving the tables is harmless. Dropping them while PR #19's code is live makes sign-in impossible (recover with a code rollback). Take an export first: dropping deletes the publishing authorizations |
| Scheduler | `select cron.unschedule('studio-publish-due');` |
| Earlier objects | See [ACTIVATION.md](../linkedin-agent/ACTIVATION.md) and handover §6 |

## Incidents

| Situation | Do this |
|---|---|
| Something posted that shouldn't have | 1. Capabilities → **Switch automatic publishing OFF**.<br>2. Delete the post on LinkedIn by hand.<br>3. Mark the item failed with a reason.<br>4. Check `li_audit_log` |
| Suspected account compromise | 1. **Sign out everywhere**.<br>2. Disconnect LinkedIn in the studio and remove the app's access in LinkedIn settings.<br>3. Issue a new setup link (gated) to reset the password and authenticator.<br>4. Rotate the LinkedIn client secret (stored tokens become unreadable, so reconnect) |
| Locked out (lockout) | Wait 15 minutes, or 1 hour for the global lock. Or use a new setup link: it skips the lockout, resets the password and authenticator, signs out other sessions and signs you in (tested in `access.test.ts`) |
| Studio unreachable after go-live (domain, DNS or setup problem) | The public site is unaffected. Promote the previous Vercel deployment or revert the merge (owner-approved); the studio is back on www with the current sign-in |
| Lost authenticator | New setup link (gated) |
| Unknown publishing outcome | Open the item, check your LinkedIn activity, record the link or "not on LinkedIn". Never re-sent automatically |
| Post held (missed time) | Edit to a new time, approve, schedule it again |
| LinkedIn connection expired | Capabilities → **Reconnect** |
