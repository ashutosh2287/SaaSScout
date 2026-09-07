import { describe, expect, it } from "vitest";
import { buildScenario, rowsToTransactions, splitWindows, HIGH_VALUE_FINDINGS, HIGH_VALUE_REVIEW_KEYS } from "./scenario";
import { computeQueueMetrics, computeCompareMetrics } from "./metrics";
import { snapshotFor, runCompare } from "../betatest/helpers";
import { deriveDashboard, rowFromSoftwareMerchant } from "../dashboard";
import { prioritizeFindings } from "../compare/prioritize";
import { suggestedAction } from "../compare/format";

// Step 22 — decision-value loop measurement.
//
// PROXY — NOT REAL USER STUDY. Deterministic seeded scenario; metrics say what
// the product surfaces first, not how humans behave. BEFORE numbers (the
// bottleneck evidence) are recorded via the engine-order measurement below.

function measure() {
  const txns = rowsToTransactions(buildScenario().rows);
  const { baseline, current } = splitWindows(txns);
  const b = snapshotFor(baseline, "baseline.csv");
  const c = snapshotFor(current, "current.csv");
  const view = deriveDashboard({
    rows: c.software.merchants.map(rowFromSoftwareMerchant),
    softwareSpend: c.software.summary,
    review: c.review.summary,
    qualityReadiness: c.quality.analysisReadiness,
    reviews: c.review.reviews,
  });
  const queue = view.reviewQueue;
  const cmp = runCompare(b.report, c.report);
  const queueMetrics = computeQueueMetrics(queue, HIGH_VALUE_REVIEW_KEYS);
  return { txns, queue, queueMetrics, findings: cmp.findings };
}

function measureCompare(txns: ReturnType<typeof rowsToTransactions>) {
  const { baseline, current } = splitWindows(txns);
  const b = snapshotFor(baseline, "baseline.csv");
  const c = snapshotFor(current, "current.csv");
  return runCompare(b.report, c.report);
}

describe("step22 / scenario integrity", () => {
  it("is deterministic and large enough to force prioritization decisions", () => {
    const { rows } = buildScenario();
    const { rows: again } = buildScenario();
    expect(rows.length).toBe(again.length);
    expect(rows.length).toBeGreaterThanOrEqual(5000);
  });
});

describe("step22 / review-queue prioritization", () => {
  it("surfaces the highest-value software merchants first (PASS)", () => {
    const { queue, queueMetrics } = measure();
    const first5 = queue.slice(0, 5).map((q) => q.key);
    expect(queueMetrics.top5HighValueCount).toBe(5);
    expect(queueMetrics.firstHighValueRank).toBe(0);
    expect(queueMetrics.flaggedCount).toBeGreaterThan(0);
    // Queue is ordered but the surface must show the most expensive first.
    const monthly = queue.slice(0, 10).map((q) => q.estimatedMonthlySpend ?? 0);
    for (let i = 1; i < monthly.length; i++) expect(monthly[i]).toBeLessThanOrEqual(monthly[i - 1]);
    expect(first5[0]).toBe("openai");
  });
});

describe("step22 / comparison decision-readiness", () => {
  it("orders findings by impact so the biggest change is seen first (AFTER)", () => {
    const { txns } = measure();
    const { findings } = measureCompare(txns);
    const prioritized = prioritizeFindings(findings);
    const byImpact = computeCompareMetrics(prioritized, HIGH_VALUE_FINDINGS, suggestedAction);
    expect(byImpact.mostImpactfulRank).toBe(0);
    expect(byImpact.top3HighValueCoverage).toBeGreaterThanOrEqual(3);
    expect(byImpact.impactShareTop3).toBeGreaterThanOrEqual(70);
    expect(byImpact.findingsWithAction).toBe(findings.length);
    expect(prioritized[0].merchantKey).toBe("openai");
  });

  it("every comparison finding carries a neutral suggested next step (AFTER)", () => {
    const { txns } = measure();
    const { findings } = measureCompare(txns);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      const action = suggestedAction(f) ?? "";
      expect(action).toBeTruthy();
      expect(action.toLowerCase()).not.toContain("cancel this subscription");
    }
  });

  it("keeps engine semantics intact: engine order is still kindOrder then merchant name", () => {
    const { txns } = measure();
    const { findings } = measureCompare(txns);
    const rank: Record<string, number> = {
      new_recurring: 0, ended_recurring: 1, price_increase: 2, price_decrease: 3,
      frequency_change: 4, pattern_irregular: 5, merchant_appeared: 6, merchant_disappeared: 7,
      possible_overlap: 8,
    };
    for (let i = 1; i < findings.length; i++) {
      const prevKind = rank[findings[i - 1].kind];
      const curKind = rank[findings[i].kind];
      expect(curKind).toBeGreaterThanOrEqual(prevKind);
      if (findings[i - 1].kind === findings[i].kind) {
        expect(findings[i - 1].merchantName.localeCompare(findings[i].merchantName)).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe("step22 / bottleneck evidence (BEFORE)", () => {
  it("BEFORE: engine surface buried the most impactful finding and offered no next step", () => {
    const { txns } = measure();
    const { findings } = measureCompare(txns);
    const raw = computeCompareMetrics(findings, HIGH_VALUE_FINDINGS);
    // Raw engine order = the surface before this step's presentation change.
    expect(raw.mostImpactfulRank).toBeGreaterThan(0);
    expect(raw.top3HighValueCoverage).toBeLessThan(3);
    expect(raw.impactShareTop3).toBeLessThan(60);
    expect(raw.findingsWithAction).toBe(0);
  });
});