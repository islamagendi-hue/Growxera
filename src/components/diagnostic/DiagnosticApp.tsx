"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAnonymousId, getAttribution, track } from "@/lib/analytics/client";
import { applyAnswer, currencyFor, QUESTION_MAP, STEPS, validateAnswer, visibleScreenQuestions } from "@/lib/diagnostic/questions";
import type { AnswerValue, Answers, DiagnosticReport, ReportPreview } from "@/lib/diagnostic/types";
import { formatNumber } from "@/lib/format";
import { DataUpload, type AppliedUpload } from "./DataUpload";
import { Progress } from "./Progress";
import { QuestionField, type Suggestion } from "./QuestionField";
import { Results } from "./Results";

const STORE_KEY = "gx_diagnostic_v2";

type Phase = "intro" | "questions" | "upload" | "submitting" | "results";

interface Saved {
  answers: Answers;
  page: number;
  phase: Phase;
  sessionId?: string;
  preview?: ReportPreview;
  report?: DiagnosticReport;
  savedToAccount?: boolean;
}

interface Page {
  step: number;
  screen: number;
  ids: string[];
}

function pagesFor(answers: Answers): Page[] {
  const pages: Page[] = [];
  STEPS.forEach((s, step) =>
    s.screens.forEach((screen, i) => {
      const ids = visibleScreenQuestions(screen, answers).map((q) => q.id);
      if (ids.length) pages.push({ step, screen: i, ids });
    }),
  );
  return pages;
}

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function suggestionFor(id: string, a: Answers, currency: string): Suggestion | undefined {
  const n = (k: string) => (typeof a[k] === "number" ? (a[k] as number) : undefined);
  const revenue = n("monthlyRevenue");
  const orders = n("monthlyOrders");
  const newCustomers = n("monthlyNewCustomers");
  if (id === "aov" && revenue && orders) {
    const v = Math.round(revenue / orders);
    return { value: v, label: `Use ≈ ${currency} ${formatNumber(v)} (revenue ÷ orders)` };
  }
  if (id === "cac" && n("marketingSpend") && newCustomers) {
    const v = Math.round(n("marketingSpend")! / newCustomers);
    return { value: v, label: `Use ≈ ${currency} ${formatNumber(v)} (marketing spend ÷ new customers)` };
  }
  if (id === "conversionRate" && n("monthlyTraffic") && orders) {
    const v = Math.round((orders / n("monthlyTraffic")!) * 10000) / 100;
    if (v > 0 && v <= 100) return { value: v, label: `Use ≈ ${v}% (orders ÷ visits)` };
  }
  return undefined;
}

