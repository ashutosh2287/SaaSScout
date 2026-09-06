# SaaSScout — Product Readiness Audit (Phase 0–16)

**Date:** 2026-09-05
**Audit scope:** Read-only. No implementation, refactor, feature, analytics, dependency, schema, deploy, or commit performed. Working tree preserved.

**Labeling:** every claim is VERIFIED (checked in code/CI/browser), INFERRED (reasonable from evidence, not directly tested), UNKNOWN (not determinable), or RECOMMENDATION (proposed). FACT / INFERENCE / POTENTIAL / NOT-DETERMINABLE are used for analytical claims.

---

## 1. Executive Summary

SaaSScout is a deliberately **privacy-first, browser-local** tool that analyzes an uploaded bank/credit-card CSV (or XLSX) to surface recurring/subscription charges, classify software vendors, estimate reviewable spend, and produce a locally-downloadable report. The product is **engineering-solid and honest**: 578 frontend + 46 backend tests pass, lint/typecheck/build all clean, CI runs on push+PR, and the engine is meticulously guarded against inventing claims (no fabricated savings, no overlap detection, approved trust-language).

The dominant gap is **product/market readiness**, not engineering quality. The engine is intentionally conservative (small 5-merchant normalization dictionary, 15-entry classification dictionary, precision-over-recall), while the **landing page's mock data and README over-claim capabilities that the engine does not have** (Slack+Teams overlap, "New recurring charge" detection, vendor-without-owner detection). The niche is crowded (LowerMySubs, FindRecurring, CancelSub, Sevro, MindsBudget, SubZero, Substract, MyMoneyLeak), so differentiation must be tightened and the claim/reality gap closed before any external launch.

**Overall readiness: NOT READY FOR PUBLIC LAUNCH** — ready for an internal dogfood + honest-market-positioning round, then a limited beta.

---

## 2. Current State (Phase 0 Baseline)

- **Git:** branch `main`, clean tree, HEAD `e7293fa` "Step 37". Earlier: `510aab7` (Step 34–36), `e8d4463` (Step 33), `ec1b530` (Step 32), `73a2966` (Step 31), `d509745` (Initial).
- Structure: `backend/`, `frontend/`, `docs/`, `.github/workflows/ci.yml`, `README.md`, `preview.html`, `opencode.json`, `.gitignore`.
- Stack: **frontend** next 16.3.4, react 19.2.8, xlsx 0.20.3 (cdn tarball). **backend** hono ^4, @hono/node-server ^1.

---

## 3. What We've Built So Far (Feature Inventory)

| Area | Delivered | Evidence (VERIFIED) |
|---|---|---|
| CSV/XLSX parse | Custom streaming CSV parser; column auto-detect; skips TOTAL/balance rows | `frontend/src/lib/parse/*` (csv.ts, columns.ts, normalize.ts) + parse-hardening tests |
| Recurring detection | Weekly/monthly/quarterly/annual patterns; strength; price-change; gaps | `recurring/detect.ts`, `constants.ts`, `intervals.ts`, `amounts.ts` |
| Software classification | Precision-over-recall; 15-entry classified dictionary | `classification/dictionary.ts` (15 entries) |
| Merchant normalization | 5 entries (Adobe, Slack, Amazon, Figma, Netflix) | `merchant/dictionary.ts` (VERIFIED 5 entries, 1397 chars) |
| Software-spend aggregate | Est. monthly/yearly only when defensible; top-8 by total | `software/aggregate.ts` + `constants.ts` |
| Review/finding engine | Review queue; CHECK-framed investigation guidance; no risk scores | `leak/detect.ts`, `score.ts`, `signals.ts`, `merchant-detail/investigation.ts` |
| Dashboard | View-model/row adapters, review queue | `dashboard/derive.ts` |
| Reports | Report v1; CSV/JSON local export | `report/{build,json,csv,download}.ts` |
| Persistence | IndexedDB saved analyses; schema-compat; corruption handling | `persistence/*` |
| Privacy | Single outbound call: `GET /health`, no body. No fetch/XHR/WS anywhere else | `api/index.ts`; VERIFIED by grep (no `fetch(|XMLHttpRequest|sendBeacon|axios|WebSocket|EventSource` in `frontend/src`) |
| Backend | Minimal Hono API: only `GET /health` + `/api/v1/health` | `backend`; tests confirm 404 for `/transactions`, `/reports`, `/analyze`, `/auth`, `/import` |
| Docs | `backend-api.md`, `deployment.md`, STEP-36/37 reports | `docs/` |

