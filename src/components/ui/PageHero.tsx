import type { ReactNode } from "react";
import { Container } from "./Section";

export function PageHero({
  eyebrow,
  title,
  lead,
  aside,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  /** A chart or mockup beside the title on wide screens, below it on phones. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const text = (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-6 max-w-[16ch] text-h2 font-semibold sm:text-[clamp(2.618rem,5vw,4.236rem)] sm:leading-[1.1]">{title}</h1>
      {lead && <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-2">{lead}</p>}
      {children}
    </>
  );
  return (
    <section className="border-b border-line">
      <Container className="py-[3.4375rem] sm:py-[5.5625rem]">
        {aside ? (
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
            <div>{text}</div>
            <div>{aside}</div>
          </div>
        ) : (
          text
        )}
      </Container>
    </section>
  );
}
