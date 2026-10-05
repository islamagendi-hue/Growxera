import { SITE } from "@/config/site";

/** GROWX_ERA wordmark. The underscore is the brand's signature: the cursor of the next era. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[-0.02em] ${className}`} aria-label={SITE.name}>
      <span aria-hidden>{SITE.wordmark.left}</span>
      <span aria-hidden className="text-accent">
        _
      </span>
      <span aria-hidden>{SITE.wordmark.right}</span>
    </span>
  );
}
