import type { MerchantCategory } from "../classification/types";
import type { RecurringAmountStability, RecurringStatus, RecurringStrength } from "../recurring/types";
import type { ReviewStatus } from "../leak/types";

export const CATEGORY_LABEL: Record<MerchantCategory, string> = {
  likely_saas: "Likely SaaS",
  likely_software: "Likely software",
  not_software: "Not software",
  unknown: "Unknown",
};

export const RECURRING_STATUS_LABEL: Record<RecurringStatus, string> = {
  likely_recurring: "Likely recurring",
  possibly_recurring: "Possibly recurring",
  not_recurring: "Not recurring",
  insufficient_data: "Not enough data",
};

export const RECURRING_STRENGTH_LABEL: Record<RecurringStrength, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  insufficient: "Insufficient",
};

export const AMOUNT_STABILITY_LABEL: Record<RecurringAmountStability, string> = {
  highly_stable: "Highly stable",
  moderately_stable: "Moderately stable",
  variable: "Variable",
  insufficient_evidence: "Insufficient",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  strong_review: "Strong review",
  review: "Review",
  no_concern: "No concern",
  insufficient_evidence: "Insufficient evidence",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function fmtMoney(n: number | null): string {
  if (n === null) return "";
  const abs = Math.abs(n);
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
