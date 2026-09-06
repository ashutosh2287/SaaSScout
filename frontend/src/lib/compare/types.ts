// Phase 18 — period-over-period comparison model.
//
// INPUT  : two independent SasscoutReports (baseline "A", current "B").
// OUTPUT : comparison findings with evidence + confidence + a suppressed list.
//
// Reuses the existing normalized merchant identity (normalizedKey) and the
// existing recurring patterns — it never re-derives those. No transaction data
// is needed at comparison time (saved analyses keep only the report snapshot),
// which is what keeps this fully local.
//
// THE CORE HONESTY RULE
// --------------------
// Absence of evidence (the band-aid "merchant exists in one report but not the
// other") is never treated as evidence of absence. A merchant missing from a
// report is only called ENDED / NEW when the OBSERVING WINDOW is long enough
// that an expected charge at the merchant's cadence would have been captured:
//
//   windowCoversCycle(B.window, interval(A))  must be true before we say "ended"
//   windowCoversCycle(A.window, interval(B))  must be true before we say "new"
//
// If the window is too short or unknown, the rule SUPPRESSES the hypothesis and
// records it in `insufficientEvidence` — never a confident finding.
//
// FIVE RULES (matching Phase 18 semantics):
//
// 1. NEW RECURRING CHARGE
//    recurring in B with a concrete interval; merchant absent from A entirely,
//    OR present in A but not recurring (was a one-off, now recurring).
//    Absence branch requires A window >= one expected cycle.
//
// 2. ENDED RECURRING CHARGE
//    recurring in A with a concrete interval; merchant absent from B entirely.
//    Requires B window >= one expected cycle (evidence of absence). A merchant
//    still present in B but no longer recurring is NEVER claimed ended: the
//    report holds only aggregate patterns, so "broken cadence" is
//    indistinguishable from "a run of missed months" — recorded as
//    insufficient evidence instead.
//
// 3. MATERIAL PRICE CHANGE
//    recurring with a concrete interval and a typical amount in BOTH reports;
//    |b - a| / a >= 0.15 AND |b - a| >= $1.00. Direction is a finding kind
//    (price_increase / price_decrease). Non-material movement produces no finding.
//
// 4. FREQUENCY CHANGE
//    recurring with a concrete interval in BOTH reports and different intervals
//    (e.g. monthly -> quarterly). Requires both patterns to be interval-bearing.
//
// 5. MERCHANT APPEARANCE / DISAPPEARANCE
//    software-classified, NOT recurring, present in exactly one report.
//    Always informational (low confidence, explicit "not a subscription claim").
//
// CONFIDENCE
//   high   : both windows known and absence side covers >= 2 cycles; both
//            patterns likely_recurring; amounts stable.
//   medium : window covers >= 1 cycle, or one side possibly_recurring.
//   low    : strictly informational presence changes; transitions.
//   suppressed: unknown or too-short window -> no finding, recorded instead.

export type ComparisonKind =
  | "new_recurring"
  | "ended_recurring"
  | "price_increase"
  | "price_decrease"
  | "frequency_change"
  | "pattern_irregular"
  | "merchant_appeared"
  | "merchant_disappeared";

export type ComparisonConfidence = "high" | "medium" | "low";

export type ComparisonEvidenceType =
  | "present_baseline"
  | "absent_baseline"
  | "present_current"
  | "absent_current"
  | "recurring_baseline"
  | "recurring_current"
  | "typical_amount_baseline"
  | "typical_amount_current"
  | "interval_baseline"
  | "interval_current"
  | "window_covers_cycle"
  | "window_insufficient"
  | "amount_unstable"
  | "spend_continues"
  | "spend_was_one_off"
  // Step 19 — transaction-edge evidence (charge boundaries + cadence gaps).
  | "last_charge_observed"
  | "first_charge_current"
  | "irregular_pattern"
  | "not_ended"
  | "pattern_baseline_weak"
  | "identity_uncertain";

export type ComparisonEvidence = {
  type: ComparisonEvidenceType;
  message: string;
};

export type ComparisonImpact = {
  // Directional change in estimated spend, when the rule can state one.
  monthlyDelta: number | null;
  yearlyDelta: number | null;
};

export type ComparisonFinding = {
  kind: ComparisonKind;
  merchantKey: string;
  merchantName: string;
  confidence: ComparisonConfidence;
  evidence: ComparisonEvidence[];
  impact: ComparisonImpact;
};

// A hypothesis the engine considered and deliberately DID NOT turn into a
// finding, with the reason — surfaced in the report as false-positive
// protection evidence.
export type SuppressionCategory = "insufficient_observation" | "identity_uncertain";

export type SuppressedHypothesis = {
  merchantKey: string;
  merchantName: string;
  rule: ComparisonKind;
  reason: string;
  // Step 19: why the hypothesis was withheld. Identity uncertainty (a possible
  // descriptor change) is a different statement than "the window cannot prove
  // it"; separating them keeps the honesty accounting measurable.
  category: SuppressionCategory;
};

export type ReportRef = {
  label: string;
  // Statement coverage, derived from quality.date (earliest/latest). Null when
  // the saved report predates window capture or has no valid dates.
  window: { start: string | null; end: string | null; days: number | null };
  generatedAt: string;
};

export type ComparisonResult = {
  baseline: ReportRef;
  current: ReportRef;
  ordered: boolean;
  caution: string | null;
  findings: ComparisonFinding[];
  suppressed: SuppressedHypothesis[];
  insufficientEvidence: SuppressedHypothesis[];
};