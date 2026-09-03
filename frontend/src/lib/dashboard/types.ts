import type { MerchantCategory, ClassificationConfidence } from "../classification/types";
import type { ReviewConfidence, ReviewReason, ReviewStatus } from "../leak/types";
import type {
  RecurringAmountStability,
  RecurringInterval,
  RecurringPriceChange,
  RecurringStatus,
  RecurringStrength,
} from "../recurring/types";
import type { SoftwareSpendStatus } from "../software/types";

// Presentation-only view model derived from the existing analysis outputs.
// It never recomputes analysis and never mutates its inputs.

export type DashboardMerchantRow = {
  normalizedKey: string;
  name: string;
  category: MerchantCategory;
  classificationConfidence: ClassificationConfidence;
  softwareStatus: SoftwareSpendStatus;
  recurringStatus: RecurringStatus | null;
  recurringInterval: RecurringInterval;
  recurringStrength: RecurringStrength | null;
  amountProfile: RecurringAmountStability | null;
  intervalConsistency: number | null;
  patternSpanMonths: number | null;
  gapCount: number | null;
  priceChange: RecurringPriceChange | null;
  // User-facing recurring evidence messages (the "why").
  recurringEvidence: string[];
  transactionCount: number;
  typicalAmount: number | null;
  totalSpend: number | null;
  estimatedMonthlySpend: number | null;
  estimatedYearlySpend: number | null;
  reviewStatus: ReviewStatus | null;
  reviewConfidence: ReviewConfidence | null;
  reviewScore: number | null;
  reasons: ReviewReason[];
};

export type ReviewQueueItem = {
  key: string;
  name: string;
  category: MerchantCategory;
  reviewStatus: ReviewStatus;
  reviewConfidence: ReviewConfidence;
  score: number;
  reasons: ReviewReason[];
  recurringStatus: RecurringStatus | null;
  recurringInterval: RecurringInterval;
  recurringStrength: RecurringStrength | null;
  amountProfile: RecurringAmountStability | null;
  intervalConsistency: number | null;
  patternSpanMonths: number | null;
  gapCount: number | null;
  priceChange: RecurringPriceChange | null;
  transactionCount: number;
  typicalAmount: number | null;
  estimatedMonthlySpend: number | null;
  estimatedYearlySpend: number | null;
  // User-facing recurring evidence messages (the "why" for the review).
  recurringEvidence: string[];
};

export type ReviewQueueFilter = "all" | "strong_review" | "review" | "insufficient_evidence";

export type ReviewQueueSort =
  | "priority"
  | "monthly_desc"
  | "score_desc"
  | "name_asc";

export type DashboardMetrics = {
  // Existing, already-computed values — re-presented only, never invented.
  softwareSpendIdentified: number | null;
  estimatedRecurringMonthly: number | null;
  estimatedRecurringYearly: number | null;
  softwareMerchantCount: number;
  merchantsWorthReviewing: number;
  strongReviewCount: number;
  blocked: boolean;
};

export type DashboardViewModel = {
  qualityReadiness: "ready" | "needs_attention" | "blocked";
  metrics: DashboardMetrics;
  reviewQueue: ReviewQueueItem[];
  softwareRows: DashboardMerchantRow[];
};

export const REVIEW_QUEUE_ORDER: Record<ReviewStatus, number> = {
  strong_review: 0,
  review: 1,
  no_concern: 2,
  insufficient_evidence: 3,
};
