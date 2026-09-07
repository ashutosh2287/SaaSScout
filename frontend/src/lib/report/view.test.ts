import { describe, it, expect } from "vitest";
import type { ReportMerchant } from "./types";
import type { RecurringPattern } from "../recurring/types";
import type { SoftwareSpendSummary } from "../software/types";
import type { ReviewSummary } from "../leak/types";
import { displayMoney, merchantRecurringLabel, savedRecurringCounts, savedReview, savedSpend } from "./view";

function merchant(overrides?: Partial<ReportMerchant>): ReportMerchant {
  return {
    normalizedKey: "adobe",
    merchantName: "Adobe",
    transactionCount: 12,
    firstSeen: "2025-01-15",
    lastSeen: "2025-12-15",
    distinctRawDescriptions: ["ADOBE CREATIVE CLOUD"],
    classification: { category: "likely_saas", confidence: "high", evidence: [] },
    recurring: null,
    softwareStatus: "software",
    totalSpend: 1200,
    typicalTransactionAmount: 100,
    estimatedMonthlySpend: 100,
    estimatedYearlySpend: 1200,
    review: null,
    ...overrides,
  };
}

// Fill-defaults recurring pattern builder so view tests don't repeat the full
// shape (the new Step 15 fields are required on RecurringPattern).
function pattern(p?: Partial<RecurringPattern>): RecurringPattern {
  return {
    status: "insufficient_data",
    confidence: "low",
    interval: null,
    evidence: [],
    transactionCount: 0,
    firstSeen: null,
    lastSeen: null,
    typicalAmount: null,
    strength: "insufficient",
    amountProfile: "insufficient_evidence",
    intervalConsistency: 0,
    patternSpanMonths: 0,
    gapCount: 0,
    priceChange: null,
    ...p,
  };
}

const SOFTWARE_SUMMARY: SoftwareSpendSummary = {
  totalSoftwareSpend: 1200,
  estimatedMonthlySpend: 100,
  estimatedYearlySpend: 1200,
  softwareMerchantCount: 2,
  recurringSoftwareMerchantCount: 2,
  nonRecurringSoftwareMerchantCount: 0,
  uncertainMerchantCount: 0,
  topSoftwareByTotal: [],
  topRecurringByMonthly: [],
};

const REVIEW_SUMMARY: ReviewSummary = {
  strongReviewCount: 1,
  reviewCount: 2,
  noConcernCount: 0,
  insufficientEvidenceCount: 0,
  estimatedMonthlyReviewSpend: 45.5,
  estimatedYearlyReviewSpend: 546,
  unclearOwnershipCount: 0,
};

describe("savedRecurringCounts", () => {
  it("returns all zeros and totalAnalyzed 0 for empty merchants", () => {
    expect(savedRecurringCounts([])).toEqual({
      likelyRecurring: 0,
      possiblyRecurring: 0,
      notRecurring: 0,
      insufficientData: 0,
      totalAnalyzed: 0,
    });
  });

  it("counts each recurring status from merchant recurring data", () => {
    const merchants = [
      merchant({ normalizedKey: "a", recurring: pattern({ status: "likely_recurring", confidence: "high", interval: "monthly", typicalAmount: 10 }) }),
      merchant({ normalizedKey: "b", recurring: pattern({ status: "likely_recurring", confidence: "high", interval: "monthly", typicalAmount: 10 }) }),
      merchant({ normalizedKey: "c", recurring: pattern({ status: "possibly_recurring", confidence: "medium", interval: null }) }),
      merchant({ normalizedKey: "d", recurring: pattern({ status: "not_recurring", confidence: "high", interval: null }) }),
      merchant({ normalizedKey: "e", recurring: pattern({ status: "insufficient_data", confidence: "low", interval: null, transactionCount: 1 }) }),
      merchant({ normalizedKey: "f" }),
    ];
    expect(savedRecurringCounts(merchants)).toEqual({
      likelyRecurring: 2,
      possiblyRecurring: 1,
      notRecurring: 1,
      insufficientData: 1,
      totalAnalyzed: 6,
    });
  });

  it("does not count merchants with null recurring data", () => {
    expect(savedRecurringCounts([merchant({ normalizedKey: "x" }), merchant({ normalizedKey: "y" })])).toEqual({
      likelyRecurring: 0,
      possiblyRecurring: 0,
      notRecurring: 0,
      insufficientData: 0,
      totalAnalyzed: 2,
    });
  });
});

