import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CtaLink } from "@/components/ui/CtaLink";
import { Container } from "@/components/ui/Section";
import { SITE } from "@/config/site";
import { EXPERIMENTS } from "@/content/experiments";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = {
  title: { absolute: "Growx Era | أنظمة النمو | البناء والتوسع" },
  description: "تساعد Growx Era الشركات على تحديد ما يعيق نموها، وبناء نظام نمو يستثمر أفضل فرصها.",
  alternates: { canonical: "/ar", languages: { en: "/", ar: "/ar" } },
  openGraph: { locale: "ar_SA" },
};

/* The Arabic homepage mirrors the English one (src/app/page.tsx) section by section. Keep them in step. */

const PROBLEMS = ["السوق", "التموضع", "الاستحواذ", "التحويل", "الاحتفاظ", "تحقيق الدخل", "اقتصاديات الوحدة", "نظام التشغيل"];

const SYSTEM = [
  { name: "السوق", text: "اختر العملاء والشرائح التي تستحق المنافسة عليها، وتأكد من وجود الطلب." },
  { name: "القيمة", text: "امنحهم سبباً واضحاً لاختيارك، بسعر يحمي هامشك." },
  { name: "الاستحواذ", text: "اكسب عملاء جدداً عبر قنوات تتوسع بتكلفة تقدر عليها." },
  { name: "التفعيل", text: "حوّل الاهتمام إلى إيراد: التحويل، والتهيئة، وعملية البيع." },
  { name: "الاحتفاظ", text: "أعد العملاء مرة أخرى عبر دورة حياة العميل وCRM وسبب للبقاء." },
  { name: "التوسع", text: "ارفع الإيراد لكل عميل عبر الباقات والبيع الإضافي والتسعير." },
  { name: "النمو المستدام", text: "ضاعف ما ينجح ببيانات موثوقة وتجارب مستمرة واقتصاديات صحية." },
];

const BOTTLENECKS = [
  { title: "الاستحواذ", text: "تحصل على الاهتمام، لكن العملاء قليلون." },
  { title: "التحويل", text: "الزيارات موجودة، لكن الإيراد لا يتبعها." },
  { title: "الاحتفاظ", text: "العملاء يشترون مرة واحدة ثم يختفون." },
  { title: "تحقيق الدخل", text: "العملاء موجودون، لكن الإيراد لكل عميل منخفض." },
  { title: "الدخول إلى السوق", text: "السوق والتموضع والقنوات غير متوافقة." },
  { title: "التوسع", text: "الإيراد ينمو، لكن الاقتصاديات تتراجع." },
];

const REPORT_PARTS = [
  ["مؤشر النمو", "من 0 إلى 100 عبر سبعة أبعاد للنمو."],
  ["عنق الزجاجة الرئيسي", "يُحدَّد حسب الأثر والشدة والاعتمادية، وليس مجرد أقل درجة."],
  ["حتى 10 توصيات", "مرتبة حسب الأثر وحجم الفجوة ومدى ملاءمتها لنشاطك."],
  ["المقارنة والتقدم", "كيف تقارن بشركات مثلك، وما الذي تغيّر منذ آخر مرة."],
];

const TOUR = [
  { title: "التشخيص", text: "سياق نشاطك أولاً، ثم أسئلة مصممة له، مع شرح لكل مقياس." },
  { title: "تقريرك", text: "مؤشر النمو، وعنق الزجاجة الرئيسي، ومقارنتك بالمعيار المرجعي." },
  { title: "التوصيات", text: "عشر توصيات كحد أقصى، مرتبة حسب الأثر وحجم الفجوة ومدى ملاءمتها لنشاطك." },
  { title: "حسابك وسجلك", text: "كل تشخيص يُحفظ كما كان في يومه، ولا يُستبدل شيء." },
  { title: "مقارنة التقدم", text: "السابق مقابل الحالي: كل مجال ومقياس ومعيار تغيّر." },
  { title: "تحدث مع مستشار", text: "اسأل سؤالاً أو احجز مراجعة مجانية لمدة 30 دقيقة. يقرأ المستشار تقريرك أولاً." },
];