---

## 4. Software Architecture

**FACT:** Single-page Next.js frontend runs the entire analysis pipeline **client-side, synchronously** (see `app/analyze/preview/page.tsx`, `app/analyze/page.tsx`). No analysis endpoint exists on the backend — backend is health-only.

**FACT:** One network boundary only: `getHealth()` → `GET /health`, no body (`frontend/src/lib/api/index.ts`).

**FACT:** Data persists to IndexedDB (`persistence/db.ts`). Privacy model verified.

**RECOMMENDATION:** The architecture is well-suited to the privacy-first positioning. Because everything runs in-browser, compute scale is capped by the device; a 20-row PREVIEW limit and the 20MB max file size bound the sync path. This is acceptable for the target use case (2–3 month personal statements). Revisit only if target shifts to large/enterprise statements.

---

## 5. Adherence to Requirements

- **Verified requirements** (from README/step docs): privacy-first (VERIFIED), CSV/XLSX input (VERIFIED), recurring detection (VERIFIED), software-spend aggregate (VERIFIED), localized report/export (VERIFIED), review/leak signals (VERIFIED).
- **NOT implemented despite README/product claims:** overlapping tools, vendors without owners, vendors across multiple payment sources (**FACT** — leak/detect.ts has no overlap/owner/duplicate detection; grep for these shows none). See Section 7.

---

## 6. Tech Debt, Dependencies & Compatibility

- **FACT:** Dependency footprint is small and modern (next 16.3.4, react 19.2.8, xlsx 0.20.3, hono ^4). No major supply-chain surface.
- **FACT:** `xlsx` is pinned to a cdn tarball (0.20.3) — a maintenance/pinning consideration, not a quality blocker (VERIFIED in package.json).
- **INFERRED:** XLSX handling relies on the `xlsx` lib; CSV is a custom parser (fewer deps, more control).
- **RECOMMENDATION:** The small classification and merchant dictionaries are a deliberate "precision-over-recall" posture. Growth path is clear (extend dictionaries), but until dictionaries grow, SaaS-detection coverage is thin.

---

## 7. Claims vs. Reality Gap (Critical)

**FACT (the most important finding):** The landing page is rendered from mock data (`frontend/src/lib/mock.ts`) that **over-claims** relative to the real engine:

| Mock / README claim (FACT, present) | Real engine capability (FACT, VERIFIED) |
|---|---|
| "Slack + Teams Possible overlap" (Hero.tsx renders this) | `leak/detect.ts` has **no overlap/duplicate detection** |
| "New recurring charge" (mock) | **No** new-recurring-charge detection exists |
| README: "overlapping tools, vendors without owners, vendors across multiple payment sources" | **Not implemented** |
| README/hero imply savings/waste outcomes | **Deliberately not computed** — tests enforce no `savings`/`potentialSavings`/`waste` fields (28 grep matches, all asserting absence) |

**INFERENCE:** The mock landing page signals an intended future direction (overlap detection), but it is currently displayed as if real. This is a **trust risk**: a careful user (the exact user this product wants) can disprove the claims and lose confidence. This must be fixed **before** any external exposure.

**RECOMMENDATION (P0):** Either (a) gate the mock claims behind an "example/preview" flag and clearly label them as illustrative, or (b) implement the overlap/owner detection. Given the conservative engine philosophy, (a) is the honest, minimum fix.

---

## 8. Landing Page & Mock Data

- **FACT:** `frontend/src/components/landing/*` and `Hero.tsx` render mock-derived claims (Slack+Teams overlap, new recurring charge) from `mock.ts`.
- **FACT:** Server (stopped after audit) returned 200 for `/` and contained the "Slack" mock overlap text.
- **RECOMMENDATION:** See Section 7. Label mock as example output, or implement the real signals.

---

## 9. Analyzer + Upload Experience

