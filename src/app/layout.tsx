import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { AttributionCapture } from "@/components/site/AttributionCapture";
import { ConsentBanner } from "@/components/site/ConsentBanner";
import { Footer } from "@/components/site/Footer";
import { GoogleAnalytics } from "@/components/site/GoogleAnalytics";
import { Header } from "@/components/site/Header";
import { HideOnLanding } from "@/components/site/HideOnLanding";
import { SITE } from "@/config/site";
import "./globals.css";

/** Dubai Font (dubaifont.com), self-hosted: covers both Latin and Arabic. */
const dubai = localFont({
  variable: "--font-dubai",
  display: "swap",
  src: [
    { path: "./fonts/Dubai-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Dubai-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Dubai-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Dubai-Bold.woff2", weight: "700", style: "normal" },
  ],
});
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s · Growx Era" },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    url: "/",
    locale: "en",
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f4f2ec",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      areaServed: ["SA", "AE", "QA", "KW", "BH", "OM"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dubai.variable} ${plexMono.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <AttributionCapture />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <HideOnLanding>
          <Footer />
        </HideOnLanding>
        <ConsentBanner />
        <GoogleAnalytics />
        {/* Cookieless page counts (no personal data), so every visit is counted, not only consented ones. */}
        <Analytics />
      </body>
    </html>
  );
}
