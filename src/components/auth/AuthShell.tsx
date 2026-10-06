import type { ReactNode } from "react";

/** Shared layout for login, signup and link pages: copy on the left, form on the right. */
export function AuthShell({ eyebrow, title, intro, children, aside }: { eyebrow: string; title: string; intro: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-5">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-h2 font-semibold">{title}</h1>
          <div className="mt-4 max-w-[46ch] text-lg leading-relaxed text-ink-2">{intro}</div>
          {aside && <div className="mt-10">{aside}</div>}
        </div>
        <div className="lg:col-span-6 lg:col-start-7">{children}</div>
      </div>
    </section>
  );
}
