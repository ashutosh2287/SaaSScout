# STEP 24 — Comparison Decision Value (does the compare surface put the right change first?)

**Date:** 2026-09-06
**Baseline / HEAD:** `f55bf4c` (Step 21). Steps 22–24 changes remain uncommitted.
**Suites:** `src/lib/step24/scenario.ts` (new scenario) · `src/lib/step24/decision-value.test.ts` (new, 18).
**Result: frontend 803/803 (41 files) · backend 46/46 (12 suites) · tsc clean · eslint clean · `next build` clean (15 routes)**
**Commit: NO · Push: NO**

---

## 1. Objective

Given many legitimate comparison findings, does SaaSScout put the **most
decision-relevant change** in front of the owner? The answer: **yes** — the
presented order is explainable materiality (`|annualized delta|` descending),
deterministic, and never buries the single biggest dollar change on either side
of the ledger. This step **proves** the existing behavior (OPTION A: keep + cover
with regression measurement) and demonstrates that a "direction preference"
(costs before savings) would be a speculative downgrade, not an improvement.

## 2. Baseline / HEAD

- HEAD `f55bf4c` (Step 21). Step 22 (`prioritizeFindings`, `suggestedAction`) and
  Step 23 review-queue preset are uncommitted in the tree; Step 24 adds nothing to
  production code.
- Pre-Step-24 fronts: FE 785/785 (40 files), BE 46/46, tsc/lint/build clean.

## 3. The comparison model (what the compare surface presents)

The engine (`compare/engine.ts`, 617 lines) emits up to 8 finding kinds, scored
and evidenced by deterministic rules; **the engine's own sort is kind-then-name
and is contract — untouched.** The **presented** order comes from
`prioritizeFindings` (`compare/prioritize.ts`, Step 22): `|yearlyDelta|`
descending, ties by kind order (`new_recurring` … `merchant_disappeared`) then
merchant name; null/NaN/Infinity deltas are guarded and sink (`impactMagnitude`).
Every card renders: kind label, merchant, **confidence badge** (`confidenceLabel`),
**impact line** (monthly + yearly for price steps; yearly for new/ended/frequency),
a **"Next step:" line** (`suggestedAction`), and evidence bullets. Currency
mismatch and reversed-window-order render amber cautions without perturbing the
sort.

## 4. Ground truths considered (PROXY — NOT REAL USER STUDY)

- **GT-A · materiality** (`|annualized delta|` desc, savings and costs interleaved):
  the current presented behavior. Rationale: absolute dollar is what the owner
  actually pays/receives; this is the same dual-threshold philosophy the engine
  uses to *create* findings (relative AND absolute materiality).
- **GT-B · direction preference** (positive cost changes first, then savings,
  each by `|delta|`): the alternative a reader might assume. Rationale for
  rejecting: it demotes facts, has no user-study backing, and re-orders the same
  numbers without adding information.

Both are explainable; GT-A is the one that ships. Labels below mark what is
verified versus inferred.

## 5. Measurement design

A new deterministic scenario (`step24/scenario.ts`, ~100 rows, 13 findings across
8 kinds) engineered to force the ordering question:

- a **huge ended charge** (slack, −$9,733/yr) vs a **small ended** (trello) — do
  savings sink because they are "not costs"?
- a **huge-absolute / +20% step** (microsoft, +$1,217/yr) vs a **small-absolute /
  +100% step** (netflix, +$122/yr) — does percentage become the cue?
- a **frequency change** (figma, monthly→quarterly) and a **pattern_irregular**
  (openai), the latter null-impact.
- **merchant appeared / disappeared** one-off charges (notion / canva), null-impact
  low-confidence informational findings that must sink below every dollar claim.
- a **same-magnitude tie cluster** (adobe new +85.17 ≡ dropbox/zoom +85.17) to test
  cross-kind then name tie-breaking.
- confidence mix: high (stable monthly), medium (frequency / weak baseline), low
  (presence changes).

Ground truth contracts live in the test (`GT_A_ORDER`, `GT_B_ORDER`), deltas are
instrumented (`ANNUAL`) and asserted against the engine output — no approximation.

## 6. Presented order (measured, deterministic)

