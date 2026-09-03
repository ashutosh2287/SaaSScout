import {
  MONTHS_PER_QUARTER,
  MONTHS_PER_YEAR,
  WEEKS_PER_YEAR,
} from "./constants";
import type { RecurringInterval } from "../recurring/types";

// Median of positive amounts; robust against a single large outlier payment.
export function medianAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;
  const sorted = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// Convert a recurring interval's typical amount into a monthly and yearly
// estimate. Weekly/quarterly/annual are only set for a recognized calendar
// interval; anything without one yields null (no invented subscription cost).
export function estimateMonthlyAndYearly(
  interval: RecurringInterval,
  typicalAmount: number | null,
): { monthly: number | null; yearly: number | null } {
  if (typicalAmount === null) return { monthly: null, yearly: null };

  switch (interval) {
    case "weekly":
      return {
        monthly: (typicalAmount * WEEKS_PER_YEAR) / MONTHS_PER_YEAR,
        yearly: typicalAmount * WEEKS_PER_YEAR,
      };
    case "monthly":
      return { monthly: typicalAmount, yearly: typicalAmount * MONTHS_PER_YEAR };
    case "quarterly":
      return { monthly: typicalAmount / MONTHS_PER_QUARTER, yearly: typicalAmount * (MONTHS_PER_YEAR / MONTHS_PER_QUARTER) };
    case "annual":
      return { monthly: typicalAmount / MONTHS_PER_YEAR, yearly: typicalAmount };
    default:
      return { monthly: null, yearly: null };
  }
}
