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
