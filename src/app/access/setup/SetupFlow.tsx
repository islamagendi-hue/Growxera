"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { tokenFromHash } from "@/lib/studio/setup-link";
import { beginSetupAction, setupAction, type SetupStart, type SetupState } from "../actions";

const field = "mt-1 w-full border border-line-strong bg-card p-3 text-sm focus:border-ink focus:outline-none";
const initial: SetupState = { error: null };

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-h2 font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-ink-2">{text}</p>
    </div>
  );
}

/** Reads the token from the #fragment, removes it from the address bar, and runs the two setup steps. */
export function SetupFlow({ minPassword, legacyLink }: { minPassword: number; legacyLink: boolean }) {
  const token = useRef<string | null | undefined>(undefined);
  const [start, setStart] = useState<(SetupStart & { token?: string }) | "loading" | "missing">("loading");
  const [state, formAction, pending] = useActionState(setupAction, initial);

  useEffect(() => {
    if (token.current !== undefined) return; // run once, also under React's development double-run
    token.current = legacyLink ? null : tokenFromHash(window.location.hash);
    // Take the token out of the address bar and this history entry straight away.
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    const t = token.current;
    if (!t) {
      queueMicrotask(() => setStart("missing"));
      return;
    }
    const form = new FormData();
    form.set("token", t);
    beginSetupAction(form).then(
      (r) => setStart(r.ok ? { ...r, token: t } : r),
      () => setStart({ ok: false }),
    );
  }, [legacyLink]);

  if (start === "loading") return <Message title="Set up sign-in" text="Checking the link…" />;
  if (start === "missing") {
    return (
      <Message
        title="Open the setup link"
        text="This page needs the one-time setup link. Open it again exactly as you received it (it works until it is used or expires). Older links ending in ?token= aren't accepted."
      />
    );
  }
  if (!start.ok) return <Message title="Link expired" text="This setup link has expired or was already used. Ask for a new one." />;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-h2 font-semibold">Set up sign-in</h1>
      <p className="mt-2 text-sm text-ink-2">For {start.email}. This link works once.</p>
      {state.error && (
        <p role="alert" className="mt-4 border border-alert p-3 text-sm text-alert">
          {state.error} Enter the password and the new code again.
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">1. Scan this with your authenticator app</h2>
        <p className="mt-1 text-sm text-ink-2">Google Authenticator, Microsoft Authenticator or 1Password: add an account, then scan.</p>
        <div className="mt-4 w-[220px] bg-white p-2" dangerouslySetInnerHTML={{ __html: start.qrSvg }} />
        <p className="mt-3 text-xs text-ink-3">
          Can&apos;t scan? Enter this key by hand: <code className="break-all font-mono">{start.secret.match(/.{1,4}/g)?.join(" ")}</code>
        </p>
      </section>

      <form action={formAction} className="mt-8 grid gap-4" autoComplete="off">
        <h2 className="font-semibold">2. Choose a password and confirm the code</h2>
        <input type="hidden" name="token" value={start.token ?? ""} />
        <input type="hidden" name="sealed" value={start.sealed} />
        <label className="text-sm font-medium">
          Password (at least {minPassword} characters)
          <input name="password" type="password" required minLength={minPassword} autoComplete="new-password" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          Password again
          <input name="confirm" type="password" required minLength={minPassword} autoComplete="new-password" dir="ltr" className={field} />
        </label>
        <label className="text-sm font-medium">
          6-digit code now shown in the app
          <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" dir="ltr" className={field} />
        </label>
        <button className={buttonClass("primary")} disabled={pending}>
          {pending ? "Saving…" : "Save and sign in"}
        </button>
      </form>
    </div>
  );
}
