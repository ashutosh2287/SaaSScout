# STEP 22 — Actionability & Decision-Value Loop

**Date:** 2026-09-06
**Baseline / HEAD:** `f55bf4c` ("Step 21: trust and classification hardening"), main clean at start.
**Suites:** `compare/prioritize.test.ts` (new, 9) · `step22/actionability.test.ts` (new, 6).
**Result: frontend 772/772 (39 files) · backend 46/46 (12 suites) · tsc clean · lint clean · `next build` clean (15 routes)**
**Commit: NO · Push: NO** (Step 22 changes left uncommitted per phase rule)

---

## 1. Objective

Run the agentic ask-and-verify loop on a single question — *"given a fresh statement,
does the product present the decision-relevant signal first, and does it tell the
owner what to do next?"* — with deterministic fixtures, one selected bottleneck, a
minimum fix, and hard before/after numbers. Must not add analytics, telemetry, cloud,
accounts, a database, AI/LLM, or transaction-side changes; presentation /
decision-support only.

## 2. The journey map (as-built, from code not prose)

`choose file` → `parse/quality/preview` → **DashboardMetrics** (totals) →
**ReviewQueue** (flagged software, status → estimated-monthly-desc) →
**RecurringCard** (the recurring reality) → **SoftwareBreakdown** (by total spend) →
**quality card** → **transaction preview/export/save** → (saved) →
**ComparePanel** (baseline vs current findings, kind → name order) →
**MerchantDetailPanel** (expand → investigation with high/medium/low + check actions,
but only reachable via one merchant at a time).

## 3. Where the decision is made — and where it is lost

- **Review queue** (`dashboard/derive.ts` `compareReviews`): strong-review first,
  then by est. monthly desc, filterable, sortable. Clean, high-value monthlies land
  on top.
- **Comparison** (`compare/engine.ts` ~L600): findings are ordered by **kind, then
  merchant name** (`kindOrder`), and carry **no next step**. The computed impact
  (`impact.yearlyDelta`) exists but decides nothing about presentation.

## 4. Measurement design (deterministic, synthetic)

- New `step22/scenario.ts`: a 12-month SMB statement, `2025-07-01..2026-06-30`
  (baseline = first 6 months, current = last 6), **6,249 rows**, PRNG-seeded
  (`mulberry32(20260906)`) — byte-for-byte reproducible across runs.
- Software universe (**dictionary/signal-backed**, so classification rides the real
  pipeline): big monthlies github 299 / adobe 250 / microsoft 210 / shopify 190 /
  zoom 165 / canva 150 / notion 140 / dropbox 135; **price steps** openai 420→530
  (+110/mo, the single largest change in the file), hubspot 320→380, google
  workspace 50→75, netflix 15.49→22.99, figma quarterly 45→54; mids slack / trello /
  spotify / office 365; **atlassian ends** (80/mo) and **salesforce starts** (60/mo);
  irregular & ambiguous edges (aws, amazon, paypal, "online subscription"); 28
  weekly non-software bulk vendors (grainger, uline, staples, …) as noise.
- Ground truth (evidence-aware, never pure "highest amount"):
  **HIGH_VALUE_REVIEW_KEYS** (est. monthly ≥ $100) and **HIGH_VALUE_FINDINGS**
  (|yearly delta| ≥ $120) — openai, atlassian, salesforce, hubspot, google workspace.
- Metrics (`step22/metrics.ts`), all labeled
  **PROXY — NOT REAL USER STUDY**: they measure what the product's deterministic
  surfaces present first on this seeded file; no real-human claim.

## 5. Time-to-insight metrics (before → after)

| Metric | Before | After |
|---|---|---|
| Review queue: first high-value item position | 0 (openai) | 0 |
| Review queue: high-value hits in default top 5 | 5 / 5 | 5 / 5 |
| Comparison: most impactful finding's rank | **6 of 7** (last) | **0 of 7** |
| Comparison: ground-truth findings inside top 3 | 2 / 5 | 3 / 3 |
| Comparison: |yearly-delta| captured in top 3 | 41% | **72%** |
| Findings carrying a suggested next step | **0 / 7** | **7 / 7** |
| Review-queue inspection burden (row count) | 47 (18 flagged + 29 noise) | 47 (unchanged) |

## 6. Existing prioritization — PASS / GAP

- **Review-queue prioritization: PASS.** The strongest signals (strong_review,
  est. monthly desc) surface openai/hubspot/github/adobe/microsoft on top —
  5/5 of the top five are high-value.
- **PASS with friction:** the queue is 47 rows here because weekly non-software
  noise, though honestly classified, still fills the "insufficient evidence" tier
  (29 merchants) — the actionable flagged list is only 18. No wrong call, but
  burden is visible (see §15 DEFER).

## 7. Actionability — PASS / GAP

