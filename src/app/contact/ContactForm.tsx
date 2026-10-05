"use client";
import { useState } from "react";
import { LeadForm } from "@/components/diagnostic/LeadForm";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div role="status" className="border-l-2 border-accent bg-accent-soft p-6">
        <p className="font-medium">Thank you. We&apos;ve received your message.</p>
        <p className="mt-2 text-ink-2">Someone from Growx_era will be in touch shortly.</p>
      </div>
    );
  }
  return <LeadForm source="contact" submitLabel="Send message" showMessage onSuccess={() => setSent(true)} />;
}
