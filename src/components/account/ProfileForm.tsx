"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClass =
  "mt-2 block w-full min-h-12 border border-line-strong bg-card px-4 text-base outline-none transition-colors focus:border-ink aria-[invalid=true]:border-alert";

export function ProfileForm({ initial }: { initial: { name: string; company: string; jobTitle: string; phone: string; website: string } }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(["name", "company", "jobTitle", "phone", "website"].map((k) => [k, String(fd.get(k) ?? "").trim()]));
    setStatus("saving");
    setMessage(null);
    const res = await fetch("/api/account/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setErrors(data?.fields ?? {});
      setMessage(data?.error ?? "We couldn't save your changes. Please try again.");
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("saved");
    router.refresh();
  }

  const field = (name: keyof typeof initial, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-3">(optional)</span>}
      </span>
      <input name={name} defaultValue={initial[name]} className={inputClass} aria-invalid={!!errors[name]} onInput={() => setStatus("idle")} {...props} />
      {errors[name] && <span className="mt-1.5 block text-sm text-alert">{errors[name]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Full name", { autoComplete: "name", required: true })}
        {field("company", "Company", { autoComplete: "organization", required: true })}
        {field("jobTitle", "Job title", { autoComplete: "organization-title" }, true)}
        {field("phone", "Phone / WhatsApp", { type: "tel", autoComplete: "tel", placeholder: "+966" }, true)}
        {field("website", "Company website", { inputMode: "url", placeholder: "example.com" }, true)}
      </div>
      {message && (
        <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
          {message}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === "saving"} className="inline-flex min-h-12 items-center justify-center bg-ink px-6 font-medium text-paper hover:bg-accent-ink disabled:opacity-60">
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span role="status" className="text-sm text-accent">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
