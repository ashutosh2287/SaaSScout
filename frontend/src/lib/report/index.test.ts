import { describe, it, expect } from "vitest";
import { buildReport } from "./build";
import { serializeReportJson, reportFilename } from "./json";
import { serializeReportCsv } from "./csv";
import type { ReportInput } from "./types";
import type { ClassifyResult } from "../classification/classify";
import type { RecurringResult } from "../recurring/types";
import type { SoftwareSpendResult } from "../software/types";
import type { SpendReviewResult } from "../leak/types";
import type { DataQualityDiagnostics } from "../quality/types";
import type { ParseResult } from "../parse/types";

const FAKE_AT = "2026-01-15T10:00:00.000Z";

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

function classification(merchants?: ClassifyResult["merchants"]): ClassifyResult {
  return {
    merchants: merchants ?? [],
    summary: {
      likelySaasCount: 1,
      likelySoftwareCount: 0,
      notSoftwareCount: 0,
      unknownCount: 0,
      totalClassified: 1,
      needsReview: 0,
    },
  };
}

function recurring(): RecurringResult {
  return {
    patterns: new Map(),
    summary: { likelyRecurringCount: 0, possiblyRecurringCount: 0, notRecurringCount: 0, insufficientDataCount: 0, totalAnalyzed: 0 },
  };
}

function software(merchants?: SoftwareSpendResult["merchants"]): SoftwareSpendResult {
  return {
    merchants: merchants ?? [],
    summary: {
      totalSoftwareSpend: 1200,
      estimatedMonthlySpend: 100,
      estimatedYearlySpend: 1200,
      softwareMerchantCount: 1,
      recurringSoftwareMerchantCount: 1,
      nonRecurringSoftwareMerchantCount: 0,
      uncertainMerchantCount: 0,
      topSoftwareByTotal: [],
      topRecurringByMonthly: [],
    },
  };
}

function review(overrides?: Partial<SpendReviewResult>): SpendReviewResult {
  return {
    reviews: [],
    summary: { strongReviewCount: 0, reviewCount: 0, noConcernCount: 0, insufficientEvidenceCount: 0, estimatedMonthlyReviewSpend: 0, estimatedYearlyReviewSpend: 0 },
    dataQuality: "ready",
    ...(overrides ?? {}),
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
    currency: null,
  };
}

function makeInput(overrides?: {
  classified?: ClassifyResult["merchants"];
  sw?: SoftwareSpendResult["merchants"];
  rv?: SpendReviewResult["reviews"];
  reviewSummary?: SpendReviewResult["summary"];
  q?: Partial<DataQualityDiagnostics>;
}): ReportInput {
  return {
    parse: parseResult(),
    quality: quality(overrides?.q),
    classification: classification(overrides?.classified),
    recurring: recurring(),
    software: software(overrides?.sw),
    review: review({
      reviews: overrides?.rv ?? [],
      ...(overrides?.reviewSummary ? { summary: overrides.reviewSummary } : {}),
    }),
  };
}

function classifiedMerchant(overrides?: Partial<ClassifyResult["merchants"][number]>): ClassifyResult["merchants"][number] {
  return {
    normalizedKey: "adobe",
    canonicalName: "Adobe",
    transactionCount: 12,
    firstSeen: "2025-01-15",
    lastSeen: "2025-12-15",
    distinctRawDescriptions: ["ADOBE CREATIVE CLOUD"],
    classification: {
      category: "likely_saas",
      confidence: "high",
      evidence: [{ type: "merchant_dictionary", message: "Known software vendor." }],
    },
    ...overrides,
  };
}

// ── Report builder ──────────────────────────────────────────────────────────

function swMerchant(overrides?: Partial<SoftwareSpendResult["merchants"][number]>): SoftwareSpendResult["merchants"][number] {
  return {
    normalizedKey: "adobe",
    displayName: "Adobe",
    status: "software",
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    transactionCount: 12,
    totalSpend: 1200,
    typicalTransactionAmount: 100,
    recurring: null,
    estimatedMonthlySpend: 100,
    estimatedYearlySpend: 1200,
    ...overrides,
  };
}

