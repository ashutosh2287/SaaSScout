# STEP 23 — Review Queue Noise Toggle

**Date:** 2026-09-06
**Baseline / HEAD:** `f55bf4c` (Step 21). Step 22 and Step 23 changes remain uncommitted.
**Suites:** `derive.test.ts` (+8 actionable/count tests) · `step22/step23-review-noise.test.ts` (new, 6).
**Result: frontend 785/785 (40 files) · backend 46/46 (12 suites) · tsc clean · lint clean · `next build` clean (15 routes)**
**Commit: NO · Push: NO**

---

## 1. Objective

Let an owner isolate the genuinely actionable review items from the Step 22
noise burden — **47 visible rows → a clear optional view of 18 actionable rows** —
as a pure presentation / filtering change. No analysis semantics touched.

## 2. Baseline / HEAD

- HEAD: `f55bf4c` (Step 21). Step 22 work uncommitted in the tree; Step 23 adds on
  top without touching Step 22's `prioritizeFindings` / `suggestedAction`.
- Pre-Step-23 fronts: FE 772/772 (39 files), BE 46/46, tsc/lint/build clean.

## 3. Existing bottleneck (Step 22 evidence)

On the deterministic Step 22 scenario the review queue rendered **47 rows**, of
which only **18** were genuinely flagged (`strong_review` ∪ `review`); the other
**29** were honest-but-not-actionable `insufficient_evidence` rows — mostly weekly
non-software vendors that pass classification but carry no confident signal.

## 4. The existing actionable / noise distinction

The distinction already existed in `ReviewQueueItem.reviewStatus`:

- **Actionable** = `strong_review` (16) + `review` (2) — a confident or probable
  flag with reasons.
- **Noise** = `insufficient_evidence` (29) — honestly shown "gap, not a confirmed
  problem" rows.

No new classification category, threshold, or amount rule was invented. An
`Actionable` filter is a **preset over existing statuses**.

## 5. Measurement design

Reused the **exact Step 22 scenario** (`step22/scenario.ts`, 6,249 seeded rows —
unchanged) and its queue construction (`deriveDashboard` over the current-window
snapshot). New pure helpers: `filterAndSortReviews(…, "actionable", …)` and
`countReviewQueue(reviews)`. Metrics are **PROXY — NOT REAL USER STUDY**: visible
row burden, not human time.

## 6. Before → After metrics

| Measure | Before | After "Actionable" |
|---|---|---|
| Total queue rows | 47 | 47 (unchanged via **All**) |
| Actionable rows | 18 | 18 |
| Noise rows | 29 | 29 (hidden, not deleted) |
| Default visible rows | 47 | 47 (default preserved) |
| Actionable-only visible rows | n/a | **18** |
| Reduction in visible burden | n/a | **61.7%** (computed: `1 − 18/47`) |
| First actionable item position | 0 (openai) | 0 (openai) |
| Deterministic across runs | yes | yes (asserted) |

## 7. Implementation changes

- `dashboard/types.ts` — `ReviewQueueFilter` gains `"actionable"` (documented as the
  Step 23 preset).
- `dashboard/derive.ts` — `matchFilter` maps `actionable` → `strong_review | review`;
  new pure `countReviewQueue(reviews)` returning per-status + actionable counts.
- `dashboard/index.ts` — exports `countReviewQueue` + `ReviewQueueCounts`.
- `components/analyze/ReviewQueue.tsx` — added an **Actionable** chip to the existing
  filter group and dynamic counts on **every** chip: `All (47) · Actionable (18) ·
  Strong review (16) · Review (2) · Insufficient evidence (29)`. Default filter stays
  **All**; source array never mutated.

## 8. Files changed

- `src/lib/dashboard/types.ts` · `derive.ts` · `index.ts` · `derive.test.ts`
- `src/components/analyze/ReviewQueue.tsx`
- `src/lib/step22/step23-review-noise.test.ts` (new)

## 9. Tests added (13)

- `derive.test.ts` (+8): actionable only returns strong+review in priority order;
  `All` returns everything; `countReviewQueue` dynamic counts; empty / all-actionable
  / all-noise / single-actionable / single-noise; repeated toggling never mutates the
  source; legacy status filters unchanged (regression).
- `step22/step23-review-noise.test.ts` (new, 6): scenario yields 47/18/29; All=47 and
  Actionable=18 with status membership verified; 61.7% reduction computed; openai
  still first in both views; priority ordering preserved within each view;
  filter-free determinism + immutability across repeated runs.

## 10. Full regression

