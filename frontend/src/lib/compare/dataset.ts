import type { NormalizedTransaction } from "../parse/types";
import type { ComparisonKind } from "./types";

// Phase 18 — period-over-period ground truth.
//
// Each scenario is a controlled pair of transaction sets (baseline "A" and
// current "B") with an explicit expected-finding contract. The measurement test
// builds a real SasscoutReport from each side through the production pipeline,
// runs compareReports, and scores the findings against this contract.
//
// Contracts:
//   expected        : findings that MUST be emitted (kind + merchant key).
//   expectedNone    : kinds that MUST NOT be emitted for any merchant.
//   expectedInsufficient: hypotheses that MUST land in insufficientEvidence.
//   confidenceAtLeast: optional minimum confidence floor per expected finding.

export type Scenario = {
  name: string;
  a: NormalizedTransaction[];
  b: NormalizedTransaction[];
  expected: {
    kind: ComparisonKind;
    key: string;
    confidenceAtLeast?: "high" | "medium" | "low";
    // Optional ceiling: the finding must stay BELOW this confidence. Used to
    // lock in Step 19's honesty rules (overlapping windows, weak baselines).
    confidenceBelow?: "high" | "medium";
  }[];
  expectedNone: ComparisonKind[];
  expectedInsufficient: { kind: ComparisonKind; key: string }[];
};

let seq = 0;
function tx(date: string, description: string, amount: number): NormalizedTransaction {
  seq += 1;
  return {
    id: `s${seq}`,
    date,
    description,
    // negative = money out, matching how statements represent spend.
    amount: -amount,
    sourceRow: seq,
  };
}

// Builds N monthly charges for a vendor across the given dates.
function monthly(description: string, amount: number, dates: string[]) {
  return dates.map((d) => tx(d, description, amount));
}

