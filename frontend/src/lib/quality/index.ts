import type { NormalizedTransaction } from "../parse/types";
import { computeCoverage } from "./coverage";
import { MIN_USEFUL_HISTORY_DAYS, SMALL_DATASET_THRESHOLD } from "./constants";
import { isLowInformationDescription, isMissingDescription } from "./descriptions";
import { countDuplicates } from "./duplicates";
import { computeScore, determineReadiness, mapLevel } from "./score";
import type { DataQualityDiagnostics, DataQualityWarning } from "./types";

export function inspectDataQuality(
  transactions: NormalizedTransaction[],
): DataQualityDiagnostics {
  const total = transactions.length;

  let datePresent = 0;
  let dateMissing = 0;
  let descMissing = 0;
  let descLowInfo = 0;
  let amountZero = 0;
  let amountPositive = 0;
  let amountNegative = 0;

  // Single accounting pass; cheap per-row checks only.
  for (const t of transactions) {
    if (t.date) datePresent++;
    else dateMissing++;
    if (isMissingDescription(t.description)) descMissing++;
    else if (isLowInformationDescription(t.description)) descLowInfo++;
    if (t.amount === 0) amountZero++;
    else if (t.amount > 0) amountPositive++;
    else amountNegative++;
  }

  const duplicates = countDuplicates(transactions);
  const coverage = computeCoverage(transactions);

  const shortHistory = coverage.dateRangeDays !== undefined && coverage.dateRangeDays < MIN_USEFUL_HISTORY_DAYS;
  const smallDataset = total < SMALL_DATASET_THRESHOLD;
  const hasSignificantGap = coverage.significantGapDays !== undefined;

  const diagnostics: DataQualityDiagnostics = {
    totalTransactions: total,
    validTransactions: datePresent,
    date: {
      present: datePresent,
      missing: dateMissing,
      // invalid dates are captured at parse time (INVALID_DATE errors); the
      // transaction array only holds null for unusable dates. Field kept for
      // future data sources that carry an explicit invalid state.
      invalid: 0,
      earliest: coverage.earliest,
      latest: coverage.latest,
    },
    description: { missing: descMissing, lowInformation: descLowInfo },
    amount: { zero: amountZero, positive: amountPositive, negative: amountNegative },
    duplicates,
    coverage: {
      dateRangeDays: coverage.dateRangeDays,
      monthsRepresented: coverage.monthsRepresented,
      transactionsByMonth: coverage.transactionsByMonth,
    },
    score: 0,
    level: "Needs attention",
    analysisReadiness: "ready",
    warnings: [],
  };

  diagnostics.score = computeScore(diagnostics, hasSignificantGap, shortHistory, smallDataset);
  diagnostics.level = mapLevel(diagnostics.score);
  diagnostics.analysisReadiness = determineReadiness(diagnostics);
  diagnostics.warnings = buildWarnings(diagnostics, shortHistory, smallDataset, hasSignificantGap);

  // An empty dataset has no measurable data; it cannot be "Good".
  if (total === 0) {
    diagnostics.score = 0;
    diagnostics.level = "Needs attention";
  }

  return diagnostics;
}

function buildWarnings(
  d: DataQualityDiagnostics,
  shortHistory: boolean,
  smallDataset: boolean,
  hasSignificantGap: boolean,
): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = [];

  if (d.date.missing > 0) {
    warnings.push({
      code: "MISSING_DATES",
      severity: d.date.missing / d.totalTransactions > 0.4 && d.totalTransactions > 0 ? "critical" : "warning",
      message: `${d.date.missing} transactions have no usable date.`,
      count: d.date.missing,
    });
  }
  if (d.description.missing > 0) {
    warnings.push({
      code: "MISSING_DESCRIPTIONS",
      severity: d.description.missing > 0.5 * d.totalTransactions ? "critical" : "warning",
      message: `${d.description.missing} transactions have no description.`,
      count: d.description.missing,
    });
  }
  if (d.description.lowInformation > 0) {
    warnings.push({
      code: "LOW_INFORMATION_DESCRIPTIONS",
      severity: "info",
      message: `${d.description.lowInformation} descriptions may carry little merchant information.`,
      count: d.description.lowInformation,
    });
  }
  if (d.amount.zero > 0) {
    warnings.push({
      code: "ZERO_VALUE_TRANSACTIONS",
      severity: "info",
      message: `${d.amount.zero} transactions have a zero amount (may be authorizations or adjustments).`,
      count: d.amount.zero,
    });
  }
  if (d.duplicates.exact > 0) {
    warnings.push({
      code: "EXACT_DUPLICATES",
      severity: "warning",
      message: `${d.duplicates.exact} exact duplicate rows detected.`,
      count: d.duplicates.exact,
    });
  }
  if (d.duplicates.possible > 0) {
    warnings.push({
      code: "POSSIBLE_DUPLICATES",
      severity: "warning",
      message: `${d.duplicates.possible} rows may be duplicates.`,
      count: d.duplicates.possible,
    });
  }
  if (hasSignificantGap) {
    warnings.push({
      code: "LARGE_DATE_GAP",
      severity: "warning",
      message: "A large gap in transaction dates was observed; possibly incomplete data.",
    });
  }
  if (shortHistory) {
    warnings.push({
      code: "SHORT_DATE_HISTORY",
      severity: "warning",
      message: "Observed date range is short; recurring analysis may not be reliable.",
    });
  }
  if (smallDataset) {
    warnings.push({
      code: "SMALL_DATASET",
      severity: "warning",
      message:
        d.totalTransactions === 0
          ? "No transactions were found in this dataset."
          : `Very few transactions found (${d.totalTransactions}); results may be limited.`,
      count: d.totalTransactions,
    });
  }

  return warnings;
}