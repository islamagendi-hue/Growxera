import { DeleteData } from "@/components/account/DeleteData";
import { ProfileForm } from "@/components/account/ProfileForm";
import { formatDate } from "@/components/account/ReportList";
import { SITE } from "@/config/site";
import { listDiagnostics } from "@/lib/server/accounts";
import { requireAccount } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const account = await requireAccount("/account/profile");
  const reports = (await listDiagnostics(account.id).catch(() => [])).length;
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
            To change your email, contact us{SITE.contactEmail ? ` at ${SITE.contactEmail}` : ""}.
          </p>
          <section id="delete" className="mt-10 border-t border-line pt-8" aria-labelledby="delete-title">
            <h2 id="delete-title" className="font-semibold">
              Delete your data
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              You can delete your saved data, or your whole account, yourself at any time. It takes two steps: choose what to
              delete, then type DELETE to confirm. Deletion is permanent and we email you a receipt.
            </p>
            <div className="mt-5">
              <DeleteData reports={reports} />
            </div>
          </section>
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
