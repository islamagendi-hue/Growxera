import { first, Notice } from "@/components/studio/StudioUi";
import { buttonClass } from "@/components/ui/button";
import { CAPABILITIES, CHECKED_ON, STATUS_TEXT, type CapabilityStatus } from "@/lib/studio/capabilities";
import { grokStatus } from "@/lib/studio/grok";
import { requireOwner } from "@/lib/studio/owner";
import { checkGrokAction } from "../actions";

export const dynamic = "force-dynamic";

const TONE: Record<CapabilityStatus, string> = {
  available: "bg-accent text-paper",
  unverified: "bg-paper-2 text-ink-2",
  unavailable: "bg-alert-soft text-alert",
};

export default async function CapabilitiesPage({ searchParams }: PageProps<"/studio/capabilities">) {
  await requireOwner("/studio/capabilities");
  const sp = await searchParams;
  const grok = grokStatus();
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
            {CAPABILITIES.map((c) => (
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
