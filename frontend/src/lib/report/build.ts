import { REPORT_VERSION } from "./types";
import type { ReportInput, ReportMerchant, SasscoutReport } from "./types";

export function buildReport(
  input: ReportInput,
  opts?: { generatedAt?: string },
): SasscoutReport {
  const generatedAt = opts?.generatedAt ?? new Date().toISOString();
  const { parse, quality, classification, software, review } = input;

  const softwareByKey = new Map(software.merchants.map((m) => [m.normalizedKey, m]));
  const reviewByKey = new Map(review.reviews.map((r) => [r.merchantKey, r]));

  const merchants: ReportMerchant[] = classification.merchants.map((cm) => {
    const sw = softwareByKey.get(cm.normalizedKey);
    const rv = reviewByKey.get(cm.normalizedKey);

    return {
      normalizedKey: cm.normalizedKey,
      merchantName: cm.canonicalName,
      transactionCount: cm.transactionCount,
      firstSeen: cm.firstSeen ?? null,
      lastSeen: cm.lastSeen ?? null,
      distinctRawDescriptions: cm.distinctRawDescriptions,
      classification: cm.classification,
      recurring: sw?.recurring ?? null,
      softwareStatus: sw?.status ?? null,
      totalSpend: sw?.totalSpend ?? null,
      typicalTransactionAmount: sw?.typicalTransactionAmount ?? null,
      estimatedMonthlySpend: sw?.estimatedMonthlySpend ?? null,
      estimatedYearlySpend: sw?.estimatedYearlySpend ?? null,
      review: rv
        ? { status: rv.status, confidence: rv.confidence, score: rv.score, reasons: rv.reasons }
        : null,
    };
  });

  return {
    reportVersion: REPORT_VERSION,
    generatedAt,
    file: {
      name: parse.file.name,
      totalRows: parse.totalRows,
      parsedRows: parse.parsedRows,
      skippedRows: parse.skippedRows,
    },
    quality,
    classification: classification.summary,
    softwareSpend: software.summary,
    review: review.summary,
    merchants,
  };
}
