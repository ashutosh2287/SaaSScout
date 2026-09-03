import type { MerchantClassification } from "../classification/types";
import type { RecurringPattern } from "../recurring/types";
import { INTERVAL_CONSISTENCY_THRESHOLD } from "../recurring/constants";
import type { SoftwareSpendMerchant } from "../software/types";
import {
  CLASSIFY_HIGH_PTS,
  CLASSIFY_LOW_PTS,
  CLASSIFY_MEDIUM_PTS,
  HIGH_MONTHLY_PTS,
  HIGH_MONTHLY_SPEND,
  LONG_RUNNING_STRONG,
  LONG_RUNNING_STRONGER,
  LONG_RUNNING_MODERATE,
  LONG_RUNNING_PTS,
  MODERATE_MONTHLY_PTS,
  MODERATE_MONTHLY_SPEND,
  RECUR_SIGNAL_BASE,
  RECUR_HIGHLY_STABLE_BONUS,
  RECUR_GAP_PENALTY,
  RECUR_LOW_CONSISTENCY_PENALTY,
} from "./constants";
import { isRecurringSignal } from "./signals";

// The four axis functions are the documented scoring model (explainable, one
// observation per axis). They stay module-internal; only the total is exposed.

function classificationPoints(classification: MerchantClassification): number {
  switch (classification.confidence) {
    case "high":
      return CLASSIFY_HIGH_PTS;
    case "medium":
      return CLASSIFY_MEDIUM_PTS;
    default:
      return CLASSIFY_LOW_PTS;
  }
}

// Recurring-pattern axis. Consumes Step 15 recurring intelligence directly:
// the amount stability tier, the number of payment gaps and interval
// consistency. These are one piece of evidence (how reliable the recurring
// pattern is), so they are folded into a single bounded contribution and are
// NOT double-counted with the history/persistence axis below.
function recurringPoints(recurring: RecurringPattern | null): number {
  if (!isRecurringSignal(recurring)) return 0;
  let points = RECUR_SIGNAL_BASE;
  if (recurring.amountProfile === "highly_stable") points += RECUR_HIGHLY_STABLE_BONUS;
  if (recurring.gapCount > 0) points += RECUR_GAP_PENALTY;
  if (recurring.intervalConsistency < INTERVAL_CONSISTENCY_THRESHOLD) {
    points += RECUR_LOW_CONSISTENCY_PENALTY;
  }
  return Math.max(0, points);
}

// Long-running axis = payment volume + implied history, one observation. This is
// the persistence evidence; the recurring axis above deliberately does not also
// reward it (the two stay distinct to avoid double-counting).
function longRunningPoints(paymentCount: number): number {
  if (paymentCount >= LONG_RUNNING_STRONG) return LONG_RUNNING_PTS.strong;
  if (paymentCount >= LONG_RUNNING_STRONGER) return LONG_RUNNING_PTS.stronger;
  if (paymentCount >= LONG_RUNNING_MODERATE) return LONG_RUNNING_PTS.moderate;
  return LONG_RUNNING_PTS.weak;
}

// Spend magnitude is supporting evidence only (never decides status alone).
function spendPoints(estimatedMonthlySpend: number | null): number {
  if (estimatedMonthlySpend === null) return 0;
  if (estimatedMonthlySpend >= HIGH_MONTHLY_SPEND) return HIGH_MONTHLY_PTS;
  if (estimatedMonthlySpend >= MODERATE_MONTHLY_SPEND) return MODERATE_MONTHLY_PTS;
  return 0;
}

export function scoreMerchant(m: SoftwareSpendMerchant): number {
  return (
    classificationPoints(m.classification) +
    recurringPoints(m.recurring) +
    longRunningPoints(m.transactionCount) +
    spendPoints(m.estimatedMonthlySpend)
  );
}
