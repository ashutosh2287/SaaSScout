import type { ComparisonFinding, ComparisonKind } from "./types";

// Step 22 — presentation-only ordering for comparison findings.
//
// The engine emits findings in a semantic kind-then-name order (that order is
// contract for engine tests and stays untouched). When a user actually READS
// the comparison, impact should decide what they see first: deterministic
// |yearly delta| descending, ties broken by kind order then merchant name.
// Findings that cannot state a delta (null impact) sink to the bottom instead
// of floating up by name.
//
// This is a pure function of the result — the engine itself is unchanged, so
// analytical semantics and the engine test contract are preserved.

const KIND_ORDER: Record<ComparisonKind, number> = {
  new_recurring: 0,
  ended_recurring: 1,
  price_increase: 2,
  price_decrease: 3,
  frequency_change: 4,
  pattern_irregular: 5,
  merchant_appeared: 6,
  merchant_disappeared: 7,
  // Step 26 — intra-period overlap has no spend delta (impact null), so it
  // sorts to the bottom of the magnitude-keyed order. It still appears, but
  // it never out-orders a quantified change.
  possible_overlap: 8,
};

export function impactMagnitude(f: ComparisonFinding): number {
  const d = f.impact.yearlyDelta;
  if (d === null || !Number.isFinite(d)) return 0;
  return Math.abs(d);
}

export function prioritizeFindings(findings: ComparisonFinding[]): ComparisonFinding[] {
  return [...findings].sort((a, b) => {
    const mag = impactMagnitude(b) - impactMagnitude(a);
    if (mag !== 0) return mag;
    const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kind !== 0) return kind;
    return a.merchantName.localeCompare(b.merchantName);
  });
}