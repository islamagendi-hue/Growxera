"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

type State = { kind: "ready" } | { kind: "working" } | { kind: "failed"; reason: string; email?: string };

const MESSAGES: Record<string, { title: string; body: string }> = {
  expired: { title: "This link has expired.", body: "For your security, links expire after a short time. Enter your email and we'll send a fresh one." },
  used: { title: "This link has already been used.", body: "Each link works once. If that wasn't you signing in, request a new link below." },
  invalid: { title: "This link isn't valid.", body: "It may be incomplete. Copy the whole link from the email, or request a new one." },
  error: { title: "We couldn't sign you in just now.", body: "Please try the link again in a moment." },
};

/**
 * Uses the token with an explicit click. Email security scanners open links
 * automatically; requiring a click (a POST) stops them from using up the token.
 */
export function VerifyLink() {
  const params = useSearchParams();
  const router = useRouter();
  // Kept in state: the address bar is cleaned below, which also clears the search params.
  const [token] = useState(() => params.get("token") ?? "");
  const [state, setState] = useState<State>(token ? { kind: "ready" } : { kind: "failed", reason: "invalid" });

  // Take the token out of the address bar and history.
  useEffect(() => {
    if (params.get("token")) window.history.replaceState(null, "", "/auth/verify");
  }, [params]);

  async function verify() {
    setState({ kind: "working" });
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.replace(data.redirectTo ?? "/account");
        router.refresh();
        return;
      }
      setState({ kind: "failed", reason: data.reason ?? "error", email: data.email ?? undefined });
    } catch {
      setState({ kind: "failed", reason: "error" });
    }
  }

  if (state.kind === "failed") {
    const m = MESSAGES[state.reason] ?? MESSAGES.error;
    return (
      <div className="border border-line bg-card p-6 sm:p-8">
        <h2 className="text-h3 font-semibold">{m.title}</h2>
        <p className="mt-2 text-ink-2">{m.body}</p>
        {state.reason === "error" ? (
          <button type="button" onClick={verify} className="mt-6 inline-flex min-h-12 items-center bg-ink px-6 font-medium text-paper">
            Try again
          </button>
        ) : (
          <div className="mt-6 border-t border-line pt-6">
            <AuthForm mode="login" defaultEmail={state.email ?? ""} />
            <p className="mt-4 text-center text-sm text-ink-3">
              No account yet?{" "}
              <Link href="/signup" className="underline underline-offset-4">
                Create one
              </Link>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-ink bg-card p-6 sm:p-8">
      <p className="text-ink-2">Continue to open your account and your saved reports.</p>
      <button
        type="button"
        onClick={verify}
        disabled={state.kind === "working"}
        autoFocus
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60"
      >
        {state.kind === "working" ? "Signing you in…" : "Continue to my account"}
        {state.kind !== "working" && <span aria-hidden>→</span>}
      </button>
    </div>
  );
}
