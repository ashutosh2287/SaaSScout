import type { ReportMerchant, SasscoutReport } from "../report/types";
import type { MerchantClassification, ClassificationEvidence } from "../classification/types";
import type { RecurringPattern } from "../recurring/types";
import type { ReviewReason, ReviewStatus, ReviewConfidence, ReviewScore } from "../leak/types";
import type { SoftwareSpendStatus } from "../software/types";

export type {
  MerchantInvestigation,
  InvestigationAction,
  InvestigationActionId,
  InvestigationPriority,
} from "./investigation";
export { deriveInvestigation } from "./investigation";

// Presentation-only view model for investigating a single merchant. Built
// entirely from persisted report data (the sole source of truth). It never
// re-analyzes transactions and never recomputes classification/recurring/leak.

export type MerchantDetail = {
  merchantKey: string;
  merchantName: string;
  transactionCount: number;
  rawDescriptorCount: number;
  rawDescriptors: string[];
  // Statement currency for money formatting, or null when undetected.
  currency: string | null;

  classification: MerchantClassification;
  classificationEvidence: ClassificationEvidence[];

  recurring: {
    status: RecurringPattern["status"] | null;
    confidence: RecurringPattern["confidence"] | null;
    strength: RecurringPattern["strength"] | null;
    interval: RecurringPattern["interval"];
    amountProfile: RecurringPattern["amountProfile"] | null;
    intervalConsistency: number | null;
    paymentCount: number | null;
    typicalAmount: number | null;
    patternSpanMonths: number | null;
    gapCount: number | null;
    priceChange: RecurringPattern["priceChange"];
    evidence: RecurringPattern["evidence"];
  };

  softwareSpend: {
    status: SoftwareSpendStatus | null;
    totalSpend: number | null;
    estimatedMonthlySpend: number | null;
    estimatedYearlySpend: number | null;
  };

  review: {
    status: ReviewStatus | null;
    confidence: ReviewConfidence | null;
    score: ReviewScore | null;
    reasons: ReviewReason[];
  };
};

export const REVIEW_UNAVAILABLE: ReviewStatus | null = null;

export function deriveMerchantDetail(m: ReportMerchant, currency: string | null = null): MerchantDetail {
  const rec = m.recurring;
  const rv = m.review;
  return {
    merchantKey: m.normalizedKey,
    merchantName: m.merchantName,
    transactionCount: m.transactionCount,
    rawDescriptorCount: m.distinctRawDescriptions.length,
    rawDescriptors: m.distinctRawDescriptions.slice(0, 3),
    currency,

    classification: m.classification,
    classificationEvidence: m.classification.evidence,

    recurring: {
      status: rec?.status ?? null,
      confidence: rec?.confidence ?? null,
      strength: rec?.strength ?? null,
      interval: rec?.interval ?? null,
      amountProfile: rec?.amountProfile ?? null,
      intervalConsistency: rec?.intervalConsistency ?? null,
      paymentCount: rec?.transactionCount ?? null,
      typicalAmount: rec?.typicalAmount ?? null,
      patternSpanMonths: rec?.patternSpanMonths ?? null,
      gapCount: rec?.gapCount ?? null,
      priceChange: rec?.priceChange ?? null,
      evidence: rec?.evidence ?? [],
    },

    softwareSpend: {
      status: m.softwareStatus,
      totalSpend: m.totalSpend,
      estimatedMonthlySpend: m.estimatedMonthlySpend,
      estimatedYearlySpend: m.estimatedYearlySpend,
    },

    review: {
      status: rv?.status ?? null,
      confidence: rv?.confidence ?? null,
      score: rv?.score ?? null,
      reasons: rv?.reasons ?? [],
    },
  };
}

// O(m) lookup over the report's merchants. Returns null when the key is unknown.
export function merchantDetailForKey(report: SasscoutReport, key: string): MerchantDetail | null {
  const m = report.merchants.find((m) => m.normalizedKey === key);
  return m ? deriveMerchantDetail(m, report.currency) : null;
}

// Deterministic, HTML-id-safe unique panel id so aria-controls/aria-labelledby
// can reference a single matching element.
export function uniquePanelId(scope: string, merchantKey: string): string {
  return `${sanitizeId(scope)}-${sanitizeId(merchantKey) || "n"}`;
}

// Strip characters that are invalid in an HTML id attribute; collapse runs.
export function sanitizeId(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_\-:]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}