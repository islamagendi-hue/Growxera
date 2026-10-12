import { signOutAction } from "@/app/access/actions";
import { StudioNavLinks } from "./StudioNavLinks";
import { STATUS_LABELS, type Status } from "@/lib/studio/workflow";

export function StudioNav() {
  return (
    <nav aria-label="Studio" className="border-b border-line pb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="eyebrow mr-auto">LinkedIn Growth Studio</span>
        <form action={signOutAction}>
          <button className="text-ink-3 underline-offset-4 hover:underline">Sign out</button>
        </form>
      </div>
      <div className="mt-3">
        <StudioNavLinks />
      </div>
    </nav>
  );
}

const TONE: Partial<Record<Status, string>> = {
  ready_for_review: "bg-accent-soft text-accent-ink",
  approved: "bg-ink text-paper",
  executed: "bg-ink-2 text-paper",
  verified: "bg-accent text-paper",
  failed: "bg-alert-soft text-alert",
  blocked: "bg-alert-soft text-alert",
  rejected: "bg-paper-2 text-ink-3",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${TONE[status] ?? "bg-paper-2 text-ink-2"}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Feedback after a server action (passed back in the query string). */
export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <p role="alert" className="mt-6 border border-alert bg-alert-soft p-4 text-sm text-alert">{error}</p>;
  if (notice) return <p role="status" className="mt-6 border border-accent bg-accent-soft p-4 text-sm text-accent-ink">{notice}</p>;
  return null;
}

/** Labels where a number came from. Every figure in the studio carries one. */
export function SourceLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-ink-3">{children}</p>;
}

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A labelled on/off state, colour plus words (never colour alone). */
export function OnOff({ on, label }: { on: boolean; label?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${on ? "bg-accent text-paper" : "bg-paper-2 text-ink-2"}`}>
      {label ?? (on ? "On" : "Off")}
    </span>
  );
}
