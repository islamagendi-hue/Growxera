# LinkedIn Growth Studio: activation checklist

For PR #14, commit `5671bf8` or later. Work top to bottom and tick each box only when its **Verify** line is true. Stop at any mismatch.

Legend:
- **Pre-merge**: whether the step is safe before PR #14 is merged.
- **Target**: where you do it.
- ⚠️ **Production data**: the step writes to a database or storage that production uses (or may use).

Nothing in this checklist publishes to LinkedIn. Buffer publishing is already stopped: 36 posts were moved to Draft on 10 Oct 2026 at 19:00 UTC and verified read-only.

What Claude could verify from its session (10 Oct 2026): Vercel refuses project details and deployment lists (403/404); Supabase shows only `leanapp-staging`, which is **not** Growxera's database; growxera.com is blocked by the session's network. So every step below is done by you in the dashboards.

## Findings for this project (read-only check, 10 Oct 2026)

| Question | Answer | Consequence |
|---|---|---|
| Growxera database | Supabase project **growxera** (org "Growx Era", us-east-1, Free plan). It has the site tables; `leanapp-staging` is separate | Steps 3, 7, 8 target **growxera** only |
| Preview vs Production database | `SUPABASE_URL` is one variable for all environments → **case A, shared** | Anything done in a Preview studio (import, media, approvals) is **production data** |
| Backups | **None** (Free plan has no backups) | Step 2 must be a manual dump before step 3 |
| Git integration | **Not connected** to Vercel; production deploys are redeploys | No Preview exists for PR #14, and **merging does not deploy** until Git is connected or a deployment is made manually (step 5) |
| Deployment protection | Off | Preview URLs are public; the studio's owner gate still applies |
| `STUDIO_OWNER_EMAIL`, `XAI_*` | Not set | Step 4 still needed; Grok stays off |

---

## Progress (10 Oct 2026)

Reported by the owner's browser session (Claude in Chrome), read from the dashboards; not independently verifiable from the cloud session:

- [x] Step 1: database identified (project growxera); Preview shares it (case A).
- [x] Steps 2–3: activation script applied in project growxera. Verification: `li_tables 10`, `li_without_rls 0`, `browser_grants 0`, `bucket_public false`, `backup_tables 8`, backup counts equal to live (accounts 1/1, leads 3/3).
- [x] Step 4: `STUDIO_OWNER_EMAIL` set for Production, Preview and Development. No `XAI_*` variables.
- [x] Production check: the live deployment was built from `main` @ `15c15ec` (the current `main`), so connecting Git changes nothing live.
- [x] Step 5a: Git connected to `islamagendi-hue/Growxera`; Production Branch `main`; no deployment triggered by connecting. ⚠️ From now on every push to `main` deploys production.
- [ ] Step 5b: Preview for PR #14 (created by the next push to the PR branch).
- [ ] Steps 6–10.

## No-computer path for steps 2 and 3

Everything in steps 2 and 3 can be done from any browser (phone included) with one script:
[`supabase/activation/2026-10-10_studio_activation.sql`](../../supabase/activation/2026-10-10_studio_activation.sql).

