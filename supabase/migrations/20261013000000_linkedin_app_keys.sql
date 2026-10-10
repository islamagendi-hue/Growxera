-- LinkedIn Growth Studio: LinkedIn app keys entered on the Capabilities page (used when the
-- LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET env vars aren't set). Additive.
-- The client secret is encrypted by the app (AES-256-GCM) with a key derived from
-- SUPABASE_SERVICE_ROLE_KEY, which is never stored in the database.
create table if not exists public.li_linkedin_app (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  client_id         text not null check (client_id ~ '^[A-Za-z0-9]{8,64}$'),
  client_secret_enc text not null check (client_secret_enc like 'v1.%')
);
create index if not exists li_linkedin_app_created_idx on public.li_linkedin_app (created_at desc);

alter table public.li_linkedin_app enable row level security;
revoke all on public.li_linkedin_app from anon, authenticated;
