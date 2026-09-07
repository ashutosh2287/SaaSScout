import type { ComparisonFinding } from "../compare/types";
import type { ReviewQueueItem } from "../dashboard/types";

// Step 22 — decision-value metrics. Deterministic, synthetic proxies.
//
// PROXY — NOT REAL USER STUDY. These numbers measure what the product's
// deterministic orderings / surfaces let a user see first, on a seeded SMB
// statement, with a documented ground-truth "rational owner" priority. They do
// not claim anything about real humans in the wild.

export const HIGH_VALUE_MONTHLY_THRESHOLD = 100;
export const HIGH_VALUE_YEARLY_DELTA_THRESHOLD = 120;

export function findingImpactMagnitude(f: ComparisonFinding): number {
  return Math.abs(f.impact.yearlyDelta ?? 0);
}

export type CompareMetrics = {
  findingsCount: number;
  order: string[]; // "key (kind | +/-$yr)" in presented order
  mostImpactfulRank: number; // 0-based position of the largest |yearlyDelta| finding
  top3HighValueCoverage: number; // of the ground-truth high-value findings inside the top 3
  impactShareTop3: number; // share of total |yearlyDelta| captured by the top 3
  findingsWithAction: number; // findings carrying a suggested next-step line
};

export function computeCompareMetrics(
  findings: ComparisonFinding[],
  groundTruth: { key: string; kind: string }[],
  actionFor?: (f: ComparisonFinding) => string | null,
): CompareMetrics {
  const order = findings.map((f) => `${f.merchantKey} (${f.kind}|${formatDelta(f.impact.yearlyDelta)})`);
  const byMagnitude = [...findings].sort(
    (a, b) => findingImpactMagnitude(b) - findingImpactMagnitude(a),
  );
  const mostImpactful = byMagnitude[0];
  const totalMagnitude = findings.reduce((s, f) => s + findingImpactMagnitude(f), 0);
  const top3 = findings.slice(0, 3);
  const top3Magnitude = top3.reduce((s, f) => s + findingImpactMagnitude(f), 0);
  const gtKeys = new Set(groundTruth.map((g) => `${g.key}|${g.kind}`));
  const top3Coverage = top3.filter((f) => gtKeys.has(`${f.merchantKey}|${f.kind}`)).length;
  const withAction = actionFor ? findings.filter((f) => actionFor(f) !== null).length : 0;
  return {
    findingsCount: findings.length,
    order,
    mostImpactfulRank: mostImpactful ? findings.indexOf(mostImpactful) : -1,
    top3HighValueCoverage: top3Coverage,
    impactShareTop3: totalMagnitude > 0 ? Math.round((top3Magnitude / totalMagnitude) * 100) : 0,
    findingsWithAction: withAction,
  };
}

export type QueueMetrics = {
  flaggedCount: number; // strong_review + review
  queueLength: number; // every reviewable row shown in the queue
  top5HighValueCount: number; // ground-truth high-value flagged merchants inside the default top 5
  firstHighValueRank: number; // 0-based position of first high-value queue item (-1 = none)
  top5MonthlyShare: number; // share of flagged merchants' total est. monthly spend captured in top 5
  inspectionBurden: number; // flagged merchants + uncertain/insufficient rows the owner must look at
};

export function computeQueueMetrics(
  queue: ReviewQueueItem[],
  highValueKeys: string[],
): QueueMetrics {
  const flagged = queue.filter((q) => q.reviewStatus === "strong_review" || q.reviewStatus === "review");
  const hv = new Set(highValueKeys);
  const top5 = queue.slice(0, 5);
  const flaggedTotalMonthly = flagged.reduce((s, q) => s + (q.estimatedMonthlySpend ?? 0), 0);
  const top5Monthly = top5.reduce((s, q) => s + (q.estimatedMonthlySpend ?? 0), 0);
  return {
    flaggedCount: flagged.length,
    queueLength: queue.length,
    top5HighValueCount: top5.filter((q) => hv.has(q.key)).length,
    firstHighValueRank: queue.findIndex((q) => hv.has(q.key)),
    top5MonthlyShare: flaggedTotalMonthly > 0 ? Math.round((top5Monthly / flaggedTotalMonthly) * 100) : 0,
    inspectionBurden: queue.length,
  };
}

function formatDelta(n: number | null): string {
  if (n === null) return "0/yr";
  return `${n > 0 ? "+" : ""}${Math.round(n)}/yr`;
}