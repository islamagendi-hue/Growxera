import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { EXPERIMENTS } from "@/content/experiments";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = {
  title: { absolute: "Growx Era — شريك النمو والتحول" },
  description: "Growx Era تساعد الشركات الطموحة في السعودية والخليج على تشخيص ما يعيق نموها، واكتشاف أكبر فرصها، وبناء نظام نمو يحققها.",
  alternates: { canonical: "/ar", languages: { en: "/", ar: "/ar" } },
  openGraph: { locale: "ar_SA" },
};

const PROBLEMS = ["السوق", "التموضع", "الاستحواذ", "التحويل", "الاحتفاظ", "تحقيق الدخل", "اقتصاديات الوحدة", "نظام التشغيل"];

const SYSTEM = [
  { name: "السوق", text: "من تخدم، وهل الطلب موجود فعلاً." },
  { name: "القيمة", text: "لماذا يختارك العميل، والهامش الذي تحققه." },
  { name: "الاستحواذ", text: "مدى كفاءتك في جذب عملاء جدد." },
  { name: "التفعيل", text: "مدى تحوّل الاهتمام إلى إيراد." },
  { name: "الاحتفاظ", text: "هل يعود العملاء مرة أخرى." },
  { name: "التوسع", text: "مدى نمو قيمة كل عميل مع الوقت." },
  { name: "التوسع المستدام", text: "هل يصبح النمو أكثر صحة كلما كبر." },
];

const STAGES = [
  { name: "تشخيص النمو", line: "نحدد المشكلة.", text: "نحدد عنق الزجاجة بدقة، ونقدّر حجم الفرصة، ونقدّم خارطة طريق لـ90 يوماً مرتبة حسب الأولوية." },
  { name: "تحول النمو", line: "نصلح النظام.", text: "نعمل مع فريقك على إعادة بناء أجزاء نظام النمو التي حددها التشخيص، ونبني القياس الذي يثبت النتائج." },
  { name: "شراكة النمو", line: "نبني وننمو مع فريقك.", text: "شراكة مستمرة: استراتيجية، وتجارب، وإشراف على التنفيذ، ومحاسبة على نتائج تجارية حقيقية." },
];

const EXTRA = [
  { name: "بناء MVP", text: "لديك فكرة أو منتج جديد؟ نحدد النطاق، ونصمم ونبني نسخة أولى (ويب أو تطبيق جوال)، ونطلقها، ونجهّز القياس لتعرف إن كانت تنجح قبل أن تستثمر أكثر." },
  { name: "تنفيذ التتبع وخريطة الأحداث", text: "نرسم خريطة لكل حدث مهم في مسار العميل، وننفّذ التتبع من البداية إلى النهاية، ونتأكد من دقة الإسناد (Attribution)، لتُبنى قرارات الإنفاق والتجارب على أرقام حقيقية. نفّذنا ذلك في كل مشروع عملنا عليه." },
];

const TRACK = [
  { value: "0 → 100K", label: "مستخدم خلال 8 أشهر" },
  { value: "−70%", label: "تكلفة الاستحواذ، من 116 إلى 35 ريالاً" },
  { value: "4:1", label: "نسبة LTV:CAC مستدامة" },
  { value: "+2M", label: "ريال إيرادات منسوبة" },
];

const CASES = [
  { slug: "car-wash-app-0-to-100k-users", sector: "تطبيق جوال · الرياض", title: "من 0 إلى 100 ألف مستخدم خلال 8 أشهر، مع خفض تكلفة الاستحواذ 70%" },
  { slug: "perfume-store-100k-to-700k-monthly", sector: "متجر إلكتروني · عطور", title: "متجر عطور رفع إيراده الشهري من 100 ألف إلى 700 ألف ريال" },
  { slug: "multi-branch-lifecycle-crm", sector: "CRM ودورة حياة العميل", title: "نظام أتمتة CRM رفع الحجوزات المتكررة 25% في 6 فروع" },
  { slug: "edtech-full-funnel-growth", sector: "تعليم إلكتروني", title: "نظام نمو متكامل رفع التحويلات 18%" },
];

