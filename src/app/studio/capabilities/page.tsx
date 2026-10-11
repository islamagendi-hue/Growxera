import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { CAPABILITIES, CHECKED_ON, STATUS_TEXT, type CapabilityStatus } from "@/lib/studio/capabilities";
import { grokStatus } from "@/lib/studio/grok";
import { connectionState, linkedInConfig, redirectUri } from "@/lib/studio/linkedin";
import { requireOwner } from "@/lib/studio/owner";
import { formatRiyadh } from "@/lib/studio/time";
import { eq, select } from "@/lib/server/store";
import { autoPublishSwitch } from "@/lib/studio/autopublish";
import { checkGrokAction, disconnectLinkedInAction, saveLinkedInKeysAction, setAutoPublishAction } from "../actions";

export const dynamic = "force-dynamic";

const TONE: Record<CapabilityStatus, string> = {
  available: "bg-accent text-paper",
  unverified: "bg-paper-2 text-ink-2",
  unavailable: "bg-alert-soft text-alert",
};

export default async function CapabilitiesPage({ searchParams }: PageProps<"/studio/capabilities">) {
  await requireOwner();
  const sp = await searchParams;
  const grok = grokStatus();
  const li = await connectionState();
  const auto = await autoPublishSwitch();
  const keysSource = (await linkedInConfig()).source;
  const redirect = redirectUri();
  // Evidence, not a setting: direct posting counts as verified only after a real API post.
  const apiPosts = await select<{ created_at: string; verified_at: string | null }>(
    "li_executions",
    [eq("channel", "linkedin_api"), eq("result", "executed")],
    { columns: "created_at,verified_at", order: { col: "created_at", ascending: false }, limit: 1 },
  );
  const lastApi = apiPosts[0] ?? null;
  const capabilities = CAPABILITIES.map((c) =>
    c.id === "publish_text" && lastApi?.verified_at
      ? { ...c, status: "available" as const, evidence: `Verified: a post published through the API on ${formatRiyadh(lastApi.created_at, false)} was confirmed live.` }
      : c,
  );
  return (
    <div className="mt-8">
      <h1 className="text-h2 font-semibold">Capabilities</h1>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        What the studio can do on LinkedIn through official, authorized access, and the manual step you take where it can&apos;t. Last
        reviewed {CHECKED_ON}. Nothing is marked available until it has been tested with this app.
      </p>
      <Notice notice={first(sp.notice)} error={first(sp.error)} />

      <div className="mt-8 overflow-x-auto border border-line">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-wide text-ink-3">
            <tr>
              <th className="p-3">Capability</th>
              <th className="p-3">Official method and permission</th>
              <th className="p-3">Status</th>
              <th className="p-3">In the studio</th>
              <th className="p-3">Your manual step</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-card align-top">
            {capabilities.map((c) => (
              <tr key={c.id} id={c.id}>
                <td className="p-3 font-medium">{c.capability}</td>
                <td className="p-3 text-ink-2">
                  {c.method}
                  <br />
                  <span className="text-xs">{c.permission}</span>
                </td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 font-mono text-xs uppercase ${TONE[c.status]}`}>{STATUS_TEXT[c.status]}</span>
                  <p className="mt-1 text-xs text-ink-3">{c.evidence}</p>
                </td>
                <td className="p-3 text-ink-2">{c.implementation}</td>
                <td className="p-3 text-ink-2">{c.manualStep ?? "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section id="autopublish" className="mt-10 border border-ink bg-card p-6">
        <h2 className="text-h3 font-semibold">Automatic publishing: {auto.enabled ? "ON" : "OFF"}</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-ink-2">
          When ON, the scheduler publishes only posts you scheduled for automatic publishing one by one, and only at their planned time, never late. Approving content never publishes it by itself. If the scheduler runs
          after a post&apos;s planned time, even by a moment, the post is held for review, never posted late. Switching OFF stops all automatic publishing immediately.
        </p>
        {!auto.ready && <p className="mt-2 text-sm text-alert">The publishing-controls database update isn&apos;t applied yet, so automatic publishing stays OFF.</p>}
        {!auto.deploymentAllowed && (
          <p className="mt-2 text-sm text-ink-2">This deployment doesn&apos;t allow switching it on (owner-approved deployment setting needed).</p>
        )}
        {auto.changedAt && (
          <p className="mt-2 text-xs text-ink-3">
            Last changed {formatRiyadh(auto.changedAt)} by {auto.changedBy}.
          </p>
        )}
        {auto.ownerEnabled ? (
          <form action={setAutoPublishAction} className="mt-4">
            <input type="hidden" name="enabled" value="false" />
            <button className={buttonClass("primary")}>Switch automatic publishing OFF</button>
          </form>
        ) : (
          auto.deploymentAllowed &&
          auto.ready && (
            <form action={setAutoPublishAction} className="mt-4">
              <input type="hidden" name="enabled" value="true" />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" value="yes" required className="mt-1" />
                Switch automatic publishing on for posts I schedule individually.
              </label>
              <button className={buttonClass("secondary", "mt-3")}>Switch ON</button>
            </form>
          )
        )}
      </section>

      <section id="linkedin" className="mt-10 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">LinkedIn connection</h2>
        {li.state === "not_configured" && (
          <div className="mt-2 space-y-2 text-sm text-ink-2">
            <p>
              Not set up. Paste your LinkedIn app&apos;s keys below (LinkedIn Developers → your app → Auth). The redirect URL there must be:{" "}
              <code className="break-all bg-paper-2 px-1 font-mono text-xs">{redirect}</code>
            </p>
          </div>
        )}
        {(li.state === "not_configured" || keysSource === "studio") && (
          <form action={saveLinkedInKeysAction} className="mt-4 grid max-w-xl gap-3" autoComplete="off">
            <label className="text-sm font-medium">
              Client ID
              <input name="clientId" required autoComplete="off" spellCheck={false} dir="ltr" className="mt-1 w-full border border-line-strong bg-card p-3 font-mono text-sm" />
            </label>
            <label className="text-sm font-medium">
              Client Secret
              <input name="clientSecret" type="password" required autoComplete="new-password" spellCheck={false} dir="ltr" className="mt-1 w-full border border-line-strong bg-card p-3 font-mono text-sm" />
            </label>
            <p className="text-xs text-ink-3">The secret is stored encrypted and is never shown again. Saving new keys replaces the old ones.</p>
            <div>
              <button className={buttonClass(li.state === "not_configured" ? "primary" : "secondary")}>Save keys</button>
            </div>
          </form>
        )}
        {li.state === "not_connected" && <p className="mt-2 text-sm text-ink-2">Not connected. Nothing can be posted directly.</p>}
        {(li.state === "expired" || li.state === "unreadable") && (
          <p className="mt-2 text-sm text-alert">
            {li.state === "expired" ? "The connection expired" : "The saved connection can't be read"}. Approved posts are not being published. Connect again.
          </p>
        )}
        {li.state === "connected" && (
          <div className="mt-2 space-y-1 text-sm">
            <p>
              Connected{li.row.member_name ? ` as ${li.row.member_name}` : ""}. Expires {formatRiyadh(li.row.expires_at, false)} ({li.daysLeft} days).
              {li.expiringSoon && <span className="text-alert"> Reconnect soon: LinkedIn requires it every 60 days.</span>}
            </p>
            <p className="text-ink-2">Permissions: {li.row.scopes}.{!li.canPost && <span className="text-alert"> Posting permission missing.</span>}</p>
            <p className="text-ink-2">
              Approved posts are published at their planned time.{" "}
              {lastApi ? `Last direct post: ${formatRiyadh(lastApi.created_at)}.` : "No post has been published through the API yet, so it stays “Not verified” until the first one succeeds."}
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {li.state !== "not_configured" && (
            <a href="/studio/linkedin/connect" className={buttonClass(li.state === "connected" ? "secondary" : "primary")}>
              {li.state === "connected" ? "Reconnect" : "Connect LinkedIn"}
            </a>
          )}
          {li.state === "connected" && (
            <form action={disconnectLinkedInAction}>
              <button className={buttonClass("secondary")}>Disconnect</button>
            </form>
          )}
        </div>
      </section>

      <section id="grok" className="mt-10 border border-line bg-card p-6">
        <h2 className="text-h3 font-semibold">Grok API</h2>
        {grok.enabled ? (
          <p className="mt-2 text-sm">Enabled with model {grok.model}, monthly cap ${grok.budgetUsd.toFixed(2)}.</p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Disabled. Missing: {grok.missing.join(", ")}.</p>
        )}
        <p className="mt-2 text-sm text-ink-2">
          This check calls xAI&apos;s model list (free) to confirm the key works and the model exists. It doesn&apos;t enable spending.
        </p>
        <form action={checkGrokAction} className="mt-4">
          <button className={buttonClass("secondary")} disabled={!grok.enabled && !grok.keyPresent}>
            Check Grok API
          </button>
        </form>
      </section>
    </div>
  );
}
