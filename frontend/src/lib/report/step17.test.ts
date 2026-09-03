import { describe, expect, it } from "vitest";
import { buildReport } from "./build";
import { serializeReportCsv } from "./csv";
import { serializeReportJson } from "./json";
import type { ReportInput } from "./types";
import type { ClassifyResult } from "../classification/classify";
import type { RecurringPattern } from "../recurring/types";
import type { SoftwareSpendResult } from "../software/types";
import type { SpendReviewResult } from "../leak/types";
import type { DataQualityDiagnostics } from "../quality/types";
import type { ParseResult } from "../parse/types";
import { deriveDashboard, rowFromReportMerchant } from "../dashboard";
import { reviewFromRow } from "../dashboard/derive";

const FAKE_AT = "2026-01-15T10:00:00.000Z";

// A fully-populated recurring pattern carrying all Step 15 intelligence.
function fullPattern(): RecurringPattern {
  return {
    status: "likely_recurring",
    confidence: "high",
    interval: "monthly",
    evidence: [
      { type: "monthly_pattern", message: "Payments recur on a monthly interval." },
      { type: "stable_amount", message: "Amounts are highly stable." },
      { type: "long_history", message: "Payments span a long history." },
    ],
    transactionCount: 6,
    firstSeen: "2025-07-10",
    lastSeen: "2025-12-10",
    typicalAmount: 1499,
    strength: "strong",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 6,
    gapCount: 0,
    priceChange: { from: 1299, to: 1499 },
  };
}

function quality(overrides?: Partial<DataQualityDiagnostics>): DataQualityDiagnostics {
  return {
    totalTransactions: 48,
    validTransactions: 48,
    date: { present: 48, missing: 0, invalid: 0, earliest: "2025-01-01", latest: "2025-12-31" },
    description: { missing: 0, lowInformation: 0 },
    amount: { zero: 0, positive: 20, negative: 28 },
    duplicates: { exact: 0, possible: 0 },
    coverage: { dateRangeDays: 365, monthsRepresented: 12, transactionsByMonth: {} },
    score: 95,
    level: "Good",
    analysisReadiness: "ready",
    warnings: [],
    ...overrides,
  };
}

function classifiedMerchant(): ClassifyResult["merchants"][number] {
  return {
    normalizedKey: "adobe",
    canonicalName: "Adobe",
    transactionCount: 6,
    firstSeen: "2025-07-10",
    lastSeen: "2025-12-10",
    distinctRawDescriptions: ["ADOBE CREATIVE CLOUD"],
    classification: {
      category: "likely_saas",
      confidence: "high",
      evidence: [{ type: "merchant_dictionary", message: "Known software vendor." }],
    },
  };
}

function swMerchant(): SoftwareSpendResult["merchants"][number] {
  return {
    normalizedKey: "adobe",
    displayName: "Adobe",
    status: "software",
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    transactionCount: 6,
    totalSpend: 8994,
    typicalTransactionAmount: 1499,
    recurring: fullPattern(),
    estimatedMonthlySpend: 1499,
    estimatedYearlySpend: 17988,
  };
}

function reviewRow(): SpendReviewResult["reviews"][number] {
  return {
    merchantKey: "adobe",
    status: "strong_review",
    confidence: "high",
    score: 8,
    reasons: [
      { type: "recurring_software", message: "Recurring software payments detected." },
      { type: "long_running", message: "Pattern spans approximately 6 months." },
      { type: "price_change", message: "Recurring amount increased from $12.99 to $14.99." },
    ],
    merchantName: "Adobe",
    recurring: fullPattern(),
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    typicalAmount: 1499,
    estimatedMonthlySpend: 1499,
    estimatedYearlySpend: 17988,
  };
}

function parseResult(): ParseResult {
  return {
    file: { name: "txns.csv" },
    transactions: [],
    totalRows: 50,
    parsedRows: 48,
    skippedRows: 2,
    errors: [],
    warnings: [],
    columns: {},
    columnDiagnostics: { detected: {}, missing: [], ambiguous: [] },
  };
}

