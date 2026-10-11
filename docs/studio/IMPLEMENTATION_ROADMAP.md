# Implementation roadmap and milestone checklist

Each milestone ships as reviewable PRs. Nothing merges or deploys without owner approval ([APPROVAL_GATES.md](APPROVAL_GATES.md)).

## M1: Audit, security and foundation

- [x] Read-only audit (11 Oct): repository, live database (read-only), Buffer (read-only), Vercel domain config.
- [x] Preserve the WIP: branch `claude/studio-wip-agent-host` @ `3ca1de7`, stash kept.
- [x] Publishing locks: all-publishing switch (P2), automatic switch, per-post authorization, submission window T − 60 s … T − 10 s (G2, P1), missed posts held. **PR #18**.
- [x] Agent-host sign-in hardened and tested. **PR #19**.
- [x] Weekly export (download, validate, isolated restore) and CI. **PR #20**.
- [x] Plan docs (this set).
- [ ] Owner approvals, batch A.
- [ ] Post-deploy verification on agent.growxera.com:
  - 404 on www;
  - sign-in;
  - lockout;
  - export download;
  - the scheduler response.

## M2: Real publishing verification

- [ ] Batch B1: connect LinkedIn.
- [ ] Pin and verify the LinkedIn API version (default `202606`; latest listed `202609`).
- [ ] B2: a live text post with "Publish now", then verify it: the URL, read-back if permitted, the owner's check.
- [ ] Image post, then PDF post (separate approvals).
- [ ] Rate-limit (429) handling and backoff, with tests.
- [ ] B3: activation.

## M3: Content engine and editorial calendar ($0 Grok)

- [ ] Content item model: topic, audience, objective, format, sources, angle, versions, model used, quality status.
- [ ] News intake (sources and terms to be confirmed), dedupe before any model call.
- [ ] Quality rubric (documented), as decision support only.
- [ ] Grok adapter behind a `$0` budget guard: a mock or fixture path for development; no paid calls.
- [ ] Editorial calendar: up to 3 slots per day as a target, not a quota.
- [ ] Review queue for the 36 migrated posts with recommendations, re-timing and reconfirmation.

## M4: Dashboard and agent control center

- [ ] The 14 sections; per-module status, last run, last error, pending, next action, pause/resume (server-enforced).
- [ ] Global "pause all" (extends the M1 switch).

## M5: Analytics and learning

- [ ] Capability-to-metric register (what is actually available).
- [ ] Creator-analytics export upload.
- [ ] Learning loop with sample-size caution.

## M6: Daily report

- [ ] An in-dashboard report traceable to records. Email later (C4).

## M7: Visuals · M8: Newsletter · M9: Engagement and relationships

- [ ] Verify the capabilities first, then build assisted workflows. No automated DMs, comments or connection requests.

## M10: End-to-end QA and operations

- [ ] Regression, security, failure and recovery tests.
- [ ] Final acceptance report.