const HOW = [
  { n: "01", title: "التشخيص", line: "نحدد عنق الزجاجة." },
  { n: "02", title: "التحول", line: "نبني نظام النمو." },
  { n: "03", title: "التوسع", line: "نضاعف ما ينجح." },
];

const STAGES = [
  { name: "تشخيص النمو", line: "نحدد المشكلة.", text: "مشروع مركّز يتحقق من عنق الزجاجة، ويقدّر حجم الفرصة، ويقدّم لك خارطة طريق مرتبة حسب الأولوية." },
  { name: "تحول النمو", line: "نصلح النظام.", text: "نعمل مع فريقك على إعادة بناء أجزاء نظام النمو التي حددها التشخيص، ونبني القياس الذي يثبت النتائج." },
  { name: "شراكة النمو", line: "نبني ونتوسع مع فريقك.", text: "شراكة مستمرة: استراتيجية، وتجارب، وإشراف على التنفيذ، ومحاسبة على نتائج تجارية حقيقية." },
];

const EXTRA = [
  {
    id: "mvp",
    name: "بناء MVP",
    line: "أطلق النسخة الأولى بسرعة.",
    text: "للمؤسسين والفرق التي لديها منتج أو فكرة جديدة: نحدد النطاق، ونصمم ونبني نسخة أولى (ويب أو تطبيق جوال)، ونطلقها، ونجهّز القياس لتعرف إن كانت تنجح قبل أن تستثمر أكثر.",
  },
  {
    id: "tracking",
    name: "تنفيذ التتبع وخريطة الأحداث",
    line: "بيانات تثق بها قبل أن تتوسع.",
    text: "نرسم خريطة لكل حدث مهم في مسار العميل، وننفّذ التتبع من البداية إلى النهاية، ونتأكد من دقة الإسناد (Attribution)، لتُبنى قرارات الإنفاق والتجارب على أرقام حقيقية. نفّذنا ذلك في كل مشروع عملنا عليه.",
  },
];

const CAPABILITIES = ["الدخول إلى السوق (GTM)", "استراتيجية النمو", "الاستحواذ", "تحسين معدل التحويل (CRO)", "الاحتفاظ", "CRM", "تحقيق الدخل", "التحليلات", "عمليات النمو", "الذكاء الاصطناعي والأتمتة"];

const TRACK = [
  { value: "0 → 100K", label: "مستخدم خلال 8 أشهر" },
  { value: "−70%", label: "تكلفة الاستحواذ (CAC)، من 116 إلى 35 ريالاً" },
  { value: "4:1", label: "نسبة LTV:CAC مستدامة" },
  { value: "SAR 2M+", label: "إيرادات منسوبة" },
];

const CASES = [
  {
    slug: "car-wash-app-0-to-100k-users",
    sector: "تطبيق جوال · الرياض، السعودية",
    title: "من الصفر إلى 100 ألف مستخدم خلال 8 أشهر، مع خفض تكلفة الاستحواذ (CAC) بنسبة 70%",
    lever: "حلقات التفعيل والإحالة، فوق استحواذ مدفوع موجّه للعميل المثالي",
    metrics: [
      { label: "المستخدمون", value: "0 → 100K" },
      { label: "تكلفة الاستحواذ (CAC)", value: "−70%" },
      { label: "التفعيل", value: "28% → 40%" },
      { label: "LTV:CAC", value: "4:1" },
    ],
  },
  {
    slug: "perfume-store-100k-to-700k-monthly",
    sector: "متجر إلكتروني · عطور",
    title: "متجر عطور رفع إيراده الشهري من 100 ألف إلى 700 ألف ريال",
    lever: "قنوات بيع جديدة (Amazon وMeta) والعينات",
    metrics: [
      { label: "الإيراد الشهري (ريال)", value: "100K → 700K" },
      { label: "النمو", value: "7×" },
      { label: "قنوات البيع", value: "1 → 3" },
    ],
  },
];