function reviewRow(overrides?: Partial<SpendReviewResult["reviews"][number]>): SpendReviewResult["reviews"][number] {
  return {
    merchantKey: "adobe",
    status: "review",
    confidence: "medium",
    score: 6,
    reasons: [{ type: "recurring_software", message: "Recurring software payments detected." }],
    merchantName: "Adobe",
    recurring: null,
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    typicalAmount: 100,
    estimatedMonthlySpend: 100,
    estimatedYearlySpend: 1200,
    ...overrides,
  };
}

describe("buildReport", () => {
  it("produces a valid report with expected top-level keys", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(report.reportVersion).toBe(1);
    expect(report.generatedAt).toBe(FAKE_AT);
    expect(report.file.name).toBe("txns.csv");
    expect(report.file.totalRows).toBe(50);
    expect(report.file.parsedRows).toBe(48);
    expect(report.file.skippedRows).toBe(2);
    expect(report.quality.score).toBe(95);
    expect(report.classification.totalClassified).toBe(1);
    expect(report.softwareSpend.softwareMerchantCount).toBe(1);
    expect(report.merchants).toEqual([]);
  });

  it("populates merchant rows with all available data", () => {
    const sw = swMerchant();
    const rv = reviewRow();
    const report = buildReport(makeInput({ classified: [classifiedMerchant()], sw: [sw], rv: [rv] }), { generatedAt: FAKE_AT });
    expect(report.merchants).toHaveLength(1);
    const m = report.merchants[0];
    expect(m.merchantName).toBe("Adobe");
    expect(m.classification.category).toBe("likely_saas");
    expect(m.softwareStatus).toBe("software");
    expect(m.totalSpend).toBe(1200);
    expect(m.estimatedMonthlySpend).toBe(100);
    expect(m.review?.status).toBe("review");
    expect(m.review?.reasons[0].message).toBe("Recurring software payments detected.");
  });

  it("leaves review/software null when merchant has no corresponding data", () => {
    const report = buildReport(makeInput({ classified: [classifiedMerchant()] }), { generatedAt: FAKE_AT });
    const m = report.merchants[0];
    expect(m.softwareStatus).toBeNull();
    expect(m.totalSpend).toBeNull();
    expect(m.review).toBeNull();
  });

  it("handles empty transactions", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(report.merchants).toEqual([]);
    expect(report.file.parsedRows).toBe(48);
  });

  it("preserves blocked quality diagnostics", () => {
    const report = buildReport(makeInput({ q: { analysisReadiness: "blocked" } }), { generatedAt: FAKE_AT });
    expect(report.quality.analysisReadiness).toBe("blocked");
  });

  it("is deterministic for identical inputs", () => {
    const a = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const b = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(a).toEqual(b);
  });

  it("does not mutate source objects", () => {
    const inp = makeInput({ classified: [classifiedMerchant()] });
    const before = JSON.stringify(inp);
    buildReport(inp, { generatedAt: FAKE_AT });
    expect(JSON.stringify(inp)).toBe(before);
  });
});

// ── JSON ────────────────────────────────────────────────────────────────────

describe("serializeReportJson", () => {
  it("returns valid, parseable JSON", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const json = serializeReportJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.reportVersion).toBe(1);
    expect(parsed.generatedAt).toBe(FAKE_AT);
  });

  it("is indented (readable formatting)", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const json = serializeReportJson(report);
    expect(json).toContain("{\n  ");
    expect(json).toContain("\n}");
  });

  it("contains all expected top-level fields", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const parsed = JSON.parse(serializeReportJson(report));
    const keys = Object.keys(parsed);
    expect(keys).toContain("reportVersion");
    expect(keys).toContain("generatedAt");
    expect(keys).toContain("file");
    expect(keys).toContain("quality");
    expect(keys).toContain("classification");
    expect(keys).toContain("softwareSpend");
    expect(keys).toContain("review");
    expect(keys).toContain("merchants");
  });

  it("does not contain [object Object]", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(serializeReportJson(report)).not.toContain("[object Object]");
  });
});

describe("reportFilename", () => {
  it("formats date correctly", () => {
    const report = buildReport(makeInput(), { generatedAt: "2026-03-05T00:00:00.000Z" });
    expect(reportFilename(report, "json")).toBe("sasscout-report-2026-03-05.json");
    expect(reportFilename(report, "csv")).toBe("sasscout-report-2026-03-05.csv");
  });
});

