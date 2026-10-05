# Data and storage

## Choice: Supabase Postgres, written only from the server

- Relational data (leads ↔ diagnostic sessions ↔ consents) with JSONB for answers and reports, so the question bank can change without migrations.
- The app talks to Supabase's REST API from Next.js route handlers using the **service-role key**, which never reaches the browser. All tables have **RLS enabled with no policies**, so the public `anon` key can read nothing.
- SQL views provide the future admin dashboard without extra infrastructure.
- No new runtime dependency: `src/lib/server/store.ts` uses `fetch`.

Fallbacks: without Supabase env vars, development appends rows to `.data/<table>.jsonl`; production stores nothing and logs a warning (never personal data). The visitor still gets their result.

## Setup

1. Create a Supabase project (pick the region with counsel; see PRIVACY_AND_CONSENT.md).
2. Apply `supabase/migrations/20261005000000_init.sql` (SQL editor or `supabase db push`).
3. In Vercel → Project → Settings → Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview.
4. Optional: enable pg_cron and schedule `select public.purge_expired_data();` daily.

## Tables

| Table | One row per | Key columns |
| --- | --- | --- |
| `diagnostic_sessions` | completed diagnostic | business model, industry, market, currency, `answers` (JSONB), `scores` (JSONB), `report` (full JSONB), overall score, stage, bottleneck, strongest, weakest, estimated opportunity low/high, `scoring_version`, UTM fields, referrer, landing page, `first_touch`, `lead_id` |
| `leads` | person who shared details | name, email, company, phone, job title, website, message, `source` (diagnostic/contact), `status` pipeline, consent snapshot (processing, marketing, policy version, timestamp), UTM fields, `diagnostic_session_id` |
| `consent_records` | consent decision | purpose (processing/marketing/analytics), granted, policy version, exact wording shown, timestamp. Append-only audit trail |
| `analytics_events` | funnel event (consented visitors) | event, anonymous id, session id, properties, page, UTM fields. No IP address |

Attribution: the last touch is stored in columns, the first touch as JSON (`first_touch`), so both models are available.

`scoring_version` is stored with every session so historical scores stay interpretable after weights change.

## Dashboard views

| View | Answers |
| --- | --- |
| `v_diagnostic_kpis` | Diagnostics started / completed, leads, average score, total estimated opportunity |
| `v_bottlenecks` | Most common bottlenecks |
| `v_industries` | Diagnostics, leads and average score by industry |
| `v_utm_performance` | Diagnostics, leads, lead conversion and score by source / medium / campaign |
| `v_funnel_daily` | Daily counts per funnel event |

Completion rate = `diagnostics_completed / diagnostics_started` (starts come from consented analytics, so this slightly overstates the true rate).

## API

| Route | Does |
| --- | --- |
| `POST /api/diagnostic` | Validates answers against the question bank, scores them, stores the session, returns the **preview** (score, stage, bottleneck, breakdown) |
| `POST /api/leads` | Validates the lead (zod), records consents, links the session, optionally notifies `LEAD_WEBHOOK_URL`, returns the **full report** |
| `POST /api/events` | Stores a validated analytics event (only sent after consent) |

All three are rate-limited per instance; add a Vercel Firewall rule for hard limits.
