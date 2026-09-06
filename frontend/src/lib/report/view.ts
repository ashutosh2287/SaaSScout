import type { ReportMerchant, SasscoutReport } from "./types";
import type { AnalysisReadiness } from "../quality/types";
import type { SoftwareSpendSummary } from "../software/types";
import type { ReviewSummary } from "../leak/types";
import { fmtMoney, RECURRING_STATUS_LABEL } from "./constants";

export type RecurringCounts = {
  likelyRecurring: number;
  possiblyRecurring: number;
  notRecurring: number;
  insufficientData: number;
  totalAnalyzed: number;
};

export function savedRecurringCounts(merchants: SasscoutReport["merchants"]): RecurringCounts {
  const counts = { likelyRecurring: 0, possiblyRecurring: 0, notRecurring: 0, insufficientData: 0 };
  for (const m of merchants) {
    switch (m.recurring?.status) {
      case "likely_recurring":
        counts.likelyRecurring++;
        break;
      case "possibly_recurring":
        counts.possiblyRecurring++;
        break;
      case "not_recurring":
        counts.notRecurring++;
        break;
      case "insufficient_data":
        counts.insufficientData++;
        break;
    }
  }
  return { ...counts, totalAnalyzed: merchants.length };
}

export type ReviewDisplay = {
  blocked: boolean;
  strongReviewCount: number;
  reviewCount: number;
  estimatedMonthlyReviewSpend: number;
  estimatedYearlyReviewSpend: number;
};

export function savedReview(quality: AnalysisReadiness, review: ReviewSummary): ReviewDisplay {
  return {
    blocked: quality === "blocked",
    strongReviewCount: review.strongReviewCount,
    reviewCount: review.reviewCount,
    estimatedMonthlyReviewSpend: review.estimatedMonthlyReviewSpend,
    estimatedYearlyReviewSpend: review.estimatedYearlyReviewSpend,
  };
}

export type SpendDisplay = {
  totalSoftwareSpend: number;
  estimatedMonthlySpend: number;
  estimatedYearlySpend: number;
  softwareMerchantCount: number;
};

export function savedSpend(s: SoftwareSpendSummary): SpendDisplay {
  return {
    totalSoftwareSpend: s.totalSoftwareSpend,
    estimatedMonthlySpend: s.estimatedMonthlySpend,
    estimatedYearlySpend: s.estimatedYearlySpend,
    softwareMerchantCount: s.softwareMerchantCount,
  };
}

export function displayMoney(n: number | null | undefined, currency?: string | null): string {
  if (n === null || n === undefined) return "—";
  return fmtMoney(n, currency);
}

export function merchantRecurringLabel(m: ReportMerchant): string {
  const status = m.recurring?.status;
  if (status && status !== "insufficient_data" && status !== "not_recurring") {
    return RECURRING_STATUS_LABEL[status];
  }
  return "—";
}
