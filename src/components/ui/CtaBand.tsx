import { SITE } from "@/config/site";
import { CtaLink } from "./CtaLink";
import { Container } from "./Section";

export function CtaBand({ source }: { source: string }) {
  return (
    <section className="bg-ink py-16 text-paper sm:py-20">
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="max-w-[20ch] text-h2 font-semibold">Ready to find what&apos;s holding your growth back?</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaLink href="/diagnostic" cta={`${source}_diagnose`} variant="inverse">
            Start Your Growth Diagnostic
          </CtaLink>
          <CtaLink
            href={SITE.bookingUrl || "/contact"}
            cta={`${source}_talk`}
            booking={!!SITE.bookingUrl}
            variant="ghost"
            className="!text-paper decoration-paper/40 sm:ml-4"
          >
            Talk to Growx_era
          </CtaLink>
        </div>
      </Container>
    </section>
  );
}
