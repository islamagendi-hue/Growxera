import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";

export default function NotFound() {
  return (
    <Container className="py-24 sm:py-32">
      <p className="eyebrow">404</p>
      <h1 className="mt-6 text-h2 font-semibold">This page doesn&apos;t exist.</h1>
      <p className="mt-4 text-lg text-ink-2">But your growth bottleneck probably does.</p>
      <div className="mt-10">
        <CtaLink href="/diagnostic" cta="404_diagnose">
          Start the Growth Diagnostic
        </CtaLink>
      </div>
    </Container>
  );
}
