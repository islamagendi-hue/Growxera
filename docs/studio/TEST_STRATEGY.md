# Test strategy

## Principles

- **Default to fakes:** tests use the local file store and fake external APIs. There are no real Supabase, LinkedIn, Buffer or xAI calls and no credentials. CI has no secrets.
- **Isolation:** each test file runs in its own worker. The export tests use their own empty store per test.
- **Production data:** never used in tests.
- **Passing tests aren't proof:** a green test proves the specified behavior in the tested cases. It does not prove production behavior or that a live API behaves like its fake.

## Commands

| Check | Command |
|---|---|
| Route types | `npx next typegen` (run before `tsc`) |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx eslint src scripts` |
| Unit tests | `npx vitest run` |
| Build | `npx next build` |
| CI | `.github/workflows/ci.yml` runs all of the above on every PR |

## Coverage map

| Area | File | Key tests |
|---|---|---|
| Workflow, approvals, versions, duplicates, races | `src/lib/studio/studio.test.ts` | "approval enforcement", "execution, verification and duplicate prevention", "races and verification" |
| Import and media | `studio.test.ts` | "import safety", "media copies" |
| LinkedIn client and publisher | `studio.test.ts` | "LinkedIn direct publishing" (fake API) |
| All-publishing switch (P2) | `studio.test.ts` | Default OFF refuses manual, automatic and scheduler runs before any LinkedIn call; OFF blocks an authorized, due post; missed posts still held while OFF; direct client call refused; switching OFF mid-upload stops the post; non-true values read OFF; static check of every path |
| Lock-out recovery | `access.test.ts` | A new setup link works during a global lockout, signs out earlier sessions, replaces the old password and authenticator |
| Automatic publishing locks (G1, G2) | `studio.test.ts` | "automatic publishing safeguards", which covers:<br>• switch OFF;<br>• 19 legacy approvals;<br>• held missed posts;<br>• new time required;<br>• submission window edges (T − 60 s and T − 10 s to the millisecond; at T held);<br>• a run that reaches the post request after T − 10 s holds and sends nothing;<br>• an unknown outcome isn't retried;<br>• the request cut-off at T;<br>• edits;<br>• direct calls;<br>• parallel runs;<br>• refusals;<br>• Riyadh time |
| Sign-in and host | `src/lib/studio/access.test.ts` | RFC 6238; passwords; setup link; code reuse; lockouts; sessions; forged cookies; proxy 404 |
| Backup export | `src/lib/studio/export.test.ts` | Contents; secrets excluded; tamper and truncation; restore round trip; refusal to overwrite |
| Repository hygiene | `studio.test.ts` | "public repository hygiene", "no publishing path without approval", "checks the owner on every studio page…" |

## Results (11 Oct 2026, branch `claude/studio-m1-ops` @ `3b0d17b`)

- `vitest`: 11 files, 189 tests, all passed, 0 skipped.
- `tsc`, `eslint`, `next build`: pass.

## Not covered yet (needs approval or access)

- A live LinkedIn post, image or PDF upload, and read-back.
- Real Supabase RLS from a browser key.
- A restore into a real project.
- The domain and TLS on agent.growxera.com.
- Vercel runtime logs.
- An end-to-end browser test of the sign-in UI (planned for M10).

## End-to-end (browser)

`npm run test:e2e` (Playwright, Chromium) runs the owner's journeys against `next dev` with a throwaway local store, so no external service is reached. `e2e/global-setup.ts` refuses to run when an `.env*` file or a real credential is present.

Covered:
- signed-out redirect;
- first sign-in with the fragment setup link (the token is in no request URL);
- dashboard with every control OFF;
- every screen from the navigation;
- settings;
- past-time refusal that keeps the text;
- write → review → approve, with every blocker shown and no Publish now;
- an edit voids the approval;
- drafts;
- upload with owner-only download; a disguised file is refused;
- the all-publishing switch and its audit entries;
- dashboard, calendar, search and activity;
- a backup export without secret fields;
- phone-size layout without horizontal scroll;
- no browser console errors;
- sign out.

`E2E_SCREENSHOTS=<folder>` also saves desktop and phone screenshots of every screen for review. CI runs this suite as the `e2e` job.
