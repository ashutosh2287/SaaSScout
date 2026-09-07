# SaaSScout v1 Launch — Forward Plan & Status Audit

**Generated:** 2026-09-07
**Repo state:** `main` @ `f55bf4c` (Step 21), Steps 22–25 uncommitted, Steps 0–25 reports present
**Gates verified during this audit:** FE 823/823 vitest, BE 46/46, FE lint clean, FE `tsc --noEmit` clean, FE `next build` clean, BE lint clean, BE `tsc --noEmit` clean

---

## 1. What the plan was, and what's actually done

| Step | Intended | Status | Evidence |
|------|----------|--------|----------|
| **0** Working-tree audit | Clean tree, baseline, plan | ✅ **DONE** | `docs/STEP-0-working-tree-audit.md`; tree clean at HEAD; gates green |
| **1** Premium design foundation | Design tokens, primitives, fonts | ✅ **DONE** | `globals.css` (oklch tokens, dark scheme, semantic vars), `tailwindcss@4`, `Newsreader + Geist Mono` in `layout.tsx`, primitives in `components/ui/*` (`Button`, `Card`, `Badge`, `Container`, `SectionHeading`, `EmptyState`, `Skeleton`, `Spinner`, `CtaButton`, `BrandMark`, `AnimatedNumber`); report `docs/STEP-1-report.md` |
| **2** Premium interaction + animation | Reveal, motion, micro-interactions | ✅ **DONE** | `Reveal.tsx`, `lib/motion.ts`, `.reveal` CSS with `prefers-reduced-motion` fallback, `prefers-reduced-motion` disabled everywhere; report `docs/STEP-2-report.md` |
| **3** Landing-page transformation | Premium landing, anti-generic | ✅ **DONE** (with a fix) | `Hero / CoreValue / HowItWorks / Philosophy / DashboardPreview / FinalCta` rebuilt; anti-generic enforcement documented; `STEP-3-report.md` + `STEP-3B-report.md` + `STEP-3B-anti-generic-report.md` cover the violations and reversions (the blur/glow/pill violations) |
| **4** Data visualization | Stone bars, donut, sparklines, pure SVG | ✅ **DONE** | `StoneBars.tsx`, `Donut.tsx`, used in `DashboardMetrics` + `RecurringCard` + `SoftwareBreakdown` — no chart library; rule-based design preserved |
| **5** Complete remaining product findings | Overlap, unowned vendors, cross-source deduction | ⚠️ **PARTIAL** | Comparison engine already does `new_recurring`, `ended_recurring`, `price_increase/decrease`, `frequency_change`, `merchant_appeared/disappeared`, `pattern_irregular` (`lib/compare/engine.ts`). **Open**: (a) intra-period overlap detection between two distinct merchants (the "Slack + Teams" finding), (b) unowned-vendor / payment-source attribution, (c) cross-source deduction (when two files share a merchant). Engine is currently one-file-at-a-time |
| **6** Loading / empty / error / responsive UX | All four states polished | ✅ **DONE** | `Spinner` (with `role="status"`), `Skeleton`, `EmptyState` (upload, no-file, no-merchant, no-saved-analyses), `DashboardPreview` empty states, preview page already shows `errors[]` and `columnDiagnostics` banners; a11y regression test guards regressions |
| **7** Browser QA + a11y + security + E2E | Cross-browser, axe, real E2E | ⚠️ **PARTIAL** | Vitest pipeline + `e2e-audit.test.ts` (full pipeline), `a11y-regression.test.ts`, `perf-resilience.test.ts`, `large-scaling.test.ts`, `step34-hardening.test.ts`, `trust-language.test.ts`, `step22/actionability.test.ts`, `step22/step23-review-noise.test.ts`, `step24/decision-value.test.ts`. **No Playwright/Cypress harness**; no real-browser axe run; "INFERRED" in STEP-25 §16. CI green but the runtime browser assertions are absent |
| **8** Deployment + sample data + docs | Deploy, sample data, accurate docs | ⚠️ **PARTIAL** | Backend: **DONE** — `Dockerfile`, `docker-compose.yml`, `Caddyfile`, Hono with `TRUST_PROXY / HSTS_ENABLED`, 46 tests, `docs/deployment.md`. Frontend: **PARTIAL** — builds clean, no Docker/SSR-config or Vercel config; no real sample data shipped in `public/`; no `GET /` E2E for the landing page; no `next.config` deployment notes |

**Post-launch items (declared in README, deferred):** analytics, auth, cloud storage, AI/LLM, payments, telemetry. None started. **Correctly deferred** — README explicitly says only after post-launch loop.

---

## 2. Honest readiness — what is and isn't shipped

