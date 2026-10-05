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
  children,
  tone = "paper",
  className = "",
}: {
  id?: string;
  index?: string;
  eyebrow?: string;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  tone?: "paper" | "ink" | "card";
  className?: string;
}) {
  const toneClass = tone === "ink" ? "bg-ink text-paper" : tone === "card" ? "bg-paper-2" : "";
  return (
    <section id={id} className={`scroll-mt-20 py-20 sm:py-28 ${toneClass} ${className}`}>
      <Container>
        {(eyebrow || title) && (
          <header className="mb-12 grid gap-6 sm:mb-16 lg:grid-cols-12">
            {eyebrow && (
              <p className={`eyebrow lg:col-span-3 ${tone === "ink" ? "!text-paper/60" : ""}`}>
                {index && <span className="mr-3">{index}</span>}
                {eyebrow}
              </p>
            )}
            <div className="lg:col-span-9">
              {title && <h2 className="max-w-[18ch] text-h2 font-semibold">{title}</h2>}
              {lead && (
                <p className={`mt-6 max-w-[60ch] text-lg leading-relaxed ${tone === "ink" ? "text-paper/70" : "text-ink-2"}`}>
                  {lead}
                </p>
              )}
            </div>
          </header>
        )}
        {children}
      </Container>
    </section>
  );
}
