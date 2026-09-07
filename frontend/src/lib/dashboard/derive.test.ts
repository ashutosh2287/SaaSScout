import { describe, expect, it } from "vitest";
import type { MerchantClassification } from "../classification/types";
import type { SpendReview, ReviewSummary } from "../leak/types";
import type { RecurringPattern, RecurringStatus, RecurringInterval } from "../recurring/types";
import type { SoftwareSpendMerchant, SoftwareSpendSummary } from "../software/types";
import type { ReportMerchant } from "../report/types";
import {
  countReviewQueue,
  deriveDashboard,
  deriveMetrics,
  filterAndSortReviews,
  formatMoney,
  reviewFromRow,
  reviewFromSpendReview,
  rowFromReportMerchant,
  rowFromSoftwareMerchant,
} from "./derive";
import type { DashboardMetrics, ReviewQueueItem } from "./types";

// ---------- fixtures ----------

function classification(category: MerchantClassification["category"]): MerchantClassification {
  return { category, confidence: "high", evidence: [] };
}

function recurring(
  status: RecurringStatus,
  interval: RecurringInterval,
  opts: { typical?: number; count?: number } = {},
): RecurringPattern {
  return {
    status,
    confidence: status === "likely_recurring" ? "high" : "medium",
    interval,
    evidence: [],
    transactionCount: opts.count ?? 1,
    firstSeen: null,
    lastSeen: null,
    typicalAmount: opts.typical === undefined ? 100 : opts.typical,
    strength: status === "likely_recurring" ? "moderate" : status === "insufficient_data" ? "insufficient" : "weak",
    amountProfile: "highly_stable",
    intervalConsistency: 1,
    patternSpanMonths: 0,
    gapCount: 0,
    priceChange: null,
  };
}

function softwareMerchant(
  key: string,
  opts: {
    category?: MerchantClassification["category"];
    totalSpend?: number;
    monthly?: number | null;
    typical?: number | null;
    recurring?: RecurringPattern | null;
    count?: number;
  } = {},
): SoftwareSpendMerchant {
  return {
    normalizedKey: key,
    displayName: key,
    status: "software",
    classification: classification(opts.category ?? "likely_saas"),
    transactionCount: opts.count ?? 1,
    totalSpend: opts.totalSpend ?? 0,
    typicalTransactionAmount: opts.typical === undefined ? null : opts.typical,
    recurring: opts.recurring ?? null,
    estimatedMonthlySpend: opts.monthly === undefined ? null : opts.monthly,
    estimatedYearlySpend: opts.monthly === undefined ? null : (opts.monthly ?? 0) * 12,
  };
}

function review(
  key: string,
  status: SpendReview["status"],
  opts: { monthly?: number | null; score?: number; typical?: number | null } = {},
): SpendReview {
  return {
    status,
    confidence: status === "strong_review" ? "high" : "medium",
    score: opts.score ?? 5,
    reasons: [{ type: "recurring_software", message: "Recurring software charge." }],
    merchantKey: key,
    merchantName: key,
    recurring: recurring("likely_recurring", "monthly", { typical: opts.typical ?? 50 }),
    classification: classification("likely_saas"),
    typicalAmount: opts.typical === undefined ? 50 : opts.typical,
    estimatedMonthlySpend: opts.monthly === undefined ? 50 : opts.monthly,
    estimatedYearlySpend: opts.monthly === undefined ? 600 : (opts.monthly ?? 0) * 12,
  };
}