- ⚠️ **Production database.** It runs in one transaction: all or nothing.
- **Order:** it first refuses to run unless the site tables exist (so it can't hit `leanapp-staging`).
- **Backup:** it then copies the 8 site tables into schema `backup_20261010` in the same database, instead of a dump. That schema isn't exposed to the API, has RLS on, and is closed to browser roles.
- **Migrations:** it then applies both migrations unchanged.
- **Re-runs:** a second run refuses ("already ran") and changes nothing.

How: Supabase → project **growxera** → SQL Editor → New query → paste the whole file → Run. Then compare the three result tables at the bottom with step 3's expectations. The last one should show equal `live` and `backup` row counts.

After the studio is verified (step 8), remove the backup copy, since it holds personal data: `drop schema backup_20261010 cascade;`

Tested on Postgres: right project, re-run, and wrong project (nothing changed in the last two). A test keeps the script identical to the two migration files.

## 1. Identify the Growxera database (read-only)

- **Pre-merge:** yes, read-only.
- **Target:** Supabase dashboard, then Vercel → project `growx-era` → Settings → Environment Variables.

1. In Supabase, open each project until **Table Editor** shows `accounts`, `leads` and `diagnostic_sessions`. That is Growxera's database. Never use `leanapp-staging`.
2. Note its **project ref** (Settings → General → Reference ID). The API URL is `https://<ref>.supabase.co`.
3. In Vercel, open `SUPABASE_URL` and read the value for **Production**, then for **Preview** (the host part only; don't copy keys anywhere).
4. Write down one of these:
   - **A. Shared:** Preview's `SUPABASE_URL` has the same ref as Production.
   - **B. Separate:** Preview points at a different project.
   - **C. None:** Preview has no `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.

**Verify:** you have written the Production ref, and A, B or C.

**What it decides:**
- **A:** everything you do on Preview (import, media copy, approvals) lands in the production database.
- **B:** run step 3 on both projects; Preview tests won't touch production data.
- **C:** the Preview studio shows "database is not configured" and refuses every action. Either add the Preview variables (making it A or B) or skip the Preview data steps.

## 2. Back up the production database

- **Pre-merge:** yes. No data changes.
- **Target:** the Production project from step 1.

This project is on the Free plan, which has **no backups**, so make a manual dump on your own machine:

1. Supabase → project growxera → **Connect** (top bar) → copy the **Session pooler** connection string, and put in your database password.
2. In a terminal (needs the Supabase CLI or `pg_dump` 15+):
   `supabase db dump --db-url "<connection string>" -f growxera-schema.sql` and
   `supabase db dump --db-url "<connection string>" --data-only -f growxera-data.sql`
3. Keep both files private, outside the repository.

The migrations in step 3 only add new objects and were tested with a full rollback, so the dump is a safety net, not a requirement for correctness.

**Verify:** a backup exists that is newer than any change you are about to make, and you know where it is.

## 3. Run the two migrations ⚠️ production database (schema only)

- **Pre-merge:** yes. Both are additive: new `li_*` tables and one private bucket. They don't touch site tables, and the current production code doesn't use them.
- **Target:** the Production project (and the Preview project too, in case B).

In **SQL Editor**, run each file as one script, **in this order**:

1. `supabase/migrations/20261010000000_linkedin_studio.sql`
2. `supabase/migrations/20261011000000_linkedin_studio_hardening.sql`

Run in the wrong order, file 2 fails with `relation "public.li_content" does not exist` and changes nothing. Re-running either file is harmless.

**Verify:** run this query.

```sql
select t.tablename, t.rowsecurity as rls,
  (select count(*) from information_schema.role_table_grants g
    where g.table_name = t.tablename and g.grantee in ('anon','authenticated')) as browser_grants
from pg_tables t where t.schemaname = 'public' and t.tablename like 'li\_%' order by 1;
select id, public from storage.buckets where id = 'li-studio-assets';
```

Expected:
- **10 rows:** `li_actions, li_approvals, li_assets, li_audit_log, li_content, li_draft_versions, li_drafts, li_executions, li_llm_usage, li_metrics_snapshots`.
- Every row has `rls = true` and `browser_grants = 0`.
- **1 bucket row:** `li-studio-assets`, `public = false`.

## 4. Vercel environment variables

- **Pre-merge:** yes. The production build from `main` doesn't contain the studio yet, and variables take effect only on the next deployment.
- **Target:** Vercel → `growx-era` → Settings → Environment Variables.

| Key | Value | Environments |
|---|---|---|
| `STUDIO_OWNER_EMAIL` | the email you log in to growxera.com with | Production, Preview |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | already set for Production; for Preview, per your step 1 decision | Preview |

Leave every `XAI_*` variable **unset**, so Grok stays off.

**Verify:** the variables page lists `STUDIO_OWNER_EMAIL` with Production and Preview ticked, and no `XAI_*` keys.

## 5. Get a Preview deployment of the PR

- **Pre-merge:** yes. It's a preview build, not production.
- **Target:** Vercel → Deployments, filtered by branch `claude/linkedin-brand-growth-agent-wu375g`.

Git is **not connected** for this project, so no Preview exists. Two ways to get one:

- **Connect Git (recommended):** Vercel → growx-era → Settings → **Git** → Connect → GitHub → `islamagendi-hue/Growxera`, production branch `main`. ⚠️ From then on, **every push to `main` deploys production** and other branches get previews. Connecting doesn't deploy by itself; the next push to the PR branch creates its preview. First check that `main` matches what production runs today (Deployments → current production → Source).
- **Or deploy a preview by hand:** on your machine, in a checkout of the PR branch, run `vercel deploy` (without `--prod`).

Case A applies: the Preview uses the production database.

**Verify:** the deployment shows **Ready**, the commit is `5671bf8` or later, and you have its URL. If deployment protection is on, open it while logged in to Vercel.

## 6. Preview smoke tests (read-only)

- **Pre-merge:** yes. Nothing is written.
- **Target:** the Preview URL from step 5.

| # | Do | Expected |
|---|---|---|
| 6.1 | Signed out, open `/studio` | Redirect to `/login?next=%2Fstudio` |
| 6.2 | Logged in as a **different** account (or a private window with another email), open `/studio` | 404 page, with no mention of the studio |
| 6.3 | Logged in as **you**, open `/studio` | Overview loads. No red "database is not configured" banner (in case C it appears: expected, and stop here) |
| 6.4 | Same | Overview shows **0** in every queue tile and "No data" for history (empty database) |
| 6.5 | Open `/studio/capabilities` | Grok "Disabled. Missing: XAI_API_KEY…"; publishing "Not verified" |
| 6.6 | Open `/studio/assets/00000000-0000-0000-0000-000000000000` | 404 |
| 6.7 | Check the footer, consent banner and site pages on Preview (`/`, `/diagnostic`) | Unchanged from production |

**Verify:** all 7 rows match.

## 7. Import the private files ⚠️ production data in case A

- **Pre-merge:** yes on Preview, but in **case A this writes to the production database**. Do it only when you intend these records to be live.
- **Target:** Preview `/studio/import` (case A or B), or production after merging.

Upload the files **one at a time, in this order**, and compare each notice:

| # | File | Expected notice (first time) |
|---|---|---|
| 1 | `2026-10-10-history-with-metrics.json` | 58 records; history 57 new; 57 metric snapshots; queue 1 new; 0 blocked; 0 invalid; 0 errors |
| 2 | `2026-10-10-scheduled-before-pause.json` | 37 records; queue 37 new; 0 blocked; 0 invalid; 0 errors |
| 3 | `2026-10-10-update-1839-published-after-export.json` | 1 record; history 1 new; 1 blocked |
| 4 | `2026-10-10-reexport-current-state.json` | 37 records; queue 0 new / 37 already there |

**Verify:**
- The Reconciliation section shows **Published history 58 · Migrated queue items 38 · Approved 0 · Blocked 1**.
- By status: **Ready for review 36 · Draft 1 · Blocked 1**.
- The exception list names `6aca0aa7…`, the post Buffer published at 18:30 UTC.
- Upload all four again: every notice says **0 new**.

Upload no other file. Any other JSON is rejected or out of scope.

## 8. Copy and verify media ⚠️ writes to Growxera storage

- **Pre-merge:** yes, with the same environment caveat as step 7.
- **Target:** `/studio/import` → **Copy and verify media**, after step 7.

**Expected:** "49 referenced, 0 already secured, 49 copied and verified, 0 failed". That's the 37 images and PDFs on the queued posts plus 12 historical thumbnails from Buffer's media bucket. Run it again: "49 already secured".

**Verify:** open any queue item that has an image and click **secured copy**: it opens. Keep `leanapp-staging` and Buffer connected until this step reports 0 failed. If some of the 12 Buffer thumbnails fail, they belong to history only: record the failures, run the step again, and decide before disconnecting Buffer.

## 9. Merge PR #14 ⚠️ production deployment

- **Pre-merge:** this *is* the merge. Needs your explicit go-ahead.
- **Target:** GitHub PR #14 → Merge. Production updates only if Git is connected (step 5); otherwise deploy `main` manually with `vercel deploy --prod`.

**Verify:**
- The production deployment is **Ready**.
- Repeat 6.1, 6.2, 6.3 and 6.7 on `https://www.growxera.com`.
- If you skipped steps 7–8 on Preview, do them now on production.

## 10. Retire Buffer

Follow [BUFFER_MIGRATION.md](BUFFER_MIGRATION.md), steps 9 onwards. Only after step 8 reports 0 failed, and only with your explicit decision. Disconnecting ends Buffer's access to the 12 historical thumbnails' source.

---

## Rollback

**Code:** revert the merge commit of PR #14 on GitHub, or promote the previous production deployment in Vercel → Deployments → ⋯ → **Promote to Production**. The site doesn't depend on the studio.

**Database** ⚠️ deletes all studio data (history imports, queue, approvals, media records), never site data. Export first if anything was imported. In Storage, empty the `li-studio-assets` bucket first, then in SQL Editor:

```sql
drop table if exists public.li_assets, public.li_audit_log, public.li_llm_usage, public.li_executions,
  public.li_approvals, public.li_actions, public.li_draft_versions, public.li_drafts,
  public.li_metrics_snapshots, public.li_content cascade;
delete from storage.buckets where id = 'li-studio-assets';
```

**Verify:** the step 3 query returns 0 rows and no bucket; site tables (`accounts`, `leads`, `diagnostic_sessions`, …) are unchanged.

Tested on Postgres: the rollback removes the 10 tables and the bucket, keeps site rows, and both migrations re-apply afterwards.

**Settings:** remove `STUDIO_OWNER_EMAIL` in Vercel (the studio returns 404 to everyone without it).

## Notes

- The migrations rely on Supabase's default `service_role` privileges on new tables, like the existing site migrations. If the studio reports database errors after step 3 while the step 3 query looks right, check those defaults.
- The studio never pretends to save: without database variables it refuses every action.
