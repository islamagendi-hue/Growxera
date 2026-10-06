/** A small line of Growth Scores over time (oldest → newest). Pure SVG, no client JS. */
export function ScoreTrend({ points, height = 64 }: { points: { score: number; date: string }[]; height?: number }) {
  if (points.length < 2) return null;
  const w = 320;
  const pad = 6;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (s: number) => pad + ((100 - s) * (height - pad * 2)) / 100;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-16 w-full" role="img" aria-label={`Growth Score over time: ${points.map((p) => p.score).join(", ")}`}>
      <line x1={pad} x2={w - pad} y1={y(50)} y2={y(50)} stroke="var(--color-line)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.score)} r={i === points.length - 1 ? 4 : 2.5} fill={i === points.length - 1 ? "var(--color-ink)" : "var(--color-accent)"} />
      ))}
    </svg>
  );
}
