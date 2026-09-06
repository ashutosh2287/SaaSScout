# Phase 18 — Period-over-Period Audit Intelligence

Status: COMPLETE — comparison feature measured against explicit ground truth (local claims boundary: no commit, no push, no branch; all implementation changes left uncommitted for review).

## 1. Phase 18 goal

Answer the audit question **“What changed in my software/recurring spend between two periods?”** for five defined semantics — new recurring charge, ended recurring charge, material price change, frequency change, and software-merchant appearance/disappearance — using existing normalized merchant identity and recurring signals, measured against explicit ground truth.

Scope discipline (non-negotiable, observed): no auth, accounts, payments, DB, cloud storage, bank APIs, Plaid, AI/LLM, analytics, backend transaction data, fabricated savings/waste/confidence, mock-only analytical findings, unrelated refactors, or generic hardening. No overlap detection (deferred by investigation). Local-first architecture, report schema/version, deterministic analysis, existing classifications, existing recurring logic, privacy and UX/a11y all preserved.

Verdict: **VERIFIED** — the feature works, ground truth is measurable (precision 1.0, recall 1.0 on 18 adversarial scenarios), absence-of-evidence is handled honestly, and no regressions were introduced.

## 2. Method — agentic loop (phases 0–13)

| Phase | Name | Output |
|---|---|---|
| 0 | Baseline | git state, test/lint/typecheck/build numbers |
| 1 | Data model trace | comparable input = two `SasscoutReport`s; window from existing `quality.date` (no schema change) |
| 2 | Comparison semantics | 5 rule classes + thresholds + cadence map + cycle-coverage tiers in `compare/constants.ts` / `types.ts` |
| 3 | Ground-truth dataset | 18 controlled binary scenarios with expected findings + suppression contracts |
| 4 | Engine | `compare/engine.ts` implementing all 5 rules with evidence + confidence + suppression |
| 5 | Measurement | `measure.test.ts`: precision/recall + per-scenario assertions |
| 6 | Adversarial unit tests | window / cycles / interval helpers + ordering guard |
| 7 | UX | `/analyze/compare` page + `ComparePanel` + “Compare two periods” entry point |
| 8 | Privacy regression | outbound-network / storage / console audit of comparison code |
| 9 | Browser QA | real UI: upload 2 files → analyze → save ×2 → compare → verify findings |
| 10 | Full regression | frontend 649 + backend 46, lint, typecheck, build |
| 11 | Honesty review | absence-of-evidence vs evidence-of-absence, trust-language guardrail |
| 12 | Product value check | feature materially improves the audit question |
| 13 | Deliverable | this report (untracked) + STATUS block |

## 3. Baseline (Phase 0)

- Git: `main` @ `e7293fa`; working tree already carried Phase 17 uncommitted changes (modified README, Philosophy.tsx, classification/dictionary.ts, merchant/dictionary.ts; untracked docs + benchmark + coverage test).
- Frontend: **621 tests / 29 files** pass; lint clean; `tsc --noEmit` clean; `next build` OK.
- Backend: **46 tests** pass; lint clean; `tsc` clean.
- Environment: Windows 11, PowerShell 7, chromium-1228 headless available (no Playwright dependency), remote debugging via raw CDP.

Verdict: **VERIFIED**.

## 4. Data model — what we compare (Phase 1)

Comparable input is two saved `SasscoutReport` snapshots (the only artifact IndexedDB ever stores — transactions are never persisted). Each merchant entry carries `normalizedKey`, `softwareStatus`, `recurring` (status/interval/typicalAmount/amountProfile), and `totalSpend`. Recurring-signal semantics and thresholds are reused from `recurring/constants.ts` (`PRICE_CHANGE_MIN_RELATIVE`, amount tolerance, `MIN_PAYMENTS`, interval windows).

The statement window each report covers comes from the **existing optional `quality.date.earliest/latest`** — populated since Phase 0 — with a dawn fallback to `file.name`/`generatedAt` for reports saved before window capture. **No schema change; backwards compatible.**

