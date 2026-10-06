"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { CONSENT_TEXT } from "@/config/privacy";
import { getAnonymousId, getAttribution, track } from "@/lib/analytics/client";
import type { Answers, DiagnosticReport } from "@/lib/diagnostic/types";

type Fields = "name" | "email" | "company" | "phone" | "jobTitle" | "website" | "message" | "consentProcessing";

const inputClass =
  "mt-2 block w-full min-h-12 border border-line-strong bg-card px-4 text-base outline-none transition-colors placeholder:text-ink-3 focus:border-ink aria-[invalid=true]:border-alert";

export function LeadForm({
  source,
  sessionId,
  answers,
  submitLabel,
  showMessage = false,
  defaultMessage,
  onSuccess,
}: {
  source: "diagnostic" | "contact";
  sessionId?: string;
  answers?: Answers;
  submitLabel: string;
  showMessage?: boolean;
  defaultMessage?: string;
  onSuccess: (report: DiagnosticReport | null, emailedTo?: string) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  const onFirstInput = () => {
    if (started.current) return;
    started.current = true;
    track("lead_form_started", { source, sessionId });
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const lead = {
      name: get("name"),
      email: get("email"),
      company: get("company"),
      phone: get("phone"),
      jobTitle: get("jobTitle"),
      website: get("website"),
      message: get("message"),
      consentProcessing: fd.get("consentProcessing") === "on",
      consentMarketing: fd.get("consentMarketing") === "on",
    };
    // Client-side validation mirrors the server schema; the server remains the authority.
    const next: Partial<Record<Fields, string>> = {};
    if (lead.name.length < 2) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) next.email = "Enter a valid work email.";
    if (!lead.company) next.company = "Enter your company.";
    if (lead.phone && !/^\+?[0-9\s()-]{7,}$/.test(lead.phone)) next.phone = "Include the country code, e.g. +966 5X XXX XXXX.";
    if (!lead.consentProcessing) next.consentProcessing = "Please agree so we can prepare your report.";
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError("Please check the highlighted fields.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead,
          source,
          diagnosticSessionId: sessionId,
          answers,
          anonymousId: getAnonymousId(),
          attribution: getAttribution(),
          company_url: get("company_url"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      track("lead_submitted", { source, sessionId, marketing_consent: lead.consentMarketing });
      onSuccess(data.report ?? null, data.emailSent ? lead.email : undefined);
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const field = (name: Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-3">(optional)</span>}
      </span>
      <input
        name={name}
        className={inputClass}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        onInput={onFirstInput}
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
      {/* The report form asks for three things only; the contact form keeps the optional extras. */}
      <div className={`grid gap-5 ${source === "contact" ? "sm:grid-cols-2" : ""}`}>
        {field("name", "Full name", { autoComplete: "name", required: true })}
        {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email", required: true })}
        {field("company", "Company", { autoComplete: "organization", required: true })}
        {source === "contact" && (
          <>
            {field("phone", "Phone / WhatsApp", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "+966" }, true)}
            {field("jobTitle", "Job title", { autoComplete: "organization-title" }, true)}
            {field("website", "Company website", { type: "url", inputMode: "url", placeholder: "example.com" }, true)}
          </>
        )}
      </div>
      {showMessage && (
        <label className="block">
          <span className="text-sm font-medium">
            What would you like to discuss? <span className="font-normal text-ink-3">(optional)</span>
          </span>
          <textarea name="message" rows={defaultMessage ? 8 : 4} defaultValue={defaultMessage} maxLength={2000} className={`${inputClass} py-3`} onInput={onFirstInput} />
        </label>
      )}
      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company URL
          <input name="company_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <fieldset className="space-y-3 border-t border-line pt-5">
        <legend className="sr-only">Consent</legend>
        <label className="flex gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="consentProcessing"
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
            aria-invalid={!!errors.consentProcessing}
            aria-describedby={errors.consentProcessing ? "consent-error" : undefined}
          />
          <span>
            {CONSENT_TEXT.processing.replace(" as described in the Privacy Notice.", "")}{" "}
            as described in the{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4">
              Privacy Notice
            </Link>
            . <span className="text-ink-3">(required)</span>
          </span>
        </label>
        {errors.consentProcessing && (
          <p id="consent-error" className="text-sm text-alert">
            {errors.consentProcessing}
          </p>
        )}
        <label className="flex gap-3 text-sm leading-relaxed text-ink-2">
          <input type="checkbox" name="consentMarketing" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" />
          <span>
            {CONSENT_TEXT.marketing} <span className="text-ink-3">(optional)</span>
          </span>
        </label>
      </fieldset>
      {formError && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-6 font-medium text-paper transition-colors hover:bg-accent-ink disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Sending…" : submitLabel}
        {!submitting && <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
