/** Button styles, usable from server and client components. */
export type Variant = "primary" | "secondary" | "ghost" | "inverse";

const styles: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-accent-ink",
  secondary: "border border-ink/80 text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink",
  inverse: "bg-paper text-ink hover:bg-accent-bright",
};

export const buttonClass = (variant: Variant = "primary", extra = "") =>
  `inline-flex min-h-12 items-center justify-center gap-2 text-[0.95rem] font-medium transition-colors duration-200 ${variant === "ghost" ? "" : "px-6"} ${styles[variant]} ${extra}`;

