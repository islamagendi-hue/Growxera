import { ScoreBars } from "@/components/diagnostic/ScoreBars";
import { CountUp } from "@/components/ui/CountUp";

/**
 * Product tour: small, static mockups of each part of the product. Every number
 * is an illustrative example and is labelled as such; none is client data.
 */
const Tag = () => (
  <span className="border border-line px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-3">Illustrative</span>
);

function Frame({ n, title, text, children }: { n: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col bg-paper p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-accent">{n}</p>
        <Tag />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-ink-2">{text}</p>
      <div aria-hidden className="mt-5 flex-1 border border-line bg-card p-4 text-[0.8rem] leading-snug">
        {children}
      </div>
    </li>
  );
}

const Field = ({ label, value, open }: { label: string; value: string; open?: boolean }) => (
  <div className="mb-2.5">
    <p className="mb-1 text-[0.7rem] text-ink-3">{label}</p>
    <div className={`flex items-center justify-between border px-2.5 py-1.5 ${open ? "border-ink" : "border-line-strong"}`}>
      <span>
        <span className="mr-1.5 text-accent">✓</span>
        {value}
      </span>
      <span className="text-ink-3">▾</span>
    </div>
  </div>
);

export function ProductMockups() {
  return (
    <ul className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
      <Frame n="01" title="The diagnostic" text="Your context first, then questions adapted to it. A help note on every metric.">
        <Field label="Industry" value="E-commerce" />
        <Field label="Business type" value="Own brand (D2C)" />
        <Field label="Category" value="Perfumes and oud" open />
        <div className="mt-3 flex items-center gap-2">
          <span className="font-medium">Repeat purchase rate</span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-ink text-[0.6rem]">?</span>
        </div>
      </Frame>

      <Frame n="02" title="Your report" text="A Growth Score, your primary bottleneck and how you compare with the benchmark.">
        <div className="flex items-end gap-3 border-b border-line pb-3">
          <p className="tabular text-4xl font-semibold leading-none"><CountUp value="58" /></p>
          <p className="pb-0.5 text-ink-3">/100 · Growth Emerging</p>
        </div>
        <p className="mt-3 text-[0.7rem] uppercase tracking-[0.08em] text-alert">▲ Primary bottleneck</p>
        <p className="font-semibold">Retention</p>
        <div className="mt-3">
          <ScoreBars
            compact
            highlight="retention"
            data={[
              { dimension: "acquisition", score: 74 },
              { dimension: "activation", score: 61 },
              { dimension: "retention", score: 34 },
            ]}
          />
        </div>
      </Frame>

      <Frame n="03" title="Recommendations" text="At most ten, ranked by impact, the size of your gap and relevance to your business.">
        <ol className="space-y-2">
          {[
            ["Launch a second-purchase journey", "High impact"],
            ["Add samples to lower first-order risk", "High impact"],
            ["Cut checkout steps on mobile", "Medium impact"],
          ].map(([t, i], k) => (
            <li key={t} className="flex gap-2.5 border-b border-line pb-2 last:border-0">
              <span className="font-mono text-accent">0{k + 1}</span>
              <span>
                <span className="block font-medium">{t}</span>
                <span className="block text-ink-3">{i}</span>
              </span>
            </li>
          ))}
        </ol>
      </Frame>

      <Frame n="04" title="Your account and history" text="Every diagnostic saved as it was on the day. Nothing is overwritten.">
        <ul className="divide-y divide-line">
          {[
            ["66", "6 Dec", "+5"],
            ["61", "4 Nov", "+3"],
            ["58", "6 Oct", "first"],
          ].map(([s, d, delta]) => (
            <li key={d} className="flex items-center gap-3 py-2">
              <span className="tabular w-8 font-mono text-lg font-semibold"><CountUp value={s} /></span>
              <span className="flex-1">{d}</span>
              <span className={delta.startsWith("+") ? "font-mono text-accent" : "text-ink-3"}>{delta.startsWith("+") ? `▲ ${delta}` : delta}</span>
            </li>
          ))}
        </ul>
      </Frame>

      <Frame n="05" title="Progress comparison" text="Previous against current: every area, metric and benchmark that moved.">
        {[
          ["Retention", 34, 47],
          ["Activation", 61, 64],
          ["Acquisition", 74, 71],
        ].map(([label, a, b]) => (
          <div key={label as string} className="mb-2.5">
            <div className="flex justify-between">
              <span>{label}</span>
              <span className="tabular font-mono text-ink-3">
                {a} → <span className="text-ink">{b}</span>
              </span>
            </div>
            <div className="relative mt-1 h-1.5 bg-paper-2">
              <div className="absolute inset-y-0 left-0 bg-line-strong" style={{ width: `${a}%` }} />
              <div className="absolute inset-y-0 left-0 border-r-2 border-ink bg-accent/70" style={{ width: `${b}%` }} />
            </div>
          </div>
        ))}
        <p className="mt-3 text-ink-3">Repeat rate: below → within the benchmark</p>
      </Frame>

      <Frame n="06" title="Talk to a specialist" text="Ask a question or book a free 30-minute review. The specialist reads your report first.">
        <p className="text-[0.7rem] text-ink-3">Saturday · Riyadh time</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono">
          {["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"].map((t) => (
            <span key={t} className={`border py-1.5 text-center ${t === "20:00" ? "border-ink bg-ink text-paper" : "border-line-strong"}`}>
              {t}
            </span>
          ))}
        </div>
        <p className="mt-3 border-l-2 border-accent bg-accent-soft px-2 py-1.5">Free 30-Minute Review · 20:00</p>
      </Frame>
    </ul>
  );
}
