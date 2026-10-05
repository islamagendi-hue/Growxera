import { IBM_Plex_Sans_Arabic } from "next/font/google";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Arabic section of the site: right-to-left, Arabic typeface. */
export default function ArabicLayout({ children }: LayoutProps<"/ar">) {
  return (
    <div lang="ar" dir="rtl" className={`${plexArabic.variable} lang-ar`}>
      {children}
    </div>
  );
}
