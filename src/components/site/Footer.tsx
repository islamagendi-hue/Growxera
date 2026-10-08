"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHROME, isArabicPath } from "@/config/chrome";
import { SITE } from "@/config/site";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";
import { ConsentSettingsButton } from "./ConsentBanner";

const FOOTER_LINKS = [
  "/diagnostic",
  "/how-we-work",
  "/advisor",
  "/account",
  "/services",
  "/case-studies",
  "/experimentation-lab",
  "/insights",
  "/contact",
  "/privacy",
];

export function Footer() {
  const isArabic = isArabicPath(usePathname());
  const t = CHROME[isArabic ? "ar" : "en"];
  return (
    <footer lang={isArabic ? "ar" : undefined} dir={isArabic ? "rtl" : undefined} className="border-t border-line bg-paper print:hidden">
      <Container className="grid gap-[2.125rem] py-[3.4375rem] sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Wordmark className="text-xl" />
          <p className="mt-4 max-w-[38ch] text-pretty text-ink-2">{t.tagline}</p>
        </div>
        <nav aria-label={t.footerNav} className="grid grid-cols-2 gap-x-8 text-sm lg:col-span-4 [&>a]:py-2.5 lg:[&>a]:py-1.5">
          {FOOTER_LINKS.map((href) => (
            <Link key={href} href={href} className="hover:underline">
              {t.footer[href]}
            </Link>
          ))}
        </nav>
        <div className="text-sm text-ink-2 sm:col-span-2 lg:col-span-3">
          {SITE.contactEmail && (
            <a href={`mailto:${SITE.contactEmail}`} className="block hover:underline">
              <bdi dir="ltr">{SITE.contactEmail}</bdi>
            </a>
          )}
          <ConsentSettingsButton label={t.privacySettings} />
        </div>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-line py-6 text-xs text-ink-3 sm:flex-row sm:justify-between">
        <p>
          {isArabic ? (
            <>
              {t.rights} <bdi dir="ltr">© {new Date().getFullYear()} Growx Era</bdi>
            </>
          ) : (
            <>
              © {new Date().getFullYear()} Growx Era. {t.rights}
            </>
          )}
        </p>
        <p className="text-balance">{t.disclaimer}</p>
      </Container>
    </footer>
  );
}
