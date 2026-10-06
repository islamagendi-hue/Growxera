import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyLink } from "./VerifyLink";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  // The token is in the URL: never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default function VerifyPage() {
  return (
    <AuthShell eyebrow="Secure sign-in" title="Welcome to Growx Era" intro={<p>One click and you&apos;re in. This link works once.</p>}>
      <Suspense fallback={<div className="min-h-48 border border-line bg-card" aria-busy="true" />}>
        <VerifyLink />
      </Suspense>
    </AuthShell>
  );
}