- **GAP (selected bottleneck).** On the comparison surface the owner sees findings
  in kind→name order: `new … salesforce (730)`, `ended … atlassian (973)`,
  `figma (37)`, `… hubspot (730), netflix (91)`, then — **last** —
  the single largest change, `openai +1,338/yr`. 0/7 findings offered anything to
  do next; an impact figure appeared but never decided what was seen first.

## 8. Selected improvement (the minimum fix)

**Make comparison findings decision-ready — presentation-only.**

1. `compare/prioritize.ts` (new) — `prioritizeFindings(findings)`: pure, O(n log n),
   |yearlyDelta| desc → kind order → merchant name; null/NaN/∞ impact sinks to the
   bottom; never mutates input. The engine and its ordering contract are untouched.
2. `compare/format.ts` — `suggestedAction(f)`: a neutral check/confirm next step per
   kind ("Check whether the current plan is still the right tier…"). Never tells the
   owner to cancel. Reuses the investigation layer's check-style language.
3. `ComparePanel.tsx` — renders `prioritizeFindings(result.findings)` and a quiet
   `Next step:` line under each finding.

**Why / evidence / user impact / success metric:** the bottle-need measurement
(§5) proved impact existed but was invisible by rank. Cost of the fix: ~40 lines +
tests. User impact: on a real 7-finding comparison the biggest delta jumps from the
last slot to the first and every finding names a next action. Success metric (locked
in `step22/actionability.test.ts`): `mostImpactfulRank = 0`, top-3 coverage ≥ 3,
impact share ≥ 70%, suggested action on 100% of findings.

## 9. Implementation changes

- `compare/prioritize.ts` (new) · `compare/prioritize.test.ts` (new, 9).
- `compare/format.ts` (`suggestedAction`).
- `components/analyze/ComparePanel.tsx` (presentation order + next-step line).
- `step22/scenario.ts` (new, seed model + 6,249-row generator + ground truth),
  `step22/metrics.ts` (new), `step22/actionability.test.ts` (new, 6).

## 10. Adversarial results

- Empty input → empty; input array never mutated (immutability asserted).
- Ties → kind order, then merchant name (deterministic).
- Null / NaN / +Infinity yearlyDelta → sink to the bottom, stable order.
- High-impact **low-confidence** finding still ranks first (confidence is
  *shown* — badge + evidence — never silently filtered; documented choice).
- Engine semantics preserved: raw engine order remains kind→name (asserted);
  detection, thresholds, suppression, identity layers untouched.
- Scenario integrity: 6,249 rows, deterministic across runs, ≥ 5,000 required.

## 11. Analytical / classification / recurring / comparison / currency drift

- **Zero drift.** Engine, score thresholds (strong ≥ 7 / review ≥ 4), MIN-payment
  rules, classification dictionaries/signals, recurring detection, non-software
  categories, review-queue ordering, and currency rendering are untouched. The
  ordering + action layers are pure functions over already-computed findings.
- Currency: `suggestedAction` carries no amounts; `impactLine` unchanged.

## 12. Performance (presentation ordering, `prioritizeFindings`)

| Findings | Measured |
|---|---|
| 1,000 | 8.8 ms |
| 5,000 | 2.3 ms |
| 10,000 | 4.3 ms |
| 25,000 | 15.0 ms |

O(n log n) sort over the finding list; asserted < 2 s even at 25k (CI-safe budget).
Realistic comparisons hold single-digit findings — negligible.

## 13. Privacy checks

Changed files contain **zero** network calls, storage writes, `console`/env usage,
or third-party hosts (grep-verified). All new logic is pure and local; nothing
leaves the browser. No transaction data is added to any report — findings were
already present.

## 14. Accessibility (verification by inspection — no new interactivity)

- No new focusable/interactive elements: the additions are two plain-text `<p>`
  lines (impact was already text; "Next step:" is the same pattern).
- No icon-only or color-only meaning; contrast inherits existing zinc palette.
- Keyboard/Tab order unchanged; nothing new to reach.
- Responsive: existing `flex-wrap` retained; no fixed widths added.
- Reduced motion: no animation or transition added.

## 15. Feature decisions

- **BUILD NEXT (this step):** impact-first comparison order + neutral next-step
  per finding. Evidence-backed, presentation-only.
- **DEFER (P1):** review-queue noise management — a "hide non-software noise"
  toggle in the queue would cut the 47-row burden to the 18 genuinely flagged
  merchants. Blocked by product judgment (merges into analysis semantics), not by
  feasibility; do it in a dedicated product step.
- **DO NOT BUILD:** cancel/auto-initiate subscription changes, account/token
  storage, price-tier reference data, AI chat, procurement or fintech dashboards.
  SaaSScout remains a local analysis/decision-support tool.

## 16. Hostile self-review (Phase 16)

1. `impactShareTop3` (72%) still leaves a size-based tie (salesforce vs hubspot,
   both 730) resolved by kind order — correct but arbitrary; acceptable.
