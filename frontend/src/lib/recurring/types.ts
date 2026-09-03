export type RecurringStatus =
  | "likely_recurring"
  | "possibly_recurring"
  | "not_recurring"
  | "insufficient_data";

export type RecurringConfidence = "high" | "medium" | "low";

export type RecurringInterval =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "irregular"
  | null;

export type RecurringEvidenceType =
  | "regular_interval"
  | "stable_amount"
  | "multiple_occurrences"
  | "long_history"
  | "monthly_pattern"
  | "quarterly_pattern"
  | "annual_pattern"
  | "weekly_pattern"
  | "amount_variation"
  | "insufficient_history"
  // Step 15 additions — additive, structured evidence.
  | "payment_history"
  | "payment_gap"
  | "price_change";

export type RecurringEvidence = {
  type: RecurringEvidenceType;
  message: string;
};

// Deterministic, evidence-based pattern strength. Derived only from observable
// signals (count, interval consistency, amount stability, span, gaps), never a
// black-box score. Used by the UI to separate "strong" from "limited history".
export type RecurringStrength = "strong" | "moderate" | "weak" | "insufficient";

// Granular amount behaviour. Distinct from the older binary "stable" flag; a
// pattern can be stable overall yet only "moderately stable" in its detail.
export type RecurringAmountStability =
  | "highly_stable"
  | "moderately_stable"
  | "variable"
  | "insufficient_evidence";

// A meaningful old->new recurring amount step (both positive payment amounts).
export type RecurringPriceChange = {
  from: number;
  to: number;
};

export type RecurringPattern = {
  status: RecurringStatus;
  confidence: RecurringConfidence;
  interval: RecurringInterval;
  evidence: RecurringEvidence[];
  transactionCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  typicalAmount: number | null;

  // Step 15 additive intelligence (present on every pattern).
  strength: RecurringStrength;
  amountProfile: RecurringAmountStability;
  // Fraction (0..1) of observed intervals that match the dominant interval.
  intervalConsistency: number;
  // Approximate whole months between the first and last observed payment.
  patternSpanMonths: number;
  // Count of payments believed missing based on interval-sized gaps.
  gapCount: number;
  // Set when a clean old->new recurring amount step was detected.
  priceChange: RecurringPriceChange | null;
};

export type RecurringResult = {
  // Keyed by Step 6 normalizedKey; only merchants with a real identity appear.
  patterns: Map<string, RecurringPattern>;
  summary: RecurringSummary;
};

// Identity-based counts. Never mixed with transaction counts.
export type RecurringSummary = {
  likelyRecurringCount: number;
  possiblyRecurringCount: number;
  notRecurringCount: number;
  insufficientDataCount: number;
  totalAnalyzed: number;
};
