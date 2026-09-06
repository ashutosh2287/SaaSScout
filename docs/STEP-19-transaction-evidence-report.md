# STEP 19 — Transaction-Level Gap Evidence & Comparison Accuracy

Date: 2026-09-06 · Applies to the `frontend/` comparison module (`src/lib/compare/`). No backend involvement (backend checks are informational).

## 1. Objective

Make the period-over-period comparison (`compareReports`) honest at the level of individual charge evidence. The comparison must reliably separate:

- **Case A — confirmed ended:** the charge stopped and the evidence can prove it.
- **Case B — became irregular:** the charge is still happening but its cadence broke (sporadic, wrong intervals).
- **Case C — insufficient observation:** the data cannot separate the above (too few charges, partial window, ambiguous identity).
- **Case D — partial period:** one of the windows only observes part of a billing cycle, so "absence" would be a false signal.
- **Case E — identity uncertainty:** the merchant reappears under a different descriptor / identity; the "end" is an artifact of naming.

Hard floor: **a B, C, D or E case is never reported as "ended".** Absence of a charge in a window is never treated as evidence of absence unless the window provably covers the merchant's own cadence.

## 2. What the saved reports actually keep (evidence survival — Phase 1 trace)

Re-confirmed by tracing `parse → normalize → classify → recurring → aggregate → report → persist`. A saved analysis retains **no per-charge dates**; it keeps only aggregate/edge evidence per merchant:

| Field | Meaning |
|---|---|
| `transactionCount`, `firstSeen`, `lastSeen` | count and charge boundaries |
| `distinctRawDescriptions` | the deduplicated raw statement lines (privacy-reduced, no dates, no IDs) |
| `interval`, `intervalConsistency`, `gapCount`, `patternSpanMonths`, `status` | recurring cadence result |
| `typicalAmount`, `amountProfile`, `totalSpend` | money edge |
| `quality.date` (earliest/latest) | the observation window |

Consequence (design constraint): transaction-level analysis is done on the **aggregate preserved edges** — boundaries, cadence gaps, description overlap — and requires **no schema change and no new persistence**. Persisting per-charge dates would violate the product's privacy model (transaction rows are browser-resident and never stored), so Step 19 must not add them.

## 3. The three Phase-18 correctness holes found during this phase

1. **Blanket suppression of "recurring-then-gapped" (old rule 2b).** A merchant recurring in the baseline that still charges in the current period but lost cadence was always suppressed with no output. This conflates a live-but-irregular subscription (Case B — genuinely visible) with "can't tell" (Case C).
2. **Overlapping windows inflated "ended" confidence.** The old rule counted the *current window's* day count as absence — but when windows overlap, some of those days are days the merchant is provably still present (baseline `lastSeen` falls inside the current window). E.g. a 60-day overlapping current window was read as ~2 monthly cycles of absence although only ~1 real cycle had elapsed since the last charge.
3. **Unmapped descriptor variants produced false "ended".** A software merchant absent from the current period whose description reappears under a *different* normalized key was reported ended even though the charge clearly continued under another label (Case E). This is exactly the disorder phase expects a comparison engine to prove it does not have.

## 4. Design: minimum-justified change

- Compare module only (`src/lib/compare/`). No report-schema change, no persistence/export change, no pipeline change.
- Every new rule is a **named threshold** in `constants.ts`, mirroring the existing Phase-18 style (no magic numbers).

## 5. Transaction-edge evidence implemented (engine.ts)

- **`observedAbsenceDays(lastSeen, windowStart, windowEnd)`** — absence is anchored at the merchant's **last observed charge** and the current window's start; days where the merchant is provably still present are excluded. This fixes hole 2: overlapping windows can no longer inflate absence. Fallback to the whole window only when no last charge is known.
- **`cadenceBrokenEvidence(bR, baselinePeriodDays)`** — decides Case B vs Case C from surviving gap fields: ≥ `IRREGULAR_MIN_CHARGES` (3) charges, spread ≥ one expected baseline cycle, and no reliable dominant interval (`intervalConsistency < BASELINE_WEAK_CONSISTENCY_MAX` = 0.7, or explicit `irregular`). On true scatter emits a low-confidence `pattern_irregular` finding; a thinner residual trace stays suppressed with an explicit reason (Case C).
- **Identity pre-pass (Case E)** — one pass builds a token index of every *appearing* merchant's description tokens (tokens = raw-description words minus `GENERIC_DESC_TOKENS`). For each vanished software merchant, candidate appearing merchants sharing a token are evaluated by **Dice similarity ≥ `DESCRIPTOR_OVERLAP_MIN_DICE` = 0.5**, then paired. A paired pair suppresses *both* directions (`ended_recurring`/`merchant_disappeared` and `new_recurring`/`merchant_appeared`) under category `identity_uncertain` with a reason naming the other identity. Complaints are impossible for:
  - **refund-aftermath lines** — an appearing merchant whose raw descriptions contain a `REFUND_MARKER_TOKENS` word is not a plausible continuation (a refund settles a bill; it does not continue a subscription);
  - **money-in identities** — an appearing merchant whose `totalSpend` is definitively ≥ 0 cannot be the same run of outgoing charges;
  - **generic corporate words** (`inc`, `llc`, `group`, `service(s)`, `technology(ies)`, `software`, `solutions`, `platform`, `cloud`, domain tokens, …) which otherwise make unrelated vendors look like twins at 0.5 Dice.
