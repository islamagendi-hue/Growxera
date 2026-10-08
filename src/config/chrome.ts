/**
 * Site chrome (header, footer, consent banner) in each language the site serves.
 * The Arabic homepage (/ar) uses `ar`; every other page uses `en`. Business terms stay in English letters.
 */
export type Locale = "en" | "ar";

export const isArabicPath = (pathname: string) => pathname === "/ar" || pathname.startsWith("/ar/");

export const CHROME = {
  en: {
    nav: {
      "/diagnostic": "Growth Diagnostic",
      "/how-we-work": "How it works",
      "/case-studies": "Case studies",
      "/advisor": "Talk to an advisor",
    } as Record<string, string>,
    account: {
      "/account": "My account",
      "/account/reports": "Previous reports",
      "/account/progress": "My progress",
      "/account/profile": "My profile",
    } as Record<string, string>,
    home: "Growx Era home",
    accountHeading: "Account",
    myAccount: "My account",
    logIn: "Log in",
    previousReports: "Previous reports",
    newDiagnostic: "New diagnostic",
    diagnose: "Diagnose your growth",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    tagline: "Growth systems for ambitious businesses across the world, from building to scaling.",
    footerNav: "Footer",
    footer: {
      "/diagnostic": "Growth Diagnostic",
      "/how-we-work": "How it works",
      "/advisor": "Talk to an advisor",
      "/account": "My account",
      "/services": "Services",
      "/case-studies": "Case studies",
      "/experimentation-lab": "Experimentation Lab",
      "/insights": "Insights",
      "/contact": "Contact",
      "/privacy": "Privacy notice",
    } as Record<string, string>,
    rights: "All rights reserved.",
    disclaimer: "Growth Diagnostic results are preliminary estimates, not financial advice.",
    privacySettings: "Privacy settings",
    consentTitle: "Your privacy",
    /** English consent wording lives in config/privacy.ts (CONSENT_TEXT.analytics), the recorded source. */
    consentText: null,
    privacyNotice: "Privacy notice",
    essentialOnly: "Essential only",
    acceptAnalytics: "Accept analytics",
  },
  ar: {
    nav: {
      "/diagnostic": "تشخيص النمو",
      "/how-we-work": "كيف نعمل",
      "/case-studies": "دراسات الحالة",
      "/advisor": "تحدث مع مستشار",
    } as Record<string, string>,
    account: {
      "/account": "حسابي",
      "/account/reports": "التقارير السابقة",
      "/account/progress": "تقدّمي",
      "/account/profile": "ملفي الشخصي",
    } as Record<string, string>,
    home: "الصفحة الرئيسية لـ Growx Era",
    accountHeading: "الحساب",
    myAccount: "حسابي",
    logIn: "تسجيل الدخول",
    previousReports: "التقارير السابقة",
    newDiagnostic: "تشخيص جديد",
    diagnose: "شخّص نمو شركتك",
    openMenu: "افتح القائمة",
    closeMenu: "أغلق القائمة",
    tagline: "أنظمة نمو للشركات الطموحة، من البناء إلى التوسع.",
    footerNav: "روابط الموقع",
    footer: {
      "/diagnostic": "تشخيص النمو",
      "/how-we-work": "كيف نعمل",
      "/advisor": "تحدث مع مستشار",
      "/account": "حسابي",
      "/services": "الخدمات",
      "/case-studies": "دراسات الحالة",
      "/experimentation-lab": "معمل التجارب",
      "/insights": "المقالات",
      "/contact": "تواصل معنا",
      "/privacy": "إشعار الخصوصية",
    } as Record<string, string>,
    rights: "جميع الحقوق محفوظة",
    disclaimer: "نتائج تشخيص النمو تقديرات مبدئية، وليست استشارة مالية.",
    privacySettings: "إعدادات الخصوصية",
    consentTitle: "خصوصيتك",
    consentText:
      "نستخدم أدوات التحليل، ومنها Google Analytics، لنفهم كيف يُستخدم الموقع والتشخيص ونحسّنهما. لا نستخدم ملفات تعريف الارتباط الإعلانية.",
    privacyNotice: "إشعار الخصوصية",
    essentialOnly: "الضرورية فقط",
    acceptAnalytics: "قبول التحليلات",
  },
} as const;

export type Chrome = (typeof CHROME)[Locale];
