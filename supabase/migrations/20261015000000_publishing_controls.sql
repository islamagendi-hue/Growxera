-- LinkedIn Growth Studio: publishing controls. Additive; apply after 20261013000000_linkedin_app_keys.sql.
-- Owner decisions G1/G2 (10 Oct 2026): automatic publishing needs a global switch (default OFF) and a
-- separate, per-post authorization; missed posts are held, never published late. See
-- src/lib/studio/autopublish.ts. NOT applied to production: needs the owner's approval.

-- Studio settings. Keys: 'publishing_enabled' (the all-publishing switch, owner decision P2, blocks
-- manual and automatic publishing) and 'auto_publish_enabled'. The app reads a missing table, row
-- or any value other than JSON true as "OFF".
create table if not exists public.li_settings (
  key         text primary key check (key ~ '^[a-z_]{3,64}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text not null
);

-- Append-only decisions to publish automatically. Valid only while the latest row for the action
-- is 'authorized' and its version, hash and planned time equal the current version's.
create table if not exists public.li_publish_authorizations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  action_id     uuid not null references public.li_actions(id) on delete cascade,
  version_id    uuid not null references public.li_draft_versions(id) on delete cascade,
  content_hash  text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  target_at     timestamptz not null,
  decision      text not null check (decision in ('authorized', 'revoked')),
  reason        text,
  decided_by    text not null
);
create index if not exists li_publish_authorizations_action_idx on public.li_publish_authorizations (action_id, created_at desc);

alter table public.li_settings enable row level security;
alter table public.li_publish_authorizations enable row level security;
revoke all on public.li_settings, public.li_publish_authorizations from anon, authenticated;
