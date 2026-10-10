# LinkedIn Growth Studio: master plan

Private, owner-only tool for Islam Gendi's personal LinkedIn presence. Canonical address:
**https://agent.growxera.com** (not live yet; see [APPROVAL_GATES.md](APPROVAL_GATES.md)).

## Mission

The goal is relevant professional authority, meaningful conversations, qualified relationships and opportunities, in these areas:
- Business Growth;
- GTM;
- Revenue Growth;
- Growth Transformation;
- executive leadership.

Posting volume and vanity metrics are not goals.

## Product rules (binding)

| Rule | Source |
|---|---|
| Private access: own host, email + password + authenticator code; every page, action and route checks the owner server-side | Owner, master directive |
| Approval binds exact text, media and planned time; any edit voids it | Owner |
| Automatic publishing: global switch (default OFF) **and** per-post authorization **and** the on-time window. Content approval alone never publishes | Owner G1 |
| No catch-up or late publishing: a missed post is held for review and needs a new time and approval | Owner G2 |
| The 19 approvals of 10 Oct never publish automatically until each one is reconfirmed | Owner G1 |
| Supabase Free; a weekly export the owner downloads; no plan upgrades | Owner G3 |
| Grok is the writing model. Budget **$0/month**: no paid calls until a budget is approved; no silent substitution | Owner |
| Buffer stays connected until the replacement is proven and the owner approves disconnecting it | Owner |
| Official APIs only; no browser automation to get around platform limits | Owner |
| No fabricated metrics, news, citations or results | Owner |

## Milestones

The checklist is in [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).

1. Audit, security and foundation (in progress: PRs #18, #19, #20).
2. Real publishing verification (needs owner approvals).
3. Content engine and editorial calendar (Grok at $0: mocks only).
4. Dashboard and agent control center.
5. Analytics and learning loop.
6. Daily report.
7. Visual content workflow.
8. Newsletter workflow (assisted; no LinkedIn API).
9. Engagement and relationship intelligence (assisted; mostly no API).
10. End-to-end QA, recovery tests, operations documentation.

## Critical path to the first automatic post

1. **Code, done locally:** PRs #18, #19 and #20.
2. **Owner approvals:**
   - merge and deploy;
   - apply the migrations;
   - domain and DNS;
   - setup link;
   - LinkedIn redirect URL and keys.
3. **Owner action:** connect LinkedIn on agent.growxera.com.
4. **Owner approval:** one live test post with "Publish now". Verify it.
5. **Owner approval:** set `STUDIO_AUTO_PUBLISH_ALLOWED=true`, switch ON, then authorize posts individually.

## Documents

| File | Content |
|---|---|
| [CURRENT_STATE.md](../linkedin-agent/handover/CURRENT_STATE.md) | Snapshot (updated) |
| [REQUIREMENTS_REGISTER.md](../linkedin-agent/handover/REQUIREMENTS_REGISTER.md) | Requirements |
| [DECISIONS_LOG.md](../linkedin-agent/handover/DECISIONS_LOG.md) | Decisions |
| [RISK_REGISTER.md](RISK_REGISTER.md) | Risks and threat model |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Milestone checklist |
| [TEST_STRATEGY.md](TEST_STRATEGY.md) | Tests |
| [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) | Backup, restore, rollback, incidents |
| [APPROVAL_GATES.md](APPROVAL_GATES.md) | Owner approvals |
| [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md) | What was done, where to resume |
