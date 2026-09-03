import { estimateMonthlyAndYearly, medianAmount } from "./amounts";
import {
  TOP_RECURRING_BY_MONTHLY,
  TOP_SOFTWARE_BY_TOTAL,
} from "./constants";
import type {
  SoftwareSpendMerchant,
  SoftwareSpendResult,
  SoftwareSpendStatus,
  SoftwareSpendSummary,
} from "./types";
import type {
  MerchantCategory,
  MerchantClassification,
} from "../classification/types";
import type { ClassifiedMerchant } from "../classification";
import type { NormalizedTransactionWithMerchant } from "../merchant/types";
import type { RecurringInterval, RecurringPattern } from "../recurring/types";

const EMPTY_SUMMARY: SoftwareSpendSummary = {
  totalSoftwareSpend: 0,
  estimatedMonthlySpend: 0,
  estimatedYearlySpend: 0,
  softwareMerchantCount: 0,
  recurringSoftwareMerchantCount: 0,
  nonRecurringSoftwareMerchantCount: 0,
  uncertainMerchantCount: 0,
  topSoftwareByTotal: [],
  topRecurringByMonthly: [],
};

type SpendPayment = {
  date: string;
  amount: number;
};

// Derives the software status from Step 7's classification. Step 7 is the only
// source of truth; this is a pure mapping, never a second classifier.
function statusForCategory(category: MerchantCategory): SoftwareSpendStatus {
  switch (category) {
    case "likely_saas":
    case "likely_software":
      return "software";
    case "not_software":
      return "non_software";
    case "unknown":
      return "uncertain";
  }
}

// Whether a recurring pattern supports a monthly/yearly estimate. Only a
// concrete calendar interval on a (possibly or likely) recurring pattern is a
// defensible basis; irregular or insufficient data never produces an invented cost.
function isEstimateBasis(interval: RecurringInterval): boolean {
  return (
    interval === "weekly" ||
    interval === "monthly" ||
    interval === "quarterly" ||
    interval === "annual"
  );
}

export function aggregateSoftwareSpend(
  transactions: NormalizedTransactionWithMerchant[],
  classified: ClassifiedMerchant[],
  recurringByKey: ReadonlyMap<string, RecurringPattern>,
): SoftwareSpendResult {
  const classificationByKey = new Map<string, MerchantClassification>();
  const nameByKey = new Map<string, string>();
  for (const m of classified) {
    classificationByKey.set(m.normalizedKey, m.classification);
    nameByKey.set(m.normalizedKey, m.canonicalName);
  }

  // Group spend payments per merchant (date+amount so duplicates can be handled
  // exactly the same way the recurring layer does).
  const spendByKey = new Map<string, SpendPayment[]>();
  for (const t of transactions) {
    const key = t.merchant.normalizedKey;
    if (key === null) continue;
    // Money out only: positive amounts are refunds/credits, zeros are not spend.
    if (t.amount >= 0) continue;
    let list = spendByKey.get(key);
    if (!list) {
      list = [];
      spendByKey.set(key, list);
    }
    list.push({ date: t.date ?? "", amount: Math.abs(t.amount) });
  }

  const merchants: SoftwareSpendMerchant[] = [];
  const software: SoftwareSpendMerchant[] = [];

  for (const [key, payments] of spendByKey) {
    const classification = classificationByKey.get(key);
    if (!classification) continue;
    const status = statusForCategory(classification.category);
    const recurring = recurringByKey.get(key) ?? null;
    const unique = dedupeExact(payments);

    const transactionCount = unique.length;
    const totalSpend = unique.reduce((sum, p) => sum + p.amount, 0);
    const amounts = unique.map((p) => p.amount);
    const typicalTransactionAmount = recurring?.typicalAmount ?? medianAmount(amounts);

    let estimatedMonthlySpend: number | null = null;
    let estimatedYearlySpend: number | null = null;
    if (
      recurring &&
      (recurring.status === "likely_recurring" || recurring.status === "possibly_recurring") &&
      isEstimateBasis(recurring.interval)
    ) {
      const est = estimateMonthlyAndYearly(recurring.interval, typicalTransactionAmount);
      estimatedMonthlySpend = est.monthly;
      estimatedYearlySpend = est.yearly;
    }

    const merchant: SoftwareSpendMerchant = {
      normalizedKey: key,
      displayName: nameByKey.get(key) ?? key,
      status,
      classification,
      transactionCount,
      totalSpend,
      typicalTransactionAmount,
      recurring,
      estimatedMonthlySpend,
      estimatedYearlySpend,
    };

    merchants.push(merchant);
    if (status === "software") software.push(merchant);
  }

  const summary: SoftwareSpendSummary = { ...EMPTY_SUMMARY };

  for (const m of software) {
    summary.totalSoftwareSpend += m.totalSpend;
    if (m.estimatedMonthlySpend !== null) summary.estimatedMonthlySpend += m.estimatedMonthlySpend;
    if (m.estimatedYearlySpend !== null) summary.estimatedYearlySpend += m.estimatedYearlySpend;
    summary.softwareMerchantCount += 1;

    const recurringStatus = m.recurring?.status;
    const hasPattern =
      recurringStatus === "likely_recurring" || recurringStatus === "possibly_recurring";
    if (hasPattern) summary.recurringSoftwareMerchantCount += 1;
    else summary.nonRecurringSoftwareMerchantCount += 1;
  }

  summary.uncertainMerchantCount = merchants.filter((m) => m.status === "uncertain").length;

  summary.topSoftwareByTotal = [...software]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, TOP_SOFTWARE_BY_TOTAL);

  summary.topRecurringByMonthly = [...software]
    .filter((m) => m.estimatedMonthlySpend !== null)
    .sort((a, b) => (b.estimatedMonthlySpend ?? 0) - (a.estimatedMonthlySpend ?? 0))
    .slice(0, TOP_RECURRING_BY_MONTHLY);

  return { merchants, summary };
}

// Remove obvious duplicates: a payment with the same date and amount as one
// already kept is almost certainly an accidental repeat, not more spend. This
// mirrors the recurring layer so totals stay consistent with it.
// ponytail: full duplicate detection lives in Step 5; this only stops the spend
// total from double-counting an obvious repeated line.
function dedupeExact(payments: SpendPayment[]): SpendPayment[] {
  const seen = new Set<string>();
  const out: SpendPayment[] = [];
  for (const p of payments) {
    const key = `${p.date}|${p.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