function summary(overrides: Partial<{
  strongReviewCount: number;
  reviewCount: number;
  noConcernCount: number;
  insufficientEvidenceCount: number;
  estimatedMonthlyReviewSpend: number;
  estimatedYearlyReviewSpend: number;
  unclearOwnershipCount: number;
  softwareSpend: number;
  monthly: number;
  yearly: number;
  softwareMerchantCount: number;
}> = {}): { softwareSpend: SoftwareSpendSummary; review: ReviewSummary } {
  return {
    softwareSpend: {
      totalSoftwareSpend: overrides.softwareSpend ?? 100,
      estimatedMonthlySpend: overrides.monthly ?? 50,
      estimatedYearlySpend: overrides.yearly ?? 600,
      softwareMerchantCount: overrides.softwareMerchantCount ?? 1,
      recurringSoftwareMerchantCount: 1,
      nonRecurringSoftwareMerchantCount: 0,
      uncertainMerchantCount: 0,
      topSoftwareByTotal: [],
      topRecurringByMonthly: [],
    },
    review: {
      strongReviewCount: overrides.strongReviewCount ?? 0,
      reviewCount: overrides.reviewCount ?? 0,
      noConcernCount: overrides.noConcernCount ?? 0,
      insufficientEvidenceCount: overrides.insufficientEvidenceCount ?? 0,
      estimatedMonthlyReviewSpend: overrides.estimatedMonthlyReviewSpend ?? 0,
      estimatedYearlyReviewSpend: overrides.estimatedYearlyReviewSpend ?? 0,
      unclearOwnershipCount: overrides.unclearOwnershipCount ?? 0,
    },
  };
}

function reportMerchant(key: string, opts: {
  reviewStatus?: NonNullable<ReportMerchant["review"]>["status"];
  score?: number;
}): ReportMerchant {
  return {
    normalizedKey: key,
    merchantName: key,
    transactionCount: 3,
    firstSeen: null,
    lastSeen: null,
    distinctRawDescriptions: [],
    classification: classification("likely_saas"),
    recurring: recurring("likely_recurring", "monthly", { typical: 40 }),
    softwareStatus: "software",
    totalSpend: 120,
    typicalTransactionAmount: 40,
    estimatedMonthlySpend: 40,
    estimatedYearlySpend: 480,
    review: opts.reviewStatus
      ? {
          status: opts.reviewStatus,
          confidence: "high",
          score: opts.score ?? 5,
          reasons: [{ type: "recurring_software", message: "Recurring software charge." }],
        }
      : null,
  };
}

// ---------- formatMoney ----------

describe("dashboard formatMoney", () => {
  it("formats positive values with $ and 2 decimals", () => {
    expect(formatMoney(59.99)).toBe("$59.99");
  });

  it("formats negative values with a leading minus", () => {
    expect(formatMoney(-59.99)).toBe("-$59.99");
  });

  it("renders an em dash for null and undefined", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toBe("$0");
  });
});

// ---------- metrics ----------

describe("deriveMetrics", () => {
  it("re-presents existing software spend values without inventing savings", () => {
    const s = summary({ softwareSpend: 1234.5, monthly: 99.99, yearly: 1199.88 });
    const m: DashboardMetrics = deriveMetrics({
      softwareSpend: s.softwareSpend,
      review: s.review,
      qualityReadiness: "ready",
    });
    expect(m.softwareSpendIdentified).toBe(1234.5);
    expect(m.estimatedRecurringMonthly).toBe(99.99);
    expect(m.estimatedRecurringYearly).toBe(1199.88);
    expect(m.softwareMerchantCount).toBe(1);
    expect(m.blocked).toBe(false);
    // No savings/savings amount is ever fabricated or exposed.
    expect("potentialSavings" in m).toBe(false);
    expect("savings" in m).toBe(false);
  });

  it("counts merchants worth reviewing as strong + review only", () => {
    const s = summary({ strongReviewCount: 2, reviewCount: 3, insufficientEvidenceCount: 7 });
    const m = deriveMetrics({
      softwareSpend: s.softwareSpend,
      review: s.review,
      qualityReadiness: "ready",
    });
    expect(m.merchantsWorthReviewing).toBe(5);
    expect(m.strongReviewCount).toBe(2);
  });

  it("marks blocked when qualityReadiness is blocked", () => {
    const s = summary();
    const m = deriveMetrics({
      softwareSpend: s.softwareSpend,
      review: s.review,
      qualityReadiness: "blocked",
    });
    expect(m.blocked).toBe(true);
  });
});