- Frontend: **785/785 passing, 40 files** (+13 from Step 23; Step 22's 12 intact).
- Backend: **46/46 (12 suites)** — untouched, verified.
- `tsc --noEmit`: clean · `eslint src`: clean · `next build`: clean (15 routes).

## 11. Adversarial results

Empty, one-actionable, one-noise, all-actionable, all-noise, mixed: all correct.
Repeated toggling: source array asserts un-mutated. Deduplication by merchant key is
a product-level concern upstream of the queue (queue items already keyed); not in
scope for a display filter. `reviewStatus` is always present on queue items (null
evidence fields are pre-normalized by the adapters), so there is no null-status
branch to fall back through — and none was fabricated. Engine output untouched.

## 12. Performance

Filter = O(n) `countReviewQueue` (single pass) + the existing O(n log n) sort over
the ≤ 47-row queue. Negligible; no recomputation of analysis.

## 13. Accessibility

Reuses the existing chip buttons: keyboard operable, `aria-pressed` state, focus
inherits browser default. The count is plain text inside the button, so the
accessible name reads "Actionable (18)" — no icon-only or color-only meaning.
No new tab stops, no motion, responsive (`flex-wrap` retained), no overflow.

## 14. Privacy / security checks

Grep-verified: **zero** network calls, storage writes, `console`/env access,
third-party hosts, telemetry, or analytics in all changed files. Filtering is
pure client-side; nothing leaves the browser.

## 15. Analytical / classification drift check

**Zero drift.** The review queue's production pipeline, scoring thresholds, review
confidence/evidence, recurring detection, merchant identity, currency, and compare
engine are untouched. The change is one union member + one status-preset matcher +
one counter over already-computed rows. The Step 22 compare prioritization and
`suggestedAction` behavior are untouched (their tests still green).

## 16. Product decision

**PASS.** Default experience preserved (`All`), actionable isolation one tap away,
counts honest and dynamic. The preset is additive — nothing removed, nothing deleted.

## 17. Remaining gaps

- Default view still shows 47 rows (deliberate: the noise is honest signal).
- Granular chips (Strong / Review / Insufficient) coexist with the Actionable preset;
  that redundancy is acceptable — each is still useful.
- No persistence of the chosen filter (out of scope: no storage writes allowed).

## 18. P0 / P1 / P2

- **P0:** none.
- **P1:** none open — Step 22's P1 (queue noise) is closed by this step.
- **P2:** optional "remember last filter" (needs persistence; deferred by privacy
  rule); optional chip consolidation.

## 19. Recommended Step 24

**Compare surface "direction preference" (Step 22 P2):** confirm whether owners
prioritize *net expense increases* over gross magnitude, then apply the same
ask-measure-fix loop to `prioritizeFindings`. Lower-confidence candidate: saved-view
parity audit (the saved ReportView already reuses this component, so likely nothing).

## STEP 23 STATUS

- **Objective:** 47 reviewed rows → optional 18-actionable view; presentation only.
- **Distinction:** existing `reviewStatus` — `strong_review ∪ review` = actionable;
  `insufficient_evidence` = noise. No new rule.
- **Before:** 47 queue rows · 18 actionable · 29 noise.
- **After (Actionable):** 18 visible rows · 29 hidden-not-deleted · **61.7%**
  reduction (computed `1 − 18/47`) · All still 47 · default unchanged.
- **Time-to-insight (PROXY):** first actionable item at position 0 in both views
  (openai); focusable burden cut by 29 rows.
- **Implementation:** `+actionable` filter preset · `countReviewQueue` · dynamic
  chip counts `All (47) Actionable (18) …`.
- **Files:** `dashboard/{types,derive,index}.ts` · `ReviewQueue.tsx` ·
  `derive.test.ts` · `step22/step23-review-noise.test.ts`.
- **Tests:** +13 (8 derive, 6 scenario-measurement) → **785/785 FE · 46/46 BE**.
- **Regression:** tsc clean · eslint clean · next build clean.
- **Adversarial:** empty/all-actionable/all-noise/mixed/single cases, repeated
  toggling, immutability, order preservation, legacy status regression — all pass.
- **Performance:** O(n) count + existing O(n log n) sort over ≤ 47 rows.
- **Accessibility:** existing chip pattern, `aria-pressed`, plain-text counts, no
  motion/overflow, no new tab stops.
- **Privacy/security:** zero network/storage/env/telemetry in changed files.
- **Drift:** zero — analysis, classification, recurring, currency, compare, Step 22
  prioritization and `suggestedAction` all unchanged.
- **P0/P1/P2:** none / none open / filter persistence (deferred by privacy rule).
- **Next phase:** Step 24 — compare "direction preference" (P2) or saved-view parity
  audit.
- **Commit: NO**
- **Push: NO**
- **FINAL VERDICT: PASS** — smallest possible change; 47→18 with a one-tap,
  dynamic-count, zero-drift presentation filter; fully regressed.