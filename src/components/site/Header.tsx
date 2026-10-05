"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/config/site";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";

export function Header() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const inDiagnostic = pathname.startsWith("/diagnostic");

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="text-lg" aria-label="Growx_era home">
          <Wordmark />
        </Link>
        {!inDiagnostic && (
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm text-ink-2 transition-colors hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          {!inDiagnostic && (
            <CtaLink href="/diagnostic" cta="header_diagnose" className="hidden !min-h-10 !px-4 text-sm sm:inline-flex">
              Diagnose your growth
            </CtaLink>
          )}
          {inDiagnostic ? (
            <Link href="/" className="text-sm text-ink-2 hover:text-ink">
              Exit
            </Link>
          ) : (
            <button
              type="button"
              className="-mr-2 flex h-11 w-11 items-center justify-center md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpenOn(open ? null : pathname)}
            >
              <span className="relative block h-3 w-5">
                <span className={`absolute left-0 h-px w-5 bg-ink transition-transform ${open ? "top-1.5 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 h-px w-5 bg-ink transition-transform ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
              </span>
            </button>
          )}
        </div>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper md:hidden">
          <Container className="flex flex-col py-4">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="border-b border-line py-4 text-lg">
                {n.label}
              </Link>
            ))}
            <CtaLink href="/diagnostic" cta="mobile_nav_diagnose" className="mt-6">
              Diagnose your growth
            </CtaLink>
          </Container>
        </nav>
      )}
    </header>
  );
}
