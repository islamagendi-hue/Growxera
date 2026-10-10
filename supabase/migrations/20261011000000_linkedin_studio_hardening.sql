-- LinkedIn Growth Studio hardening. Additive; apply after 20261010000000_linkedin_studio.sql.

-- ── Defence in depth: the browser roles get nothing on li_* tables ──────────
-- RLS with no policies already blocks anon/authenticated; revoking grants means a future
-- accidental policy still can't expose these tables through the public API.
revoke all on public.li_content, public.li_metrics_snapshots, public.li_drafts, public.li_draft_versions,
  public.li_actions, public.li_approvals, public.li_executions, public.li_llm_usage, public.li_audit_log
  from anon, authenticated;

-- ── Integrity ───────────────────────────────────────────────────────────────
-- Wrapped so re-running the migration is harmless.
do $$ begin
  alter table public.li_draft_versions add constraint li_draft_versions_version_chk check (version >= 1);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.li_draft_versions add constraint li_draft_versions_hash_chk check (content_hash ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.li_approvals add constraint li_approvals_hash_chk check (content_hash ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $$;
-- A LinkedIn post link can belong to only one history row.
create unique index if not exists li_content_external_url_uidx on public.li_content (external_url) where external_url is not null;

-- ── Durable copies of post media ────────────────────────────────────────────
-- Images and PDFs referenced by drafts and history are copied into this project's
-- private Storage bucket, verified by SHA-256, and served only to the owner via /studio.
create table if not exists public.li_assets (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  original_url    text not null,
  storage_path    text,
  sha256          text,
  bytes           integer,
  content_type    text,
  copied_at       timestamptz,
  verified_at     timestamptz,
  last_error      text
);
create unique index if not exists li_assets_original_uidx on public.li_assets (original_url);
alter table public.li_assets enable row level security;
revoke all on public.li_assets from anon, authenticated;

-- Private bucket (not public): files are read with the service key on the server only.
insert into storage.buckets (id, name, public)
values ('li-studio-assets', 'li-studio-assets', false)
on conflict (id) do nothing;