Verdict: **VERIFIED**.

## 5. Comparison semantics — the five rules (Phase 2)

Implemented in `compare/engine.ts` with named thresholds in `compare/constants.ts`:

1. **New recurring charge** — recurring with a concrete interval in the current period and absent from the baseline. Absence is evidence-gated (see §6). Confidence high only when the baseline window covers ≥ 2 expected cycles and the current pattern is `likely_recurring`.
2. **Ended recurring charge** — recurring with a concrete interval in the baseline and absent from the current period, gated on the current window covering ≥ 1 expected cycle (high: ≥ 2 cycles). A merchant *still present but no longer recurring* is **never** claimed ended (see §11) — recorded as insufficient evidence.
3. **Material price change** — both patterns interval-bearing with `typicalAmount > 0`; fires only when relative change ≥ `MATERIAL_PRICE_MIN_RELATIVE` (0.15, reused from the engine’s own threshold) **and** absolute change ≥ $1.00. High confidence when both sides are `likely_recurring` and `highly/moderately_stable`; variable amounts cap at medium and add an “approximate” evidence note.
4. **Frequency change** — intervals differ between periods; annualized dollar delta reported when both typical amounts are known.
5. **Merchant appeared / disappeared** — software-status merchants present in only one period but **not** recurring; deliberately informational at low confidence (presence change is not proof of a subscription started or stopped).

Rules 3, 4 and 5 gate on `softwareStatus === "software"` only — uncertain merchants (e.g. Amazon) can never produce a confident finding.

Verdict: **VERIFIED** against the ground-truth suite.

## 6. Core honesty model — absence of evidence ≠ evidence of absence (Phase 2/11)

New/ended recurring claims require the observing window to capture at least one expected cadence cycle (`ABSENCE_EVIDENCE_MIN_CYCLES = 1`; `STRONG_CYCLES = 2` for high confidence). A window that cannot cover a full cycle — or has no usable dates — **suppresses** the hypothesis into `insufficientEvidence` with a human-readable reason, never a confident finding. Rationale inherited from Phase 17: scripts compare two prefix-informational findings (“merchant present earlier, absent now; not proof of a subscription”) — the comparison must not imply subscription truth these cannot support.

The UI renders these prominently as “Not enough evidence to tell”, restating that absence of evidence is not proof of a change.

Verdict: **VERIFIED** — enforced in code and exercised by ground-truth scenarios 9–11, 18.

## 7. Ground-truth dataset (Phase 3)

`compare/dataset.ts` defines 18 controlled pairs of transaction sets with an explicit contract per scenario (expected findings with confidence floors, kinds that must NOT fire, and suppression records that MUST land in `insufficientEvidence`):

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Genuinely new recurring (absent in complete baseline) | `new_recurring` high |
| 2 | Genuinely ended recurring (absent in complete current) | `ended_recurring` high |
| 3 | Stable subscription both periods | none |
| 4 | Price increase $10 → $15 (+50%) | `price_increase` high |
| 5 | Price decrease $15 → $10 (−33%) | `price_decrease` high |
| 6 | Insignificant fluctuation $10 → $10.50 (+5%) | none (must stay under threshold) |
| 7 | Frequency change monthly → quarterly | `frequency_change` |
| 8 | Merchant alias change (SLACK TECHNOLOGIES INC → SLACK) | none (same identity) |
| 9 | Missing transaction in current (Jan+Mar, Feb absent) | none; suppressed `ended_recurring` |
| 10 | Partial-period current window (~13 days) | none; suppressed `ended_recurring` |
| 11 | Partial-period baseline window (~10 days) | none; suppressed `new_recurring` |
| 12 | Refund noise (subscription intact + refund identity) | none |
| 13 | Ambiguous merchant (Amazon, uncertain) | none (even at +24%) |
| 14 | Non-software recurring (grocery) | none |
| 15 | Irregular one-off software spend absent in current | `merchant_disappeared` low |
| 16 | One-off in baseline becomes recurring | `new_recurring` (medium transition) |
| 17 | Identical periods | none |
| 18 | Delayed charges (cadence wobble) | none; no false `ended` |