// ---------- review queue ----------

describe("review queue ordering", () => {
  const reviews: ReviewQueueItem[] = [
    reviewFromSpendReview(review("ie", "insufficient_evidence", { monthly: 90 })),
    reviewFromSpendReview(review("rev", "review", { monthly: 70 })),
    reviewFromSpendReview(review("str", "strong_review", { monthly: 60 })),
    reviewFromSpendReview(review("rev2", "review", { monthly: 5 })),
  ];

  it("orders strong_review before review before insufficient_evidence by default", () => {
    const ordered = filterAndSortReviews(reviews, "all", "priority");
    expect(ordered.map((r) => r.key)).toEqual(["str", "rev", "rev2", "ie"]);
  });

  it("within the same status, orders by descending estimated monthly spend", () => {
    const ordered = filterAndSortReviews(reviews, "review", "priority");
    expect(ordered.map((r) => r.key)).toEqual(["rev", "rev2"]);
  });

  it("filters by status (presentation only)", () => {
    expect(filterAndSortReviews(reviews, "strong_review", "priority").map((r) => r.key)).toEqual(["str"]);
    expect(filterAndSortReviews(reviews, "insufficient_evidence", "priority").map((r) => r.key)).toEqual(["ie"]);
    expect(filterAndSortReviews(reviews, "all", "priority")).toHaveLength(4);
  });

  it("sorts by monthly desc, score desc, and name asc", () => {
    expect(filterAndSortReviews(reviews, "all", "monthly_desc").map((r) => r.key)).toEqual(["ie", "rev", "str", "rev2"]);
    expect(filterAndSortReviews(reviews, "all", "name_asc").map((r) => r.key)).toEqual(["ie", "rev", "rev2", "str"]);
  });

  it("sorts by score desc", () => {
    const scored = reviews.map((r, i) => ({ ...r, score: i }));
    expect(filterAndSortReviews(scored, "all", "score_desc")[0].score).toBe(3);
  });

  it("does not mutate the input array", () => {
    const snapshot = reviews.map((r) => r.key);
    filterAndSortReviews(reviews, "all", "priority");
    filterAndSortReviews(reviews, "review", "name_asc");
    expect(reviews.map((r) => r.key)).toEqual(snapshot);
  });
});

// ---------- Step 23: actionable-only preset ----------

