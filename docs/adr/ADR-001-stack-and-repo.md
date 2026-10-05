# ADR-001: Stack and repository layout

**Status:** Accepted · 2026-10-05

## Context
The repo already runs the Growx Era website on Next.js 16, Tailwind 4, Supabase and Vercel. The brief asks to reuse existing infrastructure where sound and not to break what exists. LeanApp needs a dashboard, an ingestion API and background processing, and will grow into separate services.

## Decision
- Build LeanApp as a separate Next.js 16 app in `apps/platform` with its own `package.json` and lockfile (no npm workspaces), and SDKs in `sdks/`. The root site's install, build and deploy are unchanged; root tooling excludes `apps/` and `sdks/`.
- Use Postgres directly through `pg` (not the Supabase REST client) because the design depends on transactions, `SET LOCAL ROLE` and RLS session settings. Any Postgres works, Supabase included.
- Keep business logic in framework-free modules (`src/modules`) so ingestion and processing can move to a separate service without rewriting.

## Consequences
- One language and one deployment target for phase 1; fast to ship.
- Two lockfiles in one repo; CI installs each separately.
- Moving to workspaces or a separate repo later is mechanical.
