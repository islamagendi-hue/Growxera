import type { Metadata } from "next";
import { Container } from "@/components/ui/Section";
import { POLICY_VERSION, RETENTION } from "@/config/privacy";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How Growx Era collects, uses and protects personal data.",
  alternates: { canonical: "/privacy" },
};

const TBD = ({ children }: { children: React.ReactNode }) => (
  <mark className="bg-alert-soft px-1 text-alert">[{children}]</mark>
);

export default function Privacy() {
  const contact = SITE.contactEmail ? <a className="underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : <TBD>privacy contact email</TBD>;
  return (
    <Container className="py-[3.4375rem] sm:py-[5.5625rem]">
      <article className="mx-auto max-w-[70ch] space-y-8 leading-relaxed text-ink-2 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        <header>
          <p className="eyebrow">Version {POLICY_VERSION}</p>
          <h1 className="mt-4 text-h2 font-semibold text-ink">Privacy Notice</h1>
          <p className="mt-6 border-l-2 border-alert bg-alert-soft p-4 text-sm text-ink">
            Draft for legal review. Highlighted items must be completed before launch. This notice is written to
            align with the Saudi Personal Data Protection Law (PDPL) and its Implementing Regulations, and with UAE
            PDPL principles, but it is not legal advice.
          </p>
        </header>

        <section>
          <h2>Who we are</h2>
          <p>
            Growx Era (<TBD>legal entity name, commercial registration number, registered address</TBD>) is the
            controller of the personal data described here. Contact us about privacy at {contact}.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong className="text-ink">Diagnostic answers</strong>: information about your business (model, market,
              revenue ranges, metrics). This describes the business, not you personally, and you can answer
              &ldquo;I don&apos;t know&rdquo; to any metric.
            </li>
            <li>
              <strong className="text-ink">Contact details you choose to give us</strong>: name, work email, company,
              and optionally phone/WhatsApp, job title and company website.
            </li>
            <li>
              <strong className="text-ink">Your account</strong>: if you create one or open the link in your report email,
              we keep your name, email, company, optional profile details, your saved diagnostics, and a record of
              sign-in links and sessions (stored as one-way hashes, never the link itself).
            </li>
            <li>
              <strong className="text-ink">Advisor requests</strong>: questions you send and review calls you book,
              with the time, your message and a reference to your report.
            </li>
            <li>
              <strong className="text-ink">Uploaded files</strong>: an orders export you upload is read in your browser
              and never sent to us. We receive only the figures you choose to use and a short summary (file name, row count,
              date range and column names).
            </li>
            <li>
              <strong className="text-ink">Attribution</strong>: the campaign parameters (UTM), referring site and
              landing page of your visit, stored in your browser and sent only with a diagnostic or form you submit.
            </li>
            <li>
              <strong className="text-ink">Analytics, only if you accept them</strong>: pseudonymous usage events (for
              example, which diagnostic step was completed) linked to a random identifier, and Google Analytics 4, which
              sets its own cookies and is provided by Google. We do not store your IP address with our own events and
              we do not use advertising cookies.
            </li>
          </ul>
        </section>

        <section>
          <h2>Why we use it, and on what basis</h2>
          <ul>
            <li>To generate your diagnostic result: you request it by completing the diagnostic.</li>
            <li>
              To store your details, prepare your full report, email you a copy of it and contact you about it: based on
              your explicit consent, given on the form. Consent is recorded with the wording and policy version you agreed to.
            </li>
            <li>To keep your account, save your reports and show your progress over time: based on your consent when you create the account or open your report link.</li>
            <li>To answer your questions and hold the review calls you book, including reading your report beforehand: based on your request and consent.</li>
            <li>To send growth insights by email or WhatsApp: only if you separately opt in. You can opt out at any time.</li>
            <li>To understand and improve the diagnostic: only if you accept analytics.</li>
          </ul>
          <p>We do not sell personal data, and we do not use your data for automated decisions with legal effect. The Growth Score is an indicative, preliminary estimate.</p>
        </section>

        <section>
          <h2>Who processes it</h2>
          <ul>
            <li>Vercel Inc. (website hosting).</li>
            <li>Supabase Inc. (database), hosted in the United States (us-east-1) region.</li>
            <li>Resend (sending your report, sign-in links and booking emails).</li>
            <li>
              <TBD>Any CRM, WhatsApp provider or notification tool connected to lead capture</TBD>.
            </li>
          </ul>
          <p>
            Some of these providers may process data outside the Kingdom of Saudi Arabia. Where that happens we rely on
            the transfer conditions permitted under the PDPL and its Regulations on Personal Data Transfer Outside the
            Kingdom, and on contractual safeguards with each provider. <TBD>Confirm transfer basis with counsel</TBD>.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <ul>
            <li>Diagnostics not linked to contact details: {RETENTION.anonymousDiagnosticsDays} days.</li>
            <li>Contact details and linked diagnostics: up to {Math.round(RETENTION.leadsDays / 365)} years after our last interaction, unless you ask us to delete them sooner.</li>
            <li>Accounts and saved diagnostics: while your account is active, until you delete them or ask us to.</li>
            <li>Sign-in links: deleted a day after they expire. Sessions: deleted when they expire or you log out.</li>
            <li>Analytics events: {RETENTION.analyticsEventsDays} days.</li>
          </ul>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            You can ask to be informed about how we process your data, to access or obtain a copy of it, to correct it,
            to have it deleted, and to withdraw your consent at any time (this does not affect processing already
            carried out). Email {contact} and we will respond within the period required by law. You may also lodge a
            complaint with the Saudi Data &amp; AI Authority (SDAIA) or your local data protection authority.
          </p>
          <p>
            <strong>Delete it yourself.</strong> If you have an account, go to My account → My profile → Delete your
            data. It takes two steps: choose whether to delete your saved data (diagnostics, reports, progress history and
            advisor requests) or your whole account, then type DELETE to confirm. Deletion is immediate and permanent, and
            we email you a receipt. Without an account, email {contact} and we will delete it for you.
          </p>
        </section>

        <section>
          <h2>Cookies and browser storage</h2>
          <p>
            We use browser storage for essential functions: remembering your privacy choice, keeping your diagnostic
            progress while you complete it, and holding campaign attribution until you submit a form. When you log in we
            set two essential cookies: a secure session cookie that keeps you signed in for up to 30 days, and a cookie
            that only tells the menu to show &ldquo;My account&rdquo;. Analytics
            storage, including Google Analytics cookies, is used only after you accept it. You can change your choice at any time from &ldquo;Privacy
            settings&rdquo; in the footer.
          </p>
        </section>

        <section>
          <h2>Security</h2>
          <p>
            Data is encrypted in transit and stored in a database that is only accessible from our servers. There are no
            passwords to leak: you sign in with one-time links that expire after 20 minutes (48 hours for the link in
            your report email) and stop working once used. Access is
            limited to the Growx Era team members who need it.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>We will update the version above when this notice changes, and ask for consent again where the change requires it.</p>
        </section>
      </article>
    </Container>
  );
}