describe("review queue actionable preset", () => {
  const make = (
    entries: [key: string, status: ReviewQueueItem["reviewStatus"]][],
  ): ReviewQueueItem[] => entries.map(([key, status]) => ({ ...reviewFromSpendReview(review(key, status)), key, name: key }));

  it("actionable returns only strong_review and review, preserving priority order", () => {
    const q = make([
      ["ie1", "insufficient_evidence"],
      ["rev2", "review"],
      ["str", "strong_review"],
      ["rev1", "review"],
    ]);
    const out = filterAndSortReviews(q, "actionable", "priority");
    expect(out.map((r) => r.key)).toEqual(["str", "rev2", "rev1"]);
  });

  it("all still returns every review row", () => {
    const q = make([
      ["a", "strong_review"],
      ["b", "review"],
      ["c", "insufficient_evidence"],
    ]);
    expect(filterAndSortReviews(q, "all", "priority")).toHaveLength(3);
  });

  it("counts are derived dynamically from reviewStatus", () => {
    const q = make([
      ["a", "strong_review"],
      ["b", "strong_review"],
      ["c", "review"],
      ["d", "insufficient_evidence"],
      ["e", "insufficient_evidence"],
      ["f", "insufficient_evidence"],
    ]);
    expect(countReviewQueue(q)).toEqual({
      all: 6,
      actionable: 3,
      strong_review: 2,
      review: 1,
      insufficient_evidence: 3,
    });
  });

  it("handles empty, all-actionable, and all-noise queues", () => {
    expect(filterAndSortReviews([], "actionable", "priority")).toEqual([]);
    expect(countReviewQueue([]).actionable).toBe(0);

    const allActionable = make([
      ["a", "strong_review"],
      ["b", "review"],
    ]);
    expect(filterAndSortReviews(allActionable, "actionable", "priority")).toHaveLength(2);
    expect(countReviewQueue(allActionable)).toMatchObject({ all: 2, actionable: 2, insufficient_evidence: 0 });

    const allNoise = make([
      ["a", "insufficient_evidence"],
      ["b", "insufficient_evidence"],
    ]);
    expect(filterAndSortReviews(allNoise, "actionable", "priority")).toHaveLength(0);
    expect(countReviewQueue(allNoise)).toMatchObject({ all: 2, actionable: 0, insufficient_evidence: 2 });
  });

  it("single actionable and single noise rows behave", () => {
    expect(filterAndSortReviews(make([["a", "strong_review"]]), "actionable", "priority").map((r) => r.key)).toEqual(["a"]);
    expect(filterAndSortReviews(make([["a", "insufficient_evidence"]]), "actionable", "priority")).toHaveLength(0);
  });

  it("toggling between modes never mutates the source array", () => {
    const q = make([
      ["str", "strong_review"],
      ["rev", "review"],
      ["ie", "insufficient_evidence"],
    ]);
    const snapshot = q.map((r) => r.key);
    for (let i = 0; i < 5; i++) {
      filterAndSortReviews(q, "actionable", "priority");
      filterAndSortReviews(q, "all", "priority");
      filterAndSortReviews(q, "insufficient_evidence", "priority");
    }
    expect(q.map((r) => r.key)).toEqual(snapshot);
    expect(countReviewQueue(q)).toEqual({ all: 3, actionable: 2, strong_review: 1, review: 1, insufficient_evidence: 1 });
  });

  it("treats an actionable request without the new preset as unchanged old semantics (regression)", () => {
    // Old statuses still filter exactly as before; the preset is additive.
    const q = make([
      ["str", "strong_review"],
      ["rev", "review"],
      ["ie", "insufficient_evidence"],
    ]);
    expect(filterAndSortReviews(q, "strong_review", "priority").map((r) => r.key)).toEqual(["str"]);
    expect(filterAndSortReviews(q, "review", "priority").map((r) => r.key)).toEqual(["rev"]);
    expect(filterAndSortReviews(q, "insufficient_evidence", "priority").map((r) => r.key)).toEqual(["ie"]);
  });
});

