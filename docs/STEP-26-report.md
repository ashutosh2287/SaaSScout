# STEP 26 — Intra-Period Overlap Detection

**STATUS: PASS** (implemented) — Commit: NO · Push: NO

---

## 1. Objective

Close the only remaining landing-page claim the engine could not back: "two
distinct recurring software tools in the same category". The Step 5 backlog
named this as `possible_overlap`; the Hero mock has shown "Slack + Teams
Possible overlap" since the landing transformation, but `compareReports`
emitted nothing of the kind. After Step 26, the engine emits it from a single
deterministic, curatable signal (shared `SoftwareSubcategory`) and never
from invented text similarity.

PASS criteria: the finding is mathematically deterministic, the gates are
all positive (both merchants must be software, both must be interval-bearing
recurring, both must share a curated subcategory), the eligible-subcategory
list excludes categories where having multiple vendors is normal, the
output is non-mutating and stable across runs, and the engine-test contract
is preserved (the existing 13 cross-period findings are unchanged).

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21). Steps 22–25 report artifacts and
  fixtures are present and uncommitted.
- Frontend baseline: vitest 803/803 (41 files); `tsc --noEmit` clean;
  ESLint clean; `next build` clean.
- Backend baseline: 46/46; ESLint clean; `tsc --noEmit` clean; build clean.
- Baseline re-verified in Phase 1 of this step (see §15).

## 3. The surface today (what already exists)

- `compareReports` emits 8 cross-period finding kinds via the per-merchant
  loop in `engine.ts`: `new_recurring`, `ended_recurring`, `price_increase`,
  `price_decrease`, `frequency_change`, `pattern_irregular`,
  `merchant_appeared`, `merchant_disappeared`.
- Each finding is one-merchant-shaped (`merchantKey`, `merchantName`).
- `prioritizeFindings` sorts by `|yearlyDelta|` desc, ties by kind then name.
- The Hero and DashboardPreview mocks rendered "Slack + Teams Possible
  overlap" with explicit "Illustrative preview / not an actual analysis"
  labels (added in Step 3B) so the trust gap was bounded but not closed.
- A second-period P0 from `PRODUCT-READINESS-AUDIT.md §7`: "landing page
  mock data + README over-claim capabilities the engine lacks (overlap,
  new-recurring-charge, vendor-without-owner)". This step closes the
  `overlap` half of that claim.

## 4. Hypothesis

Owners reviewing their software subscriptions benefit from a real "you are
paying for two recurring tools in the same category" signal **if** it is:

1. Curated — only emitted for vendor pairs in a small, named subcategory
   map; no text-similarity invention.
2. Conservative — only emitted when both merchants are software-classified
   AND both carry an interval-bearing recurring pattern in the same report.
   One-off charges cannot create a "duplicates" claim.
3. Bounded — only emitted in subcategories where two billed tools is
   plausibly wasteful (collaboration, communication, design, CRM, …).
   Hosting-infrastructure and developer-tools are explicitly excluded.
4. Deterministic — same report in, same findings out, in the same order.
5. Pure — does not mutate the input report, does not depend on the
   comparison baseline, does not change any existing finding.

The acceptance criteria for this step (12, from the loop brief) are
mapped to evidence in §5–§11 and confirmed by tests in §10.

## 5. Design (pure, decoupled, honest)

### 5.1 New module: `frontend/src/lib/compare/subcategories.ts`

A small, **curated** subcategory map. Every merchant appears under exactly
one subcategory — a vendor that spans categories (e.g. Microsoft could be
"collaboration" or "productivity") gets the category that drives the most
useful overlap question. There is no fuzzy matching and no "all of the
above".