- **Weak-baseline cap** — when the baseline pattern was itself sloppy (`status !== possible/likely` with `intervalConsistency < 0.7`), the "ended" claim is capped at **medium**: irregular-already is as consistent with the data as stopped.

## 6. Rule details worth asserting

- Ended: `ended_recurring` requires `cyclesCovered(observedAbsenceDays, periodDays) ≥ ABSENCE_EVIDENCE_MIN_CYCLES` (1). `high` requires ≥ 2 cycles **and** a reliable baseline. Weekly cadence stays capped at medium (`WEEKLY_INTERVAL_MAX_CONFIDENCE`).
- Case B finding evidence names the residual charges (`not_ended`, `irregular_pattern`, `window_covers_cycle`), so the UI copy says *"Billing pattern became irregular"*, never "ended".
- Suppressed hypotheses carry a `category` (`insufficient_observation` vs `identity_uncertain`) so the measurement can report the two ambiguity classes separately.
- `firstSeen` is now surfaced as `first_charge_current` evidence on `new_recurring`, and `lastSeen` as `last_charge_observed` on `ended_recurring` — the charge boundaries are on the record.

## 7. Ground truth dataset (`dataset.ts`)

30 scenarios, contract = `expected` (findings that must be present, with `confidenceAtLeast`/`confidenceBelow` ceilings) + `expectedNone` (kinds that must never be emitted) + `expectedInsufficient`. Coverage by case:

| Case | Scenarios |
|---|---|
| A — true ended (monthly/quarterly/annual/weekly, ends-after-one-cycle, refund-after-final-charge, weak-baseline) | 22, 21, 23, 24, 27, 30 |
| B — became irregular | 19 (monthly-became-irregular), 28 (unrelated one-off merges into the cadence), 29 (multi-plan merchant genuinely merges) |
| C — insufficient observation | 9 (missing transaction), 10, 11 (partial windows), 20 (ends-immediately-after) |
| D — partial period | 10, 11 |
| E — identity | 25 (known-brand descriptor variant), 26 (duplicate-charge recovery path), 27 (refund-aftermath must NOT count as E) |

Plus the Phase-18 regression set (0–18) covering new/ended/stable/price-steps/alias/refund/ambiguous/non-software/one-off-to-recurring/identical-periods/delayed-charge. Every expected case asserts `expectedNone` excludes the wrong claims (e.g. a suppressed Case B/C scenario asserts `ended_recurring` is not emitted).

## 8. Measurement protocol (`measure.test.ts`)

Per scenario: build real reports (same pipeline the UI uses) and run `compareReports`. Counting:

- **TP**: expected finding emitted (with confidence floor and honesty ceiling checked).
- **FP**: any emitted finding outside the ground-truth contract (including inside `expectedNone`).
- **FN**: any expected finding not emitted.
- Suppressed hypotheses split into `insufficient_observation` vs `identity_uncertain`; `expectedInsufficient` requires specific records.

## 9. Results

```
scenarios=30   tp=16   fp=0   fn=0   precision=1.000   recall=1.000
suppressed_insufficient=7   suppressed_identity=0 (guard covered at unit + perf level)
```

Precision/recall denominator is the finding contract (16 expected findings); suppressed/ambiguity is reported separately and never laundered into accuracy.

Per-scenario sheet (from the harness):

| scenario | findings | suppressed |
|---|---|---|
| new-recurring | `new_recurring:netflix` | — |
| ended-recurring | `ended_recurring:netflix` | — |
| stable | none | — |
| price-increase / price-decrease | `price_*:netflix` | — |
| insignificant-fluctuation | none | — |
| frequency-change-monthly-to-quarterly | `frequency_change:netflix` | — |
| alias-change | none | — |
| missing-transaction | none | 1 window |
| partial-period-current / -baseline-window | none | 2 window each |
| refund | none | — |
| ambiguous-merchant / non-software-recurring | none | — |
| irregular-charge-disappearance | `merchant_disappeared:dropbox` | — |
| one-off-to-recurring | `new_recurring:netflix` | — |
| identical-periods | none | — |
| delayed-charge | none | — |
| monthly-became-irregular | `pattern_irregular:netflix` | — |
| ends-immediately-after | none | 2 window |
| ends-after-one-cycle / quarterly-ended / annual-ended / weekly-ended | `ended_recurring:netflix` | — |
| descriptor-variant-known-brand | none | — |
| duplicate-charge | none | — |
| refund-after-final-charge | `ended_recurring:netflix` | — |
| unrelated-one-off | `pattern_irregular:netflix` | — |
| multi-plan-same-merchant | `pattern_irregular:netflix` | — |
| weak-baseline-pattern | `ended_recurring:netflix` (medium cap) | — |

