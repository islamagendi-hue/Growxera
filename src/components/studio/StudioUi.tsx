import Link from "next/link";
import { signOutAction, signOutEverywhereAction } from "@/app/access/actions";
import { STATUS_LABELS, type Status } from "@/lib/studio/workflow";

const NAV = [
  { href: "/studio", label: "Overview" },
  { href: "/studio/queue", label: "Approval queue" },
  { href: "/studio/import", label: "Import" },
  { href: "/studio/capabilities", label: "Capabilities" },
  { href: "/studio/export", label: "Backup" },
];

export function StudioNav() {
  return (
    <nav aria-label="Studio" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-4 text-sm">
      <span className="eyebrow mr-2">LinkedIn Growth Studio</span>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="font-medium underline-offset-4 hover:underline">
          {n.label}
        </Link>
      ))}
      <form action={signOutAction} className="ml-auto">
        <button className="text-ink-3 underline-offset-4 hover:underline">Sign out</button>
      </form>
      <form action={signOutEverywhereAction}>
        <button className="text-ink-3 underline-offset-4 hover:underline">Sign out everywhere</button>
      </form>
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
