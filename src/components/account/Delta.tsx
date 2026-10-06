/** "+6", "−3" or "no change", with an arrow, never colour alone. */
export function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-ink-3">—</span>;
  if (value === 0) return <span className="text-ink-3">no change</span>;
  const up = value > 0;
  return (
    <span className={`font-mono ${up ? "text-accent" : "text-alert"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {up ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
      <span className="sr-only">{up ? " improvement" : " decline"}</span>
    </span>
  );
}
