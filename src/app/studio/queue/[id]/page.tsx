import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/studio/CopyButton";
import { first, Notice, StatusBadge } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { requireOwner } from "@/lib/studio/owner";
import { assetsByUrl, UPLOAD_PREFIX } from "@/lib/studio/assets";
import { DESIGN_FORMATS, designText } from "@/lib/studio/design";
import { connectionState } from "@/lib/studio/linkedin";
import { authorizationsFor, autoPublishSwitch, isAutoAuthorized, leadTimeOk } from "@/lib/studio/autopublish";
import { getAction } from "@/lib/studio/repo";
import { publishingSwitch } from "@/lib/studio/switch";
import { formatRiyadh, isPast, toRiyadhInput } from "@/lib/studio/time";
import {
  approveAction,
  authorizeAutoPublishAction,
  attachDesignAction,
  editAction,
  failedAction,
  publishNowAction,
  recordPublishedAction,
  rejectAction,
  reopenAction,
  resolveUnknownAction,
  reviseAction,
  revokeAutoPublishAction,
  submitForReviewAction,
  verifyAction,
} from "../../actions";
import { classify, loadControls, publishBlockers } from "@/lib/studio/insights";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";

export default async function QueueItem({ params, searchParams }: PageProps<"/studio/queue/[id]">) {
  const { id } = await params;
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await getAction(id);
  if (!d) notFound();
  const sp = await searchParams;
  const { action, draft, current, versions, approvals, executions, approvalValid } = d;
  const editable = !["executed", "verified"].includes(action.status);
  const chars = current.text.length;
  const secured = await assetsByUrl(current.assets.map((a) => a.url));
  const overdue = ["ready_for_review", "approved"].includes(action.status) && isPast(current.target_at);
  const li = await connectionState();
  const direct = li.state === "connected" && li.canPost && action.kind === "publish_post" && current.assets.length <= 1;
  const unknown = action.status === "executed" ? executions.find((e) => e.result === "unknown") : undefined;
  const sw = await autoPublishSwitch();
  const all = await publishingSwitch();
  const auths = await authorizationsFor(action.id);
  const autoAuthorized = isAutoAuthorized(d, auths);
  const blockers = publishBlockers(classify(action, draft, current, approvals, executions, auths, new Date()), await loadControls());
  const lastApproved = approvals.find((a) => a.decision === "approved");
  const canAuthorize =
    action.status === "approved" && approvalValid && action.kind === "publish_post" && !autoAuthorized && leadTimeOk(current.target_at);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div>
        <Link href="/studio/queue" className="text-sm underline underline-offset-4">
          ← Posts
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusBadge status={action.status} />
          <span className="font-mono text-xs text-ink-3">
            Version {current.version} · {chars} characters · hash {current.content_hash.slice(0, 12)}
          </span>
        </div>
        {action.status_reason && <p className="mt-2 text-sm text-ink-2">{action.status_reason}</p>}
        {overdue && (
          <p className="mt-3 border border-alert bg-alert-soft p-3 text-sm text-alert">
            The planned time ({formatRiyadh(current.target_at)}) has passed. Set a new time in Edit before approving.
          </p>
        )}
        <Notice notice={first(sp.notice)} error={first(sp.error)} />

        <article className="mt-6 whitespace-pre-wrap border border-line bg-card p-6 text-[0.95rem] leading-relaxed">{current.text}</article>

        {current.assets.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow">Assets ({current.assets.length})</p>
            <ul className="mt-2 space-y-1 text-sm">
              {current.assets.map((a) => {
                const copy = secured.get(a.url);
                return (
                  <li key={a.url}>
                    {a.type}: {a.title || a.url.split("/").pop()} ·{" "}
                    {copy?.verified_at ? (
                      <a href={`/studio/assets/${copy.id}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        secured copy
                      </a>
                    ) : (
                      <span className="text-alert">not secured yet</span>
                    )}{" "}
                    {a.url.startsWith(UPLOAD_PREFIX) ? (
                      <span className="text-ink-3">· uploaded in the studio</span>
                    ) : (
                      <>
                        ·{" "}
                        <a href={a.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                          original
                        </a>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-ink-3">Secure copies on the Import page (Media). The approval covers the files exactly as listed.</p>
          </div>
        )}

        <section aria-labelledby="status-h" className="mt-6 border border-line bg-card p-5 text-sm">
          <h2 id="status-h" className="eyebrow">Publishing status</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]">
            <dt className="text-ink-3">Current version</dt>
            <dd>
              Version {current.version} · hash <span className="font-mono">{current.content_hash.slice(0, 12)}</span>
            </dd>
            <dt className="text-ink-3">Approval</dt>
            <dd>
              {lastApproved
                ? `Version ${versions.find((v) => v.id === lastApproved.version_id)?.version ?? "?"} approved ${formatRiyadh(lastApproved.created_at)}${approvalValid ? ", covers the current version." : ". It doesn't cover the current version: approve again after review."}`
                : "Never approved."}
            </dd>
            <dt className="text-ink-3">Automatic publishing</dt>
            <dd>{autoAuthorized ? `Confirmed for ${formatRiyadh(current.target_at)} (Riyadh).` : "Not confirmed."}</dd>
            <dt className="text-ink-3">Publish now</dt>
            <dd>{blockers.manual.length ? <BlockerList items={blockers.manual} /> : "Nothing in the studio blocks it."}</dd>
            <dt className="text-ink-3">Publish automatically</dt>
            <dd>{blockers.automatic.length ? <BlockerList items={blockers.automatic} /> : "Nothing in the studio blocks it."}</dd>
          </dl>
        </section>

        {action.status === "draft" && (
          <section className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Draft</h2>
            <p className="mt-1 text-sm text-ink-2">Finish it below, then submit it for review. Nothing is published from here.</p>
            <form action={submitForReviewAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <button className={buttonClass("primary")}>Submit for review</button>
            </form>
          </section>
        )}

        {action.status === "ready_for_review" && (
          <section className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Review</h2>
            <p className="mt-1 text-sm text-ink-2">Approving applies to version {current.version} exactly as shown, including the planned time.</p>
            <p className="mt-2 text-sm text-ink-2">
              Approving doesn&apos;t publish anything. Afterwards you either publish it yourself, or confirm it separately for automatic publishing
              at its planned time. Any later edit cancels the approval.
            </p>
            <form action={approveAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <input type="hidden" name="versionId" value={current.id} />
              <input type="hidden" name="hash" value={current.content_hash} />
              <button className={buttonClass("primary")}>Approve version {current.version}</button>
            </form>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <form action={reviseAction}>
                <input type="hidden" name="actionId" value={action.id} />
                <label className="text-sm font-medium">
                  Needs revision: what should change?
                  <textarea name="reason" required rows={3} className={field} />
                </label>
                <button className={buttonClass("secondary", "mt-2")}>Send back</button>
              </form>
              <form action={rejectAction}>
                <input type="hidden" name="actionId" value={action.id} />
                <label className="text-sm font-medium">
                  Reject: why?
                  <textarea name="reason" required rows={3} className={field} />
                </label>
                <button className={buttonClass("secondary", "mt-2")}>Reject</button>
              </form>
            </div>
          </section>
        )}

        {action.status === "approved" && approvalValid && action.kind === "publish_post" && (
          <section id="auto" className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Automatic publishing</h2>
            <p className="mt-1 text-sm text-ink-2">
              Approving the content does not publish it. Automatic publishing needs your separate confirmation for this exact version and
              time, and both automatic publishing ({sw.enabled ? "ON" : "OFF"}) and all publishing ({all.enabled ? "ON" : "OFF"})
              switched on. It is sent to LinkedIn between 60 and 10 seconds before its planned time, never after. If that
              window is missed, the post is held for review with the reason, and needs a new time and a new approval. LinkedIn sets the
              time it finally shows.
            </p>
            {autoAuthorized ? (
              <>
                <p className="mt-3 text-sm font-medium">
                  Scheduled for automatic publishing at {formatRiyadh(current.target_at)} (Riyadh)
                  {sw.enabled && all.enabled
                    ? "."
                    : `. It won't go out while ${[!all.enabled && "all publishing", !sw.enabled && "automatic publishing"].filter(Boolean).join(" and ")} ${!all.enabled && !sw.enabled ? "are" : "is"} OFF.`}
                </p>
                <form action={revokeAutoPublishAction} className="mt-3">
                  <input type="hidden" name="actionId" value={action.id} />
                  <button className={buttonClass("secondary")}>Cancel automatic publishing</button>
                </form>
              </>
            ) : canAuthorize ? (
              <form action={authorizeAutoPublishAction} className="mt-4">
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="versionId" value={current.id} />
                <input type="hidden" name="hash" value={current.content_hash} />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-1" />
                  Publish version {current.version} automatically on my LinkedIn profile at {formatRiyadh(current.target_at)} (Riyadh).
                </label>
                <button className={buttonClass("primary", "mt-3")}>Schedule for automatic publishing</button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-ink-2">
                Not scheduled for automatic publishing.{" "}
                {current.target_at ? "Its planned time is too close or has passed: set a later time in Edit, then approve again." : "Set a planned time in Edit first."}
              </p>
            )}
          </section>
        )}

        {action.status === "approved" && approvalValid && direct && (
          <section className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Publish now (LinkedIn connected)</h2>
            <p className="mt-1 text-sm text-ink-2">Posts this version immediately, as a one-off action by you. It doesn&apos;t depend on automatic publishing.</p>
            {all.enabled ? (
              <form action={publishNowAction} className="mt-4">
                <input type="hidden" name="actionId" value={action.id} />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-1" />
                  Post version {current.version} on my LinkedIn profile now.
                </label>
                <button className={buttonClass("primary", "mt-3")}>Publish now</button>
              </form>
            ) : (
              <p className="mt-3 text-sm font-medium">
                All publishing is OFF, so this can&apos;t be posted.{" "}
                <Link href="/studio/capabilities#publishing" className="underline">
                  Switch it on in Integrations
                </Link>
                .
              </p>
            )}
          </section>
        )}

        {action.status === "approved" && approvalValid && !direct && (
          <section className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Publish (manual step)</h2>
            <p className="mt-1 text-sm text-ink-2">
              {current.assets.length > 1
                ? "Posts with more than one file are published by hand."
                : li.state === "connected"
                  ? "This post can't be published directly, so you publish it yourself."
                  : "LinkedIn isn't connected to the studio, so you publish this yourself."}{" "}
              {current.target_at ? `Planned time: ${formatRiyadh(current.target_at)} (Riyadh).` : "No planned time."}
            </p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
              <li>Copy the approved text{current.assets.length ? " and download the assets above" : ""}.</li>
              <li>Open LinkedIn, start a post, paste, attach, and post.</li>
              <li>Paste the post link below. The studio refuses a second record for the same content.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <CopyButton text={current.text} />
              <a
                href="https://www.linkedin.com/feed/?shareActive=true"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center border border-ink/80 px-4 text-sm font-medium hover:bg-ink hover:text-paper"
              >
                Open LinkedIn
              </a>
            </div>
            <form action={recordPublishedAction} className="mt-6">
              <input type="hidden" name="actionId" value={action.id} />
              <label className="text-sm font-medium">
                Link to the published post
                <input name="url" type="url" required placeholder="https://www.linkedin.com/feed/update/urn:li:share:…" className={field} />
              </label>
              <button className={buttonClass("primary", "mt-2")}>Record as published</button>
            </form>
          </section>
        )}

        {unknown && (
          <section className="mt-8 border border-alert p-6">
            <h2 className="text-h3 font-semibold">Check LinkedIn</h2>
            <p className="mt-1 text-sm text-ink-2">
              The studio sent this post, but LinkedIn didn&apos;t confirm it. It won&apos;t be sent again on its own. Open your profile&apos;s
              activity and tell the studio what you see.
            </p>
            <a
              href="https://www.linkedin.com/in/me/recent-activity/all/"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center border border-ink/80 px-4 text-sm font-medium hover:bg-ink hover:text-paper"
            >
              Open my LinkedIn activity
            </a>
            <form action={resolveUnknownAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <input type="hidden" name="found" value="published" />
              <label className="text-sm font-medium">
                It&apos;s there: link to the post
                <input name="url" type="url" required placeholder="https://www.linkedin.com/feed/update/urn:li:share:…" className={field} />
              </label>
              <button className={buttonClass("primary", "mt-2")}>Record the link</button>
            </form>
            <form action={resolveUnknownAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <input type="hidden" name="found" value="not_published" />
              <button className={buttonClass("secondary")}>It isn&apos;t on LinkedIn</button>
            </form>
          </section>
        )}

        {action.status === "executed" && !unknown && (
          <section className="mt-8 border border-ink p-6">
            <h2 className="text-h3 font-semibold">Verify</h2>
            <p className="mt-1 text-sm text-ink-2">
              Recorded as published:{" "}
              <a href={executions[0]?.external_url ?? "#"} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                open the post
              </a>
              . Check that it is live and matches version {current.version}.
            </p>
            <form action={verifyAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" value="yes" required className="mt-1" />I opened the link and the live post matches the approved text.
              </label>
              <button className={buttonClass("primary", "mt-3")}>Mark verified</button>
            </form>
            <form action={failedAction} className="mt-6">
              <input type="hidden" name="actionId" value={action.id} />
              <label className="text-sm font-medium">
                Not live or different? Say what you saw.
                <input name="reason" className={field} />
              </label>
              <button className={buttonClass("secondary", "mt-2")}>Mark failed</button>
            </form>
          </section>
        )}

        {action.status === "approved" && !approvalValid && (
          <p className="mt-8 border border-alert bg-alert-soft p-4 text-sm text-alert">
            This approval no longer matches the current version, so it can&apos;t be published. Return it to review and approve the current version.
          </p>
        )}

        {(["rejected", "needs_revision", "failed", "blocked"].includes(action.status) || (action.status === "approved" && !approvalValid)) && (
          <form action={reopenAction} className="mt-8">
            <input type="hidden" name="actionId" value={action.id} />
            <button className={buttonClass("secondary")}>Return to review without changes</button>
          </form>
        )}

        {editable && (
          <section aria-labelledby="design-h" className="mt-10">
            <h2 id="design-h" className="text-h3 font-semibold">Design</h2>
            <p className="mt-1 text-sm text-ink-2">
              An image in the house style, made from the post&apos;s opening. Change any line, preview it, then attach it. Attaching replaces the
              post&apos;s file and creates a new version, so the post needs approving again.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-only generated preview, not a static asset */}
            <img src={`/studio/design/${action.id}`} alt="Design preview" width={300} height={300} className="mt-4 border border-line" />
            <form action={attachDesignAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="actionId" value={action.id} />
              <label className="text-sm font-medium">
                Small heading
                <input name="eyebrow" defaultValue={designText(current.text).eyebrow} maxLength={60} className={field} />
              </label>
              <label className="text-sm font-medium">
                Format
                <select name="format" defaultValue="square" className={field}>
                  {Object.entries(DESIGN_FORMATS).map(([k, f]) => (
                    <option key={k} value={k}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                White line
                <input name="a" required defaultValue={designText(current.text).lineA} maxLength={140} className={field} />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Orange line
                <input name="b" defaultValue={designText(current.text).lineB} maxLength={140} className={field} />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Bottom line
                <input name="footer" defaultValue={designText(current.text).footer} maxLength={80} className={field} />
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button formAction={`/studio/design/${action.id}`} formMethod="get" formTarget="_blank" className={buttonClass("secondary")}>
                  Preview in a new tab
                </button>
                <button className={buttonClass("primary")}>Attach to post</button>
              </div>
            </form>
          </section>
        )}

        {editable && (
          <section className="mt-10">
            <h2 className="text-h3 font-semibold">Edit</h2>
            <p className="mt-1 text-sm text-ink-2">Saving creates version {Math.max(...versions.map((v) => v.version)) + 1}. Any approval of an earlier version stops applying.</p>
            <form action={editAction} className="mt-4">
              <input type="hidden" name="actionId" value={action.id} />
              <label className="text-sm font-medium">
                Text
                <textarea name="text" defaultValue={current.text} rows={14} maxLength={3000} className={field} />
              </label>
              <label className="mt-3 block text-sm font-medium">
                Planned time (Riyadh)
                <input type="datetime-local" name="target_at" defaultValue={toRiyadhInput(current.target_at)} className={field} />
              </label>
              <fieldset className="mt-3 grid gap-2 border border-line p-4">
                <legend className="px-1 text-sm font-medium">Attachment</legend>
                <p className="text-xs text-ink-3">
                  {current.assets.length ? `Now: ${current.assets.length} file${current.assets.length === 1 ? "" : "s"} (listed above).` : "Now: none."} A new file replaces
                  the current ones.
                </p>
                <label className="text-sm">
                  Replace with one image or PDF, up to 4 MB
                  <input name="file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className="mt-1 block w-full text-sm" />
                </label>
                <label className="text-sm">
                  Document title (PDFs only)
                  <input name="file_title" maxLength={200} className={field} />
                </label>
                {current.assets.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="remove_file" value="yes" /> Remove the attachment
                  </label>
                )}
              </fieldset>
              <label className="mt-3 block text-sm font-medium">
                What changed (optional)
                <input name="note" className={field} />
              </label>
              <button className={buttonClass("secondary", "mt-3")}>Save new version</button>
            </form>
          </section>
        )}
      </div>

      <aside className="space-y-8 text-sm">
        <div>
          <p className="eyebrow">Details</p>
          <dl className="mt-2 space-y-1">
            <div>
              <dt className="inline text-ink-3">Type: </dt>
              <dd className="inline">{action.kind.replace("_", " ")}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3">Execution: </dt>
              <dd className="inline">{action.channel === "manual" ? "Manual (copy and open)" : "LinkedIn API"}</dd>
            </div>
            <div>
              <dt className="inline text-ink-3">Origin: </dt>
              <dd className="inline">{draft.origin === "migrated_buffer" ? `Buffer export, post ${draft.origin_ref}` : draft.origin}</dd>
            </div>
            {action.original_due_at && (
              <div>
                <dt className="inline text-ink-3">Original schedule: </dt>
                <dd className="inline">{formatRiyadh(action.original_due_at)}</dd>
              </div>
            )}
          </dl>
          {draft.notes && <p className="mt-2 text-ink-2">{draft.notes}</p>}
        </div>

        <div>
          <p className="eyebrow">Versions</p>
          <ul className="mt-2 space-y-1">
            {versions.map((v) => (
              <li key={v.id} className={v.id === current.id ? "font-medium" : "text-ink-2"}>
                v{v.version} · {formatRiyadh(v.created_at)} · {v.author}
                {v.change_note ? ` · ${v.change_note}` : ""}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow">Decisions</p>
          {approvals.length ? (
            <ul className="mt-2 space-y-1">
              {approvals.map((a) => (
                <li key={a.id}>
                  {a.decision} v{versions.find((v) => v.id === a.version_id)?.version ?? "?"} · {formatRiyadh(a.created_at)}
                  {a.reason ? ` · ${a.reason}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-2">None yet.</p>
          )}
        </div>

        <div>
          <p className="eyebrow">Executions</p>
          {executions.length ? (
            <ul className="mt-2 space-y-1">
              {executions.map((e) => (
                <li key={e.id}>
                  {e.result} · {e.channel} · {formatRiyadh(e.created_at)}
                  {e.verified_at ? ` · verified ${formatRiyadh(e.verified_at)}` : " · not verified"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-2">None.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function BlockerList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
      {items.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}
