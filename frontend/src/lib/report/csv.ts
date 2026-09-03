import {
  AMOUNT_STABILITY_LABEL,
  CATEGORY_LABEL,
  CONFIDENCE_LABEL,
  RECURRING_STATUS_LABEL,
  RECURRING_STRENGTH_LABEL,
  REVIEW_STATUS_LABEL,
  fmtMoney,
} from "./constants";
import type { SasscoutReport } from "./types";

const HEADER = [
  "Merchant",
  "Category",
  "Classification Confidence",
  "Classification Evidence",
  "Recurring Status",
  "Recurring Confidence",
  "Typical Amount",
  "Payment Count",
  "First Seen",
  "Last Seen",
  "Estimated Monthly Spend",
  "Estimated Yearly Spend",
  "Review Status",
  "Review Confidence",
  "Review Score",
  "Review Reasons",
  // Additive Step 16 recurring intelligence columns (appended; existing
  // columns are unchanged).
  "Recurring Strength",
  "Recurring Amount Stability",
  "Interval Consistency",
  "Pattern Span Months",
  "Gap Count",
  "Price Change From",
  "Price Change To",
  "Recurring Evidence",
];

// Guards spreadsheet formula injection (CSV injection): cells whose value
// starts with a dangerous leading character are prefixed with a leading
// apostrophe, which Excel/Sheets treat as literal text and do not display.
const FORMULA_LEAD = /^[=+\-@\t]/;

function escapeCell(value: string): string {
  if (FORMULA_LEAD.test(value)) {
    value = "'" + value;
  }
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function joinMessages(items: Array<{ message: string }>): string {
  return items.map((e) => e.message).join("; ");
}

export function serializeReportCsv(report: SasscoutReport): string {
  const lines: string[] = [];
  lines.push(HEADER.join(","));

  for (const m of report.merchants) {
    const rec = m.recurring;
    const rv = m.review;
    const row = [
      m.merchantName,
      CATEGORY_LABEL[m.classification.category],
      CONFIDENCE_LABEL[m.classification.confidence],
      joinMessages(m.classification.evidence),
      rec ? RECURRING_STATUS_LABEL[rec.status] : "",
      rec ? CONFIDENCE_LABEL[rec.confidence] : "",
      fmtMoney(m.typicalTransactionAmount),
      String(m.transactionCount),
      m.firstSeen ?? "",
      m.lastSeen ?? "",
      fmtMoney(m.estimatedMonthlySpend),
      fmtMoney(m.estimatedYearlySpend),
      rv ? REVIEW_STATUS_LABEL[rv.status] : "",
      rv ? CONFIDENCE_LABEL[rv.confidence] : "",
      rv ? String(rv.score) : "",
      rv ? joinMessages(rv.reasons) : "",
      rec ? RECURRING_STRENGTH_LABEL[rec.strength] : "",
      rec ? AMOUNT_STABILITY_LABEL[rec.amountProfile] : "",
      rec ? String(rec.intervalConsistency) : "",
      rec ? String(rec.patternSpanMonths) : "",
      rec ? String(rec.gapCount) : "",
      rec?.priceChange?.from != null ? String(rec.priceChange.from) : "",
      rec?.priceChange?.to != null ? String(rec.priceChange.to) : "",
      rec ? joinMessages(rec.evidence) : "",
    ];
    lines.push(row.map(escapeCell).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}