- **FACT:** `app/analyze/page.tsx` + `preview/page.tsx` + `components/analyze/*` orchestrate validation → parse → analyze → preview → report → save.
- **FACT:** Validation: CSV/XLSX only, MAX_FILE_SIZE 20MB (`validateFile.ts`). Preview limited to 20 rows (constant).
- **FACT:** Browser-QA covered: `e2e-audit.test.ts`, `a11y-regression.test.ts`, `large-scaling.test.ts`, `perf-resilience.test.ts` all pass.
- **INFERRED:** Upload UX is functional and well-tested; not visually font/UI-verified in this audit beyond a11y tests.

---

## 10. Saving, History & Report Download

- **FACT:** `persistence/*` provides IndexedDB saved analyses, schema-compat checks, corruption handling. Report v1 via `report/*`; CSV + JSON local download via `report/download.ts`.
- **FACT:** Saved analyses rendered via `app/analyze/saved` and `saved/[id]` (dynamic route verified in build output).
- **RECOMMENDATION:** Local-only export is consistent with the privacy promise. No change needed.

---

## 11. Privacy Architecture

- **VERIFIED:** The only outbound call is `getHealth()` → `GET /health` with no body (`frontend/src/lib/api/index.ts`). Grep for `fetch(|XMLHttpRequest|sendBeacon|axios|WebSocket|EventSource` across `frontend/src` returned **no matches** (FACT).
- **VERIFIED:** Data persists only to IndexedDB.
- **VERIFIED:** `privacy/page.tsx` documents the model.
- **FACT:** The claim-reality gap is NOT in privacy — the privacy story is real and verified. This is the product's strongest, hardest-to-copy differentiator.

---

## 12. Data Model & Persistence

- **FACT:** `persistence/*` (index.ts, db.ts, repository.ts, constants.ts, types.ts) handles IndexedDB persistence, schema-compat, and corruption recovery. Full coverage in `persistence/*.test.ts`.
- **INFERRED:** Schema is stable (schema-compat checks exist); no migration concerns at current scale.
- **RECOMMENDATION:** No work needed.

---

## 13. Feature Gaps & Backlog (with priority)

Priorities P0 (must-fix before launch) / P1 (launch-blocking-ish) / P2 (post-beta) / P3 (nice-to-have).

- **P0 — Close the mock/claims gap** (Section 7): label mock as example or implement overlap/owner/new-charge detection. Trust risk today.
- **P0 — Grow dictionaries** (5 merchants, 15 classifications): detection coverage is thin; direct competitors list 50–500+ services.
- **P1 — Define honest differentiation**: privacy is real but the niche is crowded (Section 16); pick defensible angle (e.g., no-account, no-persistence, open engine, savings honesty).
- **P2 — Savings-playbook / cancel-path content** (competitors all have it): scripts, cancel URLs, alternatives. Currently absent by design (honesty constraint) — decide explicitly.
- **P2 — Multi-upload / period comparison** (new-charge, price-hike, cancelled detection): SubZero/MyMoneyLeak offer this; a real engine capability waiting to be built.
- **P3 — PDF statement support**, LLM-optional vendor hints, wider bank-format heuristics.

**INFERENCE:** The biggest near-term value lift is a period-comparison ("this month vs last") feature, which the honest engine could support without inventing savings — it would directly back credible new-charge/price-hike claims.

---

## 14. Testing & Quality Posture

- **VERIFIED:** Frontend: 578 tests / 27 files, lint clean, typecheck clean, production build OK. Backend: 46 tests, lint clean, typecheck clean, build OK.
- **VERIFIED:** Robust honesty guardrails: trust-language test forbids waste/savings/guarantee/cancel-language; safety test forbids over-strong privacy claims; multiple tests assert no `savings`/`potentialSavings` fields.
- **VERIFIED:** Browser-QA + a11y + large-scaling + perf-resilience suites present and passing.
- **FACT:** This is an unusually disciplined, trust-preserving test posture. Engineering quality is the product's strongest asset after privacy.

---

## 15. Documentation & Onboarding

- **VERIFIED:** `docs/backend-api.md`, `docs/deployment.md`, STEP-36/37 reports, README.
- **RECOMMENDATION:** README's feature claims should be reconciled with Section 7 (claims gap). Otherwise documentation is adequate.

---

## 16. Competitive Landscape (web research, 2026-09-05)

