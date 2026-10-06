import Link from "next/link";
import { ProfileForm } from "@/components/account/ProfileForm";
import { formatDate } from "@/components/account/ReportList";
import { SITE } from "@/config/site";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await requireAccount("/account/profile");
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h1 className="text-h2 font-semibold">My profile</h1>
          <p className="mt-2 text-ink-2">Your details and company information. Advisors see these when you book a review.</p>
          <dl className="mt-8 space-y-4 text-sm">
            <div>
              <dt className="text-ink-3">Email (used to log in)</dt>
              <dd className="mt-1 font-medium">{account.email}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Member since</dt>
              <dd className="mt-1">{formatDate(account.created_at)}</dd>
            </div>
          </dl>
          <p className="mt-8 text-sm text-ink-2">
            To change your email or delete your account and data,{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact us
            </Link>
            {SITE.contactEmail ? ` or write to ${SITE.contactEmail}` : ""}.
          </p>
        </div>
        <div className="border border-line bg-card p-6 sm:p-8 lg:col-span-7 lg:col-start-6">
          <ProfileForm
            initial={{
              name: account.name,
              company: account.company,
              jobTitle: account.job_title ?? "",
              phone: account.phone ?? "",
              website: account.website ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