## 10. Adversarial attack cases (no false "ended" demonstrated)

- **Duplicate-charge recovery**: the refund line in B that follows A's charge is treated as spend, not as "the subscription stopped" — no ended, no pattern call.
- **Refund-after-final-charge**: the refund-aftermath appearing identity is excluded from the E-guard by the refund-marker rule; the true end is still reported `ended_recurring`.
- **Unrelated one-off alongside intact subscription**: the merged aggregate genuinely loses cadence → honest `pattern_irregular` low; never an ended claim and never a price claim.
- **Descriptor change (known brand)**: identity layer folds the variant into the same key → stable; no false ended, no false new.
- **Descriptor change (unknown key)**: two different keys with Dice-overlapping raw descriptions → both directions suppressed `identity_uncertain` (unit-tested in `engine.test.ts`).
- **Monthly-turns-irregular**: a live 4-charge scatter spanning > a month at ~0.4 consistency → `pattern_irregular` low with explicit not-ended evidence.
- **Ends-immediately-after**: absence covers < 1 cycle → suppressed with reason.

## 11. Confidence honesty

- `high` is reserved for: ≥ 2 observed cycles of absence + a regular baseline (`ended_recurring`); or both sides `likely_recurring` + stable amounts (price/frequency). Weekly cadence and one-off presence are capped by constants.
- Ceilings are *part of the contract*: scenarios assert `confidenceBelow` (e.g. weak-baseline ended stays below medium).

## 12. Known ceilings (honest limitations, left as documented `ponytail:`-style trade-offs)

- **Merged multi-line charges**: one statement line per charge is assumed; a merchant billed in two lines (e.g. tax+base) will read as irregular because the aggregate merges seconds. Case B emits only `low`; the reason text says "aggregate data".
- **Same-day intra-cadence drift** is invisible (day-granularity).
- **Non-software descriptor drift** (a poster-card vendor that becomes a SaaS entry) is not paired — the guard intentionally over-suppresses toward honesty.
- **Refund timing**: a refund delayed across a report boundary can make the previous window look cheaper; comparisons only ever re-read raw edges, so no amount claim is fabricated.

## 13. Performance at the 25k-merchant ceiling (`perf-19.test.ts`)

Synthetic 25,000 merchant baseline vs 25,000 current (1,000 vanished, 1,000 appeared, 300 Dice-overlapping pairs exercised in the identity guard):

```
measured compareReports at 25000 merchants: 165.2ms
identity-uncertain suppressions exercised: 600 (300 pairs × 2 directions)
ended findings: 700 (= 1000 vanished − 300 paired)
```

Asserted budget < 2000 ms; measured comfortably sub-second. The identity index is built in one pass over appearing merchants and each absent merchant touches only its own tokens' buckets (linear in merchants, independent of transaction rows). Elapsed is wall-clock on this machine; the numbers above are the measured evidence.

## 14. Regression differential vs Phase 18

- Phase-18 comparison scenarios (0–17) keep **byte-identical contracts** — the full suite stays green (frontend 670 passing, compare 49 passing).
- Scenario 18 (delayed-charge) adds `pattern_irregular` to `expectedNone`: the label did not exist in Phase 18, so this is an explicit statement of unchanged behavior, not a behavior change.
- Behavior changes are confined to: suppressed-with-reason instead of silent (Case C), new `pattern_irregular` case (Case B), lastSeen-anchored absence (Case D/overlap — improves honesty, does not flip any Phase-18 verdict), baseline-weak cap (only lowers confidence, never raises it), identity suppression (only *removes* findings). Every direction of change makes the compare module more conservative.

## 15. Privacy (P9): 0 outbound, no new persistence

- `grep` over `compare/`, `report/`, `persistence/` for `fetch/XMLHttpRequest/WebSocket/axios/sendBeacon/HttpClient/https://`: **0 hits** in code (single hit is a CSV-injection test fixture `=HYPERLINK(...)`). No network primitive, no storage change.
- Nothing was added to the saved-report schema; the entire phase is derived at compare time from already-persisted edges. Saved analyses are unchanged and remain schematically identical (`schemaCompatible` unaffected).

