# Batch A deployment runbook: go live on agent.growxera.com

Status: **ready for the owner's approval. Nothing here has been executed.** Every step is owner-approved as part of batch A and is run in this order. Stop at any failed check.

Batch A **does not** connect LinkedIn, publish anything, change Buffer, switch any publishing on, or cost anything.

## Labels

| Label | Meaning |
|---|---|
| 🌐 **Externally visible** | Something outside the studio changes for other people, or becomes public |
| ⛔ **Irreversible** | Some part can't be fully undone, even though the feature can be rolled back |
| ↩️ **Reversible** | Fully undone with the listed command or click |

## Verified starting point (read-only, 11 Oct 2026)

| Item | State | How checked |
|---|---|---|
| PRs | #17 `4715694` ← #18 `f596a93` ← #19 `75edc1f` ← #20 (head after this commit); all unmerged, stack linear, merges into `main` without conflict | git |
| Production database (growxera) | 19 approved, 17 in review, 1 draft, 1 rejected; 0 LinkedIn connections; none of the 6 new tables present | Supabase SQL |
| Scheduler | `studio-publish-due`, every 5 min, every run 200 with `ran:false` | `cron.job`, `net._http_response` |
| Current studio access | Website sign-in (email link) for `STUDIO_OWNER_EMAIL`: 1 verified account; last sign-in session 10 Oct 19:52 UTC; 72 owner studio actions in the last 3 days, latest 10 Oct 21:08 UTC | Supabase SQL |
| Vercel project `growx-era` | Domains: `www.growxera.com`, `growxera.com` (redirects to www), `growxera.vercel.app`. **`agent.growxera.com` not added** | Vercel API (read) |
| DNS for agent.growxera.com | Nameservers `ns1/ns2.unstoppabledomains.com`; **no record yet**. Vercel recommends CNAME `cname.vercel-dns.com` (or A `76.76.21.21`) | Vercel domain config (read) |
| Production variables (names only) | `STUDIO_OWNER_EMAIL`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. **Not set:** `STUDIO_AUTO_PUBLISH_ALLOWED`, so automatic publishing can't be switched on. `STUDIO_HOST` isn't set either, so it defaults to agent.growxera.com. `LINKEDIN` is set but unused (C5) | Vercel API (names; no values read) |
| Live HTTP checks of growxera.com | Not possible from this container (blocked by its network policy). The owner does them in step 0 | — |

## Rehearsal evidence (no production involved)

- **Migrations, in a throwaway local PostgreSQL 16.** Production runs 17; Supabase roles, storage and vault were stubbed.
  - Applied all 8 migrations in order, with a sample row standing in for production data.
  - Then applied 20261014 and 20261015 **twice**: no errors, so they are idempotent.
  - Result: the 6 new tables exist; RLS is on for every `li_` table; 0 anon/authenticated grants, even with default privileges that granted everything; existing tables' rows and columns unchanged. The settings keys are accepted and an invalid key is refused.
  - **The rollback drop** leaves existing tables, rows and columns unchanged. Re-applying afterwards works.
- **Setup link:**
  - the script refuses to run without `--confirm`;
  - its token format matches what the app accepts;
  - both use SHA-256 hex.
- **Tests (200 on the full stack):** setup-link single use, expiry and page binding; recovery during a global lockout; host 404s on www and previews; both publishing switches; the submission window.

## Step 0: before starting (read-only, owner + Claude)

1. **Owner:**
   - open `https://www.growxera.com/studio` and confirm you can reach the studio today (fallback check);
   - keep an authenticator app ready (Google Authenticator, 1Password, Authy or similar).
2. **Claude:** re-run the read-only checks above. All of these must hold:
   - 0 LinkedIn connections and 0 executions;
   - the scheduler answering `ran:false`;
   - table counts recorded.
3. Confirm no one else will merge to `main` during the window.

## Stop rule

