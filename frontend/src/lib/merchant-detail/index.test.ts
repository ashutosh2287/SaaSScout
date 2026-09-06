import { describe, expect, it } from "vitest";
import { deriveMerchantDetail, merchantDetailForKey, sanitizeId, uniquePanelId } from "./index";
import type { ReportMerchant, SasscoutReport } from "../report/types";

function reportMerchant(overrides?: Partial<ReportMerchant>): ReportMerchant {
  return {
    normalizedKey: "adobe",
    merchantName: "Adobe",
    transactionCount: 6,
    firstSeen: "2025-07-10",
    lastSeen: "2025-12-10",
    distinctRawDescriptions: ["ADOBE CREATIVE CLOUD", "ADOBE CC"],
    classification: {
      category: "likely_saas",
      confidence: "high",
      evidence: [{ type: "merchant_dictionary", message: "Known software vendor." }],
    },
    recurring: {
      status: "likely_recurring",
      confidence: "high",
      interval: "monthly",
      evidence: [
        { type: "monthly_pattern", message: "Payments recur on a monthly interval." },
        { type: "stable_amount", message: "Amounts are highly stable." },
      ],
      transactionCount: 6,
      firstSeen: "2025-07-10",
      lastSeen: "2025-12-10",
      typicalAmount: 1499,
      strength: "strong",
      amountProfile: "highly_stable",
      intervalConsistency: 1,
      patternSpanMonths: 6,
      gapCount: 1,
      priceChange: { from: 1299, to: 1499 },
    },
    softwareStatus: "software",
    totalSpend: 8994,
    typicalTransactionAmount: 1499,
    estimatedMonthlySpend: 1499,
    estimatedYearlySpend: 17988,
    review: {
      status: "strong_review",
      confidence: "high",
      score: 8,
      reasons: [{ type: "recurring_software", message: "Recurring software payments detected." }],
    },
    ...overrides,
  };
}

function sampleReport(merchants: ReportMerchant[] = []): SasscoutReport {
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
      totalSoftwareSpend: 8994,
      estimatedMonthlySpend: 1499,
      estimatedYearlySpend: 17988,
      softwareMerchantCount: 1,
      recurringSoftwareMerchantCount: 1,
      nonRecurringSoftwareMerchantCount: 0,
      uncertainMerchantCount: 0,
      topSoftwareByTotal: [],
      topRecurringByMonthly: [],
    },
    review: {
      strongReviewCount: 1,
      reviewCount: 0,
      noConcernCount: 0,
      insufficientEvidenceCount: 0,
      estimatedMonthlyReviewSpend: 1499,
      estimatedYearlyReviewSpend: 17988,
    },
    currency: null,
    merchants,
  };
}

