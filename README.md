# Growx Era

Website and **Growth Diagnostic** for Growx Era, the Growth & Transformation Partner for ambitious GCC businesses.

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase Postgres · Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: without Supabase, data goes to .data/*.jsonl
npm run dev
```

`npm test` runs the scoring-engine tests · `npm run lint` · `npm run typecheck` · `npm run build`.

## Where things live

| Path | What |
| --- | --- |
| `src/lib/diagnostic/questions.ts` | Question bank, steps/screens, validation |
| `src/lib/diagnostic/config.ts` | **Weights, stages, benchmark curves, opportunity library, scenario assumptions**: tune here |
| `src/lib/diagnostic/scoring.ts` | Dimension signals and scoring |
| `src/lib/diagnostic/engine.ts` | Bottleneck (Impact × Severity × Dependency), opportunities, report |
| `src/lib/diagnostic/estimates.ts` | Opportunity calculator |
| `src/lib/analytics/` | Event taxonomy, client tracking, UTM attribution |
| `src/lib/server/` | Storage, validation schemas, rate limiting |
| `src/app/api/` | `diagnostic`, `leads`, `events` route handlers |
| `supabase/migrations/` | Database schema, dashboard views, retention functions |
| `docs/` | [MVP scope & launch gates](docs/MVP_SCOPE.md), [Data model](docs/DATA_MODEL.md), [Privacy & consent](docs/PRIVACY_AND_CONSENT.md) |

## Changing the scoring

Edit `config.ts`, bump `SCORING_VERSION`, run `npm test`. Each stored diagnostic records the version it was scored with.

## Content rules

No invented testimonials, logos, case studies, results, team members or certifications. Placeholders must be visibly marked.
