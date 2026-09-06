# STEP 21 — Trust & Classification Hardening

**Date:** 2026-09-06
**Suites:** `parse/errors.test.ts` (5), `parse/currency.test.ts` (7), compare engine currency guard (4, in `engine.test.ts`), `report/view.test.ts` currency rendering (2); AWS alias rework in `merchant/`, `classification/`, `benchmark/`.
**Result: frontend 757/757 (37 files) · backend 46/46 (12 suites) · tsc clean · lint clean · `next build` clean**

---

## 1. Objective

Close the four trust gaps STEP 20 left open and make the results page explain what
its conclusions are actually based on — without touching recurring thresholds,
comparison semantics, or the report schema (beyond the additive `currency` field),
and without any new runtime dependencies.

1. Parse errors surface only as a "Need attention" count → **show what went wrong,
   safely.**
2. The source date-window never appears → **show the analyzed window.**
3. Currency is hardcoded `$` → **detect the statement currency and render money with
   it.**
4. `aws` classifications ride a description signal → **dictionary-backed, alias-free.**

## 2. Parse-error transparency (without leaking data)

New `summarizeParseErrors(errors)` (`parse/errors.ts`): groups by error code and
returns, per code, a **label**, a **human hint**, a **count**, and the first **≤5
unique row numbers** (sorted count-desc, then code). It **never** renders a raw
`ParseError.message` — those embed row content (`Could not read amount "coffee".`)
and are verboten under the local-first privacy rule.

`preview/page.tsx` now renders the summary after the stat cards: `"N transaction(s)
skipped"` with per-code `Label · count` and `Rows: …`. The e2e privacy audit asserts
the serialized summary output cannot contain raw row content (`/coffee|Raw content/`).

## 3. Analyzed date-window

`DataQualityCard.tsx` gained an **"Analyzed window"** row (earliest → latest from
`quality.date`, with an honest "No usable dates" fallback instead of a fabricated
range). These fields already existed (`quality/types.ts`); this was a display gap, not
a data gap.

## 4. Currency detection & rendering (the corrected claim)

