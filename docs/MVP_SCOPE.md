# MVP scope and launch gates

The MVP is the smallest version of the site that can run the full commercial journey end to end:
**visit → diagnostic → score → lead → booking**, with attribution, consent and stored data.

## In scope (built in this release)

| Area | What ships |
| --- | --- |
| Website | Home (all sections in the brief), How we work, Services, Case studies (marked placeholders), Contact, Privacy notice, 404 |
| Growth Diagnostic | 6 sections, 14 short screens, adapts to 4 business models, "I don't know" on every metric, progress saved in the tab, derived-metric suggestions (AOV, CAC, conversion) |
| Scoring engine | 7 dimensions (0–100), configurable weights and stages, dependency-aware bottleneck (Impact × Severity × Dependency), Impact × Confidence ÷ Effort opportunities, unit-tested |
| Results | Score, stage, bottleneck explanation (hedged language), breakdown chart, strongest/weakest, data-confidence label, save as PDF |
| Lead capture | Gate before the full report (top 3 opportunities + opportunity calculator). Name, work email, company required; phone, title, website optional. Explicit processing consent, separate optional marketing consent, honeypot, server validation |
| Opportunity calculator | Conversion, AOV, retention/churn, CAC efficiency. Ranges, 2 significant figures, "not enough data" when inputs are missing |
| Storage | Supabase Postgres (schema + views + retention functions in `supabase/migrations`) |
| Analytics | 11 funnel events + page views, first/last-touch UTM attribution, dataLayer for GTM, first-party event store; opt-in only |
| SEO | Metadata, Open Graph image, canonical URLs, sitemap, robots (previews noindex), JSON-LD Organization/WebSite |

## Out of scope for the MVP (next iterations)

1. Arabic version and RTL layout (high priority for the Saudi market).
2. Admin dashboard (the data model and SQL views for it already exist).
3. Real case studies, team, testimonials and logos (only with approved, real content).
4. Emailed PDF report and automated follow-up sequences.
5. CRM integration beyond the optional lead webhook.
6. Benchmark calibration from real diagnostic data (curves in `config.ts` are working assumptions).
7. Server-side session start (completion rate currently comes from consented analytics events).

## Launch gates

All must be true before the production domain points at this build.

### Product
- [ ] Growx Era has reviewed the question bank, weights, stage labels and benchmark curves in `src/lib/diagnostic/config.ts`.
- [ ] 5+ internal test diagnostics across all four business models produce results the team agrees with.
- [ ] Booking link (`NEXT_PUBLIC_BOOKING_URL`) set and tested.
- [ ] Copy review (English) complete; no placeholder text remains outside the clearly marked case-study placeholders.

### Data and security
- [ ] Supabase project created in the agreed region; migration applied; RLS confirmed on all four tables.
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in Vercel (Production + Preview), never with a `NEXT_PUBLIC_` prefix.
- [ ] A test lead appears in `leads`, `consent_records` and `diagnostic_sessions` from the production deployment.
- [ ] Someone owns the inbox / webhook that receives new leads.
- [ ] Retention job scheduled (`purge_expired_data`) via pg_cron.

### Privacy and legal
- [ ] Legal entity, CR number, address and privacy contact filled in on `/privacy`; notice reviewed by counsel.
- [ ] Cross-border transfer basis confirmed for the chosen Supabase/Vercel regions.
- [ ] Data-subject request process tested (access + erasure via `erase_lead_by_email`).

### Quality
- [ ] `npm run build`, `npm run lint`, `npm test` green.
- [ ] Full journey tested on iOS Safari, Android Chrome and desktop: no horizontal scroll, tap targets ≥ 44px.
- [ ] Lighthouse on `/` and `/diagnostic`: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- [ ] Analytics: events visible in `analytics_events` after accepting the banner; none before.

## Success metrics to watch after launch

Diagnostic start rate (home visitors → `diagnostic_started`), completion rate (started → completed), lead conversion (completed → `lead_submitted`), booking rate (`booking_started` / leads), average score and most common bottleneck by industry and UTM source.