2. Ordering by |yearlyDelta| ignores direction preference; a low-confidence big
   finding sits on top. Mitigated by the always-visible confidence badge; the fix
   serves *impact*, confidence keeps *informing*.
3. `findingsWithAction` measures that a next-step line is *present*, not that a
   user acted — labeled PROXY, honest ceiling.
4. Scenario deltas (730 vs 720, 973 vs 960) come from the engine's day-based
   annualization — pre-existing, deliberate, unchanged.
5. The whole measurement is synthetic; it licenses the ordering change, nothing
   more.

## 17. Scorecard

| Check | Before | After |
|---|---|---|
| Frontend tests | 757/757 (37 files) | **772/772 (39 files)** |
| Backend tests | 46/46 (12 suites) | **46/46 (12 suites)** |
| tsc / eslint / build | clean | clean |
| Most-impactful finding rank (compare) | 6/7 | 0/7 |
| Findings with a next step | 0/7 | 7/7 |

## 18. Priorities

- **P0:** none open — all fixes landed and asserted.
- **P1:** review-queue noise toggle (§15). Low-hanging, presentation-only.
- **P2:** optional *direction preference* in compare ordering; real-user
  (non-PROXY) validation before any further ordering assumptions.

## 19. Next phase

Step 23 candidate: **the review-queue noise toggle** (P1, §15) — same ask-and-verify
loop: measure the 47-row burden, add a filter that isolates the 18 genuinely
flagged merchants, re-measure queue length & time-to-insight on the same scenario.

## STEP 22 STATUS

- **Baseline / HEAD:** `f55bf4c` (Step 21), main clean.
- **Journey:** home/upload → preview → review queue → recurring → breakdown →
  quality → export/save → compare → merchant detail. Decision bottlenecks: review
  queue (PASS) and comparison (GAP).
- **Bottleneck:** comparison findings ordered by kind→name, impact never deciding
  order, no next step offered. Proven: most impactful finding (openai +1,338/yr,
  the largest change in the file) rendered last (rank 6/7); 0/7 findings actionable.
- **Scenario rows:** 6,249 (deterministic, seeded; software + price steps +
  ended/new + irregular/ambiguous + 28 weekly non-software noise vendors).
- **Time-to-insight:** review first-high-value at position 0; comparison most
  impactful rank 6 → 0; |yearly-delta| share in top 3: 41% → 72%.
- **Existing prioritization:** review queue **PASS** (5/5 top-5 high-value);
  comparison **GAP**.
- **Actionability:** comparison **GAP** (0/7 with a next step) → **PASS** (7/7).
- **Selected improvement:** impact-first presentation order + per-kind neutral
  next-step, presentation-only, engine untouched.
- **Why / evidence:** deterministic measurement (§4-7); single biggest change was
  buried last, nothing actionable.
- **User impact:** owning a real 7-finding comparison now sees the biggest delta
  first and a suggested check on every finding.
- **Min solution:** `prioritizeFindings` (pure sort) + `suggestedAction` (kind →
  string) + two lines in ComparePanel.
- **Success metric:** `mostImpactfulRank = 0`, top-3 high-value coverage ≥ 3,
  impact share ≥ 70%, action on 100% of findings — asserted in
  `actionability.test.ts`.
- **Implementation changes:** `compare/prioritize.ts` (new, 9 tests),
  `compare/format.ts` (+`suggestedAction`), `ComparePanel.tsx`,
  `step22/{scenario,metrics}.ts` + `actionability.test.ts` (new, 6).
- **Adversarial results:** empty/ties/null/NaN/∞ handled deterministically;
  low-confidence-high-impact kept visible (badge informs); engine order contract
  intact; scenario deterministic ≥ 5k rows.
- **Analytical/classification/recurring/comparison/currency drift:** none.
- **Performance (1k/5k/10k/25k):** 8.8 / 2.3 / 4.3 / 15.0 ms, O(n log n).
- **Privacy checks:** zero network/storage/console/env in changed files.
- **Accessibility:** no new focusable/color-only/motion; responsive retained.
- **Test counts:** frontend 772/772 (39 files, +15); backend 46/46.
- **Scorecard:** PASS — every before/after metric improved to its asserted target.
- **P0/P1/P2:** no P0; P1 review-queue noise toggle; P2 direction preference +
  non-PROXY validation.
- **Feature decisions:** BUILD NEXT — comparison decision-readiness. DEFER —
  queue noise toggle. DO NOT BUILD — cancellation automation, tier/catalog data,
  account system, AI chat, finance-dashboard scope.
- **#1 gap going forward:** review-queue noise burden (47 rows vs 18 flagged).
- **Next phase:** Step 23 — review-queue noise toggle (same loop, same scenario).
- **Commit: NO**
- **Push: NO**
- **FINAL VERDICT: PASS** — selected bottleneck proven by measurement, fixed with a
  presentation-only minimum, adversarially tested, fully regressed (772/772 FE,
  46/46 BE), zero drift.