| Competitor | Angle | Positioning | Savings/claims | Format | Notes (INFERENCE) |
|---|---|---|---|---|---|
| LowerMySubs | Free scanner, no bank login, 179 services | "Find my subscriptions", $50–150/mo savings claim | Yes (claims savings) | CSV/PDF, in-browser | Crowded same niche |
| FindRecurring | Free, no account, no server; 500+ entries; "turn off wifi" proof | Rocket Money/Truebill alternative | No savings math, heavy privacy proof | Paste/CSV/raw text | Closest direct competitor on privacy proof |
| CancelSub | Free scan; cancel scripts, FTC language, opportunity-cost calculator | Consumer cancel help; freemium | Yes (cost calc) | CSV, in-browser | Adds cancel workflow we lack |
| Sevro | CSV-in→list-out, matches shell-company names, "never claims unused" | Fact-only, user decides | Explicitly no "unused" claims — aligns with our honesty | CSV | Philosophically the closest match to SaaSScout |
| MindsBudget | Scanner + fixed/variable separation; email-gated results | Budgeting angle | Muted | CSV/XLSX (8MB) | Table/Excel support angle |
| SubZero (open source) | Offline 500+ vendor DB, PII scrubbing, LLM optional, period comparison, open source | Rocket Money/Trim alternative, OSS | No savings, honesty | CSV/PDF | Strong OSS competitor; has period-comparison we lack |
| Substract | "AI finds hidden subs", encrypted at rest | $9.99 one-time, AI | Claims savings | CSV/PDF | One-time-price model |
| MyMoneyLeak | Duplicate-charge + spending-change review, no auto-cancel | Control to user | Muted/fact-based | CSV/PDF | Similar honesty posture |

**INFERENCE:** The space is crowded on the exact value prop. Privacy is table stakes now (everyone claims it). SaaSScout's defensible edges: (a) genuinely verified zero outbound traffic, (b) fact-only honesty (no fabricated savings), (c) clean engineering. Its gaps: thin dictionaries (5/15 vs 50–500+), no period-comparison, no cancel/savings playbook.

---

## 17. Target User & Monetization

**Target (INFERENCE):** Individual / small-team financial-hygiene users who are privacy-conscious and trust-averse — people who won't hand over bank credentials (they reject Plaid/Rocket Money) and who want a point-in-time audit they run locally and discard. These users value honesty and distrust "savings" hype, which SaaSScout's engine inherently satisfies.

**Monetization (INFERENCE, in-market):** dominant models are freemium (free scan, paid unlock of detailed review / cancel playbooks) and one-time fees ($9.99–$12.99). Given the current honest, minimal engine, SaaSScout has **no monetization mechanism implemented yet** (no accounts, no paywall, no email gate — all absent and undeclared).

**RECOMMENDATION:** Decide a monetization posture. The simplest honest options: (1) fully free/OSS to build trust and community around the privacy story, or (2) a one-time-fee capability unlock (e.g., period-comparison, save/export history beyond local) once real features exist. Do not bolt on a paywall before the claims gap is closed.

---

## 18. Phase Scoring (0–10)

| Phase | Score | Note |
|---|---|---|
| Phase 0 — Baseline | 10 | Clean git, reproducible gates (VERIFIED) |
| Phase 1 — Product understanding | 8 | Strong, verified understanding; one claims-gap blind spot |
| Phase 2 — Architecture | 9 | Privacy-first architecture verified end-to-end |
| Phase 3 — Input/parsing | 8 | Custom CSV + XLSX; TOTAL-row skip has documented date-first edge case |
| Phase 4 — Recurring detection | 8 | Solid intervals/strength/price-change |
| Phase 5 — Classification | 5 | Coverage thin (15 entries), precision-over-recall by design |
| Phase 6 — Merchant normalization | 4 | Only 5 entries; real statements need far more |
| Phase 7 — Software-spend | 7 | Honest "est. spend only when defensible" |
| Phase 8 — Review/findings | 8 | CHECK-framed, no invented risk scores |
| Phase 9 — Dashboard | 8 | View-model/queue solid |
| Phase 10 — Reports/export | 8 | Local CSV/JSON export |
| Phase 11 — Persistence | 8 | IndexedDB + schema-compat + corruption handling |
| Phase 12 — Privacy | 10 | Verified single health call, no other outbound |
| Phase 13 — Backend | 7 | Deliberately minimal; fine for current model |
| Phase 14 — UX/journey | 7 | a11y/browser-QA pass; landing over-claims vs engine |
| Phase 15 — Docs | 7 | Adequate; README over-claims (Section 7) |
| Phase 16 — Readiness/claims | 5 | Honesty engine great; landing/README claims gap is the blocker |

