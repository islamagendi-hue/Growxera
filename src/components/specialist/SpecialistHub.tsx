"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CONSENT_TEXT } from "@/config/privacy";
import { track } from "@/lib/analytics/client";
import { formatSlot, type Slot } from "@/lib/booking/slots";

interface Person {
  name: string;
  email: string;
  company: string;
}

const inputClass =
  "mt-2 block w-full min-h-12 border border-line-strong bg-card px-4 text-base outline-none transition-colors placeholder:text-ink-3 focus:border-ink aria-[invalid=true]:border-alert";

const TOPICS = [
  { value: "results", label: "Understanding my results" },
  { value: "recommendations", label: "The recommendations" },
  { value: "report", label: "A question about my report" },
  { value: "work_together", label: "Working together" },
  { value: "other", label: "Something else" },
];

/** Turns the CTA context ("bottleneck:acquisition") into a topic and a starting message. */
function starter(topic: string | undefined, bottleneck: string | undefined) {
  if (!topic) return { topic: "results", message: "" };
  if (topic.startsWith("recommendation:")) return { topic: "recommendations", message: "I'd like help planning the top recommendation in my report." };
  if (topic.startsWith("benchmark:")) return { topic: "results", message: "One of my metrics is below the benchmark. What should I look at first?" };
  if (topic.startsWith("bottleneck:")) return { topic: "results", message: bottleneck ? `My report says ${bottleneck} is my primary bottleneck. Where should I start?` : "" };
  return { topic: "results", message: "" };
}

export function SpecialistHub({ signedIn, reportId, topic, bottleneck }: { signedIn: Person | null; reportId?: string; topic?: string; bottleneck?: string }) {
  return (
    <div className="mx-auto grid max-w-[1240px] gap-px border-x border-line bg-line px-0 sm:px-0 lg:grid-cols-2">
      <section id="ask" className="scroll-mt-24 bg-paper px-4 py-12 sm:px-8 sm:py-16">
        <p className="eyebrow">Ask a specialist</p>
        <h2 className="mt-3 text-h3 font-semibold">Send a question about your results</h2>
        <p className="mt-2 text-ink-2">We reply by email, usually within one working day.</p>
        <div className="mt-8">
          <AskForm signedIn={signedIn} reportId={reportId} start={starter(topic, bottleneck)} />
        </div>
      </section>
      <section id="book" className="scroll-mt-24 bg-paper px-4 py-12 sm:px-8 sm:py-16">
        <p className="eyebrow !text-accent">Free</p>
        <h2 className="mt-3 text-h3 font-semibold">Book a Free 30-Minute Review</h2>
        <p className="mt-2 text-ink-2">
          We go through your report together and agree the first moves. Times are in Riyadh time: Saturday 10:00–24:00, Sunday to
          Thursday 19:00–24:00. Closed on Fridays.
        </p>
        <div className="mt-8">
          <Booking signedIn={signedIn} reportId={reportId} />
        </div>
      </section>
    </div>
  );
}

function ContactFields({ errors }: { errors: Record<string, string> }) {
  const field = (name: keyof Person, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input name={name} className={inputClass} aria-invalid={!!errors[name]} required {...props} />
      {errors[name] && <span className="mt-1.5 block text-sm text-alert">{errors[name]}</span>}
    </label>
  );
  return (
    <div className="grid gap-5">
      {field("name", "Full name", { autoComplete: "name" })}
      {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
      {field("company", "Company", { autoComplete: "organization" })}
    </div>
  );
}

function Consent({ text, error }: { text: string; error?: string }) {
  return (
    <>
      <label className="flex gap-3 text-sm leading-relaxed text-ink-2">
        <input type="checkbox" name="consentProcessing" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]" aria-invalid={!!error} />
        <span>
          {text.replace(" as described in the Privacy Notice.", "")} as described in the{" "}
          <Link href="/privacy" target="_blank" className="underline underline-offset-4">
            Privacy Notice
          </Link>
          .
        </span>
      </label>
      {error && <p className="text-sm text-alert">{error}</p>}
    </>
  );
}

