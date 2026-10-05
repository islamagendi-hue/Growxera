import Link from "next/link";
import { SITE } from "@/config/site";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";
import { ConsentSettingsButton } from "./ConsentBanner";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Wordmark className="text-xl" />
          <p className="mt-4 max-w-[38ch] text-ink-2">Growth &amp; Transformation Partner for ambitious businesses across the GCC.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm lg:col-span-4">
          <Link href="/diagnostic" className="hover:underline">Growth Diagnostic</Link>
          <Link href="/how-we-work" className="hover:underline">How we work</Link>
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/case-studies" className="hover:underline">Case studies</Link>
          <Link href="/contact" className="hover:underline">Contact</Link>
          <Link href="/privacy" className="hover:underline">Privacy notice</Link>
        </nav>
        <div className="text-sm text-ink-2 lg:col-span-3">
          {SITE.contactEmail && (
            <a href={`mailto:${SITE.contactEmail}`} className="block hover:underline">
              {SITE.contactEmail}
            </a>
          )}
          <ConsentSettingsButton />
        </div>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-line py-6 text-xs text-ink-3 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Growx_era. All rights reserved.</p>
        <p>Growth Diagnostic™ results are preliminary estimates, not financial advice.</p>
      </Container>
    </footer>
  );
}
