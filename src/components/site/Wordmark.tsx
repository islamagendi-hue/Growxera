import { SITE } from "@/config/site";

/** GROWX ERA wordmark: "ERA" carries the accent. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] ${className}`} aria-label={SITE.name}>
      <span aria-hidden>{SITE.wordmark.left}</span>
      <span aria-hidden className="text-accent">
        {" "}
        {SITE.wordmark.right}
      </span>
    </span>
  );
}