### ✅ Shipped & verified
- Full client-side analysis pipeline (parse → quality → merchant → classification → recurring → software → review → dashboard → report → persistence → export). FE **823/823** vitest, BE **46/46**, both clean on lint/typecheck/build.
- IndexedDB saved analyses with schema-compat, corruption recovery, `analyze/saved` + `analyze/saved/[id]`.
- Period-comparison engine: `new_recurring / ended_recurring / price_increase / price_decrease / frequency_change / merchant_appeared / merchant_disappeared / pattern_irregular`, prioritised, currency-aware, evidence-attached (Steps 22–25, 20 new tests).
- Review queue with actionable filter, dynamic chip counts, kind badge.
- Premium design system (Newsreader serif + Geist Mono, oklch tokens, dark scheme, anti-generic "printed field-report" style).
- Privacy model **verified by grep** — one outbound `GET /health`, no body, IndexedDB only. Privacy page and the trust-language test guard regressions.
- Backend hardened: HSTS, security headers, request-id, rate-limit, graceful shutdown, trusted-proxy model, structured JSON logs, Dockerfile + compose, Caddy reference, CI workflow.

### ⚠️ Shipped with caveats
- **Landing page uses mock data** ("Slack + Teams overlap", "Adobe +20% price change", "Unknown SaaS new recurring") but is **labeled "Illustrative preview / sample data, not an actual analysis"** in two places (Hero footer, DashboardPreview footer). PRODUCT-READINESS-AUDIT §7 still calls out a P0 trust risk — the labels are now in place but a careful user can still see claims the engine does not make. **Mild risk** after the labels; not catastrophic.
- **Comparison surface depends on two saved analyses** being available from different periods — onboarding has to surface this clearly.
- **No real public HTTPS deployment** (no domain in this env). Backend has a fully validated local-Caddy path. Frontend has no deploy config.
- **No sample data file in `public/`** — the "try it now" onboarding path needs one. Parse fixtures exist under `src/lib/parse/__fixtures__/` but aren't user-reachable.
- **No E2E browser harness** (Playwright/Cypress). The a11y/UX/responsive claims are *inferred* from primitives, not verified in a real browser.

### ❌ Not shipped
- Intra-period **overlap detection** (the "Slack + Teams" example). Engine currently only flags cross-period events.
- **Vendor-without-owner / cross-source attribution** (multi-file import).
- **Real E2E (browser) tests** — no Playwright/Cypress.
- **Frontend deployment config** (`Dockerfile`, Vercel/Netlify config, `next.config` headers for prod).
- **Sample data** (a worked CSV users can download to try the flow).
- **Auth, DB, cloud, AI, payments, telemetry** — deliberately deferred post-launch.

---

## 3. Detailed plan to v1 launch

Each item lists: file/area, what to ship, and the test/gate it must clear.

### Phase A — Close the "remaining findings" gap (Step 5 close-out) **[3–4 days]**

The landing still shows three finding kinds the engine does not emit. Decide: implement honestly, or stop showing them. Recommended: **honest expansion of comparison-side findings**, since the period-comparison engine already has the primitives.

**A1. Intra-period overlap detection (multiple SaaS in the same category)** — `frontend/src/lib/compare/engine.ts` already has `DESCRIPTOR_OVERLAP_MIN_DICE` for cross-period. Extend with **same-period co-occurrence**: for two merchants whose classifications are both `likely_saas` and whose canonical categories overlap (e.g. both are "team-collaboration"), emit a finding `possible_intra_overlap { merchantA, merchantB, sharedCategory, evidence[] }`. Add to `lib/compare/types.ts`, `format.ts`, `summary.ts`, `prioritize.ts`. Add a constraint: only when both have recurring status, never fabricated.

**A2. "Vendor without an obvious owner"** — a finding for likely_software merchants whose description pattern does not match any of the user's well-known-name dictionary entries and has no clarifying token. Output: `unclear_ownership { merchant, evidence }`. This is just `!dictionaryMatch && classification.category in {likely_saas, likely_software}` filtered.

**A3. Multi-file / cross-source deduction** — minimal: allow the user to upload a *second* file, attribute transactions to per-source accounts, and produce a merged dataset before analysis. Scope: accept two uploads, merge by transaction `(date, amount, normalizedDesc)`, store per-source tag, expose "X% of your software spend comes from source B" as a derived stat. Hardest piece is the upload UX; engine change is small.

**A4. Tests for A1–A3** — extend `lib/compare/engine.test.ts` and add `lib/compare/ownership.test.ts`. Pin instrumented scenarios so the "Slack + Teams overlap" example resolves to the new finding.

**A5. Landing copy** — once A1–A3 land, remove the "Illustrative preview" disclaimers where the engine actually emits those signals; keep them on anything still mocked.

**Gate:** vitest +20 tests, FE lint/tsc/build clean, landing copy matches engine output.

### Phase B — E2E browser harness + real a11y **[2 days]**

**B1.** Add `playwright` dev-dep, `playwright.config.ts`, `frontend/e2e/` with:
- `landing.spec.ts` — renders, has h1, copy matches engine reality, hero CTA goes to `/analyze`.
- `upload-flow.spec.ts` — uploads the new sample CSV, parses, lands on `/analyze/preview`, dashboard metrics render.
- `compare-flow.spec.ts` — uploads two saved analyses, runs comparison, summary band renders with correct kinds.
- `responsive.spec.ts` — 320, 375, 768, 1024, 1440 viewports; no horizontal scroll on the landing.
- `a11y.spec.ts` — `@axe-core/playwright` on every page; `0 serious/critical` violations.

