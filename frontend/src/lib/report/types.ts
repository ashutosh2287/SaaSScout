import type { ClassifyResult } from "../classification/classify";
import type { ClassificationSummary, MerchantClassification } from "../classification/types";
import type { SpendReviewResult } from "../leak/types";
import type { ReviewConfidence, ReviewReason, ReviewScore, ReviewStatus, ReviewSummary } from "../leak/types";
import type { ParseResult } from "../parse/types";
import type { DataQualityDiagnostics } from "../quality/types";
import type { RecurringPattern } from "../recurring/types";
import type { RecurringResult } from "../recurring/types";
import type { SoftwareSpendResult, SoftwareSpendStatus, SoftwareSpendSummary } from "../software/types";

export const REPORT_VERSION = 1;

export type ReportInput = {
  parse: ParseResult;
  quality: DataQualityDiagnostics;
  classification: ClassifyResult;
  recurring: RecurringResult;
  software: SoftwareSpendResult;
  review: SpendReviewResult;
};

export type ReportMerchant = {
  normalizedKey: string;
  merchantName: string;
  transactionCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  distinctRawDescriptions: string[];
  classification: MerchantClassification;
  recurring: RecurringPattern | null;
  softwareStatus: SoftwareSpendStatus | null;
  totalSpend: number | null;
  typicalTransactionAmount: number | null;
  estimatedMonthlySpend: number | null;
  estimatedYearlySpend: number | null;
  review: ReportMerchantReview | null;
};

export type ReportMerchantReview = {
  status: ReviewStatus;
  confidence: ReviewConfidence;
  score: ReviewScore;
  reasons: ReviewReason[];
};

export type SasscoutReport = {
  reportVersion: number;
  generatedAt: string;
  file: { name: string; totalRows: number; parsedRows: number; skippedRows: number };
  quality: DataQualityDiagnostics;
  classification: ClassificationSummary;
  softwareSpend: SoftwareSpendSummary;
  review: ReviewSummary;
  merchants: ReportMerchant[];
};
