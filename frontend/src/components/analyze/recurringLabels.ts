import type {
  RecurringAmountStability,
  RecurringConfidence,
  RecurringInterval,
  RecurringStatus,
  RecurringStrength,
} from "@/lib/recurring/types";

export const statusLabel: Record<RecurringStatus, string> = {
  likely_recurring: "Likely recurring",
  possibly_recurring: "Possibly recurring",
  not_recurring: "Not recurring",
  insufficient_data: "Not enough data",
};

export const statusTone: Record<RecurringStatus, string> = {
  likely_recurring: "bg-emerald-50 text-emerald-700",
  possibly_recurring: "bg-amber-50 text-amber-700",
  not_recurring: "bg-zinc-100 text-zinc-600",
  insufficient_data: "bg-zinc-100 text-zinc-600",
};

export const intervalLabel: Record<Exclude<RecurringInterval, null | "irregular">, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export const strengthLabel: Record<RecurringStrength, string> = {
  strong: "Strong pattern",
  moderate: "Moderate pattern",
  weak: "Weak pattern",
  insufficient: "Insufficient evidence",
};

export const amountStabilityLabel: Record<RecurringAmountStability, string> = {
  highly_stable: "Highly stable",
  moderately_stable: "Moderately stable",
  variable: "Variable amount",
  insufficient_evidence: "Insufficient",
};

export const confidenceTone: Record<RecurringConfidence, string> = {
  high: "text-emerald-700",
  medium: "text-amber-700",
  low: "text-zinc-500",
};