| # | merchant | kind | yearly Δ | conf |
|---|---|---|---|---|
| 1 | slack | ended_recurring | −9,733.33 | high |
| 2 | salesforce | new_recurring | +1,460.00 | high |
| 3 | microsoft | price_increase | +1,216.67 | high |
| 4 | github | price_increase | +486.67 | high |
| 5 | figma | frequency_change | −405.56 | medium |
| 6 | trello | ended_recurring | −243.33 | high |
| 7 | netflix | price_increase | +121.67 | high |
| 8 | adobe | new_recurring | +85.17 | high |
| 9 | dropbox | price_increase | +85.17 | high |
| 10 | zoom | price_increase | +85.17 | high |
| 11 | openai | pattern_irregular | null | low |
| 12 | notion | merchant_appeared | null | low |
| 13 | canva | merchant_disappeared | null | low |

The **first finding is the single largest annualized change in the file — a
$9,733/yr savings, presented first**, exactly GT-A. Under GT-B it would have
fallen to rank 8 (asserted).

## 7. Decision gate

**OPTION A — KEEP, and prove.** The current ordering already answers the four
decision questions for the top of the list: WHAT changed (`ended_recurring`),
HOW MUCH (−$9,733.33/yr), HOW CERTAIN (high confidence badge), WHAT TO REVIEW
("Next step: Confirm this subscription was meant to cancel…"). A defect was not
found; direction preference is INFERRED taste, not evidence. **No production code
changed.**

## 8. What was NOT changed (scope discipline)

- `compare/engine.ts`, `compare/prioritize.ts`, `compare/format.ts`,
  `ComparePanel.tsx` — untouched.
- No thresholds, classification semantics, currency handling, report schema,
  `.ts` persistence, or privacy posture altered.
- No AI/LLM/telemetry/analytics/opaque scoring introduced.

## 9. Materials added

- `src/lib/step24/scenario.ts` — deterministic scenario + exported ground truth
  (`EXPECTED_FINDING_KIND`, `EXPECTED_YEARLY`), split-window/transaction helpers.
- `src/lib/step24/decision-value.test.ts` — 18 tests (below).

## 10. Tests added (18)

Scenario integrity (2): 13 findings across the expected kinds; engine-observed
deltas match instrumented contracts. GT-A (6): #1 is the biggest change (a
savings); exact order + determinism (3×) + input not mutated; monotonic
materiality; null-impact tail below all dollar findings; same-magnitude tie
resolution (adobe → dropbox → zoom); percentage is not the cue. GT-B (1): the
direction-aware order would bury slack at rank 8 — divergence documented, not
shipped. Presented content (2): every finding carries a confidence badge and a
next-step line; top-3 decision triangle measured. Adversarial (6): empty
comparison; currency mismatch caution with unchanged ordering; reversed window
labels → caution + `ordered=false` + deterministic re-run; null/NaN/Infinity
delta guard (`impactMagnitude`); confidence is a badge, not a ranking key; a
weak 3-charge variable baseline surfaces as an honest medium-confidence ended
claim with explicit weak-pattern evidence (not an alarm). Performance (1): below.

## 11. Adversarial results

- **% vs $:** netflix (+100%, +$122/yr) sits below microsoft (+20%, +$1,217/yr),
  matching the engine's own dual materiality threshold. VERIFIED.
- **Savings vs costs:** a −$9,733 ending wins the top slot over a +$1,460 new
  charge. The owner's wallet feels savings first. VERIFIED (PROXY).
- **Weak-baseline claim:** a variable 90/220/310 three-charge merchant was
  classified possibly-monthly and surfaced as `ended_recurring` −$2,676/yr at
  **medium** confidence with a `pattern_baseline_weak` evidence bullet and a
  neutral next-step check — honest, not alarm-bait. VERIFIED.
- **Currency mismatch:** amber caution, deltas unchanged, ordering identical.
  **Reversed windows:** caution + `ordered=false`; ordering still deterministic.
- **Null/NaN/Infinity deltas:** guarded to magnitude 0, sink, never crash.
- **Confidence:** equal-magnitude findings order by name regardless of
  high/medium/low — ranked by materiality only, evidence strength is a badge.

## 12. Performance

`prioritizeFindings` on synthetic finding sets (deterministic repeat asserted):

| size | ms |
|---|---|
| 1,000 | 0.34 |
| 5,000 | 1.46 |
| 10,000 | 3.84 |
| 25,000 | 11.60 |

`Array.sort` — O(n log n); 25k findings (far beyond any real merged statement
size) sort in ~12 ms. VERIFIED.

## 13. Accessibility

No DOM or interaction changes this step (ComparePanel untouched; ownership is
unaffected). The presented list keeps semantic `<ul>/<li>`, plain-text badges,
no icon-only meaning, no new tab stops, no motion. Full axe sweep deferred to a
future UI step. INFERRED by inspection only.

## 14. Privacy / security

