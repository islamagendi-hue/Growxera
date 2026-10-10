-- LinkedIn Growth Studio: direct publishing connection. Additive; apply after
-- 20261011000000_linkedin_studio_hardening.sql.
--
-- One row per authorization of the owner's LinkedIn account (Share on LinkedIn product,
-- scopes openid profile w_member_social). The access token is encrypted by the app
-- (AES-256-GCM, key derived from LINKEDIN_CLIENT_SECRET, which is never stored here),
-- so a copy of the database alone can't post to LinkedIn.
create table if not exists public.li_linkedin_connection (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  member_urn       text not null check (member_urn ~ '^urn:li:person:[A-Za-z0-9_-]+$'),
  member_name      text,
  scopes           text not null,
  access_token_enc text,
  expires_at       timestamptz not null,
  revoked_at       timestamptz
);
create index if not exists li_linkedin_connection_created_idx on public.li_linkedin_connection (created_at desc);

alter table public.li_linkedin_connection enable row level security;
revoke all on public.li_linkedin_connection from anon, authenticated;

-- ── Scheduler secret ────────────────────────────────────────────────────────
-- The scheduler (pg_cron + pg_net, see docs/linkedin-agent/LINKEDIN_PUBLISHING.md) sends a
-- secret kept in Supabase Vault under the name 'studio_cron_secret'. The app checks it with
-- this function, so the secret never has to be copied anywhere. Server (service role) only.
create or replace function public.li_check_cron_secret(token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(token) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets where name = 'studio_cron_secret' and decrypted_secret = token
  );
$$;
revoke all on function public.li_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.li_check_cron_secret(text) to service_role;