export function DiagnosticApp() {
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>();
  const [preview, setPreview] = useState<ReportPreview>();
  const [report, setReport] = useState<DiagnosticReport>();
  const [savedToAccount, setSavedToAccount] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const abandonSent = useRef(false);

  // Restore progress within the browser session.
  useEffect(() => {
    const saved = load();
    // Restoring from sessionStorage can only happen after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) {
      setAnswers(saved.answers ?? {});
      setPage(saved.page ?? 0);
      setPhase(saved.phase === "submitting" ? "upload" : saved.phase);
      setSessionId(saved.sessionId);
      setPreview(saved.preview);
      setReport(saved.report);
      setSavedToAccount(!!saved.savedToAccount);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ answers, page, phase, sessionId, preview, report, savedToAccount } satisfies Saved));
    } catch {
      /* ignore */
    }
  }, [hydrated, answers, page, phase, sessionId, preview, report, savedToAccount]);

  const pages = useMemo(() => pagesFor(answers), [answers]);
  const current = pages[Math.min(page, pages.length - 1)];
  const currency = currencyFor(answers);
  // Keyed on a stable string: `current` is a new object whenever an answer changes.
  const pageKey = current ? `${STEPS[current.step].id}:${current.screen + 1}` : "";

  // diagnostic_abandoned: the visitor leaves mid-diagnostic.
  useEffect(() => {
    if (phase !== "questions") return;
    const onHide = () => {
      if (abandonSent.current || document.visibilityState !== "hidden") return;
      abandonSent.current = true;
      track("diagnostic_abandoned", { step: pageKey.split(":")[0], page: page + 1, pages: pages.length });
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [phase, pageKey, page, pages.length]);

  useEffect(() => {
    if (phase !== "questions" || !pageKey) return;
    abandonSent.current = false;
    const [step, screen] = pageKey.split(":");
    track("diagnostic_step_viewed", { step, screen: Number(screen), page: page + 1 });
  }, [phase, page, pageKey]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const setAnswer = useCallback((id: string, v: AnswerValue | undefined) => {
    // Changing a parent (e.g. industry) clears the dropdowns that depend on it.
    setAnswers((prev) => applyAnswer(prev, id, v));
    setErrors((e) => {
      if (!e[id]) return e;
      const rest = { ...e };
      delete rest[id];
      return rest;
    });
  }, []);

  function start() {
    track("diagnostic_started", {});
    setPhase("questions");
    setPage(0);
    scrollTop();
  }

  async function submit(final: Answers, upload?: AppliedUpload["summary"]) {
    setPhase("submitting");
    setSubmitError(null);
    track("diagnostic_completed", { business_model: String(final.businessModel ?? "") });
    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: final, upload, anonymousId: getAnonymousId(), attribution: getAttribution() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) {
          // Send the visitor back to the first page with a problem.
          const idx = pages.findIndex((p) => p.ids.some((id) => data.fields[id]));
          setErrors(data.fields);
          setPage(Math.max(0, idx));
        }
        setSubmitError(data.error ?? "We couldn't generate your result. Please try again.");
        setPhase(data.fields ? "questions" : "upload");
        return;
      }
      setSessionId(data.sessionId);
      setPreview(data.preview);
      setReport(data.report);
      setSavedToAccount(!!data.savedToAccount);
      setPhase("results");
      track("diagnostic_score_generated", {
        sessionId: data.sessionId,
        score: data.preview.overallScore,
        stage: data.preview.stage.id,
        bottleneck: data.preview.bottleneck,
      });
      scrollTop();
    } catch {
      setSubmitError("We couldn't reach the server. Check your connection and try again.");
      setPhase("upload");
    }
  }

  function next() {
    if (!current) return;
    const errs: Record<string, string> = {};
    for (const id of current.ids) {
      const err = validateAnswer(QUESTION_MAP[id], answers[id], answers);
      if (err) errs[id] = err;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.querySelector<HTMLElement>("input,select")?.focus({ preventScroll: true });
      return;
    }
    const nextPage = pages[page + 1];
    if (!nextPage || nextPage.step !== current.step) {
      track("diagnostic_step_completed", { step: STEPS[current.step].id });
    }
    if (!nextPage) {
      // Optional last step: strengthen the diagnosis with an orders export.
      setPhase("upload");
      scrollTop();
      return;
    }
    setPage(page + 1);
    scrollTop();
  }

  function back() {
    if (page === 0) setPhase("intro");
    else setPage(page - 1);
    setErrors({});
    scrollTop();
  }

  function restart() {
    setAnswers({});
    setPage(0);
    setSessionId(undefined);
    setPreview(undefined);
    setReport(undefined);
    setSavedToAccount(false);
    setPhase("intro");
    scrollTop();
  }

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (phase === "results" && preview && sessionId) {
    return (
      <div ref={topRef} className="scroll-mt-24">
        <Results
          preview={preview}
          report={report}
          sessionId={sessionId}
          answers={answers}
          savedToAccount={savedToAccount}
          onUnlocked={(r) => setReport(r)}
          onRestart={restart}
        />
      </div>
    );
  }

  if (phase === "intro") return <Intro onStart={start} resume={Object.keys(answers).length > 0 ? () => setPhase("questions") : undefined} topRef={topRef} />;

  if (phase === "upload" || phase === "submitting") {
    return (
      <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <Progress current={STEPS.length - 1} fraction={1} />
        <div className="animate-rise mt-10 sm:mt-14">
          <p className="eyebrow">Optional · Your data</p>
          <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em]">
            Strengthen your diagnosis with real numbers
          </h1>
          <p className="mt-2 text-ink-2">
            Upload an orders export and we&apos;ll calculate revenue, orders, new customers and repeat rate from it. You can
            review every figure before it&apos;s used, or skip this step.
          </p>
          {submitError && (
            <p role="alert" className="mt-6 border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
              {submitError}
            </p>
          )}
          <DataUpload
            answers={answers}
            currency={currency}
            busy={phase === "submitting"}
            onBack={() => {
              setSubmitError(null);
              setPhase("questions");
              scrollTop();
            }}
            onContinue={(applied) => {
              let final = answers;
              if (applied) {
                for (const [k, v] of Object.entries(applied.metrics)) if (typeof v === "number") final = applyAnswer(final, k, v);
                setAnswers(final);
              }
              void submit(final, applied?.summary);
            }}
          />
        </div>
      </div>
    );
  }

  const step = STEPS[current.step];
  const stepPages = pages.filter((p) => p.step === current.step);
  const fraction = (stepPages.indexOf(current) + 1) / stepPages.length;
  const isLast = page === pages.length - 1;

  return (
    <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <Progress current={current.step} fraction={fraction} />
      <div key={page} className="animate-rise mt-10 sm:mt-14">
        <p className="eyebrow">
          {step.label}
          {stepPages.length > 1 && (
            <span className="ml-2">
              · {stepPages.indexOf(current) + 1}/{stepPages.length}
            </span>
          )}
        </p>
        <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em]">{step.title}</h1>
        <p className="mt-2 text-ink-2">{step.intro}</p>
        <form
          className="mt-10 space-y-10"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {current.ids.map((id) => (
            <QuestionField
              key={id}
              q={QUESTION_MAP[id]}
              value={answers[id]}
              answers={answers}
              error={errors[id]}
              currency={currency}
              suggestion={suggestionFor(id, answers, currency)}
              onChange={(v) => setAnswer(id, v)}
            />
          ))}
          {submitError && (
            <p role="alert" className="border-l-2 border-alert bg-alert-soft px-4 py-3 text-sm">
              {submitError}
            </p>
          )}
          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <button type="button" onClick={back} className="min-h-12 px-2 text-ink-2 hover:text-ink">
              ← Back
            </button>
            <button
              type="submit"
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-6 font-medium text-paper transition-colors hover:bg-accent-ink disabled:opacity-60 sm:flex-none sm:min-w-48"
            >
              {isLast ? "Continue to the last step" : "Continue"}
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Intro({ onStart, resume, topRef }: { onStart: () => void; resume?: () => void; topRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={topRef} className="mx-auto grid max-w-[1240px] gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-10">
      <div className="lg:col-span-7">
        <p className="eyebrow">Growx Era Growth Diagnostic™</p>
        <h1 className="mt-6 text-h2 font-semibold sm:text-[clamp(2.5rem,5.5vw,4.5rem)]">Find Your Growth Bottleneck</h1>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-2">
          Answer a structured set of questions about your business. You&apos;ll get a preliminary Growth Score across
          seven dimensions, your most likely bottleneck, and where the biggest opportunities may be hiding.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 font-medium text-paper hover:bg-accent-ink"
          >
            Start Free Growth Diagnostic <span aria-hidden>→</span>
          </button>
          {resume && (
            <button type="button" onClick={resume} className="min-h-12 px-2 text-left underline underline-offset-4">
              Resume where you left off
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-px self-start border border-line bg-line lg:col-span-5">
        {[
          ["About 8 minutes", "Six short sections. Progress is saved in this browser tab."],
          ["No guessing", "Every metric has an “I don't know” option. We never invent numbers."],
          ["Adapted to you", "Questions change with your business model."],
          ["Private", "Your answers are used to produce your result. Contact details are optional until you want the full report."],
        ].map(([t, d]) => (
          <li key={t} className="bg-paper p-5">
            <p className="font-medium">{t}</p>
            <p className="mt-1 text-sm text-ink-2">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
