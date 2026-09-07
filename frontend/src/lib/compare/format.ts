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
  possible_overlap: "Possible overlap with another tool",
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
  if (f.kind === "possible_overlap") {
    const other = f.pair?.merchantName;
    if (!other) return null;
    return `Both are billed on a recurring cadence in the current period.`;
  }
  return null;
}

export function windowText(w: { start: string | null; end: string | null } | null): string {
  if (!w?.start || !w?.end) return "no usable date window";
  return `${w.start} to ${w.end}`;
}

// Step 22 — a neutral next-step line for a finding. Never tells the user to
// cancel; it names a concrete check they can act on. Decision support, not
// advice to terminate spending.
export function suggestedAction(f: ComparisonFinding): string | null {
  switch (f.kind) {
    case "new_recurring":
      return "Confirm this new subscription was expected and that the plan fits current usage; if it was not, contact the provider.";
    case "ended_recurring":
      return "Confirm this subscription was meant to cancel; if not, check whether a replacement charge appears soon.";
    case "price_increase":
      return "Check whether the current plan is still the right tier and whether a lower tier or annual billing avoids the increase.";
    case "price_decrease":
      return "No action needed — confirm the decrease was expected.";
    case "frequency_change":
      return "Review whether the new billing interval matches how the tool is actually used.";
    case "pattern_irregular":
      return "Check whether this merchant's billing became a one-off — call it out only if the cadence was supposed to continue.";
    case "merchant_appeared":
    case "merchant_disappeared":
      return "Likely a one-off purchase rather than a subscription; no action unless it recurs.";
    case "possible_overlap":
      return "Confirm both tools are still in active use; if not, cancel the redundant one through the provider directly.";
  }
}