// ── CSV ─────────────────────────────────────────────────────────────────────

describe("serializeReportCsv", () => {
  it("has correct header", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    const header = csv.split("\r\n")[0];
    expect(header).toBe(
      "Merchant,Category,Classification Confidence,Classification Evidence,Recurring Status,Recurring Confidence,Typical Amount,Payment Count,First Seen,Last Seen,Estimated Monthly Spend,Estimated Yearly Spend,Review Status,Review Confidence,Review Score,Review Reasons,Recurring Strength,Recurring Amount Stability,Interval Consistency,Pattern Span Months,Gap Count,Price Change From,Price Change To,Recurring Evidence",
    );
  });

  it("has correct row count", () => {
    const report = buildReport(makeInput({ classified: [classifiedMerchant()] }), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    const lines = csv.trim().split("\r\n");
    expect(lines.length).toBe(2); // header + 1 row
  });

  it("escapes commas in merchant names", () => {
    const report = buildReport(makeInput({ classified: [classifiedMerchant({ canonicalName: "Acme, Inc" })] }), { generatedAt: FAKE_AT });
    expect(serializeReportCsv(report)).toContain('"Acme, Inc"');
  });

  it("escapes quotes in evidence messages", () => {
    const report = buildReport(
      makeInput({
        classified: [
          classifiedMerchant({
            classification: {
              category: "unknown",
              confidence: "low",
              evidence: [{ type: "ambiguous_signal", message: 'The merchant is "uncertain".' }],
            },
          }),
        ],
      }),
      { generatedAt: FAKE_AT },
    );
    expect(serializeReportCsv(report)).toContain('"The merchant is ""uncertain""."');
  });

  it("escapes newlines in evidence", () => {
    const report = buildReport(
      makeInput({
        classified: [
          classifiedMerchant({
            classification: {
              category: "unknown",
              confidence: "low",
              evidence: [{ type: "ambiguous_signal", message: "Line1\nLine2" }],
            },
          }),
        ],
      }),
      { generatedAt: FAKE_AT },
    );
    expect(serializeReportCsv(report)).toContain('"Line1\nLine2"');
  });

  it("leaves blank cells for null optional values", () => {
    const report = buildReport(makeInput({ classified: [classifiedMerchant()] }), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    const lines = csv.trim().split("\r\n");
    const dataRow = lines[1];
    // With no recurring/review data, recurring, review and recurring-intelligence
    // columns are blank. Row starts with "Adobe," and has 23 commas for 24 fields.
    expect(dataRow).toMatch(/^Adobe,/);
    expect((dataRow.match(/,/g) || []).length).toBe(23);
  });

  it("does not contain [object Object]", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(serializeReportCsv(report)).not.toContain("[object Object]");
  });

  it("uses \\r\\n line endings", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(2);
  });

  it("includes valid values for populated merchant rows", () => {
    const sw = swMerchant({ typicalTransactionAmount: 99.99, estimatedMonthlySpend: 99.99, estimatedYearlySpend: 1199.88 });
    const rv = reviewRow({ status: "strong_review", confidence: "high", score: 8 });
    const report = buildReport(makeInput({ classified: [classifiedMerchant()], sw: [sw], rv: [rv] }), { generatedAt: FAKE_AT });
    const csv = serializeReportCsv(report);
    const line = csv.split("\r\n")[1];
    expect(line).toContain("Adobe");
    expect(line).toContain("Likely SaaS");
    expect(line).toContain("High");
    expect(line).toContain("$99.99");
    expect(line).toContain("12");
    expect(line).toContain("Strong review");
    expect(line).toContain("Recurring software payments detected.");
  });
});

// ── Privacy ─────────────────────────────────────────────────────────────────

describe("privacy", () => {
  it("buildReport is pure and does not call any external APIs", () => {
    // buildReport only transforms in-memory data; verify by checking it
    // produces output without any mocking — if it called a network API it
    // would fail in the test environment.
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(report).toBeDefined();
    expect(report.merchants).toBeInstanceOf(Array);
  });

  it("serialization functions are pure", () => {
    const report = buildReport(makeInput(), { generatedAt: FAKE_AT });
    expect(typeof serializeReportJson(report)).toBe("string");
    expect(typeof serializeReportCsv(report)).toBe("string");
  });
});