describe("savedReview", () => {
  it("marks review as blocked when quality is blocked", () => {
    expect(savedReview("blocked", REVIEW_SUMMARY).blocked).toBe(true);
  });

  it("does not block for ready or needs_attention quality", () => {
    expect(savedReview("ready", REVIEW_SUMMARY).blocked).toBe(false);
    expect(savedReview("needs_attention", REVIEW_SUMMARY).blocked).toBe(false);
  });

  it("passes through review summary values", () => {
    expect(savedReview("ready", REVIEW_SUMMARY)).toEqual({
      blocked: false,
      strongReviewCount: 1,
      reviewCount: 2,
      estimatedMonthlyReviewSpend: 45.5,
      estimatedYearlyReviewSpend: 546,
    });
  });
});

describe("savedSpend", () => {
  it("mirrors the persisted software spend summary without derivation drift", () => {
    const d = savedSpend(SOFTWARE_SUMMARY);
    expect(d.totalSoftwareSpend).toBe(SOFTWARE_SUMMARY.totalSoftwareSpend);
    expect(d.estimatedMonthlySpend).toBe(SOFTWARE_SUMMARY.estimatedMonthlySpend);
    expect(d.estimatedYearlySpend).toBe(SOFTWARE_SUMMARY.estimatedYearlySpend);
    expect(d.softwareMerchantCount).toBe(SOFTWARE_SUMMARY.softwareMerchantCount);
  });
});

describe("displayMoney", () => {
  it("renders a dash for null or undefined", () => {
    expect(displayMoney(null)).toBe("—");
    expect(displayMoney(undefined)).toBe("—");
  });

  it("formats a value with dollar sign", () => {
    expect(displayMoney(1200)).toBe("$1,200");
    expect(displayMoney(99.99)).toBe("$99.99");
  });

  it("uses the detected currency symbol when provided", () => {
    expect(displayMoney(1200, "€")).toBe("€1,200");
    expect(displayMoney(99.99, "£")).toBe("£99.99");
  });

  it("negatives render the sign before the symbol", () => {
    expect(displayMoney(-1200)).toBe("-$1,200");
    expect(displayMoney(-1200, "€")).toBe("-€1,200");
  });
});

describe("merchantRecurringLabel", () => {
  it("returns dash when recurring is missing", () => {
    expect(merchantRecurringLabel(merchant({ normalizedKey: "x" }))).toBe("—");
  });

  it("returns dash for not_recurring and insufficient_data", () => {
    expect(
      merchantRecurringLabel(merchant({ recurring: pattern({ status: "not_recurring", confidence: "high", interval: null, transactionCount: 1 }) })),
    ).toBe("—");
    expect(
      merchantRecurringLabel(merchant({ recurring: pattern({ status: "insufficient_data", confidence: "low", interval: null, transactionCount: 1 }) })),
    ).toBe("—");
  });

  it("returns a label for reviewable recurring statuses", () => {
    expect(
      merchantRecurringLabel(merchant({ recurring: pattern({ status: "likely_recurring", confidence: "high", interval: "monthly", typicalAmount: 10 }) })),
    ).toBe("Likely recurring");
  });
});

describe("missing optional report sections are safe", () => {
  it("handles merchants with null spend and recurring gracefully", () => {
    const m = merchant({ recurring: null, totalSpend: null, typicalTransactionAmount: null, estimatedMonthlySpend: null, estimatedYearlySpend: null });
    expect(merchantRecurringLabel(m)).toBe("—");
    expect(displayMoney(m.totalSpend)).toBe("—");
    expect(displayMoney(m.estimatedMonthlySpend)).toBe("—");
  });
});