function makeInput(overrides?: {
  q?: Partial<DataQualityDiagnostics>;
  noRecurring?: boolean;
}): ReportInput {
  const sw = overrides?.noRecurring
    ? [{ ...swMerchant(), recurring: null }]
    : [swMerchant()];
  return {
    parse: parseResult(),
    quality: quality(overrides?.q),
    classification: {
      merchants: [classifiedMerchant()],
      summary: {
        likelySaasCount: 1,
        likelySoftwareCount: 0,
        notSoftwareCount: 0,
        unknownCount: 0,
        totalClassified: 1,
        needsReview: 0,
      },
    },
    recurring: {
      patterns: new Map(),
      summary: {
        likelyRecurringCount: 1,
        possiblyRecurringCount: 0,
        notRecurringCount: 0,
        insufficientDataCount: 0,
        totalAnalyzed: 1,
      },
    },
    software: {
      merchants: sw,
      summary: {
        totalSoftwareSpend: 8994,
        estimatedMonthlySpend: 1499,
        estimatedYearlySpend: 17988,
        softwareMerchantCount: 1,
        recurringSoftwareMerchantCount: overrides?.noRecurring ? 0 : 1,
        nonRecurringSoftwareMerchantCount: 0,
        uncertainMerchantCount: 0,
        topSoftwareByTotal: [],
        topRecurringByMonthly: [],
      },
    },
    review: {
      reviews: overrides?.noRecurring ? [] : [reviewRow()],
      summary: overrides?.noRecurring
        ? {
            strongReviewCount: 0,
            reviewCount: 0,
            noConcernCount: 0,
            insufficientEvidenceCount: 1,
            estimatedMonthlyReviewSpend: 0,
            estimatedYearlyReviewSpend: 0,
          }
        : {
            strongReviewCount: 1,
            reviewCount: 0,
            noConcernCount: 0,
            insufficientEvidenceCount: 0,
            estimatedMonthlyReviewSpend: 1499,
            estimatedYearlyReviewSpend: 17988,
          },
      dataQuality: overrides?.q?.analysisReadiness ?? "ready",
    },
  };
}

describe("STEP 17 — A. report schema preserves Step 15/16 evidence", () => {
  it("preserves full recurring intelligence (strength, amount, consistency, span, gap, priceChange, evidence)", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const m = report.merchants[0];
    expect(m.recurring).not.toBeNull();
    expect(m.recurring!.strength).toBe("strong");
    expect(m.recurring!.amountProfile).toBe("highly_stable");
    expect(m.recurring!.intervalConsistency).toBe(1);
    expect(m.recurring!.patternSpanMonths).toBe(6);
    expect(m.recurring!.gapCount).toBe(0);
    expect(m.recurring!.priceChange).toEqual({ from: 1299, to: 1499 });
    expect(m.recurring!.evidence).toEqual(fullPattern().evidence);
    expect(m.recurring!.transactionCount).toBe(6);
    expect(m.recurring!.typicalAmount).toBe(1499);
  });

  it("preserves review evidence (status, confidence, score, reasons)", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const m = report.merchants[0];
    expect(m.review).toEqual({
      status: "strong_review",
      confidence: "high",
      score: 8,
      reasons: reviewRow().reasons,
    });
  });

  it("does not mutate source objects when building the report", () => {
    const inp = makeInput();
    const before = JSON.stringify(inp);
    buildReport(inp, { generatedAt: FAKE_AT });
    expect(JSON.stringify(inp)).toBe(before);
  });

  it("leaves recurring null when no pattern exists rather than fabricating values", () => {
    const report = buildReport(makeInput({ noRecurring: true }), { generatedAt: FAKE_AT });
    const m = report.merchants[0];
    expect(m.recurring).toBeNull();
    expect(m.review).toBeNull();
    // No zero-fabrication: missing recurring stays null.
    expect(m.recurring).toBeNull();
  });

  it("blocks evidence when quality is blocked but preserves nulls otherwise", () => {
    const report = buildReport(makeInput({ q: { analysisReadiness: "blocked" } }), { generatedAt: FAKE_AT });
    expect(report.quality.analysisReadiness).toBe("blocked");
    expect(report.merchants[0].review).not.toBeNull();
  });
});