Each report is built through the **real production pipeline** (parse-snapshot → quality → normalize → classify → recurring → software aggregate → review → `buildReport`), not hand-mocked merchants — so the measurement covers the engine in situ.

Verdict: **VERIFIED**.

## 8. Measurement — precision/recall (Phase 5)

`measure.test.ts` scores every scenario’s emitted findings against its contract and asserts floors:

```
tp=7  fp=0  fn=0  precision=1.000  recall=1.000  suppressed=5
```

- The 7 true positives: new-recurring (1), ended-recurring (1), price-increase (1), price-decrease (1), frequency-change (1), irregular-disappear (1), one-off→recurring (1).
- **0 false positives, 0 false negatives across 18 scenarios**, including the four adversarial no-fire cases (insignificant fluctuation, alias, ambiguous merchant, non-software).
- The 5 suppression records, each honest and accounted for: missing-month `ended_recurring` netflix; partial-current window `ended_recurring` netflix + spotify (the current window is too short to prove *any* absence); partial-baseline window `new_recurring` netflix + spotify.
- Confidence floors enforced: new/ended/price high, appearance low, transition medium.

Verdict: **VERIFIED** — feature is measurable with a pass/fail contract that will catch regressions.

## 9. Adversarial cases (Phase 6)

`engine.test.ts` unit-tests the helpers the rules depend on: `windowOf` (days from `earliest/latest`, null-safe), `cyclesCovered` (fractional cycles, zero-day → 0, unknown → null), `concretePeriodDays` (weekly 7 / monthly 30 / quarterly 90 / annual 365 / irregular null), and the ordering guard (baseline starting after current flips `ordered`, adds a `caution`, and yields no findings).

The adversarial behaviors themselves (missing transaction, partial windows, refund, alias, delayed charge, ambiguous, non-software) are exercised end-to-end through the ground-truth suite in §7/§8.

Verdict: **VERIFIED**.

## 10. Engine implementation (Phase 4)

`compare/engine.ts` — pure, deterministic, no I/O, imports engine-own thresholds. Per merchant key: both-present branch (price → frequency → same-cadence stable → one-off→now-recurring → pattern-ended-suppression), absent-from-current branch (ended or disappeared), absent-from-baseline branch (new or appeared). Findings carry `kind`, `merchantKey/Name`, `confidence`, evidence list with message per point, and `impact.monthlyDelta/yearlyDelta` (null where the delta cannot be stated). `ComparisonResult` exposes `baseline`/`current` `ReportRef`s (label + window), `ordered` + `caution`, `findings`, `suppressed`, and `insufficientEvidence`.

No exported complexity beyond what the UI and tests consume.

Verdict: **VERIFIED**.

## 11. Honesty review (Phase 11)

