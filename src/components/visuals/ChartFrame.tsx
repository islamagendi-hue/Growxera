import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/** Card that holds a chart or mockup, with a label saying where its numbers come from. */
export function ChartFrame({
  title,
  tag = "Illustrative",
  caption,
  children,
  className = "",
  dark = false,
}: {
  title: string;
  /** "Illustrative" for example numbers; anything else names the real source. */
  tag?: string;
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <Reveal
      className={`border p-5 sm:p-6 ${dark ? "border-paper/15 bg-paper/[0.04] text-paper" : "border-ink/15 bg-card shadow-[0_30px_80px_-50px_rgba(14,19,17,0.45)]"} ${className}`}
    >
      <figure>
        <div className="flex items-start justify-between gap-3">
          <figcaption className={`eyebrow ${dark ? "!text-paper/60" : ""}`}>{title}</figcaption>
          <span
            className={`shrink-0 border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider ${dark ? "border-paper/20 text-paper/60" : "border-line text-ink-3"}`}
          >
            {tag}
          </span>
        </div>
        <div className="mt-5">{children}</div>
        {caption && <p className={`mt-4 text-xs leading-relaxed ${dark ? "text-paper/60" : "text-ink-3"}`}>{caption}</p>}
      </figure>
    </Reveal>
  );
}