const FAQ = [
  {
    q: "هل تشخيص النمو مجاني فعلاً؟",
    a: "نعم. التشخيص وتقريرك وحسابك والمراجعة لمدة 30 دقيقة مع مستشار كلها مجانية، بدون بطاقة وبدون أي التزام. وإذا أردت لاحقاً مساعدة في تنفيذ الخطة، نقدّم لك عرضاً منفصلاً.",
  },
  {
    q: "كم يستغرق، وماذا لو لم أكن أعرف رقماً؟",
    a: "حوالي 8 دقائق. كل مقياس فيه خيار «لا أعرف» ولا نخمّن نيابة عنك: المقاييس غير المعروفة لا تدخل في الدرجة. لكل سؤال شرح يوضح معناه وأين تجده، ويمكنك رفع ملف Excel أو CSV (تصدير للطلبات أو جدول أرقام شهرية) لتعبئة الأرقام تلقائياً.",
  },
  {
    q: "ماذا يحدث لبياناتي؟",
    a: "تُستخدم إجاباتك لإعداد تقريرك وتُحفظ في حسابك لتتابع تقدمك. الملف المرفوع يُقرأ داخل متصفحك ولا يُرسل إلينا؛ فقط الأرقام التي تختار استخدامها. لا نبيع بياناتك. ويمكنك في أي وقت حذف بياناتك المحفوظة أو حسابك بالكامل من صفحة ملفك الشخصي، باختيار ما تريد حذفه ثم تأكيد الحذف.",
  },
  {
    q: "ما مدى دقة النتيجة؟",
    a: "هو تشخيص مبدئي مبني على إجاباتك، ومقارن بنطاقات Growx Era المرجعية لنوع نشاطك. كلما أدخلت مقاييس أكثر، زادت ثقة البيانات. يوضح لك أين تبدأ؛ ويمكن لمستشار التحقق منه معك.",
  },
  {
    q: "ماذا يحدث بعد أن أحصل على تقريري؟",
    a: "يُحفظ تقريرك في حسابك مع حتى عشر توصيات مرتبة. يمكنك أن تسأل مستشاراً أو تحجز مراجعة مجانية لمدة 30 دقيقة لتخطيط الخطوات الأولى. وأعد التشخيص الشهر القادم لنُريك بالضبط ما الذي تغيّر.",
  },
];

const REPORT_BARS = [
  { name: "السوق", score: 72 },
  { name: "القيمة", score: 68 },
  { name: "الاستحواذ", score: 81 },
  { name: "التفعيل", score: 66 },
  { name: "الاحتفاظ", score: 38, weak: true },
  { name: "التوسع", score: 55 },
  { name: "النمو المستدام", score: 70 },
];