describe("deriveDashboard", () => {
  it("merges review status into software rows via live reviews", () => {
    const merchants = [softwareMerchant("Adobe"), softwareMerchant("Slack")];
    const reviews = [review("Adobe", "strong_review")];
    const v = deriveDashboard({
      rows: merchants.map(rowFromSoftwareMerchant),
      softwareSpend: summary().softwareSpend,
      review: summary().review,
      qualityReadiness: "ready",
      reviews,
    });
    const adobe = v.softwareRows.find((r) => r.name === "Adobe");
    expect(adobe?.reviewStatus).toBe("strong_review");
    const slack = v.softwareRows.find((r) => r.name === "Slack");
    expect(slack?.reviewStatus).toBeNull();
    expect(v.reviewQueue.map((r) => r.key)).toEqual(["Adobe"]);
  });

  it("treats no_concern rows as not worth reviewing and keeps unknown merchants present", () => {
    const merchants = [
      softwareMerchant("Netflix", { category: "unknown" }),
      softwareMerchant("Adobe"),
    ];
    const reviews = [review("Adobe", "no_concern")];
    const v = deriveDashboard({
      rows: merchants.map(rowFromSoftwareMerchant),
      softwareSpend: summary({ softwareMerchantCount: 2 }).softwareSpend,
      review: summary().review,
      qualityReadiness: "ready",
      reviews,
    });
    expect(v.reviewQueue).toHaveLength(0);
    // Unknown remains a legitimate state in the breakdown.
    expect(v.softwareRows.some((r) => r.category === "unknown")).toBe(true);
  });

  it("empty analysis yields a reviewQueue of length 0", () => {
    const v = deriveDashboard({
      rows: [],
      softwareSpend: summary({ softwareMerchantCount: 0, softwareSpend: 0, monthly: 0, yearly: 0 }).softwareSpend,
      review: summary().review,
      qualityReadiness: "ready",
    });
    expect(v.reviewQueue).toHaveLength(0);
    expect(v.softwareRows).toHaveLength(0);
    expect(v.metrics.softwareSpendIdentified).toBe(0);
  });

  it("blocked quality still produces a view model (UI shows review unavailable)", () => {
    const v = deriveDashboard({
      rows: [],
      softwareSpend: summary().softwareSpend,
      review: summary().review,
      qualityReadiness: "blocked",
    });
    expect(v.qualityReadiness).toBe("blocked");
    expect(v.metrics.blocked).toBe(true);
  });

  it("does not mutate its source rows or reviews", () => {
    const merchants = [softwareMerchant("Adobe")];
    const reviews = [review("Adobe", "strong_review")];
    const rowsBefore = JSON.stringify(merchants);
    const reviewsBefore = JSON.stringify(reviews);
    deriveDashboard({
      rows: merchants.map(rowFromSoftwareMerchant),
      softwareSpend: summary().softwareSpend,
      review: summary().review,
      qualityReadiness: "ready",
      reviews,
    });
    expect(JSON.stringify(merchants)).toBe(rowsBefore);
    expect(JSON.stringify(reviews)).toBe(reviewsBefore);
  });
});

// ---------- report-driven (saved view) ----------

describe("report-driven dashboard", () => {
  it("reproduces a review queue and software rows from saved report merchants", () => {
    const merchants = [reportMerchant("Adobe", { reviewStatus: "strong_review" })];
    const v = deriveDashboard({
      rows: merchants.map(rowFromReportMerchant),
      softwareSpend: {
        totalSoftwareSpend: 120,
        estimatedMonthlySpend: 40,
        estimatedYearlySpend: 480,
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
        estimatedMonthlyReviewSpend: 40,
        estimatedYearlyReviewSpend: 480,
        unclearOwnershipCount: 0,
      },
      qualityReadiness: "ready",
    });
    expect(v.reviewQueue).toHaveLength(1);
    expect(v.reviewQueue[0].name).toBe("Adobe");
    expect(v.reviewQueue[0].estimatedMonthlySpend).toBe(40);
    expect(v.softwareRows[0].totalSpend).toBe(120);
  });

  it("live and saved dashboard values agree with the persisted values (no re-analysis)", () => {
    // Live metrics come from the same objects that are persisted into the report.
    const s = summary({ softwareSpend: 1500, monthly: 100, yearly: 1200, softwareMerchantCount: 3 });
    const liveMetrics = deriveMetrics({
      softwareSpend: s.softwareSpend,
      review: s.review,
      qualityReadiness: "ready",
    });
    // The report copies these values verbatim at build time (see report/build.ts),
    // so the saved-view metrics must equal the live metrics.
    expect(liveMetrics.softwareSpendIdentified).toBe(s.softwareSpend.totalSoftwareSpend);
    expect(liveMetrics.estimatedRecurringMonthly).toBe(s.softwareSpend.estimatedMonthlySpend);
    expect(liveMetrics.estimatedRecurringYearly).toBe(s.softwareSpend.estimatedYearlySpend);
  });

  it("rowFromReportMerchant preserves recurring-without-estimate as null", () => {
    const m = reportMerchant("Github", {});
    const row = rowFromReportMerchant(m);
    expect(row.estimatedMonthlySpend).toBe(40);
    // Recurring status is carried through.
    expect(row.recurringStatus).toBe("likely_recurring");
    // A merchant without a review stays null (not forced into the queue).
    expect(row.reviewStatus).toBeNull();
    expect(reviewFromRow(row)).toBeNull();
  });
});
