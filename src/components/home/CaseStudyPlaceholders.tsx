const STRUCTURE = ["Problem", "Diagnosis", "Intervention", "Result", "Business impact"];
const METRICS = ["Revenue", "CAC", "Conversion", "Retention"];

/**
 * Case-study layout with clearly marked placeholders.
 * Replace with real, approved client cases only. Never invent results.
 */
export function CaseStudyPlaceholders({ limit = 3 }: { limit?: number }) {
  return (
    <ul className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: limit }, (_, i) => (
        <li key={i} className="border border-dashed border-line-strong bg-card/60 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">Case {String(i + 1).padStart(2, "0")}</p>
            <span className="bg-alert-soft px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-alert">
              Placeholder · no client data
            </span>
          </div>
          <p className="mt-6 text-h3 font-semibold text-ink-3">[Client sector] · [Market]</p>
          <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m} className="bg-card p-3">
                <dt className="text-xs text-ink-3">{m}</dt>
                <dd className="mt-1 font-mono text-lg text-ink-3">—</dd>
              </div>
            ))}
          </dl>
          <ol className="mt-6 space-y-2">
            {STRUCTURE.map((s, j) => (
              <li key={s} className="flex gap-3 text-sm text-ink-3">
                <span className="font-mono">{j + 1}.</span>
                <span>
                  <span className="text-ink-2">{s}:</span> to be added from an approved engagement
                </span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}
