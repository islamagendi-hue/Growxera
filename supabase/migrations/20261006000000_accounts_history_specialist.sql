-- Growx Era: accounts, passwordless sign-in, diagnostic history and advisor requests.
-- Additive only: new tables and nullable columns. Existing rows and code keep working.
-- Same security model as the init migration: RLS on, no policies, server-only access.

-- ── Accounts ────────────────────────────────────────────────────────────────
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  email          text not null,
  name           text not null,
  company        text not null,
  job_title      text,
  phone          text,
  website        text,
  verified_at    timestamptz,
  last_login_at  timestamptz,
  deleted_at     timestamptz
);
create unique index if not exists accounts_email_uidx on public.accounts (lower(email));

-- ── One-time sign-in links ──────────────────────────────────────────────────
-- Only a SHA-256 hash of the token is stored, so a database leak can't be used to sign in.
create table if not exists public.auth_tokens (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  token_hash             text not null,
  email                  text not null,
  account_id             uuid references public.accounts(id) on delete cascade,
  purpose                text not null check (purpose in ('login', 'signup', 'report')),
  -- Pending signup details, applied when the link is used.
  pending                jsonb,
  diagnostic_session_id  uuid,
  redirect_to            text,
  expires_at             timestamptz not null,
  used_at                timestamptz
);
create unique index if not exists auth_tokens_hash_uidx on public.auth_tokens (token_hash);
create index if not exists auth_tokens_email_idx on public.auth_tokens (lower(email), created_at desc);

-- ── Sessions ────────────────────────────────────────────────────────────────
create table if not exists public.auth_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  token_hash    text not null,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  user_agent    text
);
create unique index if not exists auth_sessions_hash_uidx on public.auth_sessions (token_hash);
create index if not exists auth_sessions_account_idx on public.auth_sessions (account_id);

-- ── Diagnostic history ──────────────────────────────────────────────────────
alter table public.diagnostic_sessions add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.diagnostic_sessions add column if not exists context jsonb;       -- industry → model → type → category → geography → city
alter table public.diagnostic_sessions add column if not exists data_upload jsonb;   -- summary of an uploaded file (never the raw file)
create index if not exists diagnostic_sessions_account_idx on public.diagnostic_sessions (account_id, completed_at desc);

alter table public.leads add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Consent given at account signup (no lead row), and the 'signup' source.
alter table public.consent_records add column if not exists account_id uuid references public.accounts(id) on delete cascade;

-- ── Advisor questions and consultation bookings ─────────────────────────
create table if not exists public.advisor_requests (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  kind                   text not null check (kind in ('question', 'consultation')),
  status                 text not null default 'new' check (status in ('new', 'confirmed', 'answered', 'completed', 'cancelled', 'no_show')),
  account_id             uuid references public.accounts(id) on delete set null,
  diagnostic_session_id  uuid references public.diagnostic_sessions(id) on delete set null,
  name                   text not null,
  email                  text not null,
  company                text not null,
  topic                  text,
  message                text,
  slot_start             timestamptz,
  slot_minutes           smallint,
  timezone               text
);
create index if not exists advisor_requests_created_idx on public.advisor_requests (created_at desc);
-- One booking per slot: a second request for the same time fails instead of double-booking.
create unique index if not exists advisor_requests_slot_uidx on public.advisor_requests (slot_start)
  where kind = 'consultation' and status in ('new', 'confirmed');

alter table public.accounts            enable row level security;
alter table public.auth_tokens         enable row level security;
alter table public.auth_sessions       enable row level security;
alter table public.advisor_requests enable row level security;

-- ── Reporting ───────────────────────────────────────────────────────────────
create or replace view public.v_advisor_pipeline with (security_invoker = true) as
select r.created_at, r.kind, r.status, r.name, r.email, r.company, r.topic, r.slot_start,
       d.overall_score, d.bottleneck, d.industry
from public.advisor_requests r
left join public.diagnostic_sessions d on d.id = r.diagnostic_session_id
order by r.created_at desc;

-- ── Retention and erasure, extended to the new tables ──────────────────────
create or replace function public.purge_expired_data(
  anonymous_diagnostics_days int default 180,
  leads_days int default 730,
  events_days int default 395
) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.diagnostic_sessions
    where lead_id is null and account_id is null and created_at < now() - make_interval(days => anonymous_diagnostics_days);
  delete from public.leads
    where last_activity_at < now() - make_interval(days => leads_days);
  delete from public.analytics_events
    where created_at < now() - make_interval(days => events_days);
  delete from public.leads where deleted_at is not null and deleted_at < now() - interval '30 days';
  delete from public.auth_tokens where expires_at < now() - interval '1 day';
  delete from public.auth_sessions where expires_at < now() or revoked_at < now() - interval '1 day';
end $$;
revoke all on function public.purge_expired_data(int, int, int) from public, anon, authenticated;

create or replace function public.erase_lead_by_email(target_email text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.diagnostic_sessions
    where lead_id in (select id from public.leads where lower(email) = lower(target_email))
       or account_id in (select id from public.accounts where lower(email) = lower(target_email));
  delete from public.advisor_requests where lower(email) = lower(target_email);
  delete from public.leads where lower(email) = lower(target_email);
  get diagnostics n = row_count;
  delete from public.accounts where lower(email) = lower(target_email);
  delete from public.auth_tokens where lower(email) = lower(target_email);
  return n;
end $$;
revoke all on function public.erase_lead_by_email(text) from public, anon, authenticated;
