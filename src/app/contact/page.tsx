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
        </div>
        <div className="border border-line bg-card p-6 sm:p-10 lg:col-span-7">
          <ContactForm defaultMessage={defaultMessage} />
        </div>
      </Container>
    </section>
  );
}
