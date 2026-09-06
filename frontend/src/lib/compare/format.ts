import type { ComparisonFinding, ComparisonKind } from "./types";
import { isCurrencySymbol } from "../parse/currency";

export const KIND_LABEL: Record<ComparisonKind, string> = {
  new_recurring: "New recurring charge",
  ended_recurring: "Recurring charge ended",
  price_increase: "Price increased",
  price_decrease: "Price decreased",
  frequency_change: "Billing frequency changed",
  pattern_irregular: "Billing pattern became irregular",
  merchant_appeared: "Merchant appeared",
  merchant_disappeared: "Merchant disappeared",
};

export function confidenceLabel(level: ComparisonFinding["confidence"]): string {
  return {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
  }[level];
}

export function money(n: number | null, currency?: string | null): string | null {
  if (n === null) return null;
  const symbol = isCurrencySymbol(currency) ? currency : "$";
  return `${symbol}${Math.round(n * 100) / 100}`;
}

function sign(n: number): string {
  return n > 0 ? "+" : "−";
}

export function impactLine(f: ComparisonFinding, currency?: string | null): string | null {
  const symbol = isCurrencySymbol(currency) ? currency : "$";
  if (f.kind === "price_increase") {
    const m = f.impact.monthlyDelta;
    const y = f.impact.yearlyDelta;
    if (m !== null && y !== null) return `Now roughly ${sign(m)}${symbol}${m.toFixed(2)} per month, ${sign(y)}${symbol}${y.toFixed(2)} per year.`;
    if (m !== null) return `Now roughly ${sign(m)}${symbol}${m.toFixed(2)} per month.`;
    return null;
  }
  if (f.kind === "price_decrease") {
    const m = f.impact.monthlyDelta;
    const y = f.impact.yearlyDelta;
    if (m !== null && y !== null) return `Now roughly ${sign(m)}${symbol}${m.toFixed(2)} per month, ${sign(y)}${symbol}${y.toFixed(2)} per year.`;
    if (m !== null) return `Now roughly ${sign(m)}${symbol}${m.toFixed(2)} per month.`;
    return null;
  }
  if (f.kind === "new_recurring") {
    if (f.impact.yearlyDelta === null) return null;
    return `At the current cadence this would add roughly ${symbol}${f.impact.yearlyDelta.toFixed(2)} per year.`;
  }
  if (f.kind === "ended_recurring") {
    if (f.impact.yearlyDelta === null) return null;
    return `Had the cadence held, this would have been roughly ${symbol}${(-f.impact.yearlyDelta).toFixed(2)} per year.`;
  }
  if (f.kind === "frequency_change") {
    if (f.impact.yearlyDelta === null || f.impact.yearlyDelta === 0) return null;
    const dir = f.impact.yearlyDelta > 0 ? "more" : "less";
    return `Annualized cost moves roughly ${symbol}${Math.abs(f.impact.yearlyDelta).toFixed(2)} ${dir} per year.`;
  }
  return null;
}

export function windowText(w: { start: string | null; end: string | null } | null): string {
  if (!w?.start || !w?.end) return "no usable date window";
  return `${w.start} to ${w.end}`;
}