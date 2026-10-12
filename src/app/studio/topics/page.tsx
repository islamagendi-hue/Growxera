import Link from "next/link";
import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { grokStatus, spentThisMonthUsd } from "@/lib/studio/grok";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";
import { listTopics } from "@/lib/studio/writer";
import { addTopicAction, removeTopicAction, writeWithGrokAction } from "../actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";

function FormatSelect() {
  return (
    <select name="format" defaultValue="post" className={field}>
      <option value="post">LinkedIn post</option>
      <option value="newsletter">Newsletter issue (Behind the Number)</option>
    </select>
  );
}

export default async function Topics({ searchParams }: PageProps<"/studio/topics">) {
  await requireOwner();
  const sp = await searchParams;
  const [topics, spent] = await Promise.all([listTopics(), spentThisMonthUsd().catch(() => 0)]);
  const grok = grokStatus();

  return (
    <div className="mt-8 max-w-4xl">
      <h1 className="text-h2 font-semibold">Topics</h1>
      <p className="mt-2 text-sm text-ink-2">
        Add topics; Grok writes a draft in your voice, learning from your best posts and avoiding what you&apos;ve already published.
        Every draft waits for your review. Nothing is published from here.
      </p>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      <section aria-labelledby="grok-h" className="mt-6 border border-line bg-card p-5 text-sm">
        <h2 id="grok-h" className="eyebrow">Grok</h2>
        {grok.enabled ? (
          <p className="mt-2">
            On, model {grok.model}. This month: ${spent.toFixed(2)} of ${grok.budgetUsd.toFixed(2)}. It stops by itself at the cap.
          </p>
        ) : (
          <p className="mt-2">
            Off: drafts can&apos;t be written yet. Missing settings: {grok.missing.join(", ")}.{" "}
            <Link href="/studio/capabilities#grok" className="underline underline-offset-4">
              Integrations
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="add-h" className="mt-8 border border-ink p-6">
        <h2 id="add-h" className="text-h3 font-semibold">Add a topic</h2>
        <form action={addTopicAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_16rem]">
          <label className="text-sm font-medium">
            Topic
            <input name="topic" required maxLength={300} placeholder="e.g. Why CAC payback beats ROAS in a budget review" className={field} />
          </label>
          <label className="text-sm font-medium">
            Format
            <FormatSelect />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Angle or notes (optional)
            <textarea name="angle" rows={2} maxLength={500} placeholder="A number, a story, who it's for, what to avoid…" className={field} />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className={buttonClass("secondary")}>Add to list</button>
            <button formAction={writeWithGrokAction} className={buttonClass("primary")} disabled={!grok.enabled}>
              Write it now with Grok
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="list-h" className="mt-8">
        <h2 id="list-h" className="text-h3 font-semibold">Topic list ({topics.length})</h2>
        {topics.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No topics yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line bg-card">
            {topics.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.text}</p>
                  <p className="mt-1 text-ink-3">
                    {t.format === "newsletter" ? "Newsletter" : "Post"} · added {formatRiyadh(t.added_at)}
                    {t.angle ? ` · ${t.angle}` : ""}
                  </p>
                  {t.draft_action_id && (
                    <Link href={`/studio/queue/${t.draft_action_id}`} className="mt-1 inline-block underline underline-offset-4">
                      Open the draft
                    </Link>
                  )}
                </div>
                <div className="flex gap-2">
                  <form action={writeWithGrokAction}>
                    <input type="hidden" name="topicId" value={t.id} />
                    <button className={buttonClass("primary")} disabled={!grok.enabled}>
                      {t.draft_action_id ? "Write again" : "Write"}
                    </button>
                  </form>
                  <form action={removeTopicAction}>
                    <input type="hidden" name="topicId" value={t.id} />
                    <button className={buttonClass("secondary")}>Remove</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
