# LinkedIn Growth Studio: production activation runbook

Status as of 10 Oct 2026, 19:05 UTC. Each step says who does it and how to verify it. Do the steps in order.

Nothing here publishes anything on LinkedIn. The studio has no LinkedIn or Buffer API code, no cron jobs, and executes nothing without an approval of the exact version.

## Access this activation was checked against

| System | Access from the Claude session | Consequence |
| --- | --- | --- |
| Buffer | API works. It has **no pause-queue action**; posts were moved to Draft instead (step 1, done) | No Buffer post can publish |
| Growxera Supabase | **Not visible.** The Supabase connector only sees `leanapp-staging` (a separate project with the old workflow's `li_*` visual tables and the `li-assets` bucket; no `accounts`/`leads` tables) | Migrations must be run by you (step 2). **Never run them on `leanapp-staging`** |
| Vercel | Can list team projects (`growx-era`), but reading or changing the project returns 404/403 | Env var and deployment are manual (step 3) |
| growxera.com | Blocked by this session's network policy | Production checks are manual (step 5) |

## Step 1: Stop Buffer publishing (done)

Done 10 Oct 2026, 19:00 UTC with your approval. Buffer's API has no pause action, so the 36 scheduled posts were moved to Draft through the API. A read-only check afterwards confirmed 0 scheduled or sending posts, with text, media and original dates identical to the export. Nothing was deleted. Buffer can no longer publish them.

## Step 2: Database migrations (you, Supabase dashboard)

1. Open the Supabase project that Growxera's `SUPABASE_URL` points to. Confirm identity first: **Table Editor must show `accounts`, `leads` and `diagnostic_sessions`.** If it doesn't, stop: wrong project.
2. Backup: Database → Backups. Note the latest daily backup time (or, on the free plan, run `supabase db dump` locally first). These migrations only add tables and a bucket, but take the backup anyway.
3. SQL Editor → run, in this order, each as one script:
   1. `supabase/migrations/20261010000000_linkedin_studio.sql`
   2. `supabase/migrations/20261011000000_linkedin_studio_hardening.sql`
4. Verify with this query (expected: 10 rows, all `rls = true`, `browser_grants = 0`, and one bucket row with `public = false`):

```sql
select t.tablename, t.rowsecurity as rls,
  (select count(*) from information_schema.role_table_grants g
    where g.table_name = t.tablename and g.grantee in ('anon','authenticated')) as browser_grants
from pg_tables t where t.schemaname = 'public' and t.tablename like 'li\_%' order by 1;
select id, public from storage.buckets where id = 'li-studio-assets';
```

If `browser_grants` is 0 but the studio later reports database errors, check that the `service_role` still has Supabase's default privileges on new tables (the existing migrations rely on them too).

**Rollback** (only if you decide to remove the studio; it deletes studio data, never site data, so export first if anything was imported):

```sql
drop table if exists public.li_assets, public.li_audit_log, public.li_llm_usage, public.li_executions,
  public.li_approvals, public.li_actions, public.li_draft_versions, public.li_drafts,
  public.li_metrics_snapshots, public.li_content cascade;
-- The private bucket must be emptied in Storage first, then:
delete from storage.buckets where id = 'li-studio-assets';
```

Both scripts are safe to re-run. They were validated on Postgres (PGlite): applied twice in a row, with every duplicate and invalid insert rejected.

## Step 3: Vercel environment (you, Vercel dashboard)

Project **growx-era** → Settings → Environment Variables:

| Key | Value | Environments |
| --- | --- | --- |
| `STUDIO_OWNER_EMAIL` | your sign-in email for growxera.com | Production, Preview |

Leave all `XAI_*` variables unset (Grok stays off).

**Preview vs Production.** The studio needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment it runs in. Without them it shows "database is not configured" and refuses every action (it never pretends to save). If Preview uses the same Supabase project as Production, the preview studio reads and writes the **same** studio data: that is fine for the activation checks (the owner gate is identical), but it means what you import on the preview is already in production.

## Step 4: Deploy

The studio code is on branch `claude/linkedin-brand-growth-agent-wu375g`, not on `main`. Production does not include it yet.

1. Open the branch's **Preview** deployment in Vercel (Deployments → filter by branch). It appears automatically after each push if Git integration is on. Redeploy it after step 3 so it picks up the variable.
2. Test on the preview (step 5).
3. Merge to `main` (via a pull request) only after the preview checks pass. Production then deploys from `main`.

## Step 5: Checks on the deployment (you, about 10 minutes)

1. Signed out, open `/studio`: you are sent to the login page.
2. Log in with a different email (or a private window with another account): `/studio` shows **404**.
3. Log in with your email: `/studio` opens. The overview shows **0** items everywhere (empty database).
4. `/studio/import`: upload the private files in this order:
   1. `2026-10-10-history-with-metrics.json`
   2. `2026-10-10-scheduled-before-pause.json`
   3. `2026-10-10-update-1839-published-after-export.json`
   4. `2026-10-10-reexport-current-state.json`
5. The reconciliation must read: **Published history 58 · Migrated queue items 38 · Approved 0 · Blocked 1**, by status **Ready for review 36 · Draft 1 · Blocked 1**, and two exceptions for `6aca0aa7…` (the post Buffer published at 18:30 UTC).
6. Import the same four files again: every message says "0 new".
7. `/studio/import` → **Copy and verify media**: expected "37 referenced… 37 copied and verified, 0 failed". On a second run: "37 already secured". Open one queue item and click "secured copy".
8. Safe workflow test **without publishing**: open the **Draft** item (the old Buffer draft), edit one word, save. Check that it's still "Draft" or "Ready for review", that a v2 exists, and that no "Publish" section appears. Do not approve migrated posts until you intend to publish them.

If any number differs, stop and share the reconciliation section; don't re-import other files.

## Step 6: Retire Buffer (after step 5 passes)

Follow [BUFFER_MIGRATION.md](BUFFER_MIGRATION.md), steps 9 onwards. Disconnecting and deleting need your explicit go-ahead. Nothing in the studio depends on Buffer.
