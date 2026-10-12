# Studio runbook

One entry point for setting up, running, troubleshooting, deploying and rolling back the LinkedIn Growth Studio. The detailed procedures live in:
- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md): batch A, step by step, with stop conditions and rollback.
- [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md): backup, restore limits, incidents.

## Local development

```
npm ci
npx next typegen        # route types; needed before tsc after switching branches
npx next dev            # http://localhost:3000; the studio is at /studio (localhost allowed outside production)
```

- **Storage:** without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, everything is stored in `.data/` (local JSON files; git-ignored). Never put production keys in `.env.local` on a machine that runs tests.
- **First sign-in locally:**
  1. Set `STUDIO_OWNER_EMAIL` in your shell.
  2. Run `STUDIO_HOST=localhost:3000 node scripts/studio-setup-link.mjs --hash-only --hours 2 --out /tmp/setup-link.txt`.
  3. Add the printed hash to `.data/li_access_setup_tokens.json` as `{ "token_hash": "<hash>", "expires_at": "<ISO time>", "used_at": null }` (an array of rows).
  4. Open the link in the file, with `https://localhost:3000` replaced by `http://localhost:3000`.

## Checks

| Command | What |
|---|---|
| `npx tsc --noEmit` | Types |
| `npx eslint src scripts` | Lint |
| `npx vitest run` | Unit and integration tests (local store, fake LinkedIn) |
| `npm run test:e2e` | Browser tests (Chromium, `next dev` on port 3210, throwaway store in the temp folder). Refuses to run if any `.env*` file other than `.env.example`, or a real credential, is present |
| `E2E_SCREENSHOTS=<folder> npm run test:e2e` | Also saves desktop and phone screenshots of every screen |
| `npx next build` | Production build |

CI runs all of these on every pull request and every push to `main` or `claude/studio-*`.

## Configuration (names only; values never in Git)

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Production; Preview shares them today) | Database and private storage; the key also derives encryption keys |
| `STUDIO_OWNER_EMAIL` | Vercel | The only account that can sign in |
| `STUDIO_HOST` | optional | Studio address; default `agent.growxera.com` |
| `STUDIO_AUTO_PUBLISH_ALLOWED` | Vercel, **unset** | `true` only after the owner approves automatic publishing (B3) |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` | optional | Or enter the keys on the Integrations page |
| `CRON_SECRET` | optional | Only if a scheduler other than Supabase pg_cron is used |

## Daily operation (owner)

- **Dashboard:** what needs you, what's next, and whether anything can be published.
- **Posts → New post:** write, then submit for review. Approve on the post page.
- **Publishing a post** (both are blocked while All publishing is OFF):
  - by hand with the copy-and-open steps;
  - with Publish now, once LinkedIn is connected.
- **Backup:** download the weekly export and keep it privately.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/studio` on www shows 404 | Expected once PR #19 is live | Use https://agent.growxera.com |
| "Too many attempts" | Lockout | Wait 15 minutes (1 hour for the global lock), or use a new setup link |
| Setup link says expired or used | It works once and expires | Ask for a new one |
| "Open the setup link" on the setup page | The link was opened without its `#token=` part, or the page was reloaded after the token was removed | Open the original link again |
| Post shows "Approval outdated" | Edited after approval | Review and approve the new version |
| Post shows "Held" | Missed its submission window | Edit to a new time, approve, confirm again |
| Post shows "Outcome unknown" | LinkedIn didn't answer clearly | Check your profile, then record the link or "not on LinkedIn". Never re-sent automatically |
| "All publishing is switched off" | The master switch is OFF (default) | Integrations → All publishing → Switch ON (only when you mean to publish) |
| Upload refused | Wrong type (only PNG, JPEG, GIF, WebP, PDF), or over 4 MB | Convert or compress the file |
| `tsc` errors about `.next/types` after switching branches | Stale generated types | `npx next typegen` |
| The E2E run refuses to start | An `.env*` file or a credential is present | Remove or rename it for the test run |

## Deployment and rollback

- **Deployment:** follow [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) exactly. Every step is owner-approved, and the run stops after each one.
- **Rollback:** promote the previous production deployment in Vercel. No database change is needed. Once LinkedIn is connected, unschedule the cron job and disconnect LinkedIn first.