**Correction to STEP 20 §6 item 4:** STEP 20 claimed "the parse result already
carries a `currency` field the UI ignores." It did not. `NormalizedTransaction
currency?` existed but was **never populated**, and no statement-level detection
existed. The UI hardcoded `$`.

Now (all local-first, deterministic):

- **`parse/currency.ts`** — a dedicated currency/ccy column wins; otherwise the
  amount/debit/credit cells are scanned for `$` (literal symbol, **never assumed
  USD**), `€£₹₩₽` (glyph), or ISO codes. Mixed or silent statements resolve to
  `null` = *unknown* (keeps legacy `$` display; never a guess). ¥ is deliberately
  skipped (JPY/CNY ambiguity).
- **Pipeline** — `parse/currency.ts` + `currency.test.ts`; `ParseResult.currency:
  string | null` threaded from columns/normalize/index; populated only when every
  detected statement agrees.
- **Report** — new additive `report.currency` field (back-compat: old saved reports
  read as null; `isReadableSavedAnalysis` tolerates extras).
- **Rendering** — `fmtMoney/fmtAmount/money/displayMoney/formatMoney/impactLine`
  all take an optional currency and render the detected symbol; threaded through
  dashboard, merchant detail, review queue, software breakdown, comparison evidence,
  and preview/csv/export. Unknown currency falls back to the legacy `$` exactly as
  before.
- **Comparison** — divergent statement currencies produce a **caution** (the two
  periods are not conversion-adjusted; treat deltas as indicative), but never flip
  `ordered` (direction trust is independent of currency). Each report's own symbol is
  baked into its `typical_amount` evidence strings.
- **A `payment` column** (Outstanding/Paid/Receipt) is still fully ignored, and
  currency detection accepts only statement-wide agreement.

## 5. AWS classification without alias fuzz

Tried adding `"amazon web services"` as an AWS merchant alias. Rejected on evidence:
in the Step 19 benchmark, b72 (an off-cycle `AMAZON WEB SERVICES` fee) then pushes
AWS into `possibly_recurring` and breaks `"aws should be likely_recurring"` — no
fixture dating fixes it, because any extra charge inside the 3-month window corrupts
the monthly-evidence pattern. Rather than bend the whether-dictionary or the evidence
engine, the alias stays **out** (precision over coverage; documented trade-off,
same spirit as `ZOOM CAR WASH` staying Zoom).

Final state:
- `merchant/dictionary.ts` — `{ canonicalName: "AWS", root: "aws", aliases:
  ["aws", "amazon aws"] }`. `"AMAZON WEB SERVICES"` is **not** an alias and can never
  be claimed as AWS (root-prefix misuse like "AWS FOOD BANK" is documented, same as
  the Zoom trade-off).
- `classification/dictionary.ts` — `aws → likely_software / high`.
- `classify.test.ts` + `benchmark/dataset.ts` updated; b72 fixture date restored to
  `2026-01-20` with a comment explaining why `"AMAZON WEB SERVICES"` stays Amazon.
- Baseline preserved: precision/recall still 1.0 in the benchmark; `e2e-audit.test.ts`
  now includes `currency` in the report schema's known keys.

## 6. Verification

| Check | Result |
|---|---|
| Frontend suite | **757/757** (37 files) |
| Backend suite | **46/46** (12 suites) |
| `tsc --noEmit` (frontend + backend) | clean |
| `eslint` (frontend + backend) | clean |
| `next build` (15 routes, Turbopack) | clean |
| STEP 19 benchmark (b72 aws case) | green |

## 7. Scorecard & verdict

| Dimension | Verdict |
|---|---|
| Parse issues actionable | **PASS** — every skip is grouped, labeled, hinted, located by row number; raw row content never rendered |
| Date-window honest | **PASS** — window shown; "No usable dates" fallback instead of invention |
| Currency honest | **PASS** — detected, not assumed; mixed/silent statements state unknown; compare warns, never derails |
| Classification hardened | **PASS** — aws dictionary-backed without fuzzy aliases that would fabricate evidence |
| Private | **PASS** — all detection in-browser; no new dependencies |

**Still open (deferred by design):** typo/alias folding beyond the exact-root
dictionary, multi-currency *conversion* in compares (currently a caution, not a
conversion), ¥/CNY-JPY disambiguation.

## 8. Implementation changes (this step)

- `parse/errors.ts` (new: `summarizeParseErrors`) · `parse/errors.test.ts` (new, 5).
- `parse/currency.ts` (new) · `parse/currency.test.ts` (new, 7); `parse/{types,columns,normalize,index}.ts`.
- `report/{types,build,constants,csv,view}.ts` (`currency` field + currency-aware
  formatters); `report/view.test.ts` currency tests (2).
- `compare/engine.ts` (`fmtMoney(n, currency?)`, order/currency cautions split,
  `ordered: orderCaution === null`), `compare/format.ts`, `ComparePanel.tsx`;
  `engine.test.ts` currency guard (4).
- `leak/signals.ts` (`fmtMoney`, `buildReasons(m, currency?)`), `leak/detect.ts`,
  `betatest/pipeline.ts`.
- `dashboard/derive.ts`, `merchant-detail/{index,investigation}.ts`,
  `components/analyze/{DashboardMetrics,SoftwareSpendCard,MerchantDetailPanel,ReviewQueue,ReviewCard,SoftwareBreakdown,DataQualityCard}.tsx`,
  `app/analyze/preview/page.tsx`, `SavedReportView.tsx`.
- `merchant/dictionary.ts`, `classification/dictionary.ts`, `classify.test.ts`,
  `benchmark/dataset.ts` (b72 + comments), `e2e-audit.test.ts` (known keys).

---

## STEP 21 STATUS

### Baseline
- Frontend suite: **757/757 passing** (37 files); backend: **46/46** (12 suites).
- lint: clean · tsc: clean (both apps) · `next build`: clean (15 routes).

### Trust-hardening decision
**DECISION: PASS.** Every open STEP-20 trust gap closed product-first: skips are
explained by code/label/hint/row without leaking row content, the analyzed
date-window is on the card with an honest fallback, currency is detected not assumed
(unknown stays unknown, compares caution instead of misleading), and aws is
dictionary-backed with aliases refused where they would fabricate evidence. STEP 20's
claim that "the parse result already carries a currency field" is corrected: it was an
unpopulated per-transaction stub; the pipeline, report, and UI were the real work.

### Implementation changes
- parse/errors (new) · parse/currency (new) · report `.currency` (additive) · compare
  order/currency caution split · currency-aware formatters everywhere · aws
  dictionary entry with `AMAZON WEB SERVICES` explicitly excluded · benchmark fixture
  documented.

### Commit: NO
### Push: NO