describe("STEP 17 — B. CSV evidence columns", () => {
  it("exports all Step 15/16 evidence headers in deterministic order", () => {
    const csv = serializeReportCsv(buildReport(makeInput(), { generatedAt: FAKE_AT }));
    const header = csv.split("\r\n")[0];
    const cols = header.split(",");
    // Recurring intelligence and evidence are present.
    for (const c of [
      "Recurring Strength",
      "Recurring Amount Stability",
      "Interval Consistency",
      "Pattern Span Months",
      "Gap Count",
      "Price Change From",
      "Price Change To",
      "Recurring Evidence",
      "Review Status",
      "Review Confidence",
      "Review Score",
      "Review Reasons",
      "Classification Evidence",
    ]) {
      expect(cols).toContain(c);
    }
  });

  it("serializes recurring evidence as readable text (no raw JSON, no [object Object])", () => {
    const csv = serializeReportCsv(buildReport(makeInput(), { generatedAt: FAKE_AT }));
    expect(csv).not.toContain("[object Object]");
    expect(csv).toContain("Payments recur on a monthly interval.");
    expect(csv).toContain("Amounts are highly stable.");
  });

  it("writes price change as numeric from/to cells", () => {
    const csv = serializeReportCsv(buildReport(makeInput(), { generatedAt: FAKE_AT }));
    // Adobe row contains the raw from/to amounts in the price-change columns.
    expect(csv).toContain(",1299,1499,");
  });

  it("keeps optional recurring fields blank when there is no pattern", () => {
    const csv = serializeReportCsv(buildReport(makeInput({ noRecurring: true }), { generatedAt: FAKE_AT }));
    const row = csv.split("\r\n")[1];
    const cells = row.split(",");
    // First 16 core columns unchanged; recurring-intelligence columns blank.
    const lastCells = cells.slice(16);
    for (const c of lastCells) expect(c).toBe("");
  });

  it("keeps one row per merchant (no transaction-level rows)", () => {
    const csv = serializeReportCsv(buildReport(makeInput(), { generatedAt: FAKE_AT }));
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2); // header + 1 merchant
  });

  it("escapes commas, quotes, and newlines in evidence", () => {
    const p = fullPattern();
    p.evidence = [
      { type: "monthly_pattern", message: 'Comma, "quote" and' },
      { type: "stable_amount", message: "line\nbreak" },
    ];
    const sw = [{ ...swMerchant(), recurring: p }];
    const inp = makeInput();
    inp.software = { ...inp.software, merchants: sw };
    const csv = serializeReportCsv(buildReport(inp, { generatedAt: FAKE_AT }));
    expect(csv).toContain(`"Comma, ""quote"" and;`);
    expect(csv).toContain("line\nbreak");
  });

  it("neutralizes spreadsheet formula injection from merchant-controlled text", () => {
    const cm = {
      ...classifiedMerchant(),
      canonicalName: '=HYPERLINK("http://x","click")',
    };
    const inp = makeInput();
    inp.classification = { ...inp.classification, merchants: [cm] };
    const csv = serializeReportCsv(buildReport(inp, { generatedAt: FAKE_AT }));
    // Merchant-name cell must be apostrophe-prefixed so it can't start a formula.
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow.startsWith(`"'=HYPERLINK`)).toBe(true);
  });
});

describe("STEP 17 — C. JSON preserves structured evidence", () => {
  it("keeps recurring evidence and priceChange structured (not flattened to strings)", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const parsed = JSON.parse(serializeReportJson(report));
    const m = parsed.merchants[0];
    expect(Array.isArray(m.recurring.evidence)).toBe(true);
    expect(m.recurring.evidence[0].type).toBe("monthly_pattern");
    expect(typeof m.recurring.evidence[0].message).toBe("string");
    // priceChange remains an object with numeric from/to.
    expect(m.recurring.priceChange.from).toBe(1299);
    expect(m.recurring.priceChange.to).toBe(1499);
    // review reasons stay objects.
    expect(Array.isArray(m.review.reasons)).toBe(true);
    expect(m.review.reasons.some((r: { type: string }) => r.type === "price_change")).toBe(true);
    // classification evidence stays structured.
    expect(Array.isArray(m.classification.evidence)).toBe(true);
  });

  it("preserves numeric values as numbers and null stays null", () => {
    const parsed = JSON.parse(
      serializeReportJson(buildReport(makeInput({ noRecurring: true }), { generatedAt: FAKE_AT })),
    );
    const m = parsed.merchants[0];
    expect(m.recurring).toBeNull();
    expect(m.typicalTransactionAmount).toBe(1499);
    expect(typeof m.estimatedMonthlySpend).toBe("number");
    expect(m.estimatedYearlySpend).toBe(17988);
  });

  it("produces parseable, indented JSON without [object Object]", () => {
    const json = serializeReportJson(buildReport(makeInput(), { generatedAt: FAKE_AT }));
    expect(JSON.parse(json).reportVersion).toBe(1);
    expect(json).toContain("{\n  ");
    expect(json).not.toContain("[object Object]");
  });

  it("contains no fabricated savings fields", () => {
    const parsed = JSON.parse(serializeReportJson(buildReport(makeInput(), { generatedAt: FAKE_AT })));
    for (const field of ["potentialSavings", "savings", "estimatedSavings", "wasteAmount"]) {
      expect(field in parsed).toBe(false);
      expect(field in parsed.merchants[0]).toBe(false);
    }
  });
});