function Block({
  index,
  eyebrow,
  title,
  lead,
  card,
  id,
  children,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  card?: boolean;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-[3.4375rem] sm:py-[5.5625rem] ${card ? "bg-paper-2" : ""}`}>
      <Container>
        <p className="ar-eyebrow">
          {index && <span className="ml-3 font-mono text-ink-3">{index}</span>}
          {eyebrow}
        </p>
        <h2 className="mt-4 max-w-[22ch] text-h2 font-semibold">{title}</h2>
        {lead && <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-2">{lead}</p>}
        {children && <div className="mt-12">{children}</div>}
      </Container>
    </section>
  );
}

function ArabicReport() {
  return (
    <div className="relative border border-ink/15 bg-card p-6 shadow-[0_30px_80px_-40px_rgba(14,19,17,0.45)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <p className="ar-eyebrow">تقرير تشخيص النمو</p>
        <span className="border border-line px-2 py-0.5 text-xs text-ink-3">مثال توضيحي</span>
      </div>
      <div className="mt-6 flex items-end gap-6 border-b border-line pb-6">
        <p dir="ltr" className="tabular text-7xl font-semibold leading-none tracking-tight">
          <CountUp value="64" />
          <span className="text-2xl text-ink-3">/100</span>
        </p>
        <div className="pb-1">
          <p className="text-sm text-ink-3">المرحلة</p>
          <p className="mt-1 font-medium">نمو ناشئ</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-sm text-ink-3">عنق الزجاجة الرئيسي</p>
        <p className="mt-1 text-2xl font-semibold">الاحتفاظ</p>
      </div>
      <ul className="mt-6 space-y-2.5">
        {REPORT_BARS.map((b) => (
          <li key={b.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className={b.weak ? "font-semibold" : ""}>{b.name}</span>
            <span className="relative h-2 bg-paper-2">
              <span className={`absolute inset-y-0 right-0 ${b.weak ? "bg-ink" : "bg-accent"}`} style={{ width: `${b.score}%` }} />
            </span>
            <span className="tabular text-left font-mono">{b.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArabicHome() {
  const talkHref = SITE.bookingUrl || "/contact";
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <Container className="relative grid gap-[3.4375rem] py-[3.4375rem] sm:py-[5.5625rem] lg:grid-cols-[1.618fr_1fr] lg:gap-[2.125rem]">
          <div>
            <p className="ar-eyebrow">
              <span className="block sm:inline">أنظمة النمو</span>
              <span aria-hidden className="hidden sm:inline"> | </span>
              <span className="block sm:inline">البناء والتوسع</span>
            </p>
            <h1 className="mt-6 max-w-[18ch] text-display font-semibold">
              ابنِ المرحلة القادمة من نمو شركتك<span className="text-accent">.</span>
            </h1>
            <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-ink-2 sm:text-xl">
              اكتشف ما يعيق نمو شركتك، وحدّد أكبر فرص النمو أمامك، وابنِ نظاماً يحققها.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <CtaLink href="/diagnostic" cta="ar_hero_diagnose">
                شخّص نمو شركتك
              </CtaLink>
              <CtaLink href="/how-we-work" cta="ar_hero_how_we_work" variant="ghost" className="self-start sm:self-auto">
                تعرّف على طريقة عملنا
              </CtaLink>
            </div>
            <p className="mt-14 max-w-[46ch] border-r-2 border-accent pr-4 text-ink-2">
              تحسين نظام النمو يحقق لشركتك غالباً نتائج أكبر من زيادة الإنفاق على التسويق.
            </p>
          </div>
          <div className="lg:pt-6">
            <ArabicReport />
          </div>
        </Container>
      </section>

      {/* THE PROBLEM */}
      <Block
        index="01"
        eyebrow="المشكلة"
        title="نادراً ما يتعطل النمو في مكان واحد."
        lead="عندما يتوقف الإيراد، تكون ردة الفعل الأولى شراء مزيد من الزيارات. لكن المشكلة قد تكون في أي جزء من النظام، وضخ زيارات أكثر في نظام يتسرّب منه العملاء يجعله أغلى، لا أربح."
      >
        <ul className="grid grid-cols-2 border-r border-t border-line sm:grid-cols-4">
          {PROBLEMS.map((p, i) => (
            <li key={p} className="border-b border-l border-line p-5 sm:p-6">
              <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-6 text-lg font-medium">{p}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-h3 font-semibold">
          زيادة الزيارات ليست الحل دائماً<span className="text-accent">.</span>
        </p>
      </Block>

      {/* SYSTEM */}
      <Block
        id="system"
        card
        index="02"
        eyebrow="نظام Growx Era"
        title="سبعة أبعاد. نظام نمو واحد."
        lead="كل مشروع وكل تشخيص يعمل على الإطار نفسه، لنرى أين يتقيد النمو وما قيمة إصلاحه."
      >
        <ol className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-7">
          {SYSTEM.map((s, i) => (
            <li key={s.name} className="border-b border-line py-6 pl-6 sm:last:col-span-2 lg:last:col-span-1 lg:border-b-0 lg:border-l lg:py-8 lg:pr-5 lg:first:pr-0 lg:last:border-l-0">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              <p className="mt-3 font-semibold lg:mt-5">{s.name}</p>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </Block>

      {/* BOTTLENECKS */}
      <Block index="03" eyebrow="عنق الزجاجة" title="أين يتعثر نمو شركتك؟">
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {BOTTLENECKS.map((b) => (
            <li key={b.title} className="flex flex-col bg-paper p-6 sm:p-8">
              <p className="text-sm font-medium text-accent">{b.title}</p>
              <p className="mt-4 text-xl font-medium leading-snug">{b.text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <CtaLink href="/diagnostic" cta="ar_bottlenecks_diagnose" variant="secondary">
            اكتشف عنق الزجاجة لديك
          </CtaLink>
        </div>
      </Block>

      {/* DIAGNOSTIC TOOL */}
      <section id="diagnostic" className="scroll-mt-20 bg-paper-2 py-[3.4375rem] sm:py-[5.5625rem]">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="ar-eyebrow">
              <span className="ml-3 font-mono text-ink-3">04</span>تشخيص النمو من Growx Era
            </p>
            <h2 className="mt-4 text-h2 font-semibold">اكتشف عنق الزجاجة في نموك</h2>
            <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-ink-2">
              احصل على مؤشر نمو مبدئي واكتشف أين قد تختبئ أكبر فرصك.
            </p>
            <div className="mt-10">
              <CtaLink href="/diagnostic" cta="ar_diagnostic_section_start">
                ابدأ تشخيص النمو مجاناً
              </CtaLink>
              <p className="mt-4 text-sm text-ink-3">مجاني · حوالي 8 دقائق · خيار «لا أعرف» متاح دائماً</p>
            </div>
          </div>
          <ol className="grid gap-px self-start border border-line bg-line sm:grid-cols-2 lg:col-span-6">
            {REPORT_PARTS.map(([t, d], i) => (
              <li key={t} className="bg-paper-2 p-6">
                <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
                <p className="mt-4 font-medium">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* PRODUCT TOUR */}
      <Block
        eyebrow="داخل المنصة"
        title="من التشخيص إلى التقدم، في مكان واحد."
        lead="أجرِ التشخيص، واقرأ تقريرك، ونفّذ توصيات مرتبة، وتابع تقدمك شهراً بعد شهر، وتحدث مع مستشار عندما تريد رأياً ثانياً."
      >
        <ol className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {TOUR.map((t, i) => (
            <li key={t.title} className="bg-paper p-6">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              <p className="mt-3 font-medium">{t.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{t.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <CtaLink href="/diagnostic" cta="ar_tour_start">
            ابدأ تشخيص النمو مجاناً
          </CtaLink>
          <CtaLink href="/advisor" cta="ar_tour_advisor" variant="ghost">
            تحدث مع مستشار
          </CtaLink>
        </div>
      </Block>

      {/* HOW WE WORK */}
      <Block index="05" eyebrow="طريقة عملنا" title="شخّص. حوّل. توسّع.">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {HOW.map((s) => (
            <li key={s.n} className="border-t border-ink pt-6">
              <p className="font-mono text-sm text-accent">{s.n}</p>
              <p className="mt-4 text-h3 font-semibold">{s.title}</p>
              <p className="mt-1 text-ink-2">{s.line}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <CtaLink href="/how-we-work" cta="ar_how_we_work_more" variant="ghost">
            كيف يسير المشروع
          </CtaLink>
        </div>
      </Block>

      {/* SERVICES */}
      <Block
        id="services"
        card
        index="06"
        eyebrow="الخدمات"
        title="مسار واحد، من التشخيص إلى الشراكة."
        lead="لا نبيع خدمات منفصلة. كل مرحلة تُبنى على ما قبلها."
      >
        <ol className="grid gap-px border border-line bg-line lg:grid-cols-3">
          {STAGES.map((s, i) => (
            <li key={s.name} className="flex flex-col bg-paper-2 p-6 sm:p-8">
              <p className="text-sm text-ink-3">المرحلة {i + 1}</p>
              <p className="mt-5 text-h3 font-semibold">{s.name}</p>
              <p className="mt-1 text-accent">{s.line}</p>
              <p className="mt-4 leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
        {EXTRA.map((s) => (
          <div key={s.id} className="mt-px flex flex-col gap-4 border border-line bg-paper p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-ink-3">خدمة إضافية</p>
              <p className="mt-2 text-h3 font-semibold">
                {s.name} <span className="text-accent">· {s.line}</span>
              </p>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-2">{s.text}</p>
            </div>
            <CtaLink href={`/services#${s.id}`} cta={`ar_${s.id}_more`} variant="ghost" className="shrink-0">
              اعرف المزيد
            </CtaLink>
          </div>
        ))}
        <div className="mt-10">
          <p className="ar-eyebrow">قدرات داعمة</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <li key={c} className="border border-line-strong px-3 py-1.5 text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Block>

      {/* CASE STUDIES */}
      <Block
        index="07"
        eyebrow="دراسات الحالة"
        title="المشكلة. التشخيص. الحل. النتيجة."
        lead="تُعرض كل دراسة حالة بالهيكل نفسه، وتبدأ بالمؤشرات الأساسية: الإيراد، وتكلفة الاستحواذ (CAC)، ومعدل التحويل، ومعدل الاحتفاظ، ومتوسط قيمة الطلب (AOV)، والقيمة الدائمة للعميل (LTV)، وفترة استرداد التكلفة (Payback)، وهامش الربح."
      >
        <dl className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {TRACK.map((t) => (
            <div key={t.label} className="flex flex-col-reverse bg-paper p-5 sm:p-6">
              <dt className="mt-2 text-sm text-ink-3">{t.label}</dt>
              <dd dir="ltr" className="tabular whitespace-nowrap text-right font-mono text-xl font-medium sm:text-3xl">
                <CountUp value={t.value} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">سجل إنجازات فريق Growx Era في التطبيقات وSaaS والتجارة الإلكترونية في السعودية والخليج.</p>
        <ul className="mt-10 grid gap-6 lg:grid-cols-2">
          {CASES.map((c) => (
            <li key={c.slug}>
              <Link href={`/case-studies/${c.slug}`} className="group block h-full border border-line bg-card p-6 transition-colors hover:border-ink sm:p-8">
                <p className="text-sm text-ink-3">{c.sector}</p>
                <h3 className="mt-4 text-h3 font-semibold">{c.title}</h3>
                <p className="mt-3 text-sm text-ink-2">
                  <span className="font-medium text-ink">رافعة النمو:</span> {c.lever}
                </p>
                <dl className={`mt-6 grid gap-px border border-line bg-line ${c.metrics.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {c.metrics.map((m) => (
                    <div key={m.label} className="bg-card p-3">
                      <dt className="text-xs text-ink-3">{m.label}</dt>
                      <dd dir="ltr" className="tabular mt-1 text-right font-mono text-xl font-medium">
                        <CountUp value={m.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-sm text-ink-2 group-hover:text-ink">
                  اقرأ الحالة (بالإنجليزية) <span aria-hidden>←</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <CtaLink href="/case-studies" cta="ar_case_studies_all" variant="ghost">
            كل دراسات الحالة
          </CtaLink>
        </div>
      </Block>

      {/* EXPERIMENTATION LAB */}
      <Block
        card
        index="08"
        eyebrow="معمل التجارب"
        title={`${EXPERIMENTS.length} تجربة نمو جاهزة للاختبار.`}
        lead="فرضيات ومقاييس قرار مصنّفة حسب نموذج العمل: تطبيقات الجوال، SaaS، المتاجر الإلكترونية، المنصات (Marketplace)، المطاعم والتوصيل، التعليم الإلكتروني، التقنية المالية، العقارات، العيادات، توليد العملاء المحتملين، والأعمال متعددة الفروع."
      >
        <CtaLink href="/experimentation-lab" cta="ar_lab" variant="ghost">
          افتح معمل التجارب
        </CtaLink>
      </Block>

      {/* FAQ */}
      <Block id="faq" eyebrow="الأسئلة الشائعة" title="خمسة أسئلة يطرحها الناس أولاً.">
        <div className="grid lg:grid-cols-12">
          <div className="divide-y divide-line border-y border-line lg:col-span-9 lg:col-start-4">
            {FAQ.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="shrink-0 font-mono text-xl text-ink-3 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[68ch] pb-6 leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Block>

      {/* FINAL CTA */}
      <section className="bg-ink py-20 text-paper sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <h2 className="text-h2 font-semibold lg:col-span-8">اعرف ما يعيق نمو شركتك.</h2>
          <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
            <CtaLink href="/diagnostic" cta="ar_final_diagnose" variant="inverse" className="w-full sm:w-auto">
              ابدأ تشخيص النمو
            </CtaLink>
            <CtaLink
              href={talkHref}
              cta="ar_final_talk"
              booking={!!SITE.bookingUrl}
              variant="ghost"
              className="!text-paper decoration-paper/40 hover:decoration-paper"
            >
              تواصل مع Growx Era
            </CtaLink>
          </div>
        </Container>
      </section>
    </>
  );
}
