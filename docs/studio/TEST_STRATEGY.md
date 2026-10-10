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
| Automatic publishing locks (G1, G2) | `studio.test.ts` | "automatic publishing safeguards", which covers:<br>• switch OFF;<br>• 19 legacy approvals;<br>• held missed posts;<br>• new time required;<br>• window edges;<br>• edits;<br>• direct calls;<br>• parallel runs;<br>• refusals;<br>• Riyadh time |
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