```ts
export type SoftwareSubcategory =
  | "team-collaboration"
  | "communication"
  | "productivity"
  | "file-storage"
  | "developer-tools"
  | "design"
  | "crm-sales"
  | "marketing-analytics"
  | "accounting-finance"
  | "security-identity"
  | "hosting-infrastructure"
  | "project-management"
  | "customer-support";

export const SUBCATEGORY_MEMBERS: Record<SoftwareSubcategory, ReadonlySet<string>> = {
  "team-collaboration":  new Set(["slack", "trello", "atlassian", "notion"]),
  communication:         new Set(["zoom", "discord", "microsoft"]),
  productivity:          new Set(["google"]),
  "file-storage":        new Set(["dropbox"]),
  "developer-tools":     new Set(["github", "gitlab"]),
  design:                new Set(["figma", "adobe", "canva"]),
  "crm-sales":           new Set(["salesforce"]),
  "marketing-analytics": new Set(["hubspot"]),
  "accounting-finance":  new Set(["xero", "quickbooks"]),
  "security-identity":   new Set(["okta", "1password"]),
  "hosting-infrastructure": new Set(["aws", "digitalocean", "heroku"]),
  "project-management":  new Set(["monday", "asana"]),
  "customer-support":    new Set(["zendesk", "intercom"]),
};

export const OVERLAP_ELIGIBLE_SUBCATEGORIES: ReadonlySet<SoftwareSubcategory> = new Set([
  "team-collaboration", "communication", "design",
  "crm-sales", "marketing-analytics", "project-management", "customer-support",
]);
```

`subcategoryFor(key)` is a one-line lookup; `null` for any merchant not
in the map. The map is the only path to a subcategory — a merchant with
no entry cannot be invented into one.

### 5.2 New module: `frontend/src/lib/compare/overlap.ts`

`detectIntraPeriodOverlaps(report)` — a single pure function over ONE
`SasscoutReport`. Returns zero or more `ComparisonFinding` with kind
`possible_overlap`. Each finding is two-merchant-shaped: `merchantKey` /
`merchantName` continue to identify the first merchant (engine contract
preserved); the new optional `pair: { merchantKey, merchantName, subcategory }`
field identifies the second. `impact: { monthlyDelta: null, yearlyDelta: null }`
by construction — overlap is a category signal, not a spend delta.

Honesty gates, all positive, applied in order:

1. `m.softwareStatus === "software"`.
2. `m.recurring` exists with `status ∈ {likely_recurring, possibly_recurring}`.
3. `m.recurring.interval` is concrete (`weekly|monthly|quarterly|annual`).
4. `subcategoryFor(m.normalizedKey)` is non-null.
5. Subcategory is in `OVERLAP_ELIGIBLE_SUBCATEGORIES`.
6. Two merchants share the same subcategory.
7. Pairs are deduplicated by sorted `(keyA, keyB)` so the same two
   merchants never produce two findings.

Confidence:

- `high` when both are `likely_recurring`;
- `medium` when one is `likely_recurring` and one is `possibly_recurring`;
- `low` when both are `possibly_recurring`.

Output is sorted by subcategory, then by primary merchant name — so the
list is byte-for-byte identical across two runs on the same report.

### 5.3 Engine wire-up

`engine.ts` adds **one block** after the per-merchant cross-period loop:

```ts
for (const ov of detectIntraPeriodOverlaps(current)) {
  findings.push(ov);
}
```

The block runs on the **current** report only — the "are you paying for
two collaboration tools right now" question belongs to the current period,
not the historical baseline. The cross-period findings, their kinds,
their impacts, and their `kindOrder` values are unchanged; the new kind
appends to the order (8).

### 5.4 New evidence types

Three new `ComparisonEvidenceType` values are added — each maps to one of
the honesty gates above, so the UI can show a per-merchant reason:

| Type | Carries |
|---|---|
| `shared_subcategory` | the subcategory name (e.g. "team collaboration software") |
| `both_recurring_current` | the two intervals (e.g. "monthly, monthly") |
| `overlap_not_duplication` | the explicit "sharing a category is not the same as one being a duplicate" caveat |

## 6. Where the numbers come from (no new semantics)

