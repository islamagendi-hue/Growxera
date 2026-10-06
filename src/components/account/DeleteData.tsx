"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics/client";

type Scope = "data" | "account";

const COPY: Record<Scope, { button: string; title: string; deletes: string[]; keeps: string; confirm: string }> = {
  data: {
    button: "Delete my data",
    title: "Delete all your saved data?",
    deletes: ["Every saved diagnostic and report", "Your progress history and comparisons", "Questions and booking requests sent to advisors"],
    keeps: "Your account and profile stay, so you can log in and start fresh.",
    confirm: "Permanently delete my data",
  },
  account: {
    button: "Delete my account",
    title: "Delete your account and everything in it?",
    deletes: ["Your account and profile", "Every saved diagnostic, report and progress history", "Questions and booking requests sent to advisors", "All sign-in links and sessions on every device"],
    keeps: "You will be logged out. You can sign up again later with the same email, starting from nothing.",
    confirm: "Permanently delete my account",
  },
};

/** Self-service deletion in two steps: choose and review, then type DELETE to confirm. */
export function DeleteData({ reports }: { reports: number }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Scope | null>(null);

  async function confirm() {
    if (!scope) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, confirm: typed }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "We couldn't reach the server. Please try again.");
      return;
    }
    track("account_data_deleted", { scope });
    setDone(scope);
    setScope(null);
    setTyped("");
    if (scope === "data") router.refresh();
  }

  if (done === "account") {
    return (
      <div role="status" className="border border-line bg-card p-5">
        <p className="font-medium">Your account has been deleted.</p>
        <p className="mt-1 text-sm text-ink-2">Everything saved in it is gone, and we&apos;ve emailed you a confirmation.</p>
        <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">
          Back to the home page
        </Link>
      </div>
    );
  }

  return (
    <div>
      {done === "data" && (
        <p role="status" className="mb-4 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
          Your saved data has been deleted. We&apos;ve emailed you a confirmation.
        </p>
      )}
      {!scope ? (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-6">
          <button type="button" onClick={() => setScope("data")} className="min-h-11 text-sm text-alert underline underline-offset-4">
            {COPY.data.button}
          </button>
          <button type="button" onClick={() => setScope("account")} className="min-h-11 text-sm text-alert underline underline-offset-4">
            {COPY.account.button}
          </button>
        </div>
      ) : (
        <div className="border border-alert bg-alert-soft/40 p-5" role="region" aria-label={COPY[scope].title}>
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-alert">Step 2 of 2 · Confirm</p>
          <p className="mt-2 font-semibold">{COPY[scope].title}</p>
          <p className="mt-3 text-sm text-ink-2">This permanently deletes:</p>
          <ul className="mt-2 space-y-1 text-sm">
            {COPY[scope].deletes.map((d) => (
              <li key={d} className="flex gap-2">
                <span aria-hidden className="text-alert">×</span>
                {d}
                {d.startsWith("Every saved") && reports > 0 && <span className="text-ink-3">({reports})</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-2">{COPY[scope].keeps} This can&apos;t be undone.</p>
          <label className="mt-5 block">
            <span className="text-sm font-medium">
              Type <span className="font-mono">DELETE</span> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-2 block min-h-12 w-full max-w-xs border border-line-strong bg-card px-4 font-mono outline-none focus:border-ink"
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                setScope(null);
                setTyped("");
                setError(null);
              }}
              className="min-h-12 px-2 text-sm text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || typed.trim().toUpperCase() !== "DELETE"}
              onClick={confirm}
              className="inline-flex min-h-12 items-center justify-center bg-alert px-6 text-[0.95rem] font-medium text-paper transition-opacity disabled:opacity-40"
            >
              {busy ? "Deleting…" : COPY[scope].confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