function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Company URL
        <input name="company_url" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function readContact(fd: FormData, errs: Record<string, string>) {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const contact = { name: get("name"), email: get("email"), company: get("company") };
  if (contact.name.length < 2) errs.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) errs.email = "Enter a valid work email.";
  if (!contact.company) errs.company = "Enter your company.";
  if (fd.get("consentProcessing") !== "on") errs.consentProcessing = "Please agree so we can help.";
  return contact;
}

function SignedInAs({ who }: { who: Person }) {
  return (
    <p className="text-sm text-ink-2">
      Sending as <strong className="text-ink">{who.name}</strong>, {who.company} ({who.email}).
    </p>
  );
}

function AskForm({ signedIn, reportId, start }: { signedIn: Person | null; reportId?: string; start: { topic: string; message: string } }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    const message = String(fd.get("message") ?? "").trim();
    if (message.length < 5) errs.message = "Tell us a little more.";
    const contact = signedIn ? undefined : readContact(fd, errs);
    setErrors(errs);
    if (Object.keys(errs).length) return setError("Please check the highlighted fields.");
    setState("sending");
    setError(null);
    const res = await fetch("/api/specialist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: fd.get("topic"),
        message,
        diagnosticSessionId: reportId,
        contact,
        consentProcessing: signedIn ? undefined : true,
        company_url: String(fd.get("company_url") ?? ""),
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setErrors(data?.fields ?? {});
      setError(data?.error ?? "We couldn't send your question. Please try again.");
      setState("idle");
      return;
    }
    track("specialist_question_sent", { withReport: !!reportId });
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className="border border-ink bg-card p-6">
        <p className="font-medium">Your question is with a specialist.</p>
        <p className="mt-2 text-sm text-ink-2">We&apos;ve emailed you a copy and will reply to the same address.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {signedIn ? <SignedInAs who={signedIn} /> : <ContactFields errors={errors} />}
      <label className="block">
        <span className="text-sm font-medium">Topic</span>
        <select name="topic" defaultValue={start.topic} className={`${inputClass} appearance-none`}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Your question</span>
        <textarea name="message" rows={5} maxLength={2000} defaultValue={start.message} aria-invalid={!!errors.message} className={`${inputClass} py-3`} />
        {errors.message && <span className="mt-1.5 block text-sm text-alert">{errors.message}</span>}
      </label>
      {!signedIn && <Consent text={CONSENT_TEXT.question} error={errors.consentProcessing} />}
      <Honeypot />
      {error && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60 sm:w-auto">
        {state === "sending" ? "Sending…" : "Send my question"} {state !== "sending" && <span aria-hidden>→</span>}
      </button>
    </form>
  );
}