export default function ArabicHome() {
  const talkHref = SITE.bookingUrl || "/contact";
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Container className="relative py-[3.4375rem] sm:py-[5.5625rem]">
          <p className="ar-eyebrow">شريك النمو والتحول · الخليج</p>
          <h1 className="mt-6 max-w-[18ch] text-display font-semibold">
            ابنِ المرحلة القادمة من نمو شركتك<span className="text-accent">.</span>
          </h1>
          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-ink-2 sm:text-xl">
            اكتشف ما يعيق نمو شركتك، وحدّد أكبر فرص النمو أمامك، وابنِ نظاماً يحققها.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <CtaLink href="/diagnostic" cta="ar_hero_diagnose">
              ابدأ تشخيص النمو مجاناً
            </CtaLink>
            <CtaLink href="/ar#services" cta="ar_hero_services" variant="ghost" className="self-start sm:self-auto">
              تعرّف على خدماتنا
            </CtaLink>
          </div>
          <p className="mt-14 max-w-[46ch] border-r-2 border-accent pr-4 text-ink-2">
            شركتك لا تحتاج إلى مزيد من التسويق، بل إلى نظام نمو أفضل.
          </p>
        </Container>
      </section>

      {/* PROBLEM */}
      <section className="py-[3.4375rem] sm:py-[5.5625rem]">
        <Container>
          <p className="ar-eyebrow">المشكلة</p>
          <h2 className="mt-4 max-w-[20ch] text-h2 font-semibold">نادراً ما يتعطل النمو في مكان واحد.</h2>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-2">
            عندما يتوقف الإيراد، تكون ردة الفعل الأولى شراء مزيد من الزيارات. لكن المشكلة قد تكون في أي جزء من النظام، وضخ زيارات أكثر في نظام يتسرّب منه العملاء يجعله أغلى، لا أربح.
          </p>
          <ul className="mt-12 grid grid-cols-2 border-r border-t border-line sm:grid-cols-4">
            {PROBLEMS.map((p, i) => (
              <li key={p} className="border-b border-l border-line p-5 sm:p-6">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-6 text-lg font-medium">{p}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* SYSTEM */}
      <section className="bg-paper-2 py-[3.4375rem] sm:py-[5.5625rem]">
        <Container>
          <p className="ar-eyebrow">نظام النمو</p>
          <h2 className="mt-4 max-w-[22ch] text-h2 font-semibold">7 أبعاد تحدد سرعة نمو أي شركة.</h2>
          <ol className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEM.map((s, i) => (
              <li key={s.name} className="bg-paper-2 p-6">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-4 text-lg font-semibold">{s.name}</p>
                <p className="mt-2 leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* SERVICES */}
      <section id="services" className="scroll-mt-20 py-[3.4375rem] sm:py-[5.5625rem]">
        <Container>
          <p className="ar-eyebrow">الخدمات</p>
          <h2 className="mt-4 max-w-[22ch] text-h2 font-semibold">مسار واحد، من التشخيص إلى الشراكة.</h2>
          <ol className="mt-12 grid gap-px border border-line bg-line lg:grid-cols-3">
            {STAGES.map((s, i) => (
              <li key={s.name} className="flex flex-col bg-paper p-6 sm:p-8">
                <p className="text-sm text-ink-3">المرحلة {i + 1}</p>
                <p className="mt-5 text-h3 font-semibold">{s.name}</p>
                <p className="mt-1 text-accent">{s.line}</p>
                <p className="mt-4 leading-relaxed text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-px grid gap-px border border-line bg-line lg:grid-cols-2">
            {EXTRA.map((s) => (
              <div key={s.name} className="bg-paper-2 p-6 sm:p-8">
                <p className="text-sm text-ink-3">خدمة إضافية</p>
                <p className="mt-3 text-h3 font-semibold">{s.name}</p>
                <p className="mt-3 leading-relaxed text-ink-2">{s.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* TRACK RECORD + CASES */}
      <section className="bg-paper-2 py-[3.4375rem] sm:py-[5.5625rem]">
        <Container>
          <p className="ar-eyebrow">دراسات الحالة</p>
          <h2 className="mt-4 max-w-[22ch] text-h2 font-semibold">نتائج حقيقية بالأرقام.</h2>
          <dl className="mt-12 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
            {TRACK.map((t) => (
              <div key={t.label} className="flex flex-col-reverse bg-paper p-5 sm:p-6">
                <dt className="mt-2 text-sm text-ink-3">{t.label}</dt>
                <dd dir="ltr" className="tabular text-right font-mono text-3xl font-medium">
                  <CountUp value={t.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-3">سجل إنجازات فريق Growx Era في التطبيقات وSaaS والتجارة الإلكترونية في السعودية والخليج.</p>
          <ul className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2">
            {CASES.map((c) => (
              <li key={c.slug}>
                <Link href={`/case-studies/${c.slug}`} className="group block h-full bg-card p-6 transition-colors hover:bg-paper sm:p-8">
                  <p className="text-sm text-ink-3">{c.sector}</p>
                  <p className="mt-3 text-h3 font-semibold">{c.title}</p>
                  <p className="mt-5 text-sm text-ink-2 group-hover:text-ink">
                    اقرأ الحالة (بالإنجليزية) <span aria-hidden>←</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* LAB */}
      <section className="py-[3.4375rem] sm:py-[5.5625rem]">
        <Container>
          <p className="ar-eyebrow">معمل التجارب</p>
          <h2 className="mt-4 max-w-[22ch] text-h2 font-semibold">{EXPERIMENTS.length} فكرة لتجارب نمو جاهزة للاختبار.</h2>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-2">
            فرضيات ومقاييس قرار مصنّفة حسب نموذج العمل: تطبيقات الجوال، SaaS، المتاجر الإلكترونية، المنصات (Marketplace)، المطاعم والتوصيل، التعليم الإلكتروني، التقنية المالية، العقارات، العيادات، توليد العملاء المحتملين، والأعمال متعددة الفروع. اختر الأفكار وكوّن خطتك.
          </p>
          <div className="mt-10">
            <CtaLink href="/experimentation-lab" cta="ar_lab" variant="ghost">
              افتح معمل التجارب
            </CtaLink>
          </div>
        </Container>
      </section>

      {/* FINAL CTA */}
      <section className="bg-ink py-20 text-paper sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <h2 className="text-h2 font-semibold lg:col-span-8">هل أنت مستعد لمعرفة ما يعيق نموك؟</h2>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
            <CtaLink href="/diagnostic" cta="ar_final_diagnose" variant="inverse" className="w-full sm:w-auto">
              ابدأ تشخيص النمو
            </CtaLink>
            <CtaLink href={talkHref} cta="ar_final_talk" booking={!!SITE.bookingUrl} variant="ghost" className="text-paper">
              تواصل مع Growx Era
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