function monthSpan(startISO: string, months: number): string[] {
  const out: string[] = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < months; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

// A stable fill merchant repeated across both periods so the baseline/current
// windows span several months (absence evidence needs a long window).
const FILL = "SPOTIFY";
const FILL_AMOUNT = 10.99;
const FILL_A_DATES = ["2026-01-03", "2026-02-03", "2026-03-03"];
const FILL_B_DATES = ["2026-04-03", "2026-05-03", "2026-06-03"];

function fillA(): NormalizedTransaction[] {
  return monthly(FILL, FILL_AMOUNT, FILL_A_DATES);
}
function fillB(): NormalizedTransaction[] {
  return monthly(FILL, FILL_AMOUNT, FILL_B_DATES);
}

// A discounted one-off fill that extends the window WITHOUT being recurring
// software (so it never produces its own finding).
function zoneA(): NormalizedTransaction[] {
  return [tx("2026-01-02", "CITY PHARMACY", 12.0), tx("2026-03-20", "CITY PHARMACY", 12.0)];
}

const NETFLIX = "NETFLIX.COM";
const N10 = 10.0;
const N15 = 15.0;
const N_TOP = ["2026-01-10", "2026-02-10", "2026-03-10"];
const N_TOP_B = ["2026-04-10", "2026-05-10", "2026-06-10"];

export const SCENARIOS: Scenario[] = [
  // 1. Genuinely NEW recurring subscription (absent from a complete baseline).
  {
    name: "new-recurring",
    a: [...fillA(), ...zoneA()],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B)],
    expected: [{ kind: "new_recurring", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["ended_recurring", "price_increase", "price_decrease", "frequency_change"],
    expectedInsufficient: [],
  },

  // 2. Genuinely ENDED recurring subscription (absent from a complete current).
  {
    name: "ended-recurring",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB()],
    expected: [{ kind: "ended_recurring", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_disappeared"],
    expectedInsufficient: [],
  },

  // 3. STABLE subscription across both periods.
  {
    name: "stable",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B)],
    expected: [],
    expectedNone: [
      "new_recurring",
      "ended_recurring",
      "price_increase",
      "price_decrease",
      "frequency_change",
      "merchant_appeared",
      "merchant_disappeared",
    ],
    expectedInsufficient: [],
  },

  // 4. Material price INCREASE (10 -> 15, +50%).
  {
    name: "price-increase",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N15, N_TOP_B)],
    expected: [{ kind: "price_increase", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "ended_recurring", "price_decrease", "frequency_change"],
    expectedInsufficient: [],
  },

  // 5. Material price DECREASE (15 -> 10, -33%).
  {
    name: "price-decrease",
    a: [...fillA(), ...monthly(NETFLIX, N15, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B)],
    expected: [{ kind: "price_decrease", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "ended_recurring", "price_increase", "frequency_change"],
    expectedInsufficient: [],
  },

  // 6. INSIGNIFICANT price fluctuation (10 -> 10.50, +5%) — no finding.
  {
    name: "insignificant-fluctuation",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, 10.5, N_TOP_B)],
    expected: [],
    expectedNone: ["price_increase", "price_decrease", "new_recurring", "ended_recurring", "frequency_change"],
    expectedInsufficient: [],
  },

  // 7. FREQUENCY CHANGE: monthly -> quarterly.
  {
    name: "frequency-change-monthly-to-quarterly",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    // Quarterly cadence (Apr 10, Jul 10 -> 91-day gap).
    b: [...fillB(), ...monthly(NETFLIX, N10, ["2026-05-10", "2026-08-10"])],
    expected: [{ kind: "frequency_change", key: "netflix" }],
    expectedNone: ["new_recurring", "ended_recurring", "price_increase", "price_decrease"],
    expectedInsufficient: [],
  },

  // 8. MERCHANT ALIAS CHANGE across periods (same identity, no finding).
  {
    name: "alias-change",
    a: [...fillA(), ...monthly("SLACK TECHNOLOGIES INC", 8.0, N_TOP)],
    b: [...fillB(), ...monthly("SLACK", 8.0, N_TOP_B)],
    expected: [],
    expectedNone: [
      "new_recurring",
      "ended_recurring",
      "price_increase",
      "price_decrease",
      "frequency_change",
      "merchant_appeared",
      "merchant_disappeared",
    ],
    expectedInsufficient: [],
  },

  // 9. MISSING TRANSACTION in B (Jan + Mar charges, Feb absent) — never "ended".
  {
    name: "missing-transaction",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, ["2026-04-10", "2026-06-10"])],
    expected: [],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change"],
    expectedInsufficient: [{ kind: "ended_recurring", key: "netflix" }],
  },

  // 10. PARTIAL-PERIOD current window (too short to prove "ended") — suppressed.
  {
    name: "partial-period-current-window",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    // Current window spans only ~13 days of a fresh month, no Netflix.
    b: [tx("2026-04-05", "CITY PHARMACY", 12.0)],
    expected: [],
    expectedNone: ["ended_recurring", "new_recurring"],
    expectedInsufficient: [{ kind: "ended_recurring", key: "netflix" }],
  },

  // 11. PARTIAL-PERIOD baseline window (too short to prove "new") — suppressed.
  {
    name: "partial-period-baseline-window",
    // Baseline window ~10 days, no Netflix.
    a: [tx("2026-01-05", "CITY PHARMACY", 12.0)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B)],
    expected: [],
    expectedNone: ["new_recurring", "ended_recurring"],
    expectedInsufficient: [{ kind: "new_recurring", key: "netflix" }],
  },

  // 12. REFUND noise: subscription intact in both periods, plus a refund line.
  //     The refund resolves to its own identity ("refund netflix") which is not
  //     software — it must never appear as a finding, and the subscription stays
  //     stable.
  {
    name: "refund",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B), tx("2026-05-02", "REFUND NETFLIX", +10.0)],
    expected: [],
    expectedNone: [
      "new_recurring",
      "ended_recurring",
      "price_increase",
      "price_decrease",
      "frequency_change",
      "merchant_appeared",
      "merchant_disappeared",
    ],
    expectedInsufficient: [],
  },

  // 13. AMBIGUOUS merchant (Amazon stays unknown in both) — no finding.
  {
    name: "ambiguous-merchant",
    a: [...fillA(), ...monthly("AMAZON.COM", 33.0, N_TOP)],
    b: [...fillB(), ...monthly("AMZN MKT US", 41.0, N_TOP_B)],
    expected: [],
    expectedNone: ["merchant_appeared", "merchant_disappeared", "new_recurring", "ended_recurring"],
    expectedInsufficient: [],
  },

  // 14. NON-SOFTWARE recurring spend (grocery) — never a software finding.
  {
    name: "non-software-recurring",
    a: [...fillA(), ...monthly("GROCERY STORE", 48.3, N_TOP)],
    b: [...fillB(), ...monthly("GROCERY STORE", 51.0, N_TOP_B)],
    expected: [],
    expectedNone: ["price_increase", "price_decrease", "new_recurring", "ended_recurring", "frequency_change", "merchant_appeared", "merchant_disappeared"],
    expectedInsufficient: [],
  },

  // 15. IRREGULAR software spend in A, absent from B — informational disappearance.
  {
    name: "irregular-charge-disappearance",
    a: [...fillA(), tx("2026-01-05", "DROPBOX", 11.99), tx("2026-02-20", "DROPBOX", 11.99)],
    b: [...fillB()],
    expected: [{ kind: "merchant_disappeared", key: "dropbox", confidenceAtLeast: "low" }],
    expectedNone: ["ended_recurring", "new_recurring"],
    expectedInsufficient: [],
  },

  // 16. ONE-OFF in A becomes RECURRING in B ("now recurring" transition).
  {
    name: "one-off-to-recurring",
    a: [...fillA(), tx("2026-03-10", NETFLIX, N10)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B)],
    expected: [{ kind: "new_recurring", key: "netflix", confidenceAtLeast: "medium" }],
    expectedNone: ["ended_recurring", "price_increase", "price_decrease", "frequency_change"],
    expectedInsufficient: [],
  },

  // 17. IDENTICAL periods (same file) — nothing can change.
  {
    name: "identical-periods",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...monthly(NETFLIX, N10, N_TOP), ...fillA()],
    expected: [],
    expectedNone: [
      "new_recurring",
      "ended_recurring",
      "price_increase",
      "price_decrease",
      "frequency_change",
      "merchant_appeared",
      "merchant_disappeared",
    ],
    expectedInsufficient: [],
  },

  // 18. DELAYED charge (amounts drift within tolerance, cadence wobbles) —
  //     no price increase, no ended.
  {
    name: "delayed-charge",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, ["2026-04-10", "2026-05-18", "2026-06-16"])],
    expected: [],
    expectedNone: ["price_increase", "price_decrease", "ended_recurring", "new_recurring", "frequency_change", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // ---- Step 19: transaction-edge evidence (Cases A-E) ----

  // 19. CASE B — monthly became IRREGULAR: charges continue but scattered.
  {
    name: "monthly-became-irregular",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [
      ...fillB(),
      ...monthly(NETFLIX, N10, ["2026-04-10", "2026-05-22", "2026-07-05", "2026-08-02"]),
    ],
    expected: [{ kind: "pattern_irregular", key: "netflix", confidenceAtLeast: "low" }],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared"],
    expectedInsufficient: [],
  },

  // 20. CASE C — current data ends immediately after the last expected charge:
  //     one observed absence < 1 cycle -> insufficient, never ended.
  {
    name: "ends-immediately-after",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [tx("2026-04-02", "CITY PHARMACY", 12.0), tx("2026-04-15", "CITY PHARMACY", 12.0)],
    expected: [],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_disappeared"],
    expectedInsufficient: [{ kind: "ended_recurring", key: "netflix" }],
  },

  // 21. CASE A/C boundary — current window covers ~1 cycle after the last
  //     charge: ended at MEDIUM, never high.
  {
    name: "ends-after-one-cycle",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...monthly("SPOTIFY", FILL_AMOUNT, ["2026-05-03", "2026-06-03"])],
    expected: [
      { kind: "ended_recurring", key: "netflix", confidenceAtLeast: "medium", confidenceBelow: "high" },
    ],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 22. CASE A — quarterly cadence ended after two full quarters observed.
  {
    name: "quarterly-ended",
    a: [...fillA(), ...monthly(NETFLIX, N10, ["2026-01-10", "2026-04-10", "2026-07-10"])],
    b: [...monthly("SPOTIFY", FILL_AMOUNT, monthSpan("2026-10-03", 7))],
    expected: [{ kind: "ended_recurring", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 23. CASE A — annual cadence ended (needs a multi-year observation window).
  {
    name: "annual-ended",
    a: [
      ...monthly("SPOTIFY", FILL_AMOUNT, monthSpan("2024-01-03", 27)),
      ...monthly(NETFLIX, N10, ["2024-01-10", "2025-01-10", "2026-01-10"]),
    ],
    b: [...monthly("SPOTIFY", FILL_AMOUNT, monthSpan("2026-01-15", 26))],
    expected: [{ kind: "ended_recurring", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 24. CASE A — weekly cadence ended; presence evidence is strong but weekly
  //     cadence claims never reach high confidence.
  {
    name: "weekly-ended",
    a: [
      ...fillA(),
      ...monthly(NETFLIX, N10, ["2026-01-07", "2026-01-14", "2026-01-21", "2026-01-28", "2026-02-04", "2026-02-11"]),
    ],
    b: [...fillB()],
    expected: [
      { kind: "ended_recurring", key: "netflix", confidenceAtLeast: "medium", confidenceBelow: "high" },
    ],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 25. CASE E — descriptor VARIANT of a KNOWN brand. The merchant identity layer
//     already folds the brand-token variant into the same key, so the charge
//     reads as "still paying, stable" — never a false ended, never a false new.
//     (The identity-uncertainty guard for UNMAPPED cross-key variants is proven
//     at unit level in engine.test.ts, where a different-key twin genuinely
//     appears in the current period.)
  {
    name: "descriptor-variant-known-brand",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [
      ...fillB(),
      ...monthly("NETFLIX-STREAMING-DE", 11.0, ["2026-04-09", "2026-05-09", "2026-06-09"]),
    ],
    expected: [],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 26. DUPLICATE transaction in the current period — ledgers stay monthly,
  //     no price/frequency noise, no ended.
  {
    name: "duplicate-charge",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, ["2026-04-10", "2026-04-10", "2026-05-10", "2026-06-10"])],
    expected: [],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 27. REFUND after the apparent final charge — an ending subscription plus
  //     a refund line for it. Ended stands; the refund identity is not a
  //     "descriptor continuation" (its own net spend flows in, so the identity
  //     guard must not confuse it with the subscription continuing).
  {
    name: "refund-after-final-charge",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), tx("2026-04-02", "REFUND NETFLIX", +10.0)],
    expected: [{ kind: "ended_recurring", key: "netflix", confidenceAtLeast: "high" }],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },

  // 28. SAME MERCHANT, unrelated one-off purchase alongside an intact
  //     subscription. The aggregate pipeline folds the one-off into the same
  //     key, genuinely scrambling the detected cadence; the honest output is a
  //     LOW "pattern became irregular" (the merged trace really lost cadence),
  //     NEVER an ended claim and never a price claim.
  {
    name: "unrelated-one-off",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [...fillB(), ...monthly(NETFLIX, N10, N_TOP_B), tx("2026-05-25", "NETFLIX GIFT PURCHASE", 55.0)],
    expected: [{ kind: "pattern_irregular", key: "netflix", confidenceAtLeast: "low" }],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared"],
    expectedInsufficient: [],
  },

  // 29. MULTIPLE PLANS from one merchant merge into a single key: the merged
  //     trace reads as scattered, the engine reports the aggregate cadence
  //     honestly (low, informational). It must NEVER claim ended.
  {
    name: "multi-plan-same-merchant",
    a: [...fillA(), ...monthly(NETFLIX, N10, N_TOP)],
    b: [
      ...fillB(),
      ...monthly(NETFLIX, N10, ["2026-04-10", "2026-04-20", "2026-05-10", "2026-05-20", "2026-06-10", "2026-06-20"]),
    ],
    expected: [{ kind: "pattern_irregular", key: "netflix", confidenceAtLeast: "low" }],
    expectedNone: ["ended_recurring", "new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared"],
    expectedInsufficient: [],
  },

  // 30. INSUFFICIENT baseline evidence — the earlier pattern was itself weak
  //     (2 charges, possibly_recurring). Even a long absent stretch cannot
  //     raise the ended claim beyond medium.
  {
    name: "weak-baseline-pattern",
    a: [...fillA(), ...monthly(NETFLIX, N10, ["2026-01-10", "2026-02-10"])],
    b: [...fillB()],
    expected: [
      { kind: "ended_recurring", key: "netflix", confidenceAtLeast: "medium", confidenceBelow: "high" },
    ],
    expectedNone: ["new_recurring", "price_increase", "price_decrease", "frequency_change", "merchant_appeared", "merchant_disappeared", "pattern_irregular"],
    expectedInsufficient: [],
  },
];

export const SCENARIO_COUNT = SCENARIOS.length;

export { tx };