function Booking({ signedIn, reportId }: { signedIn: Person | null; reportId?: string }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [booked, setBooked] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/booking/slots", { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.slots) return setLoadError(true);
    setSlots(data.slots);
    setDay((d) => d ?? data.slots[0]?.day ?? null);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches once on mount; state is set after the response.
    void load();
  }, []);

  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) m.set(s.day, [...(m.get(s.day) ?? []), s]);
    return [...m.entries()];
  }, [slots]);

  const dayLabel = (d: string) => {
    const date = new Date(`${d}T12:00:00Z`);
    return {
      weekday: date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    };
  };

  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const localTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) return;
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    const contact = signedIn ? undefined : readContact(fd, errs);
    setErrors(errs);
    if (Object.keys(errs).length) return setError("Please check the highlighted fields.");
    setState("sending");
    setError(null);
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotStart: chosen.start,
        diagnosticSessionId: reportId,
        message: String(fd.get("message") ?? "").trim(),
        contact,
        consentProcessing: signedIn ? undefined : true,
        company_url: String(fd.get("company_url") ?? ""),
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setState("idle");
    if (!res?.ok) {
      setErrors(data?.fields ?? {});
      setError(data?.error ?? "We couldn't book that time. Please try again.");
      if (res?.status === 409) {
        setChosen(null);
        void load();
      }
      return;
    }
    track("consultation_booked", { withReport: !!reportId });
    setBooked(data.slotStart ?? chosen.start);
  }

  if (booked) {
    return (
      <div role="status" className="border border-ink bg-card p-6">
        <p className="eyebrow !text-accent">Booked</p>
        <p className="mt-2 text-h3 font-semibold">{formatSlot(booked)}</p>
        <p className="mt-2 text-sm text-ink-2">
          We&apos;ve emailed your confirmation with the details, and we&apos;ll send a reminder before the call.
          {tz && tz !== "Asia/Riyadh" ? ` That's ${localTime(booked)} your time.` : ""}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-ink-2">
        We couldn&apos;t load available times.{" "}
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            void load();
          }}
          className="underline underline-offset-4"
        >
          Try again
        </button>
      </p>
    );
  }
  if (!slots) return <div className="h-48 animate-pulse bg-paper-2" aria-busy="true" aria-label="Loading available times" />;
  if (!slots.length) return <p className="text-ink-2">No times are open in the next three weeks. Send a question instead and we&apos;ll arrange a time with you.</p>;

  const daySlots = days.find(([d]) => d === day)?.[1] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium" id="day-label">
          1. Choose a day
        </p>
        <div role="radiogroup" aria-labelledby="day-label" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {days.map(([d, s]) => {
            const l = dayLabel(d);
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setDay(d);
                  setChosen(null);
                }}
                className={`flex min-h-16 min-w-[4.5rem] shrink-0 flex-col items-center justify-center border px-3 text-sm transition-colors ${
                  active ? "border-ink bg-ink text-paper" : "border-line-strong bg-card hover:border-ink"
                }`}
              >
                <span className={active ? "text-paper/70" : "text-ink-3"}>{l.weekday}</span>
                <span className="font-medium">{l.date}</span>
                <span className="sr-only">, {s.length} times available</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium" id="time-label">
          2. Choose a time <span className="font-normal text-ink-3">(Riyadh time)</span>
        </p>
        <div role="radiogroup" aria-labelledby="time-label" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {daySlots.map((s) => {
            const active = chosen?.start === s.start;
            return (
              <button
                key={s.start}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChosen(s)}
                className={`min-h-12 border font-mono text-sm transition-colors ${active ? "border-ink bg-ink text-paper" : "border-line-strong bg-card hover:border-ink"}`}
              >
                {s.time}
              </button>
            );
          })}
        </div>
      </div>
      {chosen && (
        <form onSubmit={submit} noValidate className="space-y-5 border-t border-line pt-6">
          <p className="text-sm font-medium">3. Confirm</p>
          <p className="border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
            <strong>{formatSlot(chosen.start)}</strong> · 30 minutes
            {tz && tz !== "Asia/Riyadh" ? <span className="block text-ink-2">That&apos;s {localTime(chosen.start)} your time.</span> : null}
          </p>
          {signedIn ? <SignedInAs who={signedIn} /> : <ContactFields errors={errors} />}
          <label className="block">
            <span className="text-sm font-medium">
              Anything we should know? <span className="font-normal text-ink-3">(optional)</span>
            </span>
            <textarea name="message" rows={3} maxLength={2000} className={`${inputClass} py-3`} />
          </label>
          {!signedIn && <Consent text={CONSENT_TEXT.booking} error={errors.consentProcessing} />}
          <Honeypot />
          {error && (
            <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
              {error}
            </p>
          )}
          <button type="submit" disabled={state === "sending"} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60">
            {state === "sending" ? "Booking…" : "Book my free review"} {state !== "sending" && <span aria-hidden>→</span>}
          </button>
        </form>
      )}
      {error && !chosen && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