describe("STEP 18 — merchant detail derivation", () => {
  it("1: complete merchant detail exposes all sections", () => {
    const d = deriveMerchantDetail(reportMerchant());
    expect(d.merchantKey).toBe("adobe");
    expect(d.merchantName).toBe("Adobe");
    expect(d.rawDescriptorCount).toBe(2);
    expect(d.classification.category).toBe("likely_saas");
    expect(d.recurring.strength).toBe("strong");
    expect(d.recurring.intervalConsistency).toBe(1);
    expect(d.recurring.priceChange).toEqual({ from: 1299, to: 1499 });
    expect(d.softwareSpend.status).toBe("software");
    expect(d.softwareSpend.totalSpend).toBe(8994);
    expect(d.review.status).toBe("strong_review");
  });

  it("2: unknown merchant keeps unknown classification and no fabricated recurring/review", () => {
    const d = deriveMerchantDetail(
      reportMerchant({
        classification: { category: "unknown", confidence: "low", evidence: [] },
        softwareStatus: "uncertain",
        recurring: null,
        review: null,
      }),
    );
    expect(d.classification.category).toBe("unknown");
    expect(d.softwareSpend.status).toBe("uncertain");
    expect(d.recurring.status).toBeNull();
    expect(d.review.status).toBeNull();
    expect(d.classificationEvidence).toEqual([]);
  });

  it("3: insufficient recurring data presents nulls, not zeros", () => {
    const d = deriveMerchantDetail(
      reportMerchant({ recurring: null }),
    );
    expect(d.recurring.strength).toBeNull();
    expect(d.recurring.patternSpanMonths).toBeNull();
    expect(d.recurring.paymentCount).toBeNull();
    // No fabricated zero for missing monthly/typical.
    expect(d.recurring.typicalAmount).toBeNull();
  });

  it("4: null price change stays null (no fake price change)", () => {
    const m = reportMerchant();
    m.recurring!.priceChange = null;
    const d = deriveMerchantDetail(m);
    expect(d.recurring.priceChange).toBeNull();
  });

  it("5: no software spend estimate stays null, not $0", () => {
    const d = deriveMerchantDetail(
      reportMerchant({ estimatedMonthlySpend: null, estimatedYearlySpend: null, totalSpend: null }),
    );
    expect(d.softwareSpend.estimatedMonthlySpend).toBeNull();
    expect(d.softwareSpend.totalSpend).toBeNull();
  });

  it("6: blocked quality is surfaced through the report review absence, not fabricated", () => {
    const d = deriveMerchantDetail(reportMerchant({ review: null }));
    expect(d.review.status).toBeNull();
  });

  it("7: classification evidence is preserved", () => {
    const d = deriveMerchantDetail(reportMerchant());
    expect(d.classificationEvidence).toEqual([
      { type: "merchant_dictionary", message: "Known software vendor." },
    ]);
  });

  it("8: recurring evidence is preserved", () => {
    const d = deriveMerchantDetail(reportMerchant());
    expect(d.recurring.evidence).toEqual([
      { type: "monthly_pattern", message: "Payments recur on a monthly interval." },
      { type: "stable_amount", message: "Amounts are highly stable." },
    ]);
  });

  it("9: review reasons are preserved", () => {
    const d = deriveMerchantDetail(reportMerchant());
    expect(d.review.reasons).toEqual([
      { type: "recurring_software", message: "Recurring software payments detected." },
    ]);
  });

  it("10: price change is preserved", () => {
    const d = deriveMerchantDetail(reportMerchant());
    expect(d.recurring.priceChange).toEqual({ from: 1299, to: 1499 });
  });

  it("11: merchantDetailForKey returns null for unknown key and detail for known key", () => {
    const report = sampleReport([reportMerchant()]);
    expect(merchantDetailForKey(report, "adobe")?.merchantName).toBe("Adobe");
    expect(merchantDetailForKey(report, "nope")).toBeNull();
  });

  it("12: does not mutate the source merchant", () => {
    const m = reportMerchant();
    const before = JSON.stringify(m);
    deriveMerchantDetail(m);
    expect(JSON.stringify(m)).toBe(before);
  });

  it("13: deterministic output for the same input", () => {
    const m = reportMerchant();
    expect(deriveMerchantDetail(m)).toEqual(deriveMerchantDetail(m));
  });
});

describe("STEP 18 — accessibility id helpers", () => {
  it("sanitizeId strips invalid id characters and collapses runs", () => {
    expect(sanitizeId("acme\\inc, \"test\" — 测试 Δ")).toBe("acme-inc-test");
    expect(sanitizeId("Alpha123_-:x")).toBe("Alpha123_-:x");
  });

  it("uniquePanelId composes a stable id from scope and key", () => {
    const a = uniquePanelId("merchant-detail", "acme\\inc");
    const b = uniquePanelId("merchant-detail", "acme\\inc");
    expect(a).toBe(b);
    expect(a).toContain("merchant-detail-");
  });

  it("unique ids differ across merchants", () => {
    expect(uniquePanelId("review", "adobe")).not.toBe(uniquePanelId("review", "slack"));
  });
});