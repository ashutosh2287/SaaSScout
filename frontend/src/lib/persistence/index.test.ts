import { describe, it, expect } from "vitest";
import {
  createSavedAnalysis,
  defaultAnalysisName,
  generateAnalysisId,
  schemaCompatible,
  isSerializableAnalysis,
} from "./index";
import type { SavedAnalysis } from "./types";
import type { SasscoutReport } from "../report/types";

function sampleReport(overrides?: Partial<SasscoutReport>): SasscoutReport {
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
    classification: {
      likelySaasCount: 1,
      likelySoftwareCount: 0,
      notSoftwareCount: 0,
      unknownCount: 0,
      totalClassified: 1,
      needsReview: 0,
    },
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
    merchants: [
      {
        normalizedKey: "acme\\inc, \"test\"",
        merchantName: "Acme, Inc. \"Test\" — 测试 Δ",
        transactionCount: 12,
        firstSeen: "2025-01-01",
        lastSeen: "2025-12-31",
        distinctRawDescriptions: ["ACME INC", 'Acme "Test"'],
        classification: {
          category: "likely_saas",
          confidence: "high",
          evidence: [{ type: "merchant_dictionary", message: "Test\nMerchant" }],
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
    ...overrides,
  };
}

describe("createSavedAnalysis", () => {
  it("produces a record with schemaVersion and required fields", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15T10:00:00.000Z" });
    expect(saved.id).toBe("id-1");
    expect(saved.schemaVersion).toBe(1);
    expect(saved.createdAt).toBe("2026-01-15T10:00:00.000Z");
    expect(saved.updatedAt).toBe("2026-01-15T10:00:00.000Z");
    expect(saved.fileName).toBe("txns.csv");
    expect(saved.name).toBe("Sasscout Analysis — txns.csv");
  });

  it("preserves the report without mutating it", () => {
    const report = sampleReport();
    const snapshot = JSON.stringify(report);
    const saved = createSavedAnalysis(report, { id: "id-1", now: "2026-01-15T10:00:00.000Z" });
    expect(saved.report).toBe(report);
    expect(JSON.stringify(report)).toBe(snapshot);
  });

  it("generates unique ids and valid timestamps", () => {
    const ids = new Set<string>();
    const timestamps: string[] = [];
    for (let i = 0; i < 100; i++) {
      const saved = createSavedAnalysis(sampleReport());
      ids.add(saved.id);
      timestamps.push(saved.createdAt);
    }
    expect(ids.size).toBe(100);
    for (const ts of timestamps) {
      expect(Number.isNaN(Date.parse(ts))).toBe(false);
    }
  });

  it("honours a custom name", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15", name: "My analysis" });
    expect(saved.name).toBe("My analysis");
  });
});

describe("defaultAnalysisName", () => {
  it("prefixes the filename", () => {
    expect(defaultAnalysisName("bank.xlsx")).toBe("Sasscout Analysis — bank.xlsx");
  });
});

describe("generateAnalysisId", () => {
  it("produces non-empty unique ids", () => {
    const a = generateAnalysisId();
    const b = generateAnalysisId();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("schemaCompatible", () => {
  it("accepts the current schemaVersion", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15" });
    expect(schemaCompatible(saved)).toBe(true);
  });

  it("rejects an older schemaVersion", () => {
    const saved: SavedAnalysis = {
      ...createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15" }),
      schemaVersion: 0,
    };
    expect(schemaCompatible(saved)).toBe(false);
  });
});

describe("isSerializableAnalysis", () => {
  it("accepts a valid record", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15" });
    expect(isSerializableAnalysis(saved)).toBe(true);
  });

  it("rejects non-objects and partial records", () => {
    expect(isSerializableAnalysis(null)).toBe(false);
    expect(isSerializableAnalysis("nope")).toBe(false);
    expect(isSerializableAnalysis({ id: "x", schemaVersion: 1 })).toBe(false);
  });
});

describe("serialization boundary", () => {
  // IndexedDB stores via the structured clone algorithm. structuredClone is the
  // closest approximation available in the test runtime. This verifies the
  // saved representation round-trips with the report fully intact.
  it("round-trips a full analysis through a structured clone", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15" });
    const cloned = structuredClone(saved) as SavedAnalysis;
    expect(cloned).toEqual(saved);
    expect(cloned.report).toEqual(saved.report);
    expect(cloned.report.merchants[0].merchantName).toBe(saved.report.merchants[0].merchantName);
  });

  it("round-trips special characters (quotes, newlines, Unicode, commas)", () => {
    const saved = createSavedAnalysis(sampleReport(), { id: "id-1", now: "2026-01-15" });
    const cloned = structuredClone(saved) as SavedAnalysis;
    const m = cloned.report.merchants[0];
    expect(m.merchantName).toContain('"');
    expect(m.merchantName).toContain(",");
    expect(m.merchantName).toContain("测试");
    expect(m.merchantName).toContain("Δ");
    expect(m.classification.evidence[0].message).toContain("\n");
    expect(m.normalizedKey).toContain("\\");
  });

  it("round-trips an empty report and a blocked analysis", () => {
    const empty = createSavedAnalysis(sampleReport({ merchants: [], quality: { ...sampleReport().quality, analysisReadiness: "blocked" as const } }), { id: "e1", now: "2026-01-15" });
    const cloned = structuredClone(empty) as SavedAnalysis;
    expect(cloned.report.merchants).toEqual([]);
    expect(cloned.report.quality.analysisReadiness).toBe("blocked");
  });

  it("round-trips a very large merchant list", () => {
    const merchants = Array.from({ length: 5000 }, (_, i) => ({
      ...sampleReport().merchants[0],
      normalizedKey: `m${i}`,
      merchantName: `Merchant ${i}`,
    }));
    const report = sampleReport({ merchants });
    const saved = createSavedAnalysis(report, { id: "big", now: "2026-01-15" });
    const cloned = structuredClone(saved) as SavedAnalysis;
    expect(cloned.report.merchants).toHaveLength(5000);
    expect(cloned.report.merchants[4999].merchantName).toBe("Merchant 4999");
  });
});
