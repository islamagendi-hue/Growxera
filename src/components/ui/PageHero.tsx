import type { ReactNode } from "react";
import { Container } from "./Section";

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line">
      <Container className="py-16 sm:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-6 max-w-[16ch] text-h2 font-semibold sm:text-[clamp(2.5rem,5.5vw,4.5rem)]">{title}</h1>
        {lead && <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-2">{lead}</p>}
        {children}
      </Container>
    </section>
  );
}
