"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CONSENT_TEXT } from "@/config/privacy";
import { track } from "@/lib/analytics/client";

const inputClass =
  "mt-2 block w-full min-h-12 border border-line-strong bg-card px-4 text-base outline-none transition-colors placeholder:text-ink-3 focus:border-ink aria-[invalid=true]:border-alert";

type Field = "name" | "email" | "company" | "consentProcessing";

/** Passwordless login (email only) and signup (name, email, company). */
export function AuthForm({ mode, next, defaultEmail = "" }: { mode: "login" | "signup"; next?: string; defaultEmail?: string }) {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [resent, setResent] = useState(false);

  async function send(body: Record<string, unknown>) {
    setSending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return false;
      }
      track("sign_in_requested", { mode });
      return true;
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const body: Record<string, unknown> = { mode, email: get("email"), ...(next ? { next } : {}) };
    const errs: Partial<Record<Field, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) errs.email = "Enter a valid email address.";
    if (mode === "signup") {
      Object.assign(body, { name: get("name"), company: get("company"), consentProcessing: fd.get("consentProcessing") === "on", company_url: get("company_url") });
      if (String(body.name).length < 2) errs.name = "Enter your name.";
      if (!body.company) errs.company = "Enter your company.";
      if (!body.consentProcessing) errs.consentProcessing = "Please agree so we can create your account.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please check the highlighted fields.");
      return;
    }
    if (await send(body)) {
      setPayload(body);
      setSentTo(String(body.email));
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="border border-ink bg-card p-6 sm:p-8">
        <p className="eyebrow !text-accent">Link sent</p>
        <h2 className="mt-3 text-h3 font-semibold">Check your email.</h2>
        <p className="mt-3 text-ink-2">
          We sent you a secure login link. If <strong className="text-ink">{sentTo}</strong>{" "}
          {mode === "login" ? "has an account" : "is correct"}, it will arrive within a minute. The link works once and expires in
          20 minutes.
        </p>
        <p className="mt-4 text-sm text-ink-3">Nothing there? Check your spam or promotions folder.</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
          <button
            type="button"
            disabled={sending || resent}
            onClick={async () => {
              if (payload && (await send(payload))) setResent(true);
            }}
            className="underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {resent ? "Sent again" : sending ? "Sending…" : "Send the link again"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setResent(false);
            }}
            className="underline underline-offset-4"
          >
            Use a different email
          </button>
        </div>
        {formError && <p className="mt-4 text-sm text-alert">{formError}</p>}
      </div>
    );
  }

  const field = (name: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        className={inputClass}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <span id={`${name}-error`} className="mt-1.5 block text-sm text-alert">
          {errors[name]}
        </span>
      )}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {mode === "signup" && field("name", "Full name", { autoComplete: "name", required: true })}
      {field("email", mode === "signup" ? "Work email" : "Email", {
        type: "email",
        autoComplete: "email",
        inputMode: "email",
        required: true,
        defaultValue: defaultEmail,
        autoFocus: mode === "login",
      })}
      {mode === "signup" && field("company", "Company", { autoComplete: "organization", required: true })}
      {mode === "signup" && (
        <>
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Company URL
              <input name="company_url" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex gap-3 text-sm leading-relaxed text-ink-2">
            <input
              type="checkbox"
              name="consentProcessing"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              aria-invalid={!!errors.consentProcessing}
              aria-describedby={errors.consentProcessing ? "consent-error" : undefined}
            />
            <span>
              {CONSENT_TEXT.account.replace(" as described in the Privacy Notice.", "")} as described in the{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                Privacy Notice
              </Link>
              .
            </span>
          </label>
          {errors.consentProcessing && (
            <p id="consent-error" className="text-sm text-alert">
              {errors.consentProcessing}
            </p>
          )}
        </>
      )}
      {formError && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-6 font-medium text-paper transition-colors hover:bg-accent-ink disabled:opacity-60"
      >
        {sending ? "Sending…" : mode === "signup" ? "Create my account" : "Email me a login link"}
        {!sending && <span aria-hidden>→</span>}
      </button>
      <p className="text-center text-sm text-ink-3">No password needed. We email you a secure, one-time link.</p>
    </form>
  );
}
