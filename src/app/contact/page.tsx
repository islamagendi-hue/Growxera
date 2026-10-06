import type { Metadata } from "next";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { planMessage } from "@/content/experiments";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Talk to Growx Era",
  description: "Talk to Growx Era about diagnosing and fixing what's holding your growth back.",
  alternates: { canonical: "/contact" },
};

export default async function Contact({ searchParams }: PageProps<"/contact">) {
  const plan = (await searchParams).plan;
  const defaultMessage = typeof plan === "string" ? planMessage(plan) : undefined;
  return (
    <section>
      <Container className="grid gap-12 py-[3.4375rem] sm:py-[5.5625rem] lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow">Contact</p>
          <h1 className="mt-6 text-h2 font-semibold">Talk to Growx Era.</h1>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink-2">
            Tell us where growth feels stuck. If you haven&apos;t yet, the free Growth Diagnostic gives us both a head start.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4">
            <CtaLink href="/diagnostic" cta="contact_diagnose" variant="secondary">
              Start the Growth Diagnostic
            </CtaLink>
            {SITE.bookingUrl && (
              <CtaLink href={SITE.bookingUrl} cta="contact_book" booking variant="ghost">
                Book a call directly
              </CtaLink>
            )}
            {SITE.whatsapp && (
              <CtaLink href={`https://wa.me/${SITE.whatsapp}`} cta="contact_whatsapp" variant="ghost">
                Message us on WhatsApp
              </CtaLink>
            )}
          </div>
          <div className="mt-14 border-t border-line pt-8">
            <p className="eyebrow">What happens next</p>
            <ol className="mt-5 space-y-5">
              {[
                ["We read your message", "And your diagnostic report, if you've run one, so we start from your numbers."],
                ["We reply by email", "With a first view of where the constraint may be and what we'd look at."],
                ["A free 30-minute review, if useful", "A call to agree the first moves. No obligation."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="font-mono text-sm text-accent">0{i + 1}</span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="border border-line bg-card p-6 sm:p-10 lg:col-span-7">
          <ContactForm defaultMessage={defaultMessage} />
        </div>
      </Container>
    </section>
  );
}
