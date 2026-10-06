"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Holds the chart animations inside (bars growing, lines drawing) until the
 * block scrolls into view, so visitors see them play rather than finished.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal="" data-shown={shown ? "" : undefined} className={className}>
      {children}
    </div>
  );
}
