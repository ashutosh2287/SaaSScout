# STEP 27 — Unclear-Ownership Review Signal

**STATUS: PASS** (implemented) — Commit: NO · Push: NO

---

## 1. Objective

Close the second of three landing-page claims the engine could not back:
"vendor without an obvious owner" (the third, cross-source / multi-file
deduction, remains Step 5 item A3 and is out of scope here). The Step 5
backlog named this as `unowned-vendor`; the honest reading of the
existing engine is a narrower, sharper signal: a merchant the recurring
engine calls a sustained software bill, that the classification engine
could not identify by name or category pattern. That intersection is the
smallest honest "vendor without owner" reading the engine can back
without inventing text similarity.

PASS criteria: the reason fires only on a real review/strong_review
candidate (the merchant is software-classified, has enough history to
review, AND its classification is `unknown`); the summary exposes a
single count so the UI can surface one badge; copy never claims
savings, waste, or auto-cancel language; the existing review contract
is unchanged for every other reason.

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21). Step 26 (overlap detection) is
  complete and uncommitted.
- Frontend baseline after Step 26: vitest 843/843 (43 files); `tsc
  --noEmit` clean; ESLint clean; `next build` clean.
- Backend baseline: 46/46; ESLint clean; `tsc --noEmit` clean; build
  clean. (Backend untouched.)
- Baseline re-verified in Phase 1 of this step (see §14).

## 3. The surface today (what already exists)

- `detectSpendReviews` in `leak/detect.ts` already builds a per-merchant
  `SpendReview { status, confidence, score, reasons[], ... }`.
- A `ReviewReasonType: "uncertain_classification"` already exists for
  merchants that the aggregate layer marks `status: "uncertain"` (e.g.
  payment processors, mixed-merchants like Amazon).
- The review queue UI (`ReviewQueue.tsx`) renders every `reason` as a
  bulleted line, so a new reason type surfaces in the existing UI without
  a JSX change.
- The review summary exposes counts but no per-reason tally. Adding a
  single `unclearOwnershipCount` lets the UI show "X vendors without an
  obvious owner" as a header chip without any new component.

## 4. Hypothesis

Owners running a software-spend review benefit from a single, named
"this merchant is recurring but we don't know what it is" badge **if** it
is:

1. Conservative — only on a merchant that the existing engine has
   already accepted as a software candidate (status === "software")
   AND called recurring enough to be worth reviewing.
2. Non-additive of fake precision — never claims to know what the
   merchant is; it only says the engine could not identify it.
3. Non-creating — does not change the review/strong_review count
   itself. A merchant carries the reason *in addition to* its other
   reasons; the existing "is this worth reviewing" decision is
   independent of the ownership signal.
4. Plain English — no savings / cancel / waste / unused language.
5. Pure — same input, same output; no mutation; deterministic.

The acceptance criteria for this step (8, from the loop brief) are
mapped to evidence in §5–§10 and confirmed by tests in §9.

## 5. Design (additive, gated, honest)

### 5.1 New `ReviewReasonType: "unclear_ownership"`

Added to the union in `leak/types.ts` with a doc comment that names the
two intersecting layers and the rule that the reason is additive (a
merchant can carry it alongside `recurring_software`,
`high_monthly_spend`, etc., not instead of them).

### 5.2 Detection (one block, four lines)

Added to `detectSpendReviews` inside the existing `else` branch that
runs for non-blocked quality. The block fires when ALL of:

- the merchant reached `review` or `strong_review` status
  (i.e. it's a software merchant with enough history to review);
- `m.classification.category === "unknown"` (the classification
  engine could not identify it by dictionary, by description pattern,
  or by non-software guard);
- the merchant is not already a `reasons.some((r) => r.type ===
  "unclear_ownership")` (dedup).

The text is plain English: "Recurring software spend whose vendor the
engine could not identify by name or category pattern — confirm who
owns this expense." It contains no "cancel", "savings", "waste", or
"unused" — these are checked by an explicit test (§9 case F).

### 5.3 Summary count

Added a single `unclearOwnershipCount: number` to `ReviewSummary`.
Bumped in the per-merchant loop after the spend totals, with a `some`
check that uses the already-built `reasons` array. `EMPTY_SUMMARY`
initialises it to `0`. The UI can read this field directly to render a
"X vendors without an obvious owner" chip without any change to the
review queue component.

## 6. Where the numbers come from (no new semantics)

Every input to the new reason is already a value the engine computes:

- `m.status === "software"` — the existing aggregate layer's verdict
  on whether this merchant is a software candidate.
- `m.recurring.status ∈ {likely_recurring, possibly_recurring}` — the
  existing recurring engine's verdict that this is a sustained bill.
- `m.classification.category === "unknown"` — the existing
  classification engine's verdict that no dictionary or pattern
  match identified this vendor.
- `(status === "review" || status === "strong_review")` — the existing
  status policy's verdict that this is worth reviewing at all.

The new reason is the *intersection* of four existing verdicts, so it
is exactly as trustworthy as the worst of the four — never more.

## 7. Honesty / false-certainty guardrails

| Risk | Guard | Evidence |
|---|---|---|
| Fires on a one-off charge | `m.recurring.status ∈ {likely_recurring, possibly_recurring}` is required for review status; one-off charges go to `no_concern` and never reach this block | Test "does NOT fire when the merchant never reaches a review status" |
| Fires on a not-software merchant | `m.classification.category === "unknown"` is not the only gate; the merchant must also be `status === "software"` (which already requires passing the aggregate layer's non-software guard) | Test "does NOT fire when classification is known" |
| Fires on a mixed/processor merchant | `m.status === "uncertain"` (Amazon, PayPal wrapper, etc.) routes to `insufficient_evidence` and never reaches the `unclear_ownership` block | Test "does NOT fire when the merchant status is 'uncertain'" |
| A merchant is double-counted | `if (!reasons.some((r) => r.type === "unclear_ownership"))` dedup guard | Test "counts each unclear-ownership merchant once (dedup)" |
| A merchant with KNOWN classification (Adobe, Slack) is flagged | `m.classification.category === "unknown"` is a hard gate | Test "does NOT fire when classification is known" (Adobe + electric, both reach strong_review, neither has the reason) |
| A merchant without enough history is flagged | `(status === "review" \|\| status === "strong_review")` gate; fewer than `MIN_PAYMENTS_FOR_REVIEW` payments go to `insufficient_evidence` | Test "does NOT fire … never reaches a review status" |
| Plain English only — no fake-precision copy | Explicit text inspection: no `saving`, `cancel`, `waste`, `unused` | Test "the reason text is plain English and does not invent a category or claim savings" |

## 8. Scope discipline (what was NOT changed)

- No backend change (backend untouched and green).
- No change to the engine, comparison, dashboard, persistence, or
  saved-view schema. `ReviewSummary` gains one field; `ReviewReasonType`
  gains one variant; `detectSpendReviews` gains one block.
- `leak/detect.ts`'s `statusForMerchant`, `confidenceFor`, and
  `scoreMerchant` are untouched. The review-queue policy and the
  score model are unchanged.
- `ReviewQueue.tsx`, `DashboardMetrics.tsx`, and `ComparePanel.tsx` are
  unchanged. The new reason surfaces through the existing `reasons[]`
  rendering; the new count is available to any future UI without a
  forced change here.
- The leak tests' existing fixtures (Adobe, Slack, Shop, electric, etc.)
  are unchanged; six new tests in a new `describe` block are additive
  only.
- `REVIEW_QUEUE_ORDER`, the sort key map, the filter policy, the
  summary-derived metrics are all unchanged.
- No new dependencies.

## 9. Tests added (6, `frontend/src/lib/leak/index.test.ts`)

| Case | Asserts |
|---|---|
| Fires on a software merchant with `unknown` classification that reaches review | `status ∈ {review, strong_review}`, reason present, `summary.unclearOwnershipCount === 1` |
| Does NOT fire when classification is known | Adobe (likely_software) and electric (not_software) reach strong_review / no_concern; neither carries the reason; count is 0 |
| Does NOT fire when the merchant never reaches a review status | 1-payment `insufficient_data` recurring → `insufficient_evidence`; reason absent; count is 0 |
| Does NOT fire when `m.status === "uncertain"` | Aggregate layer's pre-existing uncertain routing prevents the block; reason absent; count is 0 |
| Counts each merchant once across a mixed input | Two unknown-software + one known (Adobe) → `unclearOwnershipCount === 2`; review/strong_review totals unaffected |
| Plain English copy; no `saving`/`cancel`/`waste`/`unused` | Text-inspection test on the reason message |

Plus the existing test suite (49 tests in `index.test.ts` + 2 in
`step16.test.ts`) continues to pass unchanged.

## 10. Adversarial results

Cases A through T (loop convention):

- A (overlapping windows) — N/A, this signal is per-merchant inside a
  single report.
- B (became irregular) — N/A, the reason does not touch recurring
  detail.
- C (residual trace too thin) — covered by Test case C (`insufficient_data`).
- D (descriptor similarity) — N/A, the gate is the classification
  category, not text similarity.
- E (identity uncertainty) — N/A.
- F (currency mismatch) — N/A, the reason has no monetary claim.
- G (null deltas) — N/A, this is a `reasons[]` string, not a number.
- H / I (NaN / ±Infinity) — N/A.
- J–R — pre-existing tests pass.
- S (saved-view rendering) — the reason is rendered via the existing
  per-reason bullet in the ReviewQueue; the `summary.unclearOwnershipCount`
  field is part of `SasscoutReport`, which is already serialized in
  `report/build.ts`. Persistence and round-trip are unchanged because
  the field is additive.
- T (unchanged-state re-render) — `detectSpendReviews` is pure; same
  input, same output, in the same order.

No adversary produced a case where the new reason invents a category or
claims a spend delta.

## 11. Determinism & non-mutation

- `detectSpendReviews` is unchanged in its mutation policy; the new
  block is a `push` and a summary increment, no input mutation.
- The reason order within a review is determined by the engine's
  `buildReasons` and the explicit `if (!reasons.some(...))` dedup. A
  re-run on the same input produces a byte-for-byte identical output
  (existing "same input -> same output" test in `index.test.ts`).
- The summary's `unclearOwnershipCount` is deterministic: it counts the
  set of reviews carrying the reason.

## 12. Empty / zero / blocked interplay

- Empty dataset — `unclearOwnershipCount === 0` (no reviews).
- Blocked data — `detectSpendReviews` short-circuits to
  `insufficient_evidence` for every merchant with a
  `poor_data_quality` reason. The new block sits inside the
  `else` branch (non-blocked quality), so a blocked dataset never
  produces the reason.
- No software merchants — no reviews → count is 0.
- All known merchants — the gate `category === "unknown"` is false
  for every review → count is 0.

## 13. Currency behavior (VERIFIED, unchanged)

The reason has no monetary claim. The currency-mismatch caution
(`app.ts`) is unchanged.

## 14. Full regression (VERIFIED)

- Frontend: vitest **849/849 (43 files)** → 843 baseline + 6 new
  (Step 27); ESLint clean; `tsc --noEmit` clean; `next build` clean.
- Backend: 46/46; ESLint clean; `tsc --noEmit` clean; build clean.
  (Backend untouched.)
- All 8 `ReviewSummary` literal call-sites in the test suite were
  updated to include `unclearOwnershipCount`; no behaviour change in
  any other test.

## 15. Stop-condition review (phase 10)

Loop stop conditions re-checked: (a) no pre-existing "vendor without
owner" / "unclear ownership" signal anywhere in the engine (grep for
`unclear|owner|unowned` returns no pre-existing match); (b) the new
reason is purely additive — it never changes a status, score, or
existing reason; (c) the new gate is the strict intersection of
existing verdicts; (d) regression gates green. → **No stop condition
met; feature qualifies as PASS.**

## 16. Product decision

**PASS — ship the unclear-ownership signal.** Rationale: it is the
smallest honest reading of "vendor without owner" the engine can
support; it is gated by four existing verdicts so it cannot claim
more than the worst of them; the new reason is plain English, never
savings/cancel/waste language; the summary exposes one count for the
UI; and the cost is six new tests plus one field on `ReviewSummary`.

## 17. Files changed

- `frontend/src/lib/leak/types.ts` (modified): new `unclear_ownership`
  reason type; new `unclearOwnershipCount` on `ReviewSummary`.
- `frontend/src/lib/leak/detect.ts` (modified): one block in
  `detectSpendReviews` to push the reason; one increment for the
  summary count; one new field on `EMPTY_SUMMARY`.
- `frontend/src/lib/leak/index.test.ts` (modified): six new tests in a
  new `describe("Step 27 — unclear ownership ...")` block.
- `frontend/src/lib/dashboard/derive.test.ts` (modified): one field
  on the test `summary` helper's `Partial<{ ... }>` parameter and on
  the literal; no behaviour change.
- `frontend/src/lib/step34-hardening.test.ts` (modified): one field on
  the literal; no behaviour change.
- `frontend/src/lib/merchant-detail/index.test.ts` (modified): one
  field on the literal; no behaviour change.
- `frontend/src/lib/persistence/index.test.ts` (modified): one field
  on the literal; no behaviour change.
- `frontend/src/lib/persistence/readable.test.ts` (modified): one
  field on the literal; no behaviour change.
- `frontend/src/lib/report/index.test.ts` (modified): one field on the
  literal; no behaviour change.
- `frontend/src/lib/report/step17.test.ts` (modified): one field on
  two literals; no behaviour change.
- `frontend/src/lib/report/view.test.ts` (modified): one field on the
  shared `REVIEW_SUMMARY` constant; no behaviour change.
- `docs/STEP-27-report.md` (this report).

## 18. Remaining gaps (deferred deliberately)

- The landing-page mock "Unknown SaaS — New recurring charge" is a
  *recurring* finding, not an *unclear-ownership* signal. The new
  reason surfaces a *different* kind of "vendor without owner":
  recurring + unknown classification, not new vs. established. A
  future copy pass can decide whether to swap the landing example.
- Multi-file / cross-source deduction (Step 5 A3) is the third and
  last landing claim the engine cannot back; it is a separate, larger
  change and remains out of scope here.
- Real-user copy review of the new reason ("vendor the engine could
  not identify" vs. "vendor without an obvious owner") — the loop is
  proxy-based; the cheapest honest label is INFERRED.

## 19. P0 / P1 / P2

- P0: none.
- P1: none.
- P2 (deferred): A3 (multi-file / cross-source); landing copy
  reconciliation for the unclear-ownership kind; real-user copy test
  of the new reason wording.

---

## STEP 27 STATUS

**PASS** — unclear-ownership review signal implemented as an additive
`ReviewReasonType` and a single `unclearOwnershipCount` summary field;
six new tests (843→849 FE, backend unchanged at 46/46); all gates
green; report covers all brief sections; evidence labeled
VERIFIED/INFERRED/NOT TESTED. Commit: NO · Push: NO. Recommend
(Step 28): Phase B — Playwright E2E + `@axe-core/playwright` harness
in CI. The unit and integration coverage is now strong; the next
honest step is real-browser proof.