Grep-verified: **zero** network calls, storage access, cookies, env reads,
third-party hosts, or telemetry in `step24/`. The scenario is synthetic; the
measurement is pure client-side arrays. VERIFIED.

## 15. Analytical / classification drift

**Zero drift.** Engine, thresholds, classification, currency, review queue, Step
22 prioritization and Step 23 preset untouched. The only additions are a test
scenario and its measurement suite.

## 16. Product decision

**PASS (OPTION A — keep current ordering).** The compare surface already answers
"what changed most" first, in both directions of the ledger, deterministically.
No fix warranted.

## 17. Remaining gaps

- Direction preference remains UNKNOWN without a real-user study (this PROXY only
  shows the cost of burying magnitude, not human preference).
- The null-impact informational findings sink below all dollar claims; a reader
  scanning only the top may miss one-off merchants. Acceptable — they are
  "informational by definition" (`PRESENCE_CHANGE_CONFIDENCE`).
- A weak-baseline ended claim can reach a high position by magnitude alone; the
  medium badge + weak-pattern evidence covers it, and no suppression rule was
  added (evidence, not silence, is the product's language).

## 18. P0 / P1 / P2

- **P0:** none.
- **P1:** none open. Step 22's P2 (compare direction preference) is now resolved
  — measured, diverged, documented.
- **P2:** comparison summary band (total net annualized change + counts by kind
  at the top of the compare view) — deterministic, builds directly on
  `prioritizeFindings`; direction-preference toggle (needs real-user study —
  DEFERRED, UNKNOWN).

## 19. Recommended Step 25

**Comparison summary band** (P2 above): a one-line "Net annualized change across
13 findings: −$6,842/yr; 5 increases, 2 ended, 2 new…" strip over the ordered
list. Smallest deterministic feature that complements, not replaces, the
decision-first ordering proven here. Alternative (lower value): saved-view parity
audit — already largely in place (ReviewQueue is shared).

## STEP 24 STATUS

- **Objective:** confirm the compare surface puts the most decision-relevant
  change first; keep + prove, or fix minimally.
- **Models compared (PROXY):** GT-A materiality (`|annualized delta|` desc —
  shipped) vs GT-B direction preference (costs before savings — diverged).
- **Before (Step 18–22):** engine kind-then-name order; Step 22 added
  `prioritizeFindings` (impact-first presentation) + `suggestedAction`. No
  measurement existed for "is the biggest change first?"
- **After (this step):** deterministic 13-finding scenario proves the presented
  #1 is the largest annualized change (−$9,733/yr ended). GT-B would demote it to
  rank 8. Ordering is |Δ| desc, ties kind-then-name, null/NaN/Inf sink —
  reproducible run-to-run.
- **Decision:** **OPTION A — KEEP.** No production change. Direction preference
  documented INFERRED/UNKNOWN pending a real-user study.
- **Implementation:** none in production. Added `step24/scenario.ts` +
  `step24/decision-value.test.ts` (18 tests) as regression/measurement coverage.
- **Files:** `src/lib/step24/scenario.ts` · `src/lib/step24/decision-value.test.ts`
  (new). No existing file modified.
- **Tests:** +18 → **803/803 FE (41 files) · 46/46 BE (12 suites)**; Step 20/21/
  22/23 suites re-run green inside the full frontend run.
- **Regression:** tsc clean · eslint clean · `next build` clean (15 routes) ·
  backend lint/tsc/build clean.
- **Adversarial:** %-vs-$, savings-vs-costs, weak-baseline medium claim, currency
  mismatch, reversed windows, empty, null/NaN/Inf deltas, confidence-as-badge,
  tie determinism, no-mutation — all pass.
- **Performance:** 25,000 findings sorted deterministically in **11.60 ms**;
  O(n log n), scaled from 0.34 (1k) to 3.84 (10k).
- **Accessibility:** no DOM/interaction change; semantics preserved. Full axe
  sweep deferred.
- **Privacy/security:** zero network/storage/env/telemetry in `step24/`.
- **Drift:** zero — engine, thresholds, classification, currency, queue, pricing
  actions all untouched.
- **P0/P1/P2:** none / none open / comparison summary band (Step 25 candidate);
  direction-preference toggle DEFERRED (UNKNOWN until user study).
- **Next phase:** Step 25 — comparison summary band; or direction-preference study.
- **Commit: NO**
- **Push: NO**
- **FINAL VERDICT: PASS** — the compare surface demonstrably surfaces the most
  material change first, deterministically; the alternative "direction preference"
  ordering would bury the single largest change and is correctly not shipped.