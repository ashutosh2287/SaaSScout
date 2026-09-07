import type { MerchantClassification } from "../classification/types";
import type { RecurringPattern } from "../recurring/types";
import type { AnalysisReadiness } from "../quality/types";

// A "leak" is never proven by transaction history. Step 10 only produces a
// conservative, explainable review/risk signal.
export type ReviewStatus =
  | "review"
  | "strong_review"
  | "no_concern"
  | "insufficient_evidence";

export type ReviewConfidence = "high" | "medium" | "low";

// Internal, deterministic prioritization number. NOT a probability, NOT a score
// to show to users. Only used to rank and bucket status.
export type ReviewScore = number;

export type ReviewReasonType =
  | "recurring_software"
  | "interval_pattern"
  | "long_running"
  | "high_monthly_spend"
  | "high_yearly_spend"
  | "many_occurrences"
  | "stable_recurring_charge"
  | "amount_stability"
  | "price_change"
  | "payment_gap"
  | "limited_payments"
  | "insufficient_history"
  | "uncertain_classification"
  | "weak_recurring_evidence"
  | "poor_data_quality"
  // Step 27 — a recurring software merchant that the classification engine
  // could not identify by name or pattern. The recurring engine says this
  // is a sustained software bill; the classification engine says it is not
  // in the dictionary and the descriptions do not match a known category.
  // The honest read: the engine cannot say who or what owns this expense,
  // so the owner should confirm. A new instance of this reason on the same
  // merchant always fires after `uncertain_classification` is present.
  | "unclear_ownership";

export type ReviewReason = {
  type: ReviewReasonType;
  // User-facing explanation. Never exposes internal scoring terms.
  message: string;
};

export type SpendReview = {
  status: ReviewStatus;
  confidence: ReviewConfidence;
  score: ReviewScore;

  reasons: ReviewReason[];

  merchantKey: string;
  merchantName: string;

  recurring: RecurringPattern | null;
  classification: MerchantClassification;

  typicalAmount: number | null;
  estimatedMonthlySpend: number | null;
  estimatedYearlySpend: number | null;
};

// Amounts here are estimated recurring software spend tied to candidates that
// reached review status. They are NOT confirmed savings.
export type ReviewSummary = {
  strongReviewCount: number;
  reviewCount: number;
  noConcernCount: number;
  insufficientEvidenceCount: number;

  estimatedMonthlyReviewSpend: number;
  estimatedYearlyReviewSpend: number;

  // Step 27 — count of reviews carrying the `unclear_ownership` reason
  // (a recurring-software merchant that the classification engine could
  // not identify by name or pattern). Surfaces as a single "vendors
  // without an obvious owner" badge in the UI; does not change the
  // review/strong_review count itself because a merchant can carry the
  // reason in addition to its other reasons.
  unclearOwnershipCount: number;
};

export type SpendReviewResult = {
  reviews: SpendReview[];
  summary: ReviewSummary;
  // Bubbled up so the UI can show "Review unavailable" for blocked data without
  // re-deriving the quality algorithm.
  dataQuality: AnalysisReadiness;
};
