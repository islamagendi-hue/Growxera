import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

export function Section({
  id,
  index,
  eyebrow,
  title,
  lead,
  aside,
  children,
  tone = "paper",
  className = "",
}: {
  id?: string;
  index?: string;
  eyebrow?: string;
  title?: ReactNode;
  lead?: ReactNode;
  /** A chart or mockup shown beside the title on wide screens, below it on phones. */
  aside?: ReactNode;
  children?: ReactNode;
  tone?: "paper" | "ink" | "card";
  className?: string;
}) {
  const toneClass = tone === "ink" ? "bg-ink text-paper" : tone === "card" ? "bg-paper-2" : "";
  return (
    <section id={id} className={`scroll-mt-20 py-[3.4375rem] sm:py-[5.5625rem] ${toneClass} ${className}`}>
      <Container>
        {(eyebrow || title) && (
          <header className="mb-[2.125rem] grid gap-[1.3125rem] sm:mb-[3.4375rem] lg:grid-cols-12">
            {eyebrow && (
              <p className={`eyebrow lg:col-span-3 ${tone === "ink" ? "!text-paper/60" : ""}`}>
                {index && <span className="mr-3">{index}</span>}
                {eyebrow}
              </p>
            )}
            <div className={aside ? "lg:col-span-5" : "lg:col-span-9"}>
              {title && <h2 className="max-w-[18ch] text-h2 font-semibold">{title}</h2>}
              {lead && (
                <p className={`mt-6 max-w-[60ch] text-lg leading-relaxed ${tone === "ink" ? "text-paper/70" : "text-ink-2"}`}>
                  {lead}
                </p>
              )}
            </div>
            {aside && <div className="mt-4 lg:col-span-4 lg:mt-0">{aside}</div>}
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}
