import { describe, it, expect } from "vitest";
import { createSavedAnalysis, isReadableSavedAnalysis } from "./index";
import type { SavedAnalysis } from "./types";
import type { SasscoutReport } from "../report/types";

function sampleAnalysis(): SavedAnalysis {
  return createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15T10:00:00.000Z" });
}

function sampleReport(): SasscoutReport {
  return {
    reportVersion: 1,
    generatedAt: "2026-01-15T10:00:00.000Z",
    file: { name: "txns.csv", totalRows: 50, parsedRows: 48, skippedRows: 2 },
    quality: {
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
    },
    classification: { likelySaasCount: 1, likelySoftwareCount: 0, notSoftwareCount: 0, unknownCount: 0, totalClassified: 1, needsReview: 0 },
    softwareSpend: {
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
    review: {
      strongReviewCount: 0,
      reviewCount: 1,
      noConcernCount: 0,
      insufficientEvidenceCount: 0,
      estimatedMonthlyReviewSpend: 50,
      estimatedYearlyReviewSpend: 600,
    },
    currency: null,
    merchants: [
      {
        normalizedKey: "acme-inc",
        merchantName: "Acme, Inc.",
        transactionCount: 12,
        firstSeen: "2025-01-01",
        lastSeen: "2025-12-31",
        distinctRawDescriptions: ["ACME INC"],
        classification: {
          category: "likely_saas",
          confidence: "high",
          evidence: [{ type: "merchant_dictionary", message: "Test merchant" }],
        },
        recurring: null,
        softwareStatus: "software",
        totalSpend: 1200,
        typicalTransactionAmount: 100,
        estimatedMonthlySpend: 100,
        estimatedYearlySpend: 1200,
        review: {
          status: "review",
          confidence: "medium",
          score: 5,
          reasons: [{ type: "recurring_software", message: "Recurring software payments detected." }],
        },
      },
    ],
  };
}

function fullRecurringReport(): SasscoutReport {
  const report = sampleReport();
  report.merchants[0].recurring = {
    status: "likely_recurring",
    confidence: "high",
    interval: "monthly",
    evidence: [{ type: "regular_interval", message: "Regular monthly payments." }],
    transactionCount: 12,
    firstSeen: "2025-01-01",
    lastSeen: "2025-12-31",
    typicalAmount: 100,
    strength: "strong",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 11,
    gapCount: 0,
    priceChange: { from: 95, to: 100 },
  };
  return report;
}

function corrupt(overrides: Partial<SasscoutReport>): SavedAnalysis {
  const analysis = sampleAnalysis();
  analysis.report = { ...analysis.report, ...overrides };
  return analysis;
}

describe("isReadableSavedAnalysis", () => {
  it("accepts a production-shaped analysis (recurring null)", () => {
    expect(isReadableSavedAnalysis(sampleAnalysis())).toBe(true);
  });

  it("accepts a full recurring object with priceChange", () => {
    const analysis = sampleAnalysis();
    analysis.report = fullRecurringReport();
    expect(isReadableSavedAnalysis(analysis)).toBe(true);
  });

  it("rejects non-object and null records", () => {
    expect(isReadableSavedAnalysis(null)).toBe(false);
    expect(isReadableSavedAnalysis(undefined)).toBe(false);
    expect(isReadableSavedAnalysis("garbage")).toBe(false);
    expect(isReadableSavedAnalysis([1, 2, 3])).toBe(false);
  });

  it("accepts a record round-tripped through JSON (store serialization)", () => {
    const roundTripped = JSON.parse(JSON.stringify(sampleAnalysis())) as SavedAnalysis;
    expect(isReadableSavedAnalysis(roundTripped)).toBe(true);
  });

  it("rejects records missing saved-level fields", () => {
    const a = sampleAnalysis() as unknown as Record<string, unknown>;
    delete a.name;
    expect(isReadableSavedAnalysis(a)).toBe(false);
    const b = sampleAnalysis() as unknown as Record<string, unknown>;
    delete b.report;
    expect(isReadableSavedAnalysis(b)).toBe(false);
  });

  it("rejects a non-object report", () => {
    const a = sampleAnalysis();
    a.report = "garbage" as unknown as SasscoutReport;
    expect(isReadableSavedAnalysis(a)).toBe(false);
    a.report = null as unknown as SasscoutReport;
    expect(isReadableSavedAnalysis(a)).toBe(false);
  });

  it("rejects a missing or non-string generatedAt", () => {
    const noGeneratedAt = sampleReport();
    (noGeneratedAt as unknown as Record<string, unknown>).generatedAt = undefined;
    expect(isReadableSavedAnalysis(corrupt(noGeneratedAt))).toBe(false);

    expect(isReadableSavedAnalysis(corrupt({ generatedAt: 5 } as unknown as SasscoutReport))).toBe(false);
  });

  it("rejects a missing merchants array or non-number metrics", () => {
    expect(isReadableSavedAnalysis(corrupt({ merchants: undefined }))).toBe(false);
    expect(isReadableSavedAnalysis(corrupt({ merchants: "nope" as never }))).toBe(false);
    expect(
      isReadableSavedAnalysis(corrupt({ softwareSpend: { ...sampleReport().softwareSpend, estimatedMonthlySpend: NaN } })),
    ).toBe(false);
    expect(isReadableSavedAnalysis(corrupt({ review: { ...sampleReport().review, strongReviewCount: NaN } }))).toBe(false);
  });

  it("rejects a merchant missing normalizedKey/merchantName/classification", () => {
    const noKey = sampleReport();
    delete (noKey.merchants[0] as Partial<typeof noKey.merchants[0]>).normalizedKey;
    expect(isReadableSavedAnalysis(corrupt({ merchants: noKey.merchants }))).toBe(false);

    const noName = sampleReport();
    const m = noName.merchants[0];
    (m as Record<string, unknown>).merchantName = undefined;
    expect(isReadableSavedAnalysis(corrupt({ merchants: noName.merchants }))).toBe(false);

    const noClass = sampleReport();
    const m2 = noClass.merchants[0];
    (m2 as Record<string, unknown>).classification = undefined;
    expect(isReadableSavedAnalysis(corrupt({ merchants: noClass.merchants }))).toBe(false);
  });

  it("rejects a merchant missing distinctRawDescriptions or with non-string entries", () => {
    const missing = sampleReport();
    (missing.merchants[0] as Record<string, unknown>).distinctRawDescriptions = undefined;
    expect(isReadableSavedAnalysis(corrupt({ merchants: missing.merchants }))).toBe(false);

    const badEntries = sampleReport();
    badEntries.merchants[0].distinctRawDescriptions = ["ok", "also fine", { not: "a string" }] as unknown as string[];
    expect(isReadableSavedAnalysis(corrupt({ merchants: badEntries.merchants }))).toBe(false);
  });

  it("rejects classification evidence and review reasons that lack message entries", () => {
    const noEvidence = sampleReport();
    (noEvidence.merchants[0].classification as Record<string, unknown>).evidence = "nomap";
    expect(isReadableSavedAnalysis(corrupt({ merchants: noEvidence.merchants }))).toBe(false);

    const emptyEvidence = sampleReport();
    emptyEvidence.merchants[0].classification.evidence = [
      { type: "merchant_dictionary" },
    ] as unknown as SasscoutReport["merchants"][0]["classification"]["evidence"];
    expect(isReadableSavedAnalysis(corrupt({ merchants: emptyEvidence.merchants }))).toBe(false);

    const emptyReason = sampleReport();
    const mrv = emptyReason.merchants[0].review as unknown as Record<string, unknown>;
    mrv.reasons = [{}];
    expect(isReadableSavedAnalysis(corrupt({ merchants: emptyReason.merchants }))).toBe(false);
  });

  it("rejects a recurring object missing its evidence array", () => {
    const report = fullRecurringReport();
    const m = report.merchants[0];
    (m.recurring as Record<string, unknown>).evidence = undefined;
    expect(isReadableSavedAnalysis(corrupt({ merchants: report.merchants }))).toBe(false);
  });

  it("rejects recurring priceChange with non-numeric fields", () => {
    const report = fullRecurringReport();
    (report.merchants[0].recurring as Record<string, unknown>).priceChange = { from: "ten", to: 100 };
    expect(isReadableSavedAnalysis(corrupt({ merchants: report.merchants }))).toBe(false);
  });

  it("rejects NaN/Infinity numbers anywhere (IndexedDB structured-clone path)", () => {
    const noInf = sampleReport();
    noInf.merchants[0].transactionCount = Infinity;
    expect(isReadableSavedAnalysis(corrupt({ merchants: noInf.merchants }))).toBe(false);

    const noNaN = sampleReport();
    noNaN.quality.score = NaN;
    expect(isReadableSavedAnalysis(corrupt({ quality: noNaN.quality }))).toBe(false);

    const deepNaN = sampleReport();
    deepNaN.softwareSpend.topSoftwareByTotal = [{ totalSpend: NaN }] as never[];
    expect(isReadableSavedAnalysis(corrupt({ softwareSpend: deepNaN.softwareSpend }))).toBe(false);
  });

  it("rejects quality without the date/description/amount subobjects", () => {
    const noDate = sampleReport();
    (noDate.quality as Record<string, unknown>).date = undefined;
    expect(isReadableSavedAnalysis(corrupt({ quality: noDate.quality }))).toBe(false);

    const noMonths = sampleReport();
    (noMonths.quality.coverage as Record<string, unknown>).monthsRepresented = undefined;
    expect(isReadableSavedAnalysis(corrupt({ quality: noMonths.quality }))).toBe(false);
  });

  it("rejects warnings that are not an array of message-bearing objects", () => {
    const noWarningsArray = sampleReport();
    (noWarningsArray.quality as Record<string, unknown>).warnings = "none";
    expect(isReadableSavedAnalysis(corrupt({ quality: noWarningsArray.quality }))).toBe(false);

    const bareWarning = sampleReport();
    bareWarning.quality.warnings = [{ code: "SMALL_DATASET" } as never];
    expect(isReadableSavedAnalysis(corrupt({ quality: bareWarning.quality }))).toBe(false);
  });

  it("rejects exotic values JSON.stringify cannot serialize", () => {
    const fnValue = sampleReport();
    (fnValue.quality as Record<string, unknown>).extra = () => {};
    expect(isReadableSavedAnalysis(corrupt({ quality: fnValue.quality }))).toBe(false);

    const dateLeaf = sampleReport();
    (dateLeaf.softwareSpend as Record<string, unknown>).extra = new Date(0);
    expect(isReadableSavedAnalysis(corrupt({ softwareSpend: dateLeaf.softwareSpend }))).toBe(false);
  });

  it("rejects reference cycles", () => {
    const analysis = sampleAnalysis();
    const self: Record<string, unknown> = { cycle: null };
    self.cycle = self;
    (analysis.report.quality as Record<string, unknown>).extra = self;
    expect(isReadableSavedAnalysis(analysis)).toBe(false);
  });

  it("rejects pathologically deep nesting", () => {
    const analysis = sampleAnalysis();
    const innerRoot: Record<string, unknown> = { next: null };
    let node = innerRoot;
    for (let i = 0; i < 70; i++) {
      node.next = {};
      node = node.next as Record<string, unknown>;
    }
    (analysis.report.quality as Record<string, unknown>).deep = innerRoot;
    expect(isReadableSavedAnalysis(analysis)).toBe(false);
  });
});