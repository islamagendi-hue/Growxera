-- LinkedIn Growth Studio: its own sign-in (email + password + authenticator code) on the
-- studio's own address. Additive. Same model as the other li_* tables: RLS on, no policies,
-- no browser grants; only the server (service role) reads or writes.

-- One owner credential. password_hash: scrypt. totp_secret_enc: AES-256-GCM, key derived from
-- SUPABASE_SERVICE_ROLE_KEY (never stored here). totp_last_step blocks reuse of a code.
create table if not exists public.li_access_credentials (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  email            text not null,
  password_hash    text not null check (password_hash like 'scrypt$%'),
  totp_secret_enc  text not null check (totp_secret_enc like 'v1.%'),
  totp_last_step   bigint not null default 0
);

-- Sessions: only the SHA-256 of the cookie value is stored.
create table if not exists public.li_access_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  user_agent  text
);

-- One-time links to set (or reset) the password and authenticator. SHA-256 only.
create table if not exists public.li_access_setup_tokens (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Sign-in attempts, for the lockout after repeated failures. ip_hash: SHA-256, not the IP.
create table if not exists public.li_access_attempts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  ok          boolean not null,
  ip_hash     text
);
create index if not exists li_access_attempts_created_idx on public.li_access_attempts (created_at desc);

alter table public.li_access_credentials  enable row level security;
alter table public.li_access_sessions     enable row level security;
alter table public.li_access_setup_tokens enable row level security;
alter table public.li_access_attempts     enable row level security;
revoke all on public.li_access_credentials, public.li_access_sessions, public.li_access_setup_tokens, public.li_access_attempts
  from anon, authenticated;