- **Presence-change is never subscription-truth**: appeared/disappeared findings carry the explicit evidence “presence change — not proof of a new subscription” / “may simply be a one-off that did not repeat”, capped at low confidence.
- **“Pattern ended, spend continues” is never claimed** (`ponytail:` marker documents the tradeoff): at report level, Jan+Mar charges over a Jan–Mar window are indistinguishable from a genuinely broken cadence. Recording it as insufficient evidence is the honest answer; the upgrade path (transaction-level charge dates) is documented next to the rule.
- **Uncertain merchants can’t fire**: Rule 3/4/5 gate on `softwareStatus === "software"` — the debug run that attempted a +24% Amazon price increase correctly produced nothing (§7 #13).
- **Trust-language guardrail** (`trust-language.test.ts`) scans `components/analyze` for unsupported savings/waste/guarantee/cancel copy; the new panel’s copy passes (“A quiet period is a genuine result”, deltas hedged with “would add roughly”, “Now roughly”). `privacy/safety.test.ts` also green.
- UI throughout uses the source of truth (evidence + confidence), never a savings/waste framing.

Verdict: **VERIFIED**.

## 12. Privacy regression (Phase 8)

Comparison code audited for `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `console.log`, `navigator`: **zero hits in the engine, formatting helpers, panel and page** (only test files log, for the measurement table). `ComparePanel` reads saved analyses solely via the local IndexedDB repository (`listAnalyses`); `compareReports` is a pure function. Nothing new touches the network.

Verdict: **VERIFIED**.

## 13. Browser QA (Phase 9)

Raw-CDP Chromium session driving the real app on `localhost:3000` (backend off; the known “Service unavailable” /health banner appeared and analysis still functioned client-side):

1. Upload `qa-baseline.csv` (Jan–Mar 2026: Spotify, Netflix $10, Slack monthly; Amazon x2; grocery) → Continue → report → Save analysis.
2. Upload `qa-current.csv` (Apr–Jun 2026: Spotify, Netflix $15, Slack, new Canva $12.99 monthly; Amazon; grocery) → Continue → report → Save analysis.
3. Saved analyses → **Compare two periods** → `/analyze/compare` picks baseline and current.
4. Result rendered correctly:
   - **New recurring charge — Canva — High confidence** → “would add roughly $158.04 per year”, evidence: absent in baseline window 2026-01-03→2026-03-15, current monthly cadence, baseline window covers ≥ 2 cycles without it.
   - **Price increased — Netflix — High confidence** → “Now roughly +$5.00 per month, +$60.83 per year”, evidence $10.00 → $15.00.
   - No spurious findings for Spotify/Slack (stable), Amazon (uncertain), grocery (non-software).

QA round-trip (upload → analyze → report → save → reopen via IndexedDB → compare) is fully verified in the browser.

Verdict: **VERIFIED**.

## 14. Full regression (Phase 10)

- Frontend: **649 / 649 tests (31 files)** — 621 pre-existing + 28 new compare tests (9 units + 19 ground-truth). Lint clean. `tsc --noEmit` clean. `next build` OK (7 routes, `/analyze/compare` added).
- Backend: **46 / 46 tests**; `tsc` clean; untouched this phase.
- Guardrail suites (`trust-language`, `privacy/safety`) green within the 649.

Verdict: **VERIFIED**.

## 15. Product value check (Phase 12)

The feature answers the audit question directly: from two saved reports the user learns, with evidence, that a subscription started, one ended, a price stepped up, a cadence shifted, or a software merchant appeared/disappeared — and, critically, which candidate changes are **unprovable** with the data and why. The honest-suppression layer (most of the surface area in this phase) is what keeps the answer trustworthy: quiet periods are reported as quiet, uncertain cadence breaks are reported as uncertain. This is a material improvement over diffing two reports by eye (alias changes, insignificant fluctuations, refund noise and partial windows are all handled).

Verdict: **VERIFIED** within the measured scope. Confidence in real-world recall is **INFERRED** (see §16/§17).

## 16. Known limitations (UNKNOWN / deliberately reduced recall)

- **`pattern ended, spend continues`** is always suppressed (§11) → real cadence drifts to occasional are underreported by design (recall cost accepted for false-positive protection). Upgrade path documented.
- **Real-world delayed/implicit charges** — the delayed-charge scenario #18 passes (no finding, no false `ended`), but real statements with bank-imposed charge smoothing will occasionally evade interval detection; behavior on unseen data is **UNKNOWN**.
- **Multi-plan merchants** — per-merchant single-interval model (as in the shared recurring engine); two subscriptions to one merchant merge. Pre-existing design, unchanged.
- **Window provenance** — reports saved before `quality.date` existed fall back to null-window and suppress rather than guess; the number of historical affected records is **UNKNOWN** (fresh analysis always captures the window).

## 17. Recommendations (RECOMMENDATION)

1. Transaction-level comparison (`firstSeen`/`lastSeen` + per-charge gaps) to claim cadence breaks at medium confidence (§16) and to compute exact period-over-period deltas rather than cadence-annualized estimates.
2. Surface window-adequacy *before* comparing (a “your current window may not cover the cadence” hint in `ComparePanel`) — today the suppression reason explains it after the fact.
3. Export/print the comparison (CSV or markdown) for audit hand-offs; comparison results stay ephemeral this phase by design.
4. Optional: store `file.name`-resolved two-analyses quick-compare from the saved list (one-click “compare with previous”) — entry point already exists; a shortcut is a UX nicety, not a gap.

## 18. Files changed

Created (all untracked, under `frontend/src/` unless noted):
- `lib/compare/types.ts` — comparison model, findings, suppression records, `ReportRef`.
- `lib/compare/constants.ts` — thresholds, cadence map, cycle tiers.
- `lib/compare/engine.ts` — rules engine (pure).
- `lib/compare/format.ts` — kind labels, confidence labels, threat-delta wording, window text.
- `lib/compare/dataset.ts` — 18-scenario ground truth.
- `lib/compare/engine.test.ts` — helper/ordering units (9 tests).
- `lib/compare/measure.test.ts` — precision/recall contract (19 tests).
- `components/analyze/ComparePanel.tsx` — pickers + result view (insufficient-evidence section included).
- `app/analyze/compare/page.tsx` — `/analyze/compare` route.
- `docs/PHASE-18-PERIOD-COMPARISON-REPORT.md` — this report.

Modified:
- `components/analyze/ComparePanel.tsx` (within created), `app/analyze/saved/page.tsx` — “Compare two periods” entry link when ≥ 2 saved analyses exist.

No schema version change; no persistence-layer change; no backend change.

## 19. Scope compliance audit

| Guardrail | Status |
|---|---|
| No auth / accounts / payments / DB / cloud / bank APIs / Plaid / AI | **VERIFIED** — none introduced |
| No fabricated savings/waste/confidence | **VERIFIED** — trust-language + evidence-honest copy |
| No mock-only analytical findings | **VERIFIED** — all findings from engine; ground truth is measurement, not UI decoration |
| No overlap detection (deferred) | **VERIFIED** — not touched |
| Local-first + privacy | **VERIFIED** — zero outbound from comparison code |
| Report schema/version untouched | **VERIFIED** — reuses `quality.date` |
| Deterministic | **VERIFIED** — pure function, no I/O |
| No regression | **VERIFIED** — 649 frontend + 46 backend, lint/tsc/build clean |

## 20. Phase 18 status

**VERIFIED** overall. Goal met within scope; feature measurable (precision 1.0 / recall 1.0 on 18 adversarial scenarios); absence-of-evidence handled honestly; UX evidence-honest; privacy intact; no regressions.

```
PHASE 18 STATUS
baseline=621/29; 46
comparison_module=types,constants,engine,format,dataset (+tests)
rules=5 (new_rec, ended_rec, price, frequency, appearance)
scenarios=18
true_positives=7
false_positives=0
false_negatives=0
precision=1.000
recall=1.000
suppressed_insufficient=5
adversarial_handled=missing-month,partial-windows,delayed-charge,refund,alias,ambiguous,non-software
absence_evidence_min_cycles=1
absence_evidence_strong_cycles=2
price_min_relative=0.15
price_min_abs_dollars=1.00
ux_route=/analyze/compare
privacy_compare=0_outbound
browser_qa=passed (new recurring Canva + price increase Netflix verified)
frontend_tests=649/649
backend_tests=46/46
lint=clean
typecheck=clean
build=clean
report_schema=unchanged
comparison_persisted=no (ephemeral by design)
cs_end_corners_cut=1 (pattern-ended-spend-continues always suppressed, ponytail-marked)
recommended_phase_19=transaction-level-gap-evidence;window-adequacy-hint;compare-export;backfill-old-saved-windows
implementation=10 new, 1 modified
commit=no
push=no
```