**Overall (weighted): ~7 / 10** — engineering strong, product honesty strong, but coverage + claims gap cap the readiness score.

---

## 19. Risk Register

- **HIGH — Claims/reality gap** (mock overlap/"new charge"/README statements vs. engine). Trust risk for the exact skeptical user this product targets. P0.
- **MED — Dictionary coverage** (5/15 entries) → weak detection versus 50–500+ competitors. P0/P1.
- **MED — Crowded niche + weak differentiation** — privacy is table stakes; must pick an angle. P1.
- **MED — No monetization mechanism** — not implemented, not decided. P1/P2.
- **LOW — XLSX pinned cdn tarball** — maintenance pinning. P3.
- **LOW — TOTAL-row skip edge case** (date-first "2026-01-01 TOTAL 100" rows not skipped; documented in e2e-audit.test.ts:630). P3.
- **LOW — Sync in-browser compute** caps statement size; fine for target but a scaling ceiling. P3.

---

## 20. Biggest Bottleneck

**The claims-vs-reality gap on the landing page/README is the single biggest bottleneck to any credible launch** — a privacy-conscious, trust-averse user (the ideal user) will disprove the overlap/"new recurring charge"/vendor-owner claims and walk away. Second bottleneck is detection coverage (5/15 dictionary entries) against a field that markets 50–500+ recognized services.

---

## 21. Roadmap (P0–P3)

**P0 (before any launch):**
1. Close claims gap: label mock output as illustrative, or implement overlap/new-charge/owner detection. Reconcile README.
2. Grow classification + merchant dictionaries to a defensible baseline.

**P1 (beta):**
3. Define and document honest differentiation (recommended: zero-outbound + fact-only honesty, no fabricated savings).
4. Decide monetization posture (free/OSS vs one-time fee vs freemium).

**P2 (growth):**
5. Period-comparison ("last month vs this") → supports new-charge / price-hike / cancelled detection credibly.
6. Cancel-path content (scripts/URLs/alternatives) if that direction is chosen.

**P3 (nice-to-have):**
7. PDF statements; LLM-optional vendor hints; broader bank-format heuristics; multi-currency.

---

## 22. Recommended Next Phase

**Phase 17 — "Honest Beta Positioning"** (not a hardening step): Fix the P0 claims gap and dictionary coverage, then run a limited dogfood/beta with real (non-mock) statements, measure real-world detection vs competitors, and lock the differentiation story. This moves the product from "engineering-complete but over-claimed" to "verifiably honest, ready for skeptical users."

---

## AUDIT STATUS

**Repository state:** `main` @ `e7293fa`, clean tree (no changes) — verified
**Tests:** frontend 578 pass (27 files), backend 46 pass — verified
**Lint:** frontend + backend clean — verified
**Typecheck:** frontend + backend clean — verified
**Build:** frontend production build OK; backend build OK — verified
**Browser QA:** e2e-audit, a11y-regression, large-scaling, perf-resilience pass (headless chromium-1228 available) — verified
**Critical findings:**
1. Landing page mock data + README over-claim capabilities the engine lacks (overlap, new-recurring-charge, vendor-without-owner) — P0 trust risk.
2. Detection coverage thin (5-merchant / 15-class dictionary) versus 50–500+ competitors.
3. Privacy architecture is genuinely verified (single no-body GET /health; IndexedDB only) — strongest differentiator.
4. No savings/waste fabrication anywhere in the engine (28 test assertions enforce absence) — honesty is a real asset.
**Biggest bottleneck:** Claims-vs-reality gap on the landing/README (P0).
**Top 3 next priorities:** 1) Close the claims gap; 2) grow dictionaries; 3) define honest differentiation + monetization posture.
**Recommended next phase:** Phase 17 — Honest Beta Positioning.
**Implementation performed:** NO
**Commit performed:** NO
**Push performed:** NO
