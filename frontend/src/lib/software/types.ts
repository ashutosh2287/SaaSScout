import type { MerchantClassification } from "../classification/types";
import type { RecurringPattern } from "../recurring/types";

// Derived from Step 7 classification — Step 7 stays the single source of truth.
export type SoftwareSpendStatus = "software" | "non_software" | "uncertain";

export type SoftwareSpendMerchant = {
  normalizedKey: string;
  displayName: string;
  status: SoftwareSpendStatus;
  classification: MerchantClassification;
  transactionCount: number;
  totalSpend: number;
  typicalTransactionAmount: number | null;
  recurring: RecurringPattern | null;
  estimatedMonthlySpend: number | null;
  estimatedYearlySpend: number | null;
};

export type SoftwareSpendSummary = {
  totalSoftwareSpend: number;
  estimatedMonthlySpend: number;
  estimatedYearlySpend: number;
  softwareMerchantCount: number;
  recurringSoftwareMerchantCount: number;
  nonRecurringSoftwareMerchantCount: number;
  uncertainMerchantCount: number;
  topSoftwareByTotal: SoftwareSpendMerchant[];
  topRecurringByMonthly: SoftwareSpendMerchant[];
};

export type SoftwareSpendResult = {
  merchants: SoftwareSpendMerchant[];
  summary: SoftwareSpendSummary;
};
