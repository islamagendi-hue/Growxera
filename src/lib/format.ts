export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0, currencyDisplay: "code" })
      .format(value)
      .replace(/ /g, " ");
  } catch {
    return `${currency} ${Math.round(value).toLocaleString("en-US")}`;
  }
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Parses user-typed numbers like "500,000" or "1.5". Returns undefined when not a number. */
export function parseNumber(input: string): number | undefined {
  const cleaned = input.replace(/[,\s]/g, "").replace(/%$/, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
