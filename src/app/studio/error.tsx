"use client";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

/**
 * Shown when a studio page fails to load (for example the database didn't answer). Never shows
 * internal details; the reference lets the owner match it with the server log. Nothing was changed:
 * pages only read, and every change goes through a server action that reports its own result.
 */
export default function StudioError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mt-8 max-w-2xl border border-alert bg-alert-soft p-6">
      <h1 className="text-h3 font-semibold text-alert">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm">
        Usually the database didn&apos;t answer in time. Nothing was changed. Try again; if it keeps happening, check the Supabase project status.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-ink-3">Reference: {error.digest}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={() => retry()} className={buttonClass("primary")}>
          Try again
        </button>
        <Link href="/studio" className={buttonClass("secondary")}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
