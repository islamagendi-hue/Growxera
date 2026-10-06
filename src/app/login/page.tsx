import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { currentAccount, safeRedirect } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeRedirect(sp.next) : undefined;
  if (await currentAccount()) redirect(next ?? "/account");
  return (
    <AuthShell
      eyebrow="Your account"
      title="Log in"
      intro={<p>Enter your email and we&apos;ll send you a secure login link. Your reports and progress are waiting.</p>}
      aside={
        <p className="text-sm text-ink-2">
          New here?{" "}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium underline underline-offset-4">
            Create your free account
          </Link>{" "}
          or{" "}
          <Link href="/diagnostic" className="font-medium underline underline-offset-4">
            start with the diagnostic
          </Link>
          .
        </p>
      }
    >
      <div className="border border-line bg-card p-6 sm:p-8">
        <AuthForm mode="login" next={next} defaultEmail={typeof sp.email === "string" ? sp.email.slice(0, 200) : ""} />
      </div>
    </AuthShell>
  );
}
