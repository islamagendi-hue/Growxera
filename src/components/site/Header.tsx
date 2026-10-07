"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ACCOUNT_NAV, NAV } from "@/config/site";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";
import { Wordmark } from "./Wordmark";

// The session cookie is HttpOnly; this hint cookie only tells the menu which links to show.
const readSignedIn = () => /(?:^|;\s*)gx_signed_in=1/.test(document.cookie);
const noop = () => () => {};

/** Re-read on every render; login and logout both navigate, which re-renders the header. */
const useSignedIn = () => useSyncExternalStore(noop, readSignedIn, () => false);

export function Header() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const signedIn = useSignedIn();
  const inDiagnostic = pathname.startsWith("/diagnostic");
  const isArabic = pathname === "/ar" || pathname.startsWith("/ar/");
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined);

  // The diagnostic is a standalone landing page: no site header.
  if (inDiagnostic) return null;

  return (
    <header className="sticky top-0 z-40 print:hidden border-b border-line/80 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="text-lg" aria-label="Growx Era home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 xl:gap-8 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)} className="text-sm text-ink-2 transition-colors hover:text-ink aria-[current=page]:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href={isArabic ? "/" : "/ar"}
            hrefLang={isArabic ? "en" : "ar"}
            lang={isArabic ? "en" : "ar"}
            className="px-1 py-2.5 text-sm text-ink-2 hover:text-ink"
          >
            {isArabic ? "English" : "العربية"}
          </Link>
          <span className="hidden lg:block">
            {signedIn ? <AccountMenu /> : (
              <Link href="/login" className="px-1 py-2.5 text-sm text-ink-2 hover:text-ink">
                Log in
              </Link>
            )}
          </span>
          <span className="hidden sm:block">
            <CtaLink href="/diagnostic" cta="header_diagnose" className="!min-h-10 !px-4 text-sm">
              {signedIn ? "New diagnostic" : "Diagnose your growth"}
            </CtaLink>
          </span>
          <button
            type="button"
            className="-mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
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
        </div>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-paper lg:hidden">
          <Container className="flex flex-col py-4">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={current(n.href)} className="border-b border-line py-4 text-lg">
                {n.label}
              </Link>
            ))}
            <p className="eyebrow mt-6">Account</p>
            {signedIn ? (
              ACCOUNT_NAV.map((n) => (
                <Link key={n.href} href={n.href} className="border-b border-line py-3">
                  {n.label}
                </Link>
              ))
            ) : (
              <>
                <Link href="/login" className="border-b border-line py-3">
                  Log in
                </Link>
                <Link href="/login?next=/account/reports" className="border-b border-line py-3">
                  Previous reports
                </Link>
              </>
            )}
            <CtaLink href="/diagnostic" cta="mobile_nav_diagnose" className="mt-6">
              {signedIn ? "New diagnostic" : "Diagnose your growth"}
            </CtaLink>
          </Container>
        </nav>
      )}
    </header>
  );
}

function AccountMenu() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpenOn(null);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpenOn(null)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpenOn(open ? null : pathname)}
        className="flex items-center gap-1.5 px-1 py-2.5 text-sm text-ink-2 hover:text-ink"
      >
        My account
        <svg aria-hidden viewBox="0 0 12 8" className={`h-1.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul className="absolute right-0 top-full z-50 mt-1 w-52 border border-ink bg-card py-1 text-sm shadow-lg">
          {[...ACCOUNT_NAV, { href: "/account/profile", label: "My profile" }].map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="block px-4 py-2.5 hover:bg-paper-2">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