## 16. UX verification

- New kind renders through the existing generic finding path (`KIND_LABEL[f.kind]` + evidence bullets + confidence chip) in `ComparePanel.tsx`; new label *"Billing pattern became irregular"* tested-safe against the trust-language suite. `impactLine` returns null for irregular/appeared/disappeared, so no invented dollar impact line is drawn.
- Suppressed hypotheses render under "Not enough evidence to tell" with `reason` text; identity-uncertain ones carry a reason naming the possible other identity.
- No new UI copy beyond the label; no structural change.

## 17. Acceptance gates (all green)

- [x] Never report Case B/C/D/E as `ended_recurring` — asserted across the 30-scenario contract and unit tests; `fp=0`.
- [x] Ground truth ≥ 20 scenarios — 30 provided, each with named expectations.
- [x] Metrics with denominators — tp/fp/fn, precision/recall, suppressed split by category, confidence ceilings asserted.
- [x] Adversarial scenarios — section 10.
- [x] Privacy — 0 outbound, no schema/persistence change (section 15).
- [x] Performance @25k — 165 ms measured, < 2 s budget (section 13).
- [x] Regression differential — Phase-18 contracts intact (section 14).
- [x] Full suite: frontend **670/670**, backend **46/46**; `eslint` clean; `tsc --noEmit` clean.
- [x] Determinism preserved: outputs sorted by kind then name; identical inputs → identical outputs (Phase-17 determinism test still passing).

## 18. How to reproduce

```
cd frontend
npx vitest run src/lib/compare/            # 49 tests, 49 through
npx vitest run src/lib/compare/measure.test.ts --disableConsoleIntercept
npm test                                   # 670 through
npm run lint; npx tsc --noEmit
cd ../backend && npm test                  # 46 through
```

## Step 19 – change register (all uncommitted)

| File | Change |
|---|---|
| `frontend/src/lib/compare/constants.ts` | `IRREGULAR_MIN_CHARGES`, `BASELINE_WEAK_CONSISTENCY_MAX`, `DESCRIPTOR_OVERLAP_MIN_DICE`, `GENERIC_DESC_TOKENS` (incl. saas corpus words), `REFUND_MARKER_TOKENS` |
| `frontend/src/lib/compare/types.ts` | kind `pattern_irregular`, 6 evidence types, `SuppressionCategory` |
| `frontend/src/lib/compare/engine.ts` | `observedAbsenceDays`, `cadenceBrokenEvidence`, identity pre-pass, 2b split, lastSeen-anchored ended, baseline-weak cap, first/last-charge evidence, category-carrying suppression |
| `frontend/src/lib/compare/format.ts` | `KIND_LABEL.pattern_irregular` |
| `frontend/src/lib/compare/dataset.ts` | 30-scenario ground truth (12 new), confidence ceilings, insufficient-evidence contracts |
| `frontend/src/lib/compare/measure.test.ts` | measurement harness + step19 sheet export |
| `frontend/src/lib/compare/engine.test.ts` | unit proofs: identity guard, refund exclusion, weak-baseline cap, observed-absence anchoring, cadence split, ordering |
| `frontend/src/lib/compare/perf-19.test.ts` | 25k-merchant wall-clock guard |

```
STEP 19 STATUS

Baseline: frontend 649/649 (31 files) · backend 46/46 · git main @ e7293fa
Root cause: Phase-18 comparison could not separate "ended" (A) from
became-irregular (B), insufficient observation (C), partial periods (D), and
descriptor/identity drift (E); overlapping windows inflated ended confidence;
unmapped descriptor variants produced false "ended".
Transaction-level evidence implemented: YES
Sources traced end-to-end: YES
Rules rebuilt on surviving aggregate edges only (no schema/persistence change): YES
All suffixes anchored (no low-confidence-only cultural claims; caps enforced): YES
Benchmark measured (30 scenarios, precision 1.000 / recall 1.000, tp16 fp0 fn0,
+ 7 insufficient-observation suppressions, + 0 pipeline identity suppressions
with the cross-key guard covered at unit and perf level): YES
Adversarial comparisons (duplicate, refund-after-final, unrelated one-off,
descriptor change, monthly-turned-irregular): PASS
Adversarial logging for new coupled findings (deterministic ordering, sorted
keys, all finding evidence lists non-empty): PASS
Performance @25k merchants: 165ms measured (budget < 2000ms): PASS
Regression differential vs Phase 18: scenarios 0-17 contracts unchanged; only
intentional additions are more conservative
UX handling verified (generic finding renderer + label; no structural change): YES
Privacy impact: none — 0 network primitives, no new persistence, no schema change
Memory: linear in merchant count (token index sized by appearing descriptions)
Implementation performed: YES
Commit: NO
Push: NO
```