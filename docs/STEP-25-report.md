# STEP 25 - Compact Comparison Summary Band (does a net + kind-count aggregate above the findings list help?)

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Evaluate whether a compact aggregate summary displayed above the comparison findings list materially improves decision comprehension. The band is **pure presentation of aggregates the comparison already computes**: it reuses the existing `findings[]` (kinds + `yearlyDelta`) and does not change any analytical conclusion, scoring, ordering, persistence, or telemetry.

PASS criteria: the aggregate is mathematically correct, currency-aware, deterministic, honest about reversed windows and mixed currencies, adds no new semantics beyond a transparent sum + kind counts, and measurably cheap (single pass, `O(n)`).

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21). Steps 22/23/24 report artifacts and fixtures are present and uncommitted.
- Frontend baseline: vitest 803/803 (41 files); `tsc --noEmit` clean; ESLint clean; `next build` clean.
- Backend baseline: 46/46; ESLint clean; `tsc --noEmit` clean; build clean.
- Baseline re-verified in Phase 1 this step (see §20).

## 3. The comparison surface today (what already exists)

- `runCompare` (betatest/helpers) produces `ComparisonResult { findings, suppressed, insufficientEvidence, baseline, current, caution, ordered }`.
- Findings carry `kind`, `impact.yearlyDelta` (nullable), `confidence`, `evidence[]`.
- UI renders: caution box, period cards, findings list (via `prioritizeFindings`), and an "Not enough evidence" block.
- **Nothing communicates net direction or kind-count magnitude** — the ordering answers "which change is biggest", not "what is the overall picture". That gap is the first rung of the ladder: the summary is new compression, not duplication.

## 4. Hypothesis

Owners (small-business) comparing two periods benefit from a compact aggregate ("13 changes · Net −$6841.72/yr · 7 increases · 3 decreases · 2 new · 2 ended") **if** it is:
1. mathematically correct (simple sum of the same valid deltas, nothing invented),
2. currency-aware,
3. honest (never presents a signed net when window direction is untrusted or currencies differ),
4. deterministic and side-effect free (pure, no mutation, no sorting of input),
5. cheap enough to run on a 25k-finding comparison without jank.

The step-25 acceptance criteria (17, from the loop brief) are mapped to evidence in §5–§11 and confirmed by tests in §10.

## 5. Design (pure, decoupled, honest)

New module `frontend/src/lib/compare/summary.ts`:

- `summarizeFindings(findings)` → `CompareSummary { findingCount, netAnnualizedDelta|null, increaseCount, decreaseCount, newRecurringCount, endedRecurringCount }`.
  - Single `O(n)` pass; reads only `impact.yearlyDelta` and `kind`.
  - `yearlyDelta === null || !Number.isFinite(d)` → excluded from the total (never corrupts it; a delta of exactly `0` IS valid and keeps the net at its true value).
  - Net = sum of valid deltas; `null` when no valid delta exists (never a fabricated number).
  - Direction counts: `>0` increase, `<0` decrease, `0` in neither. `new_recurring` / `ended_recurring` counted by kind.
- `formatSummary(summary, opts)` → compact single-string band. Rules:
  - `opts.ordered === false` → `"{n} changes · window order unclear — verify the periods selected"`; **the net is never rendered** when window direction is untrusted.
  - Currency: uses `isCurrencySymbol(currency)` (existing curated type guard); unknown or missing → default symbol `$`.
  - `opts.currencyMismatch` → appends `(not conversion-adjusted)`; the net is never implied to be a conversion-correct total.
  - Net `0` → `Net $0.00/yr` (no sign); positive → `+`, negative → `−` (U+2212, matching `impactLine` house style; no thousands separator, matching existing engine output like `−$9733.33`); suffix `/yr`.
  - Zero-valued groups are omitted (no `0 increases` / `0 new` noise); pluralization handled (`1 change`).
- Presentation (`frontend/src/components/analyze/ComparePanel.tsx`): a `ResultView`-level `<section aria-label="Comparison summary">` rendered **only when `result.findings.length > 0`** (the existing "No material changes detected" empty state is untouched). `currencyMismatch` is computed in ComparePanel from `baseline.report.currency !== current.report.currency` (both non-null). The band sits above the prioritized findings list; the list itself is byte-for-byte unchanged.

## 6. Where the numbers come from (no new semantics)

The band is a **transparent sum + kind tally of the exact values already on screen** in the findings list. No scoring, thresholds, classification, discounting, or new labels were added. A user can verify any band number against the list below it by hand. This is the "compression without fabrication" test, and it passes by construction and by the §10 integration test against instrumented ground truth.

## 7. Honesty / false-certainty guardrails

| Risk | Guard | Evidence |
|---|---|---|
| Reversed/uncertain window shows authoritative total | `ordered === false` → no net rendered, explicit caveat string | Test M (§10) |
| Mixed currencies summed as if comparable | `(not conversion-adjusted)` label; never claimed equal | Test L (§10) |
| Null/NaN/Infinity poisoning the total | rejected from sum; net `null` if none valid | Tests G, H/I (§10) |
| Zero net shown as signed | `Net $0.00/yr`, no sign | Test E (§10) |
| Group counts invented | derived from the same `kind` field the list renders | by construction |
| Fabricated total on empty | band only renders when `findings.length > 0`; empty model is `0 changes` separate from the UI empty state | §13 |

## 8. Scope discipline (what was NOT changed)

- No backend change (backend suite/lint/tsc/build untouched and green).
- No change to engine, `prioritize.ts` (ordering), `format.ts` (`impactLine`, `suggestedAction`), analyze metrics, dashboard, persistence, or saved-view schema.
- `ComparePanel.tsx`: presentation-only delta — new imports, a `currencyMismatch` prop on `ResultView`, and the summary `<section>`. Findings list JSX unchanged.
- No new dependencies (component-render harness does not exist in the repo; the JSX is a thin shim over pure, fully-tested functions — screenshot/axe QA is out of scope for a CLI loop, see §16).
- `step22/scenario.ts` untouched (Step 23's queue-split assertions depend on it).

## 9. Ground truth

- **Instrumented**: `step24/scenario.ts` (13 findings, 8 kinds — slack ended −9733.33 vs salesforce new +1460 vs ... −6841.72 net, 7 increases, 3 decreases, 2 new, 2 ended) is reused to pin the aggregate to measured engine output (Test A, both model and presentation).
- **Synthetic**: hand-built findings for all-lower, all-upper, cancelling, zero-delta, null-delta, NaN/±Inf, singular, and large-N cases.
- PROXY — not a real user study; UI benefit is judged by correctness + the fact that the info is genuinely new compression.

## 10. Tests added (20, `frontend/src/lib/compare/summary.test.ts`)

| Case | Asserts |
|---|---|
| A | step24 scenario: findingCount 13, net −6841.722 (closeTo 2dp), inc 7, dec 3, new 2, ended 2 |
| B | empty → all-zero model, net null |
| C | all positive: sum + increase count |
| D | all negative: sum + decrease count |
| E | +100/−100 cancels to exact `$0.00`, no sign |
| F | zero delta is valid, in neither direction |
| G | null deltas excluded; all-null → net null |
| H/I | NaN & ±Infinity excluded, don't poison net |
| N | ±85.17 same magnitude stays exact |
| O | 25k findings → exact aggregate, single pass, perf asserted `<50ms` (measured 0.99ms) |
| P/Q/R | deterministic, immutable, order-preserving |
| A-pres | exact band string `13 changes · Net −$6841.72/yr · 7 increases · 3 decreases · 2 new · 2 ended` |
| B-pres | `0 changes` |
| 1-pres | `1 change · Net +$5.00/yr · 1 increase` (singular/plural) |
| E-pres | cancelling net → `Net $0.00/yr` |
| G-pres | all-null → `2 changes` (no net segment) |
| J | `€` honored |
| K | unknown / null currency → `$` |
| L | mismatch → `(not conversion-adjusted)` |
| M | `ordered:false` → caveat, no `Net`, no `$` |

## 11. Adversarial results (phase-5 cases A–T)

Cases A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R → **implemented and passing** in §10. Cases S (saved-view rendering) and T (unchanged-state re-render) → verified **by inspection**: the band lives inside `ResultView`, which renders the same `ComparisonResult` wherever compare results render (including saved views); it is derived each render and holds no state, so `re-render` and `saved-view` paths cannot diverge. No adversary produced a case where the band invents, mislabels, or double-counts.

## 12. Determinism & non-mutation

`summarizeFindings` and `formatSummary` are pure. Test P/Q/R deep-equal two runs, assert the input array and its elements are unchanged (structuredClone comparison), and assert input order is untouched after summarization. The band cannot affect ordering (`prioritize.ts` is not called by the summary).

## 13. Empty state / zero-change interplay

- `findings.length === 0` → existing "No material changes detected" empty state renders; the band does not (no `0 changes · Net ...` noise).
- The model's `0 changes` string is only reachable when rendering an explicit empty summary, which the UI does not do.

## 14. Currency behavior (VERIFIED)

- Recognized symbols (via existing `isCurrencySymbol`; curated set `$ € £ ₹ ₩ ₽`) render as-is.
- Unknown/missing → `$`.
- Cross-currency comparison → label `(not conversion-adjusted)`, verifiable by tests K and L against the same instrumented scenario.

## 15. Responsive behavior (INFERRED)

Single block-level `<p>` inside a bordered section; the band is one short text line that wraps natively. Inspector review at 320px (smallest target): string length ≈ 60 chars at `text-sm`, wraps onto two lines at worst; no fixed widths, no horizontal overflow risk. 375/768/1024/1440 use available width normally. (INFERRED — no browser harness in repo; see §16.)

## 16. Accessibility (INFERRED / NOT TESTED)

- Band is plain readable text (`text-emerald-900` on `emerald-50/70` — the emerald tint is decorative; meaning is carried by the words, not color alone).
- Landmark/region for screen readers: `<section aria-label="Comparison summary">`.
- Not inside the findings `<ul>`, so list semantics of the findings are preserved.
- **NOT TESTED**: no axe/browser QA harness exists in the repo and no new dependency is permitted by the loop; focus order, screen-reader verbosity, and visual contrast were reviewed by inspection only (INFERRED).

## 17. Privacy / security (VERIFIED)

- Grep on all changed files for `raw|account|iban|card|password|token|secret|ssn|bank|cvv` → no privacy-sensitive data. The band's inputs are `yearlyDelta` and `kind` (already displayed on-screen per finding); no raw transactions, identifiers, or credential material enter the summary.
- No storage, network, or telemetry additions; the band is derived in-memory at render time.

## 18. Performance (VERIFIED)

Single `O(n)` pass over `findings`, no allocation beyond one result object; not memoized (25k findings is sub-millisecond, memoization would be the over-engineering).

| n | summarizeFindings |
|---|---|
| 100 | <0.05 ms (single pass, instrumented same code path) |
| 1k | ~0.05 ms (linear, projected from measured single-pass slope) |
| 5k | ~0.2 ms (same linear slope) |
| 10k | ~0.4 ms (projected) |
| 25k | **0.99 ms measured** (Test O, bound asserted <50 ms) |

(`n→∞` is linear by construction; only the 25k point is directly measured; smaller-n figures are that linear slope.)

## 19. Analytical / classification drift

None. Engine, comparison rules, `prioritize.ts`, and format helpers unchanged; ComparePanel diff is presentation-only. Test A re-derives the aggregate from the *live* engine via `runCompare`, proving the band's numbers equal the engine's own outputs (no drift between what is analyzed and what is summarized).

## 20. Full regression (VERIFIED)

- Frontend: vitest **823/823 (42 files)** → 803 baseline + 20 new; ESLint clean; `tsc --noEmit` clean; `next build` clean.
- Backend: 46/46; ESLint clean; `tsc --noEmit` clean; build clean. (Backend untouched.)
- One transient failure appeared during a run started back-to-back with the isolated summary run (concurrent vitest processes); an immediate solo re-run passed and repeated solo runs passed 3× — treated as test-runner concurrency noise, not a product regression. Flagged here rather than silent.

## 21. Stop-condition review (phase 10)

Loop stop conditions re-checked: (a) no existing aggregate anywhere (grep over `frontend/src` for summary/net symbols → none); (b) no untrusted authoritative total introduced — reversed-window and multi-currency cases are explicitly caveated; (c) no analytical semantics added — pure count + sum; (d) regression gates green. → **No stop condition met; feature qualifies as PASS.**

## 22. Product decision

**PASS — ship the band.** Rationale: it is the first and only aggregate on the compare surface (ladder rung 1: the need was real); it is a transparent, hand-verifiable sum of values already shown; it is cheap, deterministic, and honest by construction and by test. Rejected alternative deliberately NOT done: rendering a severity/judgment engine *into* the band (would add semantics the loop forbids).

## 23. Files changed

- `frontend/src/lib/compare/summary.ts` (new): `summarizeFindings`, `formatSummary`, `CompareSummary`.
- `frontend/src/lib/compare/summary.test.ts` (new): 20 tests.
- `frontend/src/components/analyze/ComparePanel.tsx` (modified): summary section + `currencyMismatch` prop.
- `docs/STEP-25-report.md` (this report).

## 24. Remaining gaps (deferred deliberately)

- Real-user study of "does the band change a decision" (loop is proxy-based; cheapest honest label is INFERRED).
- axe/browser/screenshot QA and keyboard-focus visual check in a real browser (no harness exists; added when the project has one).
- Thousands separators in monetary strings (the engine's existing `impactLine` emits none; matching house style — separators would be a cross-cutting change, budget separately).

## 25. P0 / P1 / P2

- P0: none.
- P1: none.
- P2 (deferred): browser a11y harness; banner copy if user research shows owners misread net as "total bill delta" (band says "/yr" and derives from listed findings, but this is the one semantic a real user could over-read — worth a follow-up two-line copy check).

---

## STEP 25 STATUS

**PASS** — compact comparison summary band implemented as pure presentation over existing findings; 20 new tests (803→823 FE, backend unchanged at 46/46); all gates green; report covers all brief sections; evidence labeled VERIFIED/INFERRED/NOT TESTED. Commit: NO · Push: NO. Recommend (Step 26): a two-line copy/label test of the band ("Net …/yr") with two naive owners, or the deferred browser a11y pass — whichever the loop prioritizes next.