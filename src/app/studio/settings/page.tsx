import Link from "next/link";
import { signOutEverywhereAction } from "@/app/access/actions";
import { OnOff } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { storageMode } from "@/lib/server/store";
import { GLOBAL_MAX_FAILURES, LOCK_WINDOW_MS, MAX_FAILURES, sessionOverview } from "@/lib/studio/access";
import { grokStatus } from "@/lib/studio/grok";
import { STUDIO_HOST } from "@/lib/studio/host";
import { loadControls } from "@/lib/studio/insights";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";

export const dynamic = "force-dynamic";

const RULES = [
  "Nothing is published without your approval of that exact version (text, files and planned time). Any edit cancels the approval.",
  "All publishing is OFF by default. While it is OFF, neither Publish now nor automatic publishing can post anything.",
  "Automatic publishing also needs its own switch, an owner-approved deployment setting, and your confirmation of each post, one by one. The 19 approvals from 10 Oct are not confirmed until you confirm each.",
  "A scheduled post is sent only between 60 and 10 seconds before its planned time. Missed: it is held for review and needs a new time and approval; it is never published late.",
  "If LinkedIn's answer is unclear, the post is never re-sent automatically. You check your profile and record the result.",
  "The studio controls when a request is sent, not the time LinkedIn finally displays.",
  "Grok writes drafts only when its settings are present, and stops at a hard monthly cap (owner decision: $10). Drafts are never published without your approval. Buffer stays connected until you approve disconnecting it.",
];

export default async function Settings() {
  const owner = await requireOwner();
  const [access, controls] = await Promise.all([sessionOverview(), loadControls()]);
  const grok = grokStatus();

  return (
    <div className="mt-8 max-w-4xl">
      <h1 className="text-h2 font-semibold">Settings</h1>

      <section aria-labelledby="account-h" className="mt-8 border border-line bg-card p-6">
        <h2 id="account-h" className="text-h3 font-semibold">Account and sign-in</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[14rem_1fr]">
          <dt className="text-ink-3">Owner</dt>
          <dd>{owner.email}</dd>
          <dt className="text-ink-3">Sign-in</dt>
          <dd>Email, password and authenticator code, on {STUDIO_HOST} only</dd>
          <dt className="text-ink-3">Password and authenticator set</dt>
          <dd>{access.passwordChangedAt ? formatRiyadh(access.passwordChangedAt) : "Unknown"}</dd>
          <dt className="text-ink-3">Failed sign-ins, last 24 hours</dt>
          <dd className={access.failedAttempts24h ? "text-alert" : ""}>{access.failedAttempts24h}</dd>
          <dt className="text-ink-3">Lockout</dt>
          <dd>
            {MAX_FAILURES} failures from one network locks it for {LOCK_WINDOW_MS / 60_000} minutes; {GLOBAL_MAX_FAILURES} failures in an hour locks sign-in for
            everyone for an hour.
          </dd>
        </dl>

        <h3 className="mt-6 font-semibold">Active sessions ({access.sessions.length})</h3>
        <ul className="mt-2 divide-y divide-line border border-line text-sm">
          {access.sessions.map((s, i) => (
            <li key={i} className="flex flex-wrap gap-x-4 gap-y-1 p-3">
              <span className="font-medium">{s.device}</span>
              <span className="text-ink-3">signed in {formatRiyadh(s.created_at)}</span>
              <span className="text-ink-3">expires {formatRiyadh(s.expires_at)}</span>
              {s.current && <span className="font-mono text-xs text-accent-ink">This device</span>}
            </li>
          ))}
        </ul>
        <form action={signOutEverywhereAction} className="mt-4">
          <button className={buttonClass("secondary")}>Sign out everywhere</button>
        </form>

        <h3 className="mt-6 font-semibold">Recovery</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>Locked out: wait 15 minutes (or an hour if sign-in was locked for everyone).</li>
          <li>
            Lost the authenticator or forgot the password: ask for a new one-time setup link. It is valid for a short time, works once, replaces the
            password and authenticator, and signs out every other session. Creating one is an owner-approved production step (runbook).
          </li>
          <li>Suspect someone else got in: Sign out everywhere, switch all publishing OFF, then reset with a new setup link.</li>
        </ul>
      </section>

      <section aria-labelledby="publishing-h" className="mt-8 border border-line bg-card p-6">
        <h2 id="publishing-h" className="text-h3 font-semibold">Publishing</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[14rem_1fr]">
          <dt className="text-ink-3">All publishing</dt>
          <dd>
            <OnOff on={controls.publishing.enabled} />{" "}
            <Link href="/studio/capabilities#publishing" className="underline underline-offset-4">
              Change
            </Link>
          </dd>
          <dt className="text-ink-3">Automatic publishing</dt>
          <dd>
            <OnOff on={controls.auto.enabled} /> {controls.auto.deploymentAllowed ? "Allowed for this deployment." : "Not allowed for this deployment."}{" "}
            <Link href="/studio/capabilities#autopublish" className="underline underline-offset-4">
              Change
            </Link>
          </dd>
          <dt className="text-ink-3">LinkedIn</dt>
          <dd>
            {controls.linkedin.state === "connected" ? "Connected" : "Not connected"}.{" "}
            <Link href="/studio/capabilities#linkedin" className="underline underline-offset-4">
              Integrations
            </Link>
          </dd>
          <dt className="text-ink-3">Writing engine</dt>
          <dd>{grok.enabled ? `Grok, budget $${grok.budgetUsd.toFixed(2)}/month` : "Grok off (budget $0/month: no model calls)"}</dd>
          <dt className="text-ink-3">Data</dt>
          <dd>
            {storageMode === "supabase" ? "Supabase (Free plan, no automatic backups)" : "Local development store"}.{" "}
            <Link href="/studio/export" className="underline underline-offset-4">
              Weekly backup
            </Link>
          </dd>
        </dl>
      </section>

      <section aria-labelledby="rules-h" className="mt-8 border border-line bg-card p-6">
        <h2 id="rules-h" className="text-h3 font-semibold">Safety rules (fixed)</h2>
        <p className="mt-1 text-sm text-ink-2">These are built in and can&apos;t be changed from the studio.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
