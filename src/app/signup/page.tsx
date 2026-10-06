import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { currentAccount, safeRedirect } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeRedirect(sp.next) : undefined;
  if (await currentAccount()) redirect(next ?? "/account");
  return (
    <AuthShell
      eyebrow="Your account"
      title="Create your free account"
      intro={<p>Keep every Growth Diagnostic in one place, see how your business changes over time, and talk to an advisor with your report in hand.</p>}
      aside={
        <ul className="space-y-3 text-sm">
          {["Every report saved, never overwritten", "Progress compared month to month", "No password: a secure link by email"].map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="text-accent">
                ✓
              </span>
              {t}
            </li>
          ))}
          <li className="pt-4 text-ink-2">
            Already have an account?{" "}
            <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium underline underline-offset-4">
              Log in
            </Link>
          </li>
        </ul>
      }
    >
      <div className="border border-line bg-card p-6 sm:p-8">
        <AuthForm mode="signup" next={next} />
      </div>
    </AuthShell>
  );
}