**B2.** CI — add `e2e` job to `.github/workflows/ci.yml` that installs playwright browsers, runs the suite, uploads the report on failure. Frontend-only at first; backend stays a separate job.

**B3.** Local dev script `npm run test:e2e`.

**Gate:** suite passes locally, CI is green, axe 0 serious/critical across all pages.

### Phase C — Deployment + sample data + honest docs **[2 days]**

**C1. Sample data** — author a 6-month, 8-mercher, ~120-row CSV at `frontend/public/samples/sasscout-sample-6mo.csv` (Adobe, Slack, Figma, Notion, Linear, Zoom, GitHub, AWS, plus 1 refund, 1 duplicate, 1 zero-amount, 1 unowned vendor). Mirror as XLSX. Add a "Try the sample" link on the upload page and on the landing "How it works" section. The link drops the file via a fetch + `setParseResult` flow so the user goes straight to preview.

**C2. Frontend deploy** — `frontend/Dockerfile` (multi-stage Next.js standalone), `frontend/next.config.ts` security headers (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options — same model as backend), `docker-compose.yml` with `frontend + caddy` profile, `Caddyfile` variant that serves the static frontend and proxies `/health` to the backend.

**C3. Update `docs/deployment.md`** — split into `docs/deployment-backend.md` (existing) and `docs/deployment-frontend.md` (new) with a reference `compose` for the full stack behind Caddy.

**C4. Update `README.md`** — reconcile claims with what the engine emits. The "overlapping tools, vendors without owners, vendors across multiple payment sources" line in README is currently *aspirational*; after Phase A it becomes real. Replace the "field report 001 — spend scan" with something the landing can prove. The pre-existing README note about Steps 31–37 ordering should be cleaned up.

**C5. Landing page final copy pass** — go through every landing sentence against the engine; remove or hedge anything the engine cannot deliver. This is the **trust audit** that the PRODUCT-READINESS-AUDIT called P0.

**Gate:** compose stack boots end-to-end, sample data flows through to preview, README accurate, axe clean.

### Phase D — Real-user dogfood + production telemetry opt-in **[2–3 days]**

**D1.** Manual run with 3 real CSV files (yours + 2 testers'). Note any false positives, false negatives, UX paper-cuts. File a small follow-up list.

**D2.** Optional, only if asked: privacy-preserving feedback widget (a static form, no telemetry). Skip unless requested — POST-LAUNCH items include analytics.

**Gate:** no P0 defects from dogfood; remaining items filed as P2.

### Phase E — Launch **[0.5 day]**

**E1.** Commit the WIP (Steps 22–25 + 0–8). Push. Tag `v1.0.0`. Merge the release notes from the STEP reports.

**E2.** Deploy. Smoke-test the live URL: `/`, `/analyze`, `/analyze/preview` (with sample), `/analyze/compare`, `/privacy`, `/health` (via reverse proxy).

**E3.** Post the README + privacy page link. Stop.

---

## 4. Estimated total

- Phase A: 3–4 days
- Phase B: 2 days
- Phase C: 2 days
- Phase D: 2–3 days (calendar, not all in front of the keyboard)
- Phase E: 0.5 day

**Roughly 7–9 working days of focused engineering** (plus dogfood lead time) to a defensible v1.

---

## 5. What is **explicitly out of scope** for v1

Held over to post-launch, per README and the product philosophy:

- Auth / accounts / login
- Cloud sync / multi-device
- AI / LLM hints
- Payments / paywall / monetization decision
- Server-side analytics / telemetry
- Database / server-side state
- PDF statement parsing
- Public cancellation-playbook content
- Mobile app

These are **not** gaps in the v1 plan — they are deliberate non-goals until a real user signal justifies them.

---

## 6. Risks & ceilings to call out before launch

- **Comparison depends on two saved analyses.** Onboarding must explain this or the "compare two periods" page looks dead. The "Try the sample" sample-data path should pre-create two saved analyses so the first-run user can see the comparison engine live.
- **Sync in-browser compute** caps file size at 20MB and rows at ~25k (verified). Acceptable for 2–3 month personal statements; flag this on the upload page.
- **Dictionary coverage (5 merchants, 15 classifications)** is still thin. After Phase A the *findings* surface expands, but the underlying classification coverage doesn't. Phase A2 ("unclear ownership") is the honest move here — better to say "we don't recognize this" than to misclassify.
- **Backend scaling** — backend is health-only and intentionally single-instance. Document this; do not promise more.
- **Mock-data trust gap** — Phase A + C5 are the cure; do not skip them.

---

## 7. The single most important next step

**Phase A, A1 (intra-period overlap detection).** It removes the only remaining landing-page claim the engine can't back, it has the smallest blast radius (extend an existing engine), and it unlocks the "Slack + Teams" example in the Hero — turning the highest-trust-risk mock into a real signal.

After A1, the rest of the plan is mostly polish and packaging.