After every step, Claude reports the check results and **stops**. The next step starts only when the owner says so. A failed or unclear check means: stop, report, and use that step's way back. Nothing continues automatically.

## Step 1 · A2: apply the two migrations · ↩️ Reversible · not externally visible

**What:** apply `20261014000000_studio_access.sql`, then `20261015000000_publishing_controls.sql`, to project growxera.

**Effect:** 6 new, empty tables. The current production code doesn't use them, so the live studio and website are unaffected.

**How:** with the Supabase connector's `apply_migration` (project `upffkhzdjphqqacfbyjp`), one call per file, with the file's exact contents. Names: `studio_access`, then `publishing_controls`. Both files are idempotent (`if not exists`), so a partial run can be re-run.

**Check query (read-only), expected values in brackets:**
```sql
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in
    ('li_settings','li_publish_authorizations','li_access_credentials','li_access_sessions',
     'li_access_setup_tokens','li_access_attempts')) as new_tables,                          -- [6]
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'li\_%'
     and not rowsecurity) as li_tables_without_rls,                                          -- [0]
  (select count(*) from information_schema.role_table_grants where table_schema = 'public'
     and table_name like 'li\_%' and grantee in ('anon','authenticated')) as browser_grants, -- [0]
  (select count(*) from public.li_settings) as settings_rows,                                -- [0] = both switches OFF
  (select json_object_agg(status, n) from (select status, count(*) n from public.li_actions group by status) t) as actions,
                                                       -- [{"approved":19,"ready_for_review":17,"draft":1,"rejected":1}]
  (select count(*) from public.li_linkedin_connection) as li_connections;                    -- [0]
```

**Checks:**
- the 6 tables exist;
- RLS is on for every `li_` table;
- 0 grants to anon or authenticated;
- the counts of existing tables equal step 0;
- **the owner opens `www.growxera.com/studio` and it still works** (the current code with the new tables present, which is the rollback target).

**Baseline (read-only, 11 Oct 06:4x UTC):**
- 6 rows in `supabase_migrations.schema_migrations` (latest `20261010213149 linkedin_app_keys`);
- 12 `li_` tables;
- 0 row-level policies on `li_` tables. That is the intended model: RLS on, no policies, so browsers get nothing and only the server's service role reads and writes.

**Expected after:** 8 history rows (`studio_access`, `publishing_controls` added), 18 `li_` tables, still 0 policies, 0 browser grants.

**If a call fails or a check doesn't match: stop. No automatic retry, no automatic drop.**
1. **Inspect** (read-only) what actually happened:
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
   select t.tablename, t.rowsecurity,
          (select count(*) from information_schema.role_table_grants g
            where g.table_schema = 'public' and g.table_name = t.tablename
              and g.grantee in ('anon','authenticated')) as browser_grants,
          (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename) as policies
   from pg_tables t
   where t.schemaname = 'public' and t.tablename in
     ('li_access_credentials','li_access_sessions','li_access_setup_tokens','li_access_attempts',
      'li_settings','li_publish_authorizations')
   order by 1;
   select indexname from pg_indexes where schemaname = 'public'
     and indexname in ('li_access_attempts_created_idx','li_publish_authorizations_action_idx');
   ```
   Row counts of any table found, and the existing-table counts against the baseline, are checked too.
2. **Classify and report to the owner:**

   | State found | Meaning | Proposed next step (owner approves) |
   |---|---|---|
   | None of the 6 tables, no new history row | Nothing applied | Re-apply the same file once |
   | `studio_access` complete (4 tables, RLS on, 0 grants, history row), `publishing_controls` absent | File 1 done | Apply file 2 only |
   | Some tables present but RLS off or browser grants > 0 | Partial apply; possible exposure (tables are empty) | Run only the missing `alter table … enable row level security` / `revoke …` lines from the file, then re-check |
   | Tables present and correct, history row missing | Applied but not recorded | Leave as is; record it in the log; don't re-run blindly |
   | Anything else, or existing-table counts changed | Unexpected | Stop; investigate before any change |

3. **Dropping is never automatic.** Only if the owner asks: drop only the named new tables, and only when they are empty (row count 0). The current production code doesn't use them, so leaving them in place is always safe.

## Step 2 · A3: domain and DNS · 🌐 Externally visible · ⛔ partly irreversible

**What:**
1. **Vercel** (Claude, with the Vercel connector's `add_project_domain`, or the owner in the dashboard): project `growx-era` → Domains → add `agent.growxera.com`, Production, no redirect.
2. **Unstoppable Domains** (the owner; no connector exists for it): growxera.com → DNS records → add:

   | Type | Host / name | Value | TTL |
   |---|---|---|---|
   | CNAME | `agent` | `cname.vercel-dns.com` | default (or 600) |

   That is Vercel's recommended value, read from its domain config on 11 Oct. If Vercel asks for an extra `TXT _vercel…` verification record, add it exactly as Vercel shows it; it is usually not needed, because growxera.com is already verified in this project.

**HTTPS readiness:** after the CNAME resolves, Vercel issues the certificate automatically. "Ready" means all of these:
- Vercel's domain config shows `misconfigured: false` (Claude checks it read-only), and the project lists the domain as verified;
- the dashboard shows "Valid Configuration" and a certificate;
- the owner opens `https://agent.growxera.com` and sees the padlock. Until step 3 it shows the current website. Claude can't open growxera.com from this container.

