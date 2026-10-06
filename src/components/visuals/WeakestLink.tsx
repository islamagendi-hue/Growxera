import { ChartFrame } from "./ChartFrame";

/** Seven growth areas as a radar: one weak area caps the whole system. Example scores. */
const AREAS = [
  { label: "Market", score: 72 },
  { label: "Value", score: 68 },
  { label: "Acquisition", score: 81 },
  { label: "Activation", score: 66 },
  { label: "Retention", score: 34 },
  { label: "Expansion", score: 55 },
  { label: "Scale", score: 70 },
];

const C = 110;
const R = 80;

function point(i: number, r: number) {
  const a = (Math.PI * 2 * i) / AREAS.length - Math.PI / 2;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const;
}

export function WeakestLink() {
  const weak = AREAS.reduce((w, a, i) => (a.score < AREAS[w].score ? i : w), 0);
  const shape = AREAS.map((a, i) => point(i, (a.score / 100) * R).join(",")).join(" ");
  return (
    <ChartFrame title="Seven areas, one weak link" caption="Strong acquisition can't make up for weak retention. The diagnostic finds the area that caps the rest.">
      <svg viewBox="-34 0 288 220" className="mx-auto h-auto w-full max-w-[340px]" role="img" aria-label={`Example scores across seven growth areas. ${AREAS[weak].label} is the weakest at ${AREAS[weak].score}.`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={AREAS.map((_, i) => point(i, R * f).join(",")).join(" ")} fill="none" stroke="var(--color-line)" />
        ))}
        {AREAS.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="var(--color-line)" />;
        })}
        <polygon className="animate-fade" points={shape} fill="rgba(15,107,79,0.14)" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
        {AREAS.map((a, i) => {
          const [x, y] = point(i, (a.score / 100) * R);
          const [lx, ly] = point(i, R + 18);
          const isWeak = i === weak;
          return (
            <g key={a.label}>
              <circle cx={x} cy={y} r={isWeak ? 4.5 : 3} fill={isWeak ? "var(--color-alert)" : "var(--color-accent)"} />
              <text x={lx} y={ly + 3} fontSize="9.5" textAnchor="middle" fontWeight={isWeak ? 700 : 400} fill={isWeak ? "var(--color-alert)" : "var(--color-ink-2)"}>
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}
