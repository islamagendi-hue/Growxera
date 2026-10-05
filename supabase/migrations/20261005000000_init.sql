-- Growx Era: Growth Diagnostic data model.
-- All tables have RLS enabled with NO policies: only the server (service role)
-- can read or write. Never expose the service-role key to the browser.

create extension if not exists pgcrypto;

-- ── Leads ───────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  source                 text not null check (source in ('diagnostic', 'contact')),
  status                 text not null default 'new'
                           check (status in ('new', 'contacted', 'qualified', 'booked', 'won', 'lost', 'unsubscribed')),
  name                   text not null,
  email                  text not null,
  company                text not null,
  phone                  text,
  job_title              text,
  website                text,
  message                text,
  diagnostic_session_id  uuid,
  anonymous_id           uuid,
  overall_score          smallint,
  bottleneck             text,
  -- Consent snapshot (full history in consent_records)
  consent_processing     boolean not null,
  consent_marketing      boolean not null default false,
  consent_policy_version text not null,
  consent_at             timestamptz not null,
  -- Attribution (last touch; first touch kept as JSON)
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,
  landing_page text,
  first_touch  jsonb,
  last_activity_at timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));

-- ── Diagnostic sessions ─────────────────────────────────────────────────────
create table if not exists public.diagnostic_sessions (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  completed_at                timestamptz,
  status                      text not null default 'completed' check (status in ('started', 'completed')),
  anonymous_id                uuid,
  lead_id                     uuid references public.leads(id) on delete set null,
  -- Business information (denormalised for reporting; full answers in `answers`)
  business_model              text,
  industry                    text,
  primary_market              text,
  currency                    text,
  monthly_revenue             numeric,
  answers                     jsonb not null,
  -- Results
  scores                      jsonb not null,          -- { market: 62, value: 59, ... }
  report                      jsonb not null,          -- full DiagnosticReport incl. opportunities & estimates
  overall_score               smallint not null,
  stage                       text not null,
  bottleneck                  text not null,
  strongest                   text,
  weakest                     text,
  estimated_opportunity_low   numeric,
  estimated_opportunity_high  numeric,
  scoring_version             text not null,
  -- Attribution
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,
  landing_page text,
  first_touch  jsonb
);
create index if not exists diagnostic_sessions_created_at_idx on public.diagnostic_sessions (created_at desc);
create index if not exists diagnostic_sessions_lead_idx on public.diagnostic_sessions (lead_id);

-- leads.diagnostic_session_id is a soft reference (no FK) so a lead is never
-- lost if its diagnostic row failed to store.

-- ── Consent records (append-only audit trail) ───────────────────────────────
create table if not exists public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  lead_id        uuid references public.leads(id) on delete cascade,
  anonymous_id   uuid,
  purpose        text not null check (purpose in ('processing', 'marketing', 'analytics')),
  granted        boolean not null,
  policy_version text not null,
  wording        text not null,
  source         text
);
create index if not exists consent_records_lead_idx on public.consent_records (lead_id);

-- ── Analytics events (pseudonymous, consented visitors only) ────────────────
create table if not exists public.analytics_events (
  id                    bigint generated always as identity primary key,
  created_at            timestamptz not null default now(),
  client_ts             text,
  event                 text not null,
  anonymous_id          uuid not null,
  diagnostic_session_id uuid,
  properties            jsonb not null default '{}',
  page_path             text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  referrer     text,
  landing_page text
);
create index if not exists analytics_events_event_time_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_anon_idx on public.analytics_events (anonymous_id);

-- ── Row level security: deny all to anon/authenticated ──────────────────────
alter table public.leads               enable row level security;
alter table public.diagnostic_sessions enable row level security;
alter table public.consent_records     enable row level security;
alter table public.analytics_events    enable row level security;

-- ── Reporting views for the future admin dashboard ──────────────────────────
create or replace view public.v_diagnostic_kpis with (security_invoker = true) as
select
  (select count(distinct anonymous_id) from public.analytics_events where event = 'diagnostic_started') as diagnostics_started,
  (select count(*) from public.diagnostic_sessions)                                                  as diagnostics_completed,
  (select count(*) from public.leads where source = 'diagnostic' and deleted_at is null)             as diagnostic_leads,
  (select round(avg(overall_score), 1) from public.diagnostic_sessions)                              as average_growth_score,
  (select sum(estimated_opportunity_low) from public.diagnostic_sessions)                            as estimated_opportunity_low_total;

create or replace view public.v_bottlenecks with (security_invoker = true) as
select bottleneck, count(*) as diagnostics, round(avg(overall_score), 1) as avg_score
from public.diagnostic_sessions group by bottleneck order by diagnostics desc;

create or replace view public.v_industries with (security_invoker = true) as
select industry, count(*) as diagnostics, count(lead_id) as leads, round(avg(overall_score), 1) as avg_score
from public.diagnostic_sessions group by industry order by diagnostics desc;

create or replace view public.v_utm_performance with (security_invoker = true) as
select
  coalesce(utm_source, '(direct)') as utm_source,
  coalesce(utm_medium, '(none)')   as utm_medium,
  coalesce(utm_campaign, '(none)') as utm_campaign,
  count(*)                         as diagnostics,
  count(lead_id)                   as leads,
  round(100.0 * count(lead_id) / nullif(count(*), 0), 1) as lead_conversion_pct,
  round(avg(overall_score), 1)     as avg_score
from public.diagnostic_sessions
group by 1, 2, 3
order by diagnostics desc;

create or replace view public.v_funnel_daily with (security_invoker = true) as
select date_trunc('day', created_at) as day, event, count(*) as events, count(distinct anonymous_id) as visitors
from public.analytics_events
group by 1, 2
order by 1 desc, 2;

-- ── Retention (see docs/PRIVACY_AND_CONSENT.md) ─────────────────────────────
-- Schedule daily with pg_cron:  select cron.schedule('purge', '0 3 * * *', 'select public.purge_expired_data()');
create or replace function public.purge_expired_data(
  anonymous_diagnostics_days int default 180,
  leads_days int default 730,
  events_days int default 395
) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.diagnostic_sessions
    where lead_id is null and created_at < now() - make_interval(days => anonymous_diagnostics_days);
  delete from public.leads
    where last_activity_at < now() - make_interval(days => leads_days);
  delete from public.analytics_events
    where created_at < now() - make_interval(days => events_days);
  -- Soft-deleted leads (erasure requests) are removed for good after 30 days.
  delete from public.leads where deleted_at is not null and deleted_at < now() - interval '30 days';
end $$;
revoke all on function public.purge_expired_data(int, int, int) from public, anon, authenticated;

-- Erasure request helper: removes a person's lead, consents and linked diagnostics.
create or replace function public.erase_lead_by_email(target_email text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.diagnostic_sessions where lead_id in (select id from public.leads where lower(email) = lower(target_email));
  delete from public.leads where lower(email) = lower(target_email);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.erase_lead_by_email(text) from public, anon, authenticated;
