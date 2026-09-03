import type { DataQualityDiagnostics, AnalysisReadiness } from "../quality/types";
import type { SoftwareSpendMerchant } from "../software/types";
import {
  MIN_PAYMENTS_FOR_REVIEW,
  MIN_PAYMENTS_FOR_STRONG,
  STRONG_REVIEW_SCORE_THRESHOLD,
  CONFIDENCE_WEAK_STRENGTHS,
  CONFIDENCE_VARIABLE_AMOUNT,
} from "./constants";
import { scoreMerchant } from "./score";
import { buildReasons, isRecurringSignal } from "./signals";
import type {
  ReviewConfidence,
  ReviewStatus,
  SpendReview,
  SpendReviewResult,
  ReviewSummary,
} from "./types";

function statusForMerchant(m: SoftwareSpendMerchant): ReviewStatus {
  switch (m.status) {
    case "uncertain":
      return "insufficient_evidence";
    case "non_software":
      return "no_concern";
    case "software":
    default:
      break;
  }

  // Software merchant: branch on recurrence evidence.
  const r = m.recurring;
  if (r?.status === "insufficient_data") {
    return "insufficient_evidence";
  }
  if (!isRecurringSignal(m.recurring)) {
    return "no_concern";
  }
  // Recurring software spend: decide between review and strong review.
  // Below a minimum, there is too little history to review at all.
  if (m.transactionCount < MIN_PAYMENTS_FOR_REVIEW) return "insufficient_evidence";
  if (m.transactionCount < MIN_PAYMENTS_FOR_STRONG) return "review";
  return scoreMerchant(m) >= STRONG_REVIEW_SCORE_THRESHOLD ? "strong_review" : "review";
}

function confidenceFor(
  score: number,
  merchant: SoftwareSpendMerchant,
  quality: AnalysisReadiness,
  status: ReviewStatus,
): ReviewConfidence {
  if (status === "insufficient_evidence") return "low";
  let conf: ReviewConfidence = score >= STRONG_REVIEW_SCORE_THRESHOLD ? "high" : "medium";
  if (merchant.classification.confidence === "low") conf = "medium";
  // Weak or variable recurring evidence caps the certainty of the review signal
  // (the recurring pattern itself is only moderately supported).
  const r = merchant.recurring;
  if (
    r &&
    ((CONFIDENCE_WEAK_STRENGTHS as readonly string[]).includes(r.strength) ||
      r.amountProfile === CONFIDENCE_VARIABLE_AMOUNT)
  ) {
    conf = "medium";
  }
  if (quality !== "ready") conf = "medium";
  return conf;
}

const EMPTY_SUMMARY: ReviewSummary = {
  strongReviewCount: 0,
  reviewCount: 0,
  noConcernCount: 0,
  insufficientEvidenceCount: 0,
  estimatedMonthlyReviewSpend: 0,
  estimatedYearlyReviewSpend: 0,
};

export function detectSpendReviews(
  merchants: SoftwareSpendMerchant[],
  quality: DataQualityDiagnostics,
): SpendReviewResult {
  const summary: ReviewSummary = { ...EMPTY_SUMMARY };
  const reviews: SpendReview[] = [];

  // Blocked data: no confident conclusions. Every candidate becomes
  // "insufficient_evidence" so the UI shows "Review unavailable".
  const blocked = quality.analysisReadiness === "blocked";

  for (const m of merchants) {
    let status: ReviewStatus;
    let reasons = buildReasons(m);

    if (blocked) {
      status = "insufficient_evidence";
      reasons = [
        { type: "poor_data_quality", message: "Dataset quality limits confidence." },
      ];
    } else {
      status = statusForMerchant(m);

      if (m.status === "uncertain") {
        if (!reasons.some((r) => r.type === "uncertain_classification")) {
          reasons.push({
            type: "uncertain_classification",
            message: "Merchant classification is uncertain.",
          });
        }
      }
      if (status === "insufficient_evidence" && m.recurring?.status === "insufficient_data") {
        reasons.push({
          type: "insufficient_history",
          message: "Not enough payment history to confirm a pattern.",
        });
      }
      if (status === "no_concern" && m.recurring?.status === "not_recurring") {
        reasons.push({
          type: "weak_recurring_evidence",
          message: "Recurring evidence is weak or absent.",
        });
      }
      if (quality.analysisReadiness === "needs_attention") {
        reasons.push({
          type: "poor_data_quality",
          message: "Dataset quality limits confidence.",
        });
      }
    }

    const score = scoreMerchant(m);
    const review: SpendReview = {
      status,
      confidence: confidenceFor(score, m, quality.analysisReadiness, status),
      score,
      reasons,
      merchantKey: m.normalizedKey,
      merchantName: m.displayName,
      recurring: m.recurring,
      classification: m.classification,
      typicalAmount: m.typicalTransactionAmount,
      estimatedMonthlySpend: m.estimatedMonthlySpend,
      estimatedYearlySpend: m.estimatedYearlySpend,
    };
    reviews.push(review);

    // Summaries count by status.
    switch (status) {
      case "strong_review":
        summary.strongReviewCount++;
        break;
      case "review":
        summary.reviewCount++;
        break;
      case "no_concern":
        summary.noConcernCount++;
        break;
      case "insufficient_evidence":
        summary.insufficientEvidenceCount++;
        break;
    }

    // Review-spend totals include only review/strong_review candidates. These
    // are ESTIMATED recurring software spend under review, never savings.
    if (status === "review" || status === "strong_review") {
      if (m.estimatedMonthlySpend !== null) summary.estimatedMonthlyReviewSpend += m.estimatedMonthlySpend;
      if (m.estimatedYearlySpend !== null) summary.estimatedYearlyReviewSpend += m.estimatedYearlySpend;
    }
  }

  reviews.sort(compareReviews);

  return { reviews, summary, dataQuality: quality.analysisReadiness };
}

// Deterministic sort: strong_review -> review -> no_concern -> insufficient.
// Within a status, higher monthly estimate first, then key tie-break.
const STATUS_RANK: Record<ReviewStatus, number> = {
  strong_review: 0,
  review: 1,
  no_concern: 2,
  insufficient_evidence: 3,
};

function compareReviews(a: SpendReview, b: SpendReview): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  const aM = a.estimatedMonthlySpend ?? 0;
  const bM = b.estimatedMonthlySpend ?? 0;
  if (bM !== aM) return bM - aM;
  return a.merchantKey.localeCompare(b.merchantKey);
}
