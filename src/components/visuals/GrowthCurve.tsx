import { ChartFrame } from "./ChartFrame";

const PHASES = [
  { x: 0, w: 110, label: "Diagnose", line: "Find the leak" },
  { x: 110, w: 140, label: "Transform", line: "Fix the system" },
  { x: 250, w: 150, label: "Scale", line: "Compound the wins" },
];

/** The shape of an engagement: no numbers, just how growth behaves in each stage. */
export function GrowthCurve({ dark = false }: { dark?: boolean }) {
  const stroke = dark ? "var(--color-accent-bright)" : "var(--color-accent)";
  const muted = dark ? "rgba(244,242,236,0.35)" : "var(--color-line-strong)";
  const text = dark ? "rgba(244,242,236,0.7)" : "var(--color-ink-3)";
  return (
    <ChartFrame
      dark={dark}
      title="How growth behaves in each stage"
      caption="Shape only, not a forecast. Gains start once the constraint is fixed, then compound as experiments keep landing."
    >
      <svg viewBox="0 0 400 220" className="h-auto w-full" role="img" aria-label="Growth stays flat while the bottleneck is found, rises as the system is fixed, then compounds at scale. Without a system it stays flat.">
        {PHASES.map((p, i) => (
          <g key={p.label}>
            <rect x={p.x} y={0} width={p.w} height={170} fill={i % 2 ? (dark ? "rgba(244,242,236,0.04)" : "rgba(14,19,17,0.03)") : "transparent"} />
            <line x1={p.x} x2={p.x} y1={0} y2={170} stroke={muted} strokeDasharray="2 4" />
            <text x={p.x + 8} y={190} fontSize="14" fontWeight="600" fill={dark ? "#f4f2ec" : "var(--color-ink)"}>
              {p.label}
            </text>
            <text x={p.x + 8} y={208} fontSize="11.5" fill={text}>
              {p.line}
            </text>
          </g>
        ))}
        <line x1={0} x2={400} y1={170} y2={170} stroke={muted} />
        {/* Without a system: more spend, the same flat line. */}
        <path d="M0 140 C 120 136, 260 134, 400 131" fill="none" stroke={muted} strokeWidth="1.5" strokeDasharray="5 5" />
        <text x={396} y={122} fontSize="12" textAnchor="end" fill={text}>
          Without a system
        </text>
        <path
          className="animate-draw"
          pathLength={1}
          d="M0 140 C 60 139, 90 141, 110 138 C 150 132, 200 112, 250 96 C 300 80, 350 52, 398 14"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle className="animate-fade" cx={398} cy={14} r={4.5} fill={stroke} />
      </svg>
    </ChartFrame>
  );
}
