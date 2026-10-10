# Retiring Buffer: migration checklist

Goal: stop using Buffer without losing a draft, a scheduled post, or useful performance history, and without anything being published twice.

The studio has **no Buffer integration**. Buffer was read once (read-only) on 10 Oct 2026 to export data. Nothing was changed or deleted in Buffer.

## What has been exported (10 Oct 2026, read-only)

Private files, kept out of the public repository and sent to the owner directly:

| File | Contents |
| --- | --- |
| `2026-10-10-history-with-metrics.json` | 57 published posts (text, date, link, assets, how published) with Buffer's lifetime metrics as of 10 Oct 12:07 UTC, plus 1 Buffer draft |
| `2026-10-10-scheduled-before-pause.json` | 37 scheduled posts: full text, image/PDF links, original date and time, status, tags and notes |
| `2026-10-10-update-1839-published-after-export.json` | The 1 queued post Buffer published at 18:30 UTC after the export ("More subscribers this month…") |
| `2026-10-10-reexport-current-state.json` | Read-only re-export at 18:46 UTC: 36 scheduled (unchanged by id and by text+media+time fingerprint), 1 draft, nothing new; the 18:30 post confirmed sent. Buffer queue **not paused** |
| `assets/urls.tsv` | Every asset link. All 37 queued images/PDFs confirmed present in the source bucket (3.99 MB, PNG/PDF); copied into Growxera's private storage by the studio (Import → Media) |

## Checklist

### Before disconnecting

- [ ] **1. Pause Buffer's queue now** (exact clicks in [ACTIVATION.md](ACTIVATION.md), step 1). Buffer's API cannot pause, so this is manual; a Claude session can then confirm it read-only. This keeps all 36 remaining posts, their dates and their status exactly as they are, and stops publishing. (Do not delete posts; do not disconnect yet.)
- [ ] **2. Check what Buffer published since the export.** In Buffer's Sent tab, note anything sent after 10 Oct 18:39 UTC. If there is any, a new read-only update export is needed (ask in a Claude session); the studio blocks those queue items on import.
- [ ] **3. Apply the studio migration and set `STUDIO_OWNER_EMAIL`** (PLAN.md, section 6).
- [ ] **4. Import in the studio** (`/studio/import`), in order: history, scheduled, update file(s).
- [ ] **5. Confirm the counts** on `/studio/import`: 58 published posts in history; 38 migrated items = 36 Ready for review, 1 Draft, 1 Blocked (published by Buffer at 18:30 UTC); 0 approved.
- [ ] **6. Secure the images.** The queued posts' images and PDFs are in a public bucket (`li-assets`) of the Supabase project `leanapp-staging`. In the studio, Import → **Copy and verify media** copies all 37 into Growxera's private bucket and checks each copy by SHA-256. Keep `leanapp-staging` untouched until this reports 0 failed.
- [ ] **7. Keep Buffer's analytics.** Optional: in Buffer, export the LinkedIn analytics (CSV) for the full date range. The export above already holds per-post lifetime numbers as of 10 Oct; Buffer's own export is a second copy.
- [ ] **8. Review the migrated queue** in the studio: approve, edit, reject or leave each item. Items whose planned time has passed are flagged; give them a new time before approving.

### Disconnecting

- [ ] **9. Disconnect LinkedIn from Buffer** (Buffer → Channels → LinkedIn → Disconnect) only after steps 1 to 5. Disconnecting stops Buffer from publishing; it also ends Buffer's access to your analytics, so do step 7 first if you want it.
- [ ] **10. Revoke Buffer's access in LinkedIn:** LinkedIn → Settings → Data privacy → Permitted services → Buffer → Remove.
- [ ] **11. Remove the Buffer connector from Claude** (claude.ai → Settings → Connectors) so no session can schedule through it again.
- [ ] **12. Retire the old skills** that told Claude to own the Buffer queue and to post through the Chrome extension (`linkedin-posts-buffer`, `linkedin-daily-engagement`), or rewrite them to point to the studio.
- [ ] **13. Cancel or downgrade the Buffer plan** if it is paid.

### After

- [ ] **14. Replace Buffer's analytics feed:** upload LinkedIn's creator analytics export weekly (Milestone 2 adds the importer).
- [ ] **15. Delete the local copies of the private export files** once the import is confirmed, or keep them somewhere private (not this repository).

## What you lose by leaving Buffer, and the replacement

| Buffer gave | Replacement |
| --- | --- |
| Automatic publishing of scheduled posts | Approved items published by you with copy-and-open now; LinkedIn direct publishing after it is verified (Milestone 4) |
| Daily post metrics through its LinkedIn partner access | Weekly LinkedIn creator analytics export upload (authorized, more complete, less frequent) |
| Queue and calendar | Studio approval queue (built) and editorial calendar (Milestone 3) |
