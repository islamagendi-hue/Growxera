-- LinkedIn Growth Studio (private, owner-only): content history, drafts, approvals, executions.
-- Additive only: new li_* tables. Nothing existing changes.
-- Same security model as the other migrations: RLS on, no policies, server-only access.
--
-- Separation (docs/linkedin-agent/PLAN.md): content and metrics, drafts and versions,
-- approvals, executions and the audit log each live in their own table.

-- ── Content that exists or existed on LinkedIn ──────────────────────────────
-- Imported history (authorized exports) and, later, content this studio published.
create table if not exists public.li_content (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('post', 'newsletter', 'comment', 'reply')),
  text            text not null,
  language        text,
  published_at    timestamptz,
  external_url    text,
  -- Provenance: where this row came from and its id there. Unique, so imports are idempotent.
  source          text not null check (source in ('buffer_export', 'linkedin_export', 'manual', 'studio')),
  source_id       text not null,
  -- How it was originally published: natively on LinkedIn or through a tool.
  published_via   text,
  assets          jsonb not null default '[]'::jsonb,
  imported_at     timestamptz not null default now()
);
create unique index if not exists li_content_source_uidx on public.li_content (source, source_id);
create index if not exists li_content_published_idx on public.li_content (published_at desc);

-- Append-only metric readings. Lifetime totals from exports are flagged so they are never
-- compared with 7-day numbers as if they were the same thing.
create table if not exists public.li_metrics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  content_id      uuid not null references public.li_content(id) on delete cascade,
  measured_at     timestamptz not null,
  window_kind     text not null check (window_kind in ('lifetime', '7d', '24h')),
  source          text not null,
  impressions     integer,
  reach           integer,
  reactions       integer,
  comments        integer,
  shares          integer,
  engagement_rate numeric
);
create unique index if not exists li_metrics_uidx on public.li_metrics_snapshots (content_id, source, measured_at);

-- ── Drafts and immutable versions ───────────────────────────────────────────
create table if not exists public.li_drafts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('post', 'newsletter', 'comment', 'reply')),
  title           text,
  current_version uuid,
  -- Where the draft came from: 'migrated_buffer', 'grok', 'claude', 'manual'.
  origin          text not null,
  origin_ref      text,
  notes           text
);
create unique index if not exists li_drafts_origin_uidx on public.li_drafts (origin, origin_ref) where origin_ref is not null;

create table if not exists public.li_draft_versions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  draft_id        uuid not null references public.li_drafts(id) on delete cascade,
  version         integer not null,
  text            text not null,
  assets          jsonb not null default '[]'::jsonb,
  target_at       timestamptz,
  -- SHA-256 of the canonical content (text, assets, target). Approvals bind to this.
  content_hash    text not null,
  author          text not null,
  change_note     text
);
create unique index if not exists li_draft_versions_uidx on public.li_draft_versions (draft_id, version);

-- ── Proposed external actions ───────────────────────────────────────────────
create table if not exists public.li_actions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  draft_id        uuid not null references public.li_drafts(id) on delete cascade,
  kind            text not null check (kind in ('publish_post', 'publish_newsletter', 'reply', 'comment')),
  -- How it is executed: a verified LinkedIn API capability, or a manual step by the owner.
  channel         text not null check (channel in ('linkedin_api', 'manual')),
  status          text not null check (status in (
                    'draft', 'ready_for_review', 'approved', 'executed', 'verified',
                    'rejected', 'needs_revision', 'failed', 'blocked')),
  status_reason   text,
  sensitive       boolean not null default false,
  -- Schedule carried over from a migrated source (kept for reference, never auto-used).
  original_due_at timestamptz,
  target_url      text
);
create index if not exists li_actions_status_idx on public.li_actions (status, updated_at desc);
create unique index if not exists li_actions_draft_uidx on public.li_actions (draft_id);

-- Append-only decisions. An approval is valid only while content_hash equals the
-- current version's hash; any edit makes a new version and so voids it.
create table if not exists public.li_approvals (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  action_id       uuid not null references public.li_actions(id) on delete cascade,
  version_id      uuid not null references public.li_draft_versions(id) on delete cascade,
  content_hash    text not null,
  decision        text not null check (decision in ('approved', 'rejected', 'needs_revision', 'revoked')),
  reason          text,
  decided_by      text not null
);
create index if not exists li_approvals_action_idx on public.li_approvals (action_id, created_at desc);

-- One row per execution. The idempotency key (action + approved hash) is unique, so the
-- same approved content can never be executed twice, even by concurrent requests.
create table if not exists public.li_executions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  action_id       uuid not null references public.li_actions(id) on delete cascade,
  idempotency_key text not null,
  content_hash    text not null,
  channel         text not null,
  result          text not null check (result in ('executed', 'failed', 'unknown')),
  external_url    text,
  error           text,
  verified_at     timestamptz,
  verification    text
);
create unique index if not exists li_executions_key_uidx on public.li_executions (idempotency_key);
create index if not exists li_executions_hash_idx on public.li_executions (content_hash);

-- ── Model usage (spending limit enforcement) ────────────────────────────────
create table if not exists public.li_llm_usage (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  provider        text not null,
  model           text not null,
  purpose         text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  cost_usd        numeric not null
);
create index if not exists li_llm_usage_month_idx on public.li_llm_usage (created_at);

-- ── Audit log ───────────────────────────────────────────────────────────────
create table if not exists public.li_audit_log (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  actor           text not null,
  event           text not null,
  entity          text not null,
  entity_id       text,
  detail          jsonb
);
create index if not exists li_audit_log_created_idx on public.li_audit_log (created_at desc);

alter table public.li_content           enable row level security;
alter table public.li_metrics_snapshots enable row level security;
alter table public.li_drafts            enable row level security;
alter table public.li_draft_versions    enable row level security;
alter table public.li_actions           enable row level security;
alter table public.li_approvals         enable row level security;
alter table public.li_executions        enable row level security;
alter table public.li_llm_usage         enable row level security;
alter table public.li_audit_log         enable row level security;