The finding is derived entirely from values the report already carries
(`softwareStatus`, `recurring.interval`, `merchantName`). No new data is
introduced, no new classification is added, no score is computed. The
suggested action ("Confirm both tools are still in active use; if not,
cancel the redundant one through the provider directly.") mirrors the
existing voice: a check, not a directive to terminate spending.

## 7. Honesty / false-certainty guardrails

| Risk | Guard | Evidence |
|---|---|---|
| Two unrelated merchants in a generic category flagged as overlap | Categories must be overlap-eligible (no `hosting-infrastructure`, no `developer-tools`); both merchants must map to the same curated subcategory | Test "does NOT emit overlap for an ineligible subcategory" (developer-tools), Test "does NOT emit overlap … hosting-infrastructure" |
| One-off + recurring pair | Both must carry an interval-bearing recurring pattern | Test "does NOT emit overlap when one merchant is not recurring" |
| Not-software merchant | `softwareStatus === "software"` gate | Test "does NOT emit overlap when one merchant is not classified as software" |
| Pair without a concrete interval | `interval !== null && interval !== "irregular"` | Test "does NOT emit overlap when the recurring pattern has no concrete interval" |
| Unknown vendors in a "same vibe" pair | Curated map is the only subcategory source | Test "does NOT emit overlap when both merchants are unknown to the curated map" |
| Cross-subcategory pair (slack + zoom) flagged as overlap | Each merchant is in exactly one subcategory; pair requires identical subcategory | Test "does NOT emit overlap between two merchants in different subcategories" |
| Same pair emitted twice | Deterministic sorted `(keyA, keyB)` dedup | Test "emits ONE finding per pair" |
| Spending delta implied | `impact.monthlyDelta = null`, `impact.yearlyDelta = null` by construction | Test "emits a possible_overlap finding … impact monthlyDelta/yearlyDelta are null" |
| Overlap finding out-orders a quantified change | `KIND_ORDER.possible_overlap = 8` (last) and `impactMagnitude` returns 0 for null impact; prioritize sort is `|delta| desc, kind, name` | Existing step24 test "keeps null-impact findings in the tail" |
| New finding kind changes the 13-finding engine contract | `kindOrder` map adds the new kind with a value of 8; existing kinds keep their values; sorted output is monotonic | Existing step22 test "keeps engine semantics intact" still passes after the rank map extension |

## 8. Scope discipline (what was NOT changed)

- No backend change (backend suite/lint/tsc/build untouched and green).
- No change to engine, `prioritize.ts` (only `KIND_ORDER` extended), format
  helpers, analyze metrics, dashboard, persistence, or saved-view schema.
- `compareReports` diff is one block of overlap-emission + one extra entry
  in `kindOrder`. Cross-period rules untouched.
- No new dependencies (component-render harness does not exist; the JSX
  is a thin shim over pure, fully-tested functions).
- `step22/scenario.ts` untouched (Step 23's queue-split assertions depend
  on it).
- The Hero and DashboardPreview mocks are unchanged; the "Illustrative
  preview" label is still on the source data because the **amounts** in
  the mock are still mock, but the **finding kind** "Slack + Teams
  Possible overlap" is now backed by a real engine.

## 9. Ground truth

- **Instrumented**: `step24/scenario.ts` (15 findings: 13 cross-period + 2
  intra-period `possible_overlap` — adobe+figma in `design`, microsoft+zoom
  in `communication`) is the integration ground truth. The 2 added findings
  are exactly what the new detector is supposed to produce on this
  scenario; the 13 cross-period findings are unchanged in kind and impact.
- **Synthetic**: hand-built merchants for: pair matches, subcategory-gate
  no-matches, software-gate no-matches, recurring-gate no-matches,
  interval-gate no-matches, ineligible-subcategory no-matches, unknown-
  vendor no-matches, cross-subcategory no-matches, dedup, confidence
  tiers, deterministic order, immutability, 3-merchant-pair combinations.
- PROXY — not a real user study; UI benefit judged by correctness + the
  fact that the finding kind now matches what the landing has claimed.

## 10. Tests added (24, `frontend/src/lib/compare/overlap.test.ts`)

| Case | Asserts |
|---|---|
| Subcategory map returns the curated category for known merchants | `slack→team-collaboration`, `zoom→communication`, `github→developer-tools`, `salesforce→crm-sales` |
| Subcategory map returns null for unknown merchants | `null` for any vendor not in the map |
| Every curated merchant is in exactly one subcategory | pairwise-unique across `Object.values(SUBCATEGORY_MEMBERS)` |
| `OVERLAP_ELIGIBLE_SUBCATEGORIES` excludes hosting and dev-tools | `has("hosting-infrastructure") === false`; `has("developer-tools") === false`; `has("team-collaboration") === true`; `has("communication") === true` |
| Emits a `possible_overlap` for two recurring subcategory peers | kind, key order (alphabetical), pair fields, `impact` null, evidence types |
| No emission for a single merchant in a subcategory | empty array |
| No emission when one merchant is `not_software` | empty array |
| No emission when one merchant is not recurring | empty array |
| No emission when interval is `irregular` | empty array |
| No emission for `developer-tools` (ineligible) | empty array |
| No emission for `hosting-infrastructure` (ineligible) | empty array |
| No emission for unknown-vendor pair | empty array |
| No emission for two merchants in different subcategories | slack + zoom (team-collab vs communication) |
| Exactly one finding per pair | dedup |
| Medium confidence when one is `possibly_recurring` | mixed status |
| Low confidence when both are `possibly_recurring` | both status |
| Multiple findings for two distinct eligible subcategories | 2 subcategories, 2 findings |
| 3-merchant subcategory → 3 pairs | all combinations emitted |
| Deterministic order across runs | string keys identical |
| Input report is not mutated | JSON snapshot before/after identical |

Plus the existing tests that depend on the engine contract:

- `engine.test.ts` (all 17 tests pass; per-merchant contract intact)
- `summary.test.ts` (13 → 15 count, net deltas unchanged, "15 changes" band)
- `prioritize.test.ts` (unchanged; possible_overlap sits at kind rank 8)
- `step24/decision-value.test.ts` (GT_A_ORDER tail extended, scenario
  integrity updated to 15)
- `step22/actionability.test.ts` (rank map extended to 9 kinds)

## 11. Adversarial results

Cases A through T:

- A (overlapping windows) — N/A, the detector runs on the current report,
  not on a comparison.
- B (became irregular) — N/A, the detector does not produce
  `pattern_irregular`.
- C (residual trace too thin) — N/A.
- D (descriptor similarity) — N/A, the curated map is the only path.
- E (identity uncertainty) — N/A.
- F (currency mismatch) — N/A, the detector is per-report.
- G (null deltas) — `possible_overlap` impact is null by construction;
  `summarizeFindings` excludes null deltas from the net (Test G-pres).
- H / I (NaN / ±Infinity) — no impact number is computed, so these cannot
  be introduced.
- J–R — pre-existing tests pass.
- S (saved-view rendering) — `possible_overlap` renders through the same
  `ResultView` as other findings, with the same `merchantKey/merchantName`
  fields; the new `pair` field is only rendered when present. No new
  branch in the renderer is needed.
- T (unchanged-state re-render) — the detector is pure; same report
  always produces the same findings.

No adversary produced a case where the detector invents, mislabels, or
double-counts.

## 12. Determinism & non-mutation

`detectIntraPeriodOverlaps` is pure. Tests "returns findings in
deterministic order across runs" and "does not mutate the input report"
pass. The detector does not call any external function, does not depend
on the cross-period baseline, and does not call `prioritize.ts`.

## 13. Empty state / zero-change interplay

- `findings.length === 0` (e.g. no software merchants) — the detector
  emits an empty array; `compareReports` produces no `possible_overlap`
  findings; the existing "No material changes detected" empty state is
  unchanged.
- Single software merchant — no pair → no `possible_overlap` finding.
- All-software-but-all-non-recurring — no pair → no `possible_overlap`
  finding (gate 2 prevents one-off + recurring or two one-offs).

## 14. Currency behavior (VERIFIED, unchanged)

The detector does not touch amounts. No currency symbol is emitted on
`possible_overlap` findings. The cross-period currency-mismatch caution
is unchanged.

## 15. Full regression (VERIFIED)

- Frontend: vitest **843/843 (43 files)** → 823 baseline + 20 new
  (overlap + scenario-integrity + summary + decision-value + actionability);
  ESLint clean; `tsc --noEmit` clean; `next build` clean.
- Backend: 46/46; ESLint clean; `tsc --noEmit` clean; build clean.
  (Backend untouched.)

## 16. Stop-condition review (phase 10)

Loop stop conditions re-checked: (a) no existing intra-period overlap
detection anywhere in the engine (grep for `possible_overlap` /
`intra.*overlap` returns no pre-existing matches); (b) the new finding
is purely additive — cross-period findings are unchanged; (c) the new
gates are positive and the curated map is the only source of subcategory
labels (no over-claim); (d) regression gates green. → **No stop
condition met; feature qualifies as PASS.**

## 17. Product decision

**PASS — ship the overlap detection.** Rationale: it is the first and only
intra-period signal the engine emits, the gates are positive and named,
the curated map is auditable in a single file, the engine-test contract
is preserved, and the landing claim it backs is the most visible of the
mock-driven trust risks named in the product-readiness audit.

## 18. Files changed

- `frontend/src/lib/compare/subcategories.ts` (new): curated subcategory
  map, eligibility set, lookup.
- `frontend/src/lib/compare/overlap.ts` (new): `detectIntraPeriodOverlaps`.
- `frontend/src/lib/compare/overlap.test.ts` (new): 20 tests.
- `frontend/src/lib/compare/types.ts` (modified): new `possible_overlap`
  kind, three new evidence types, optional `pair` field on
  `ComparisonFinding`.
- `frontend/src/lib/compare/engine.ts` (modified): one block to emit
  overlap findings; one entry in `kindOrder` (`possible_overlap: 8`).
- `frontend/src/lib/compare/format.ts` (modified): `KIND_LABEL` entry,
  `impactLine` returns a "both are billed on a recurring cadence" line,
  `suggestedAction` returns the "Confirm both tools are still in active
  use" check.
- `frontend/src/lib/compare/prioritize.ts` (modified): `KIND_ORDER` adds
  `possible_overlap: 8`.
- `frontend/src/components/analyze/ComparePanel.tsx` (modified): React
  key uses the pair key when present; title renders "and" between the
  two merchant names.
- `frontend/src/lib/compare/summary.test.ts` (modified): 13 → 15 count
  assertions; "15 changes" band.
- `frontend/src/lib/step24/decision-value.test.ts` (modified):
  GT_A_ORDER/GT_B_ORDER extended; scenario integrity updated; tail-test
  updated.
- `frontend/src/lib/step22/actionability.test.ts` (modified): `rank`
  map extended.
- `docs/STEP-26-report.md` (this report).

## 19. Remaining gaps (deferred deliberately)

- Real-user study of "does the overlap finding drive a cancel action" (the
  loop is proxy-based; cheapest honest label is INFERRED).
- Subcategory map growth — adding a vendor is a deliberate, named change
  to `subcategories.ts` (review the existing pairs before extending).
- Vendor-without-owner / cross-source deduction (Step 5 items still open:
  A2, A3 in the launch plan).

## 20. P0 / P1 / P2

- P0: none. The new finding does not claim a spend delta, never fires
  from invented text similarity, and is the smallest possible expansion
  to the engine.
- P1: none.
- P2 (deferred): copy review of the rendered overlap finding with naive
  owners; expansion of the subcategory map based on real-world merchant
  coverage; A2 / A3 work (ownership flag, multi-file merge).

---

## STEP 26 STATUS

**PASS** — intra-period overlap detection implemented as a pure,
curated, gate-bounded addition to the comparison engine; 20 new tests
(823→843 FE, backend unchanged at 46/46); all gates green; report covers
all brief sections; evidence labeled VERIFIED/INFERRED/NOT TESTED. Commit:
NO · Push: NO. Recommend (Step 27): A2 (unowned-vendor flag) — the
smallest remaining gap in the Step 5 "remaining findings" backlog and the
next landing claim that the engine cannot back.
