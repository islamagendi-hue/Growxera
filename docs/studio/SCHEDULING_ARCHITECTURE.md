# Scheduling architecture for exact-deadline publishing (proposal, P1)

Status: **approved by the owner (11 Oct 2026) and implemented in code (PR #18).** The production scheduler change waits for batch B3. Automatic publishing stays disabled until then, and until a manually approved live test validates it.

**Owner's conditions:**
- Submit only between T − 60 s and T − 10 s.
- Never submit automatically after the deadline.
- A missed window holds the post: a new schedule and a new approval are required.
- Never retry automatically when LinkedIn's outcome is unknown.
- **We control when the request is sent, not the timestamp LinkedIn finally shows.**
- Automatic publishing stays disabled until the implementation is complete and a manually approved live test validates it.

## The rule (owner decision G2 / P1)

A post must never be published after its planned time **T**. Zero tolerance after T. If the system can't publish it in time, the post is held for review with the reason. It is never published late and never caught up.

## Facts this design is based on

Read-only checks of project growxera, 11 Oct 2026:

- **Extensions:** pg_cron 1.6.4 and pg_net 0.20.4. pg_cron 1.5 and later accept schedules in seconds (`'15 seconds'`), so a sub-minute tick is available on Supabase Free at no cost.
- **Current job:** `studio-publish-due`, `*/5 * * * *`.
- **Tick delay today:** each run starts 60–100 ms after its tick and finishes in about 25 ms. The HTTP request is queued to pg_net in the same moment.
- **Unmeasured:** the time from that request to our Vercel function running, and from our post request to LinkedIn creating the post. They will be measured on the first live test (batch B).
- **Media posts are slow to prepare:** the upload to LinkedIn runs before the post request. Images are usually ready at once, but PDFs can take up to about 30 s.

## Why the current design holds everything

The current window is exactly `[T, T]`. A run reaches the app a fraction of a second after its tick, so even a tick scheduled exactly at T arrives after T, and the post is held. The 5-minute tick makes it worse: only one run in five minutes could ever qualify.

## Proposal: finish before the deadline, never after it

Publishing happens in a short window that ends before T:

```
            T − E                      T − M        T
  ──────────[====== publish window ======]────────────|──────► time
   too early                              too late: held
```

| Symbol | Meaning | Proposed value |
|---|---|---|
| **T** | Planned time, the hard deadline. Nothing is published after it | Set per post, as today |
| **E** | Early allowance: the earliest a post may go out before T | **60 s** (owner to approve) |
| **M** | Safety margin before T that covers network and LinkedIn processing | **10 s** |
| Tick | How often the scheduler checks | **every 15 s** |

1. **Sub-minute tick, called only when needed.** Replace the 5-minute job with a 15-second pg_cron job. Its SQL calls `/api/studio/publish-due` only when an authorized post has its planned time within the next ~75 s, so the app is called a few times per post instead of every 15 s all day.
2. **Publish window `[T − E, T − M]`.** A run in the window publishes. A run before it waits. A run after T − M holds the post, as G2 requires. With a 15-second tick, each post gets about 3 runs inside a 50-second window. If one run fails before anything reaches LinkedIn, the next run tries again, still inside the window.
3. **Deadline checked against the real clock right before the post request.** It is checked after any media upload, not at the start of the run. Media uploads start at the beginning of the window, so a slow PDF fails "before T − M" rather than going out late.
4. **The post request is cut off at T.** The request timeout is set to `T − now`. If LinkedIn hasn't answered by T, the outcome is unknown: it is never retried, and the owner checks the profile (the existing "unknown outcome" flow).
5. **Idempotency unchanged.** One claim per approved version, so overlapping runs can't post twice.
6. **Switches unchanged.** The all-publishing switch (P2), the automatic switch, per-post authorization and approval binding all still apply.

### What the owner would see

- "Scheduled: goes out between 17:59:00 and 17:59:50 (Riyadh), never after 18:00:00."
- A held post shows the run time and the reason.

### Alternatives considered

| Option | Why not chosen |
|---|---|
| Keep 5-minute ticks, window `[T − 5 min, T]` | Posts could go out up to 5 minutes early |
| One pg_cron job per post, scheduled at T's minute | Minute precision only, and it creates and deletes production cron jobs per post |
| Vercel Cron | The Hobby plan allows only daily runs. A higher plan costs money (G3) |
| A paid queue or scheduler (QStash, Inngest and similar) | A new paid or third-party service; not needed |

## Timing limits no design can remove

1. **There is no "exactly at T".** Every request takes time to travel and to be processed. The only way to guarantee "not after T" is to start before T, so posts appear up to E seconds early. Zero-early and zero-late together are impossible. The owner chooses E.
2. **LinkedIn's timestamp is LinkedIn's.** If LinkedIn receives the request before T but is slow to process it, its "posted" time could fall a moment after T. Margin M and the cut-off at T make this unlikely. If it happens, the outcome is unknown and the post is never retried.
3. **Clocks differ slightly** between Supabase, Vercel and LinkedIn. They are NTP-synced, typically to well under a second. M covers this.
4. **An outage during the window holds the post.** This covers Supabase, pg_cron, Vercel or LinkedIn. It is correct under G2, but it means a missed post, not a late one.
5. **Cold starts.** A Vercel function that hasn't run recently can take a few seconds to start. That is inside the window; repeated ticks absorb it.
6. **Media posts need more lead time.** A PDF still processing at T − M is held.
7. **Live latency hasn't been measured yet.** E and M are proposals until the first live test (B2) measures the real delays. They may need adjusting, with the owner's approval.

## Implementation (PR #18)

`SUBMIT_EARLY_MS = 60_000`, `SUBMIT_MARGIN_MS = 10_000` in `src/lib/studio/autopublish.ts`; the pre-send deadline check and the request cut-off are in the LinkedIn client; a run that misses the deadline after claiming the post releases the claim and holds it. Tests cover the exact window edges, a run that reaches the post request too late, an unknown outcome not being retried, and the cut-off.

## What it changes

- **Code (a PR, no production effect until merged):**
  - `timing()` uses the window `[T − E, T − M]`;
  - the real-clock check right before the post request;
  - a request timeout bounded by T;
  - UI wording;
  - tests for each edge: T − E − 1 ms waits, T − E publishes, T − M + 1 ms is held, a run after T is held, a slow upload is held, a request still running at T ends as unknown.
- **Production (separate gate, with batch B3):** replace the cron job with the 15-second job and its pre-check. Rollback: `select cron.unschedule(...)`.
- **No migration needed.**