**Externally visible:**
- the subdomain resolves publicly;
- until step 3 it serves the current website, plus the current studio sign-in on that host;
- nothing LinkedIn-related is shown to signed-out visitors (the studio there redirects to the website sign-in).
- Keep the gap between steps 2 and 3 short.

**Irreversible part:** when Vercel issues the HTTPS certificate, the hostname `agent.growxera.com` is written to public Certificate Transparency logs **permanently**. Removing the domain later doesn't erase that record. The name reveals nothing beyond "agent"; the owner chose it knowing this.

**Checks:**
- Vercel shows the domain as **valid** with an issued certificate;
- `https://agent.growxera.com` answers over HTTPS;
- `https://www.growxera.com` is unchanged: **the owner opens www and www/studio, and both still work**.

**Stop condition:** if the domain isn't verified with a certificate, **don't merge.** DNS can take minutes to hours; wait or roll back.

**Rollback:** delete the CNAME at Unstoppable Domains and remove the domain from the Vercel project. The studio stays on www; only the Certificate Transparency entry remains.

## Step 3 · A1: merge #17 → #18 → #19 → #20 into `main` · 🌐 Externally visible · ⛔ partly irreversible

**What:** collapse the stack first, then merge once into `main`, so production deploys **once**. Merging #17 → #18 → #19 → #20 into `main` one by one would produce four production deployments, and "the previous deployment" would then be a half-merged state.
1. Note the current production deployment in Vercel (commit `8542b1e`, PR #16). This is the **rollback target**.
2. Merge #20 into its base (`claude/studio-m1-agent-host-auth`), then #19 into `claude/studio-m1-publishing-safeguards`, then #18 into `claude/linkedin-brand-growth-agent-wu375g`. These bases aren't `main`, so they only produce previews.
3. Check that #17's head now equals the reviewed stack (same tree as `770f727` or later) and that its CI and preview are green.
4. Merge #17 into `main`. **This is the one production deployment.**

**Externally visible:**
- `www.growxera.com/studio` and `/access` return **404**;
- the studio moves to `agent.growxera.com`, behind password + authenticator;
- the public website and its own sign-in don't change.

**Irreversible part:**
- The merge commits stay in the public repository's history; a revert adds new commits but doesn't remove them. The code is already public in the PRs.
- Each production deployment is recorded by Vercel.

**Checks, within minutes of "Ready":**
- `www.growxera.com/studio` → 404;
- `agent.growxera.com/studio` → the studio sign-in page;
- public pages and website sign-in work;
- the scheduler endpoint (`/api/studio/publish-due`, still called on www) keeps returning 200 with `ran:false` (Supabase `net._http_response`).

**Gap:** from here until step 4 is complete, the studio can only be reached with a setup link. The public site is unaffected, and nothing can publish: LinkedIn isn't connected and both switches are OFF.

**If any check fails:** **promote the previous production deployment** in Vercel (Deployments → previous → Promote). It is instant. The studio is back on www with today's sign-in. See Rollback.

## Step 4 · A4: setup link and first sign-in · ↩️ Reversible · not externally visible

**What:** right after step 3 is Ready, create a one-time link: single use, stored only as its SHA-256. It is valid for **2 hours** in this run, because the owner is present (the script's default is 24 h).

**Delivery (the link never appears in chat, commands, logs or Git):**
1. In this session, a local script generates the token and writes the full link to a private file in the session's scratchpad (`setup-link.txt`, mode 600). The only thing it prints is the token's SHA-256.
2. Claude inserts only that hash with the Supabase connector:
   ```sql
   insert into public.li_access_setup_tokens (token_hash, expires_at)
   values ('<sha256>', now() + interval '2 hours');
   ```
3. **How the owner opens it:** Claude's message gives only the file's path, never its contents. Tap or click the path in the Claude app; the app opens files in this session's scratchpad. Copy the link into your browser and complete the setup.
4. **Privacy:** the file lives only in this session's cloud container: outside the repository (never committed), owner-only permissions (600), deleted when the session ends. Only someone signed in to your Claude account with access to this session could open it. Claude never prints, sends or attaches it, and never runs a command that shows it.
5. **Deleted immediately after setup succeeds:** Claude deletes it and shows that it is gone (`ls` reports no such file). It is also deleted if setup is abandoned or the link is invalidated.
6. **Residual exposure:** opening the link sends the token as a URL parameter to agent.growxera.com, so Vercel's request log for that single request may contain it. It is single use and expires in 2 hours, so once setup completes, the logged value can't be used.

**Exposed? Invalidate immediately** (works whether the link was used or not):
```sql
update public.li_access_setup_tokens set used_at = now() where used_at is null;  -- kills every unused link
select count(*) from public.li_access_credentials;                               -- 1 after the owner's setup
```
If someone else may already have used it, create a new link and complete it yourself. That replaces the password and authenticator and signs out every session (tested). Then use **Sign out everywhere**.

**Other ways to create the link:**
- With the service key: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/studio-setup-link.mjs --confirm`, from a local shell with the production values.
- In the Supabase SQL editor: generate a random token locally, then insert only its hash:
  ```sql
  insert into public.li_access_setup_tokens (token_hash, expires_at)
  values ('<sha256 hex of the token>', now() + interval '24 hours');
  ```
  The link is `https://agent.growxera.com/access/setup?token=<token>`.

The link is a secret. Deliver it to the owner privately, never in chat logs, issues, commits or docs.

**Owner:** open the link, choose a password (12+ characters), scan the QR code, enter the 6-digit code. You are signed in.

**Checks:** the owner reaches `/studio` on agent.growxera.com. Capabilities shows **All publishing: OFF** and **Automatic publishing: OFF**.

**Recovery:**

| Situation | Do this |
|---|---|
| Link expired or already used | Create a new link (same step). Nothing else changes |
| Link possibly leaked before use | Invalidate unused links: `update public.li_access_setup_tokens set used_at = now() where used_at is null;` then create a new one |
| Link used by someone else | Create a new link and complete it: it replaces the password and authenticator and signs out every session (tested) |
| Setup keeps failing | Promote the previous deployment (step 3) and investigate |
| Later: lost authenticator, forgotten password, lockout | A new link (gated). It skips the lockout, replaces both, signs out everything else (tested) |

## Step 5 · A5: LinkedIn redirect URL · ↩️ Reversible · not publicly visible (external account setting)

**What:** LinkedIn Developers → your app → Auth → **add** `https://agent.growxera.com/studio/linkedin/callback`. **Keep** the existing www callback; rollback needs it.

**Checks:** both URLs are listed. Nothing is connected: connecting is batch B1.

## After go-live

- Download the first weekly export (Studio → Backup) and keep it privately.
- **Restore is not supported yet:** not into Supabase, not into production. Only a local round trip is tested, and media files aren't in the export.

## Rollback (any time after step 3)

**During batch A** (LinkedIn not connected):
1. Promote the previous production deployment in Vercel (instant), or revert the merge commits on GitHub (needs a new deployment).
2. The studio is back at `www.growxera.com/studio` with today's website sign-in for `STUDIO_OWNER_EMAIL`.
3. **No database change is needed.**
   - The old code ignores the 6 new tables.
   - Every row the new code writes uses existing values. A held post is `ready_for_review` with a reason, and there are no new statuses.
   - Dropping the new tables is optional, and only after the code rollback (rehearsed: existing data unaffected).
4. Optional: remove `agent.growxera.com` from Vercel and its DNS record (the CT log entry stays).

**Verification status**

| Claim | Status | Evidence / how it gets verified |
|---|---|---|
| Today's www studio login works | **Verified from the database, not over HTTP** | 3 live, unexpired website sessions; owner activity on 10 Oct. The owner confirms it in the browser in step 0 |
| The old code keeps working with the 6 new tables present | **Unverified end-to-end; verified by analysis** | The old code never references them, and no new status values are written. The owner checks www/studio **after step 1** in production; that is the end-to-end check of the rollback target |
| Adding agent.growxera.com doesn't affect www | **Unverified end-to-end** | Vercel domains are independent, and www's record and config aren't touched. The owner checks www and www/studio **after step 2** |
| Promoting the previous deployment restores the www login | **Unverified end-to-end** (never exercised on this project) | The target is exactly today's production (`8542b1e`), with step 1 having shown it works with the new tables; one production deploy only (step 3), so "previous" is that target. If the Vercel plan allows only instant rollback to the immediately previous deployment, that is the one needed |
| The rollback drop doesn't affect existing data | Verified in rehearsal only | Throwaway local PostgreSQL 16 |

**After batch B1** (LinkedIn connected), **first:**
- `select cron.unschedule('studio-publish-due');`
- **Disconnect** LinkedIn on Capabilities.

The reason: the code on today's `main` publishes approved posts automatically within 3 hours of their time and doesn't know the new switches.

## Not in batch A (for reference)

- **B1:** connect LinkedIn.
- **B2:** one manual live test, with all publishing ON only for the test.
- **B3:** automatic publishing, which needs:
  - the scheduler change below;
  - one **manually approved live test of the timed submission**;
  - `STUDIO_AUTO_PUBLISH_ALLOWED=true`;
  - both switches ON.

Until then, automatic publishing stays disabled.

### B3 scheduler change (separate approval, not now)

Every 15 seconds. It calls the app only when an authorized, approved post is due within 75 seconds or overdue; overdue posts are held.
```sql
select cron.unschedule('studio-publish-due');
select cron.schedule('studio-publish-due', '15 seconds', $$
  select net.http_post(
    url := 'https://www.growxera.com/api/studio/publish-due',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'studio_cron_secret'))
  )
  where exists (
    select 1 from public.li_publish_authorizations a
    join public.li_actions x on x.id = a.action_id and x.status = 'approved'
    where a.decision = 'authorized'
      and a.target_at <= now() + interval '75 seconds'
      and a.created_at = (select max(b.created_at) from public.li_publish_authorizations b where b.action_id = a.action_id)
  );
$$);
```
Rollback: `select cron.unschedule('studio-publish-due');`, then re-create the 5-minute job (LINKEDIN_PUBLISHING.md). This SQL is to be rehearsed in a throwaway database before B3.