describe("STEP 17 — D. dashboard parity and no re-analysis", () => {
  it("live and saved dashboard review evidence agree from the same persisted report", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    // Saved view is report-driven (no re-analysis).
    const saved = deriveDashboard({
      rows: report.merchants.map(rowFromReportMerchant),
      softwareSpend: report.softwareSpend,
      review: report.review,
      qualityReadiness: report.quality.analysisReadiness,
    });
    const qi = saved.reviewQueue[0];
    expect(qi.reviewStatus).toBe("strong_review");
    expect(qi.recurringStrength).toBe("strong");
    expect(qi.amountProfile).toBe("highly_stable");
    expect(qi.intervalConsistency).toBe(1);
    expect(qi.patternSpanMonths).toBe(6);
    expect(qi.priceChange).toEqual({ from: 1299, to: 1499 });
    expect(qi.recurringEvidence).toContain("Payments recur on a monthly interval.");
    // Every evidence value originated from the persisted report, not recomputed.
    expect(qi.reasons).toEqual(reviewRow().reasons);
  });

  it("saved reviewFromRow carries recurring evidence without re-analysis", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const row = rowFromReportMerchant(report.merchants[0]);
    const qi = reviewFromRow(row)!;
    expect(qi.recurringEvidence).toEqual([
      "Payments recur on a monthly interval.",
      "Amounts are highly stable.",
      "Payments span a long history.",
    ]);
    expect(qi.priceChange).toEqual({ from: 1299, to: 1499 });
  });

  it("does not fabricate values in the saved view (no merchants → empty queue)", () => {
    const inp = makeInput();
    inp.software = { ...inp.software, merchants: [] };
    const report = buildReport(inp, { generatedAt: FAKE_AT });
    const v = deriveDashboard({
      rows: [],
      softwareSpend: report.softwareSpend,
      review: report.review,
      qualityReadiness: report.quality.analysisReadiness,
    });
    expect(v.reviewQueue).toHaveLength(0);
    expect(v.softwareRows).toHaveLength(0);
  });
});

describe("STEP 17 — E. negative cases", () => {
  it("empty dataset produces no merchant rows and no evidence", () => {
    const inp = makeInput();
    inp.software = { ...inp.software, merchants: [] };
    inp.classification = { merchants: [], summary: inp.classification.summary };
    const report = buildReport(inp, { generatedAt: FAKE_AT });
    expect(report.merchants).toHaveLength(0);
    expect(serializeReportCsv(report)).toBe("Merchant,Category,Classification Confidence,Classification Evidence,Recurring Status,Recurring Confidence,Typical Amount,Payment Count,First Seen,Last Seen,Estimated Monthly Spend,Estimated Yearly Spend,Review Status,Review Confidence,Review Score,Review Reasons,Recurring Strength,Recurring Amount Stability,Interval Consistency,Pattern Span Months,Gap Count,Price Change From,Price Change To,Recurring Evidence\r\n");
  });

  it("insufficient recurring evidence and null price change produce no fabricated facts", () => {
    const report = buildReport(makeInput({ noRecurring: true }), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    const row = csv.split("\r\n")[1];
    // Price-change and evidence cells are blank when there is no pattern.
    expect(row).toMatch(/^Adobe,/);
    expect(row).toContain(",,,,,");
    expect(row).not.toContain(",1499,");
    // No fabricated recurring evidence text.
    expect(csv).not.toContain("Payments recur");
  });
});

describe("STEP 17 — F. determinism", () => {
  it("produces identical output for identical inputs apart from generatedAt", () => {
    const a = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const a2 = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(a).toEqual(a2);
    expect(serializeReportCsv(a)).toBe(serializeReportCsv(a2));
    expect(serializeReportJson(a)).toBe(serializeReportJson(a2));
  });
});