import { fmtMoney } from "../report/constants";
import type { SoftwareSpendMerchant, SoftwareSpendSummary } from "../software/types";
import type { SpendReview, ReviewStatus, ReviewSummary } from "../leak/types";
import type { AnalysisReadiness } from "../quality/types";
import type { ReportMerchant } from "../report/types";
import type {
  DashboardMerchantRow,
  DashboardMetrics,
  DashboardViewModel,
  ReviewQueueFilter,
  ReviewQueueItem,
  ReviewQueueSort,
} from "./types";
import { REVIEW_QUEUE_ORDER } from "./types";

// ---------- money ----------
// Single presentation formatter shared by the dashboard. Delegates to the
// existing report fmtMoney so live and saved views render identically.

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return fmtMoney(n);
}

// ---------- row adapters ----------
// Normalize two different source shapes (live software merchant, saved report
// merchant) into one dashboard row. Pure; never mutates inputs.

export function rowFromSoftwareMerchant(m: SoftwareSpendMerchant): DashboardMerchantRow {
  return {
    normalizedKey: m.normalizedKey,
    name: m.displayName,
    category: m.classification.category,
    classificationConfidence: m.classification.confidence,
    softwareStatus: m.status,
    recurringStatus: m.recurring?.status ?? null,
    recurringInterval: m.recurring?.interval ?? null,
    recurringStrength: m.recurring?.strength ?? null,
    amountProfile: m.recurring?.amountProfile ?? null,
    intervalConsistency: m.recurring?.intervalConsistency ?? null,
    patternSpanMonths: m.recurring?.patternSpanMonths ?? null,
    gapCount: m.recurring?.gapCount ?? null,
    priceChange: m.recurring?.priceChange ?? null,
    recurringEvidence: m.recurring?.evidence.map((e) => e.message) ?? [],
    transactionCount: m.transactionCount,
    typicalAmount: m.typicalTransactionAmount ?? null,
    totalSpend: m.totalSpend,
    estimatedMonthlySpend: m.estimatedMonthlySpend,
    estimatedYearlySpend: m.estimatedYearlySpend,
    reviewStatus: null,
    reviewConfidence: null,
    reviewScore: null,
    reasons: [],
  };
}

export function rowFromReportMerchant(m: ReportMerchant): DashboardMerchantRow {
  return {
    normalizedKey: m.normalizedKey,
    name: m.merchantName,
    category: m.classification.category,
    classificationConfidence: m.classification.confidence,
    softwareStatus: m.softwareStatus ?? "uncertain",
    recurringStatus: m.recurring?.status ?? null,
    recurringInterval: m.recurring?.interval ?? null,
    recurringStrength: m.recurring?.strength ?? null,
    amountProfile: m.recurring?.amountProfile ?? null,
    intervalConsistency: m.recurring?.intervalConsistency ?? null,
    patternSpanMonths: m.recurring?.patternSpanMonths ?? null,
    gapCount: m.recurring?.gapCount ?? null,
    priceChange: m.recurring?.priceChange ?? null,
    recurringEvidence: m.recurring?.evidence.map((e) => e.message) ?? [],
    transactionCount: m.transactionCount,
    typicalAmount: m.typicalTransactionAmount ?? null,
    totalSpend: m.totalSpend,
    estimatedMonthlySpend: m.estimatedMonthlySpend,
    estimatedYearlySpend: m.estimatedYearlySpend,
    reviewStatus: m.review?.status ?? null,
    reviewConfidence: m.review?.confidence ?? null,
    reviewScore: m.review?.score ?? null,
    reasons: m.review?.reasons ?? [],
  };
}

// ---------- review queue ----------
// Live reviews carry their own spend estimates (already computed by Step 10).

export function reviewFromSpendReview(r: SpendReview): ReviewQueueItem {
  return {
    key: r.merchantKey,
    name: r.merchantName,
    category: r.classification.category,
    reviewStatus: r.status,
    reviewConfidence: r.confidence,
    score: r.score,
    reasons: r.reasons,
    recurringStatus: r.recurring?.status ?? null,
    recurringInterval: r.recurring?.interval ?? null,
    recurringStrength: r.recurring?.strength ?? null,
    amountProfile: r.recurring?.amountProfile ?? null,
    intervalConsistency: r.recurring?.intervalConsistency ?? null,
    patternSpanMonths: r.recurring?.patternSpanMonths ?? null,
    gapCount: r.recurring?.gapCount ?? null,
    priceChange: r.recurring?.priceChange ?? null,
    transactionCount: r.recurring?.transactionCount ?? 0,
    typicalAmount: r.typicalAmount,
    estimatedMonthlySpend: r.estimatedMonthlySpend,
    estimatedYearlySpend: r.estimatedYearlySpend,
    recurringEvidence: r.recurring?.evidence.map((e) => e.message) ?? [],
  };
}

export function reviewFromRow(row: DashboardMerchantRow): ReviewQueueItem | null {
  if (!row.reviewStatus || row.reviewStatus === "no_concern") return null;
  return {
    key: row.normalizedKey,
    name: row.name,
    category: row.category,
    reviewStatus: row.reviewStatus,
    reviewConfidence: row.reviewConfidence ?? "low",
    score: row.reviewScore ?? 0,
    reasons: row.reasons,
    recurringStatus: row.recurringStatus,
    recurringInterval: row.recurringInterval,
    recurringStrength: row.recurringStrength,
    amountProfile: row.amountProfile,
    intervalConsistency: row.intervalConsistency,
    patternSpanMonths: row.patternSpanMonths,
    gapCount: row.gapCount,
    priceChange: row.priceChange,
    transactionCount: row.transactionCount,
    typicalAmount: row.typicalAmount,
    estimatedMonthlySpend: row.estimatedMonthlySpend,
    estimatedYearlySpend: row.estimatedYearlySpend,
    recurringEvidence: row.recurringEvidence,
  };
}

// Presentation-only filtering + ordering. Inputs are never mutated.
export function filterAndSortReviews(
  reviews: ReviewQueueItem[],
  filter: ReviewQueueFilter,
  sort: ReviewQueueSort,
): ReviewQueueItem[] {
  let out = reviews;
  if (filter !== "all") {
    out = out.filter((r) => matchFilter(r.reviewStatus, filter));
  }
  const ranked = [...out];
  ranked.sort((a, b) => compareReviews(a, b, sort));
  return ranked;
}

function matchFilter(status: ReviewStatus, filter: ReviewQueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "strong_review":
      return status === "strong_review";
    case "review":
      return status === "review";
    case "insufficient_evidence":
      return status === "insufficient_evidence";
  }
}

function compareReviews(a: ReviewQueueItem, b: ReviewQueueItem, sort: ReviewQueueSort): number {
  switch (sort) {
    case "monthly_desc":
      return (b.estimatedMonthlySpend ?? 0) - (a.estimatedMonthlySpend ?? 0);
    case "score_desc":
      return b.score - a.score;
    case "name_asc":
      return a.name.localeCompare(b.name);
    case "priority":
    default:
      const byStatus = REVIEW_QUEUE_ORDER[a.reviewStatus] - REVIEW_QUEUE_ORDER[b.reviewStatus];
      if (byStatus !== 0) return byStatus;
      return (b.estimatedMonthlySpend ?? 0) - (a.estimatedMonthlySpend ?? 0);
  }
}

// ---------- metrics ----------
// Only re-presents existing computed values. "Merchants worth reviewing" is
// existing ReviewSummary counts, never an invented savings figure.

export function deriveMetrics(args: {
  softwareSpend: SoftwareSpendSummary;
  review: ReviewSummary;
  qualityReadiness: AnalysisReadiness;
}): DashboardMetrics {
  const blocked = args.qualityReadiness === "blocked";
  return {
    softwareSpendIdentified: args.softwareSpend.totalSoftwareSpend,
    estimatedRecurringMonthly: args.softwareSpend.estimatedMonthlySpend,
    estimatedRecurringYearly: args.softwareSpend.estimatedYearlySpend,
    softwareMerchantCount: args.softwareSpend.softwareMerchantCount,
    merchantsWorthReviewing: args.review.strongReviewCount + args.review.reviewCount,
    strongReviewCount: args.review.strongReviewCount,
    blocked,
  };
}

// ---------- full view model ----------

export function deriveDashboard(args: {
  rows: DashboardMerchantRow[];
  softwareSpend: SoftwareSpendSummary;
  review: ReviewSummary;
  qualityReadiness: AnalysisReadiness;
  // Optional live review lookups (Step 10 SpendReview). Report-backed rows
  // already carry review fields; these override only when provided.
  reviews?: SpendReview[];
}): DashboardViewModel {
  const reviewByKey = new Map<string, ReviewQueueItem>();
  if (args.reviews) {
    for (const r of args.reviews) reviewByKey.set(r.merchantKey, reviewFromSpendReview(r));
  }

  const rows: DashboardMerchantRow[] = args.rows.map((row) => {
    const live = reviewByKey.get(row.normalizedKey);
    if (!live) return row;
    return {
      ...row,
      reviewStatus: live.reviewStatus,
      reviewConfidence: live.reviewConfidence,
      reviewScore: live.score,
      reasons: live.reasons,
    };
  });

  const reviewQueue = rows
    .map(reviewFromRow)
    .filter((x): x is ReviewQueueItem => x !== null)
    .sort((a, b) => compareReviews(a, b, "priority"));

  return {
    qualityReadiness: args.qualityReadiness,
    metrics: deriveMetrics(args),
    reviewQueue,
    softwareRows: rows,
  };
}
