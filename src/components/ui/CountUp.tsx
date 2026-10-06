"use client";
import { useEffect, useRef, useState } from "react";

const NUM = /(\d+(?:[.,]\d+)*)/;

function parts(value: string) {
  return value.split(NUM).map((text) => {
    if (!NUM.test(text)) return { text };
    const decimals = /[.]\d+$/.test(text) ? text.split(".").pop()!.length : 0;
    const grouped = text.includes(",") && !/,\d{1,2}$/.test(text);
    return { text, target: Number(text.replace(/,/g, "")), decimals, grouped };
  });
}

function format(n: number, decimals: number, grouped: boolean) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
}

/**
 * Counts every number in `value` up from zero when it scrolls into view
 * ("SAR 2M+", "−70%", "0 → 100K", "66"). Screen readers and visitors who prefer
 * reduced motion get the final value straight away.
 */
export function CountUp({ value, duration = 1400, className }: { value: string | number; duration?: number; className?: string }) {
  const text = String(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setProgress(1);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setProgress(1 - Math.pow(1 - t, 3)); // ease-out
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [duration, text]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="tabular">
        {parts(text).map((p, i) =>
          p.target === undefined ? <span key={i}>{p.text}</span> : <span key={i}>{progress >= 1 ? p.text : format(p.target * progress, p.decimals, p.grouped)}</span>,
        )}
      </span>
    </span>
  );
}
