import { describe, expect, it } from "vitest";
import { buildScenario, rowsToTransactions, splitWindows } from "./scenario";
import { snapshotFor } from "../betatest/helpers";
import {
  countReviewQueue,
  deriveDashboard,
  filterAndSortReviews,
  rowFromSoftwareMerchant,
} from "../dashboard";

// Step 23 — review-queue noise toggle measurement on the exact Step 22 scenario.
// Deterministic, seeded, >= 5k rows, same software universe and ground truth.
// PROXY — NOT REAL USER STUDY: it measures visible row burden, not human time.

describe("step23 / review-queue noise toggle", () => {
  const measure = () => {
    const txns = rowsToTransactions(buildScenario().rows);
    const { current } = splitWindows(txns);
    const c = snapshotFor(current, "current.csv");
    const view = deriveDashboard({
      rows: c.software.merchants.map(rowFromSoftwareMerchant),
      softwareSpend: c.software.summary,
      review: c.review.summary,
      qualityReadiness: c.quality.analysisReadiness,
      reviews: c.review.reviews,
    });
    return view.reviewQueue;
  };

  it("the Step 22 scenario still yields exactly 47 queue rows: 18 actionable + 29 noise", () => {
    const queue = measure();
    const counts = countReviewQueue(queue);
    expect(counts.all).toBe(47);
    expect(counts.actionable).toBe(18);
    expect(counts.strong_review + counts.review).toBe(18);
    expect(counts.insufficient_evidence).toBe(29);
    expect(counts.all).toBe(counts.actionable + counts.insufficient_evidence);
  });

  it("'All' preserves every review row; 'Actionable' isolates exactly 18", () => {
    const queue = measure();
    expect(filterAndSortReviews(queue, "all", "priority")).toHaveLength(47);
    const actionable = filterAndSortReviews(queue, "actionable", "priority");
    expect(actionable).toHaveLength(18);
    for (const row of actionable) {
      expect(["strong_review", "review"]).toContain(row.reviewStatus);
    }
    const excluded = queue.filter((r) => !["strong_review", "review"].includes(r.reviewStatus));
    expect(excluded).toHaveLength(29);
    for (const row of excluded) expect(row.reviewStatus).toBe("insufficient_evidence");
  });

  it("visible inspection burden drops by the computed ~61.7% without changing data", () => {
    const queue = measure();
    const counts = countReviewQueue(queue);
    const reduction = Math.round((1 - counts.actionable / counts.all) * 1000) / 10;
    expect(reduction).toBeCloseTo(61.7, 1);
    // Nothing is deleted: the full list still exists.
    expect(counts.all).toBe(47);
  });

  it("first actionable item is still the highest-value merchant (openai)", () => {
    const queue = measure();
    const actionable = filterAndSortReviews(queue, "actionable", "priority");
    expect(actionable[0].name.toLowerCase()).toContain("openai");
    const all = filterAndSortReviews(queue, "all", "priority");
    expect(all[0].name.toLowerCase()).toContain("openai");
  });

  it("ordering within each view is unchanged from the existing priority order", () => {
    const queue = measure();
    const all = filterAndSortReviews(queue, "all", "priority");
    const actionable = filterAndSortReviews(queue, "actionable", "priority");
    const tier = (s: string) => (s === "strong_review" ? 0 : s === "review" ? 1 : 2);
    const monthly = (r: (typeof queue)[number]) => r.estimatedMonthlySpend ?? 0;
    for (let i = 1; i < actionable.length; i++) {
      const prevTier = tier(actionable[i - 1].reviewStatus);
      const curTier = tier(actionable[i].reviewStatus);
      expect(curTier).toBeGreaterThanOrEqual(prevTier);
      if (curTier === prevTier) {
        expect(monthly(actionable[i])).toBeLessThanOrEqual(monthly(actionable[i - 1]));
      }
    }
    expect(all[0].key).toBe(actionable[0].key);
  });

  it("filtering never mutates the source queue and is deterministic across runs", () => {
    const a = measure();
    const snapshot = a.map((r) => r.key);
    for (let i = 0; i < 3; i++) {
      filterAndSortReviews(a, "actionable", "priority");
      filterAndSortReviews(a, "all", "priority");
    }
    expect(a.map((r) => r.key)).toEqual(snapshot);

    const b = measure();
    expect(b.map((r) => r.key)).toEqual(snapshot);
    expect(countReviewQueue(b)).toEqual(countReviewQueue(a));
  });
});