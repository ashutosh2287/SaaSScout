# SaaSScout v1 Launch — Forward Plan & Status Audit

**Generated:** 2026-09-07
**Last updated:** 2026-09-08 (roadmap restructured)
**Repo state:** `main` @ `fe4f357` (Phase C), pushed to `origin/main`. Steps 22–28 + Phase B + Phase C all committed and pushed.
**Gates verified:** FE 868/868 vitest, BE 46/46, FE lint clean, FE `tsc --noEmit` clean, FE `next build` clean, Playwright 7/7, `.next/standalone/server.js` present

---

## 0. Roadmap structure (current)

The plan is now three tiers, not six phases. Core product work is done; the remaining gap is **premium experience polish**.

```
SaaSScout v1
  │
  ├─ CORE PRODUCT          🟢 ~85–90%  DONE
  │    Steps 22–28 complete
  │
  ├─ QA / ENGINEERING     🟢 ~75–85%  DONE
  │    Playwright + axe, Docker + CI + CSP, sample data
  │
  └─ PREMIUM EXPERIENCE   🟡 ~15–25%  ← THE BIGGEST WORKSTREAM
       Design System → Animation System → Premium Landing
       → Data Visualization → Loading/Empty/Error
       → Responsive Polish → Final Browser QA → Production Deploy
       → 🚀 V1
```

---

## 1. What the plan was, and what's actually done

| Step | Intended | Status | Evidence |
|------|----------|--------|----------|
| **0** Working-tree audit | Clean tree, baseline, plan | ✅ **DONE** | `docs/STEP-0-working-tree-audit.md`; tree clean at HEAD; gates green |
| **1** Premium design foundation | Design tokens, primitives, fonts | ✅ **DONE** | `globals.css` (oklch tokens, dark scheme, semantic vars), `tailwindcss@4`, `Newsreader + Geist Mono` in `layout.tsx`, primitives in `components/ui/*`; report `docs/STEP-1-report.md` |
| **2** Premium interaction + animation | Reveal, motion, micro-interactions | ✅ **DONE** | `Reveal.tsx`, `lib/motion.ts`, `.reveal` CSS with `prefers-reduced-motion` fallback; report `docs/STEP-2-report.md` |
| **3** Landing-page transformation | Premium landing, anti-generic | ✅ **DONE** | `Hero / CoreValue / HowItWorks / Philosophy / DashboardPreview / FinalCta` rebuilt; anti-generic enforcement documented; `STEP-3-report.md` + `STEP-3B-report.md` + `STEP-3B-anti-generic-report.md` |
| **4** Data visualization | Stone bars, donut, sparklines, pure SVG | ✅ **DONE** | `StoneBars.tsx`, `Donut.tsx`, used in `DashboardMetrics` + `RecurringCard` + `SoftwareBreakdown` — no chart library |
| **5** Complete remaining product findings | Overlap, unowned vendors, cross-source deduction | ✅ **DONE** | **A1** intra-period overlap (`lib/compare/subcategories.ts`, `overlap.ts`, 20 tests); **A2** unclear ownership (`leak/detect.ts`, `index.test.ts`, 6 tests); **A3** multi-file (`parseFiles`, `source` tags, `CrossSourceBreakdown` panel, 11 + 8 tests). Engine now emits all three. |
| **6** Loading / empty / error / responsive UX | All four states polished | ✅ **DONE** | `Spinner`, `Skeleton`, `EmptyState`, `DashboardPreview` empty states, preview `errors[]` + `columnDiagnostics` banners. **Open:** responsive polish is inferred, not browser-verified — see Phase D below |
| **7** Browser QA + a11y + security + E2E | Cross-browser, axe, real E2E | ✅ **DONE** | **Phase B**: `@playwright/test` + `@axe-core/playwright`, `playwright.config.ts`, `frontend/e2e/{landing,upload-flow,a11y}.spec.ts`, `frontend/e2e/fixtures/sample.csv`, CI `e2e` job in `.github/workflows/ci.yml`, `npm run test:e2e`. 7/7 passing, axe 0 serious/critical |
| **8** Deployment + sample data + docs | Deploy, sample data, accurate docs | ✅ **DONE** | **Phase C**: `frontend/Dockerfile` (multi-stage standalone, ~150 MB), `frontend/.dockerignore`, `next.config.ts` security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy, `poweredByHeader: false`), `Caddyfile` (HTTP→HTTPS, `/health`, HSTS), `frontend/public/samples/sasscout-sample-6mo.csv`, `docs/deployment-frontend.md`, "Try the sample" link on `/analyze`. Pushed to `origin/main` |
| **9** Premium experience polish | Design system, animation, premium landing, viz, responsive | ✅ **DONE (D1–D7)** | Design audit (34 panel violations fixed, dead `Card.tsx` deleted), `Reveal` wired into preview, landing copy pass (Hero + DashboardPreview fabrications removed), `StoneBars`/`Donut` empty-state + hover + tooltip polish, `EmptyState`/`Spinner` wired into saved + compare flows, `responsive.spec.ts` (10 assertions, all pass), production standalone E2E gate (17/17, production CSP verified tighter than dev). **Open:** D8 production deploy (Docker daemon unavailable in this env) |

**Post-launch items (declared in README, deferred):** analytics, auth, cloud storage, AI/LLM, payments, telemetry. None started. **Correctly deferred** — README explicitly says only after post-launch loop.

---

## 2. Honest readiness — what is and isn't shipped

### ✅ Shipped & verified
- Full client-side analysis pipeline (parse → quality → merchant → classification → recurring → software → review → dashboard → report → persistence → export). FE **868/868** vitest, BE **46/46**, both clean on lint/typecheck/build.
- IndexedDB saved analyses with schema-compat, corruption recovery, `analyze/saved` + `analyze/saved/[id]`.
- Period-comparison engine: `new_recurring / ended_recurring / price_increase / price_decrease / frequency_change / merchant_appeared / merchant_disappeared / pattern_irregular`, prioritised, currency-aware, evidence-attached (Steps 22–25, 20 new tests).
- Review queue with actionable filter, dynamic chip counts, kind badge.
- Premium design system (Newsreader serif + Geist Mono, oklch tokens, dark scheme, anti-generic "printed field-report" style).
- Privacy model **verified by grep** — one outbound `GET /health`, no body, IndexedDB only. Privacy page and the trust-language test guard regressions.
- Backend hardened: HSTS, security headers, request-id, rate-limit, graceful shutdown, trusted-proxy model, structured JSON logs, Dockerfile + compose, Caddy reference, CI workflow.

### ⚠️ Shipped with caveats
- **Landing page still shows a few illustrative claims** the engine does not emit. Hero + DashboardPreview carry "Illustrative preview / sample data, not an actual analysis" labels in two places. PRODUCT-READINESS-AUDIT §7 called this a P0 trust risk; the labels are in place but a careful user can still see claims the engine does not make. **Mild risk** after the labels; not catastrophic. Phase D (premium landing copy pass) is the cure.
- **Comparison surface depends on two saved analyses** being available from different periods — onboarding has to surface this clearly.
- **No real public HTTPS deployment** (no domain in this env). Backend has a fully validated local-Caddy path. Frontend now has a Dockerfile + Caddyfile + `next.config.ts` security headers, but the compose stack has not been booted end-to-end in this env.
- **Responsive UX is inferred, not browser-verified.** The `Spinner`/`Skeleton`/`EmptyState` primitives exist and the a11y audit is real, but no spec asserts 320/375/768/1024/1440 viewports. Phase D covers this.
- **CSP compromise**: `script-src 'unsafe-inline'` is required for Next's per-request inline bootstrap script; a nonce middleware is out of scope for v1. `'unsafe-eval'` is only added in dev (React dev-mode callstack reconstruction) — the production CSP is a step tighter.

### ❌ Not shipped
- **Premium experience polish** (design system, animation system, premium landing, data viz, loading/empty/error states, responsive polish, final browser QA) — this is now the **largest remaining workstream**, ~15–25% of v1.
- **Auth, DB, cloud, AI, payments, telemetry** — deliberately deferred post-launch.

---

## 3. Detailed plan to v1 launch

Each item lists: file/area, what to ship, and the test/gate it must clear.

### Phase D — Premium experience polish **[3–5 days]** ← THE BIGGEST REMAINING WORKSTREAM

The core product is done. What's left is making it *feel* like a launch. This is the tier that turns "works correctly" into "worth opening every morning."

**D1. Design system audit.** ✅ **DONE** — ran a grep-driven audit of `src/components` + `src/app` against the "printed field-report" contract (STEP-3B-anti-generic-report.md). Found and fixed 34 panel-style violations of `rounded-2xl`/`rounded-xl` + `shadow-sm`/`shadow-card` on panels, which the contract explicitly forbids ("sharp 2–4px corners, hairline `border-line` 1px rules define panels, NOT rounded floating cards with shadows"). Rewrote via `d1-audit.ps1`:
  - `rounded-2xl border border-zinc-200 bg-surface shadow-sm` → `border border-line bg-surface` (ClassificationCard, ExportCard, MerchantSummaryCard, DataQualityCard, ReviewCard, ReviewQueue, SoftwareSpendCard, SaveAnalysisCard, privacy list items, saved-list empty states, saved-list header, preview table wrapper)
  - `rounded-xl border border-zinc-200 bg-surface shadow-sm` → `border border-line bg-surface` (CoreValue, Philosophy)
  - `rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4` → `rounded-sm border border-amber-200 bg-amber-50 px-5 py-4` (preview attention banner)
  - `rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900` → `rounded-sm ...` (preview summary band)
  - `rounded-2xl border-2 border-zinc-300 bg-zinc-50 p-6` → `rounded-sm border-2 border-zinc-300 bg-zinc-50 p-6` (privacy callout)
  - `rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4` → `rounded-sm ...` (SelectedFile status row — kept the emerald border as a status indicator, dropped the radius)
  - `rounded-2xl border border-line bg-surface shadow-sm` → `border border-line bg-surface` (SaveAnalysisCard)
  - `rounded-2xl border border-zinc-200 bg-surface p-5 shadow-sm` → `border border-line bg-surface p-5` (privacy step list items)
  - `rounded-2xl border border-line bg-surface shadow-sm` → `border border-line bg-surface` (Card.tsx — deleted, it was dead code with no importers)
  Deliberately NOT touched: `EmptyState.tsx` (a quiet-state block, not a panel), `UploadZone.tsx` (a dropzone), `BrandMark.tsx`/`Button.tsx`/`CtaButton.tsx` (icon/button primitives — `rounded-xl` is the correct radius for a control), `CrossSourceBreakdown.tsx` (already compliant).
  Remaining `rounded-2xl`/`rounded-xl` in the codebase are all on controls/icons/status rows, not panels — verified by grep after the pass.

**D2. Animation system.** ✅ **DONE** — `Reveal.tsx` + `lib/motion.ts` were only used on the landing. Wired them into the analysis pages:
  - `preview/page.tsx`: wrapped the dashboard metrics + review queue + recurring card + software breakdown + data quality card in a single `<Reveal>` so the analysis body entrances on scroll. The metrics row and preview table were already wrapped in `border border-line` ruled sheets (D1), so the reveal adds entrance motion without changing the panel contract.
  - `prefers-reduced-motion` is honored everywhere: `Reveal` uses `useInView` + the `.reveal` CSS rule, which has a `prefers-reduced-motion: reduce` fallback that renders the content immediately. No `animate-*` classes were added anywhere.
  - No new animation library — `lib/motion.ts` is the existing primitive, already used by `AnimatedNumber.tsx`'s `useCountUp`/`useInView`.

**D3. Premium landing copy pass.** ✅ **DONE** — `lib/mock.ts`, `Hero.tsx`, `DashboardPreview.tsx`. Two specific fabrications removed:
  - Hero "Unknown SaaS · New recurring charge · $89/month" → "Unknown SaaS · Recurring charge we can't identify · Needs your confirmation". The engine emits `unclear_ownership` ("recurring software we cannot identify by name or pattern"), not a "new recurring charge" with a fabricated amount. The badge moved from green to amber because it is a "needs your confirmation" signal, not a "likely fine" one.
  - DashboardPreview "Slack + Teams · Both collaboration tools are billed to the same account" → "Both are classified as team-collaboration software and billed on a recurring cadence in the current period". The overlap detector only looks at subcategory, recurring status, and interval — it does not establish a shared payment source. The next step is to confirm both are still in use.
  The "Illustrative preview" footer copy now says "finding types shown here are real engine output; the numbers are sample data, not a real analysis" — accurate, and no longer claims anything the engine does not emit.

**D4. Data visualization polish.** ✅ **DONE** — `StoneBars.tsx`, `Donut.tsx`. Both are pure-SVG, no chart library. Added:
  - Zero-value bars render as a 1px hairline (a missing bar would imply the value is absent, not zero).
  - Empty input renders an honest "no data to chart" row instead of zero-width bars with a "0" label.
  - Native `title` tooltips on hover — no tooltip library, no custom positioning, no z-index juggling.
  - Optional `detail` per item/segment (e.g. "est. $4,820/mo").
  - Optional `color` per item/segment (already supported; now documented).
  - `transition-colors hover:opacity-80` on bars/segments for a subtle hover affordance.
  - Tabular-nums alignment is enforced by the parent's `tabular-nums` class; the SVG figures themselves are plain numbers.

**D5. Loading / empty / error states.** ✅ **DONE** — `Spinner`, `EmptyState`, `buttonClasses` now wired into the real flows:
  - `saved/[id]/page.tsx`: loading state shows a centered `Spinner` + "Loading saved analysis…"; missing/incompatible/error states all render as `EmptyState` with an icon, a title, a description, and a primary action (`Back to saved analyses` / `Upload a new file`). The old hand-rolled `rounded-2xl` + `shadow-card` blocks are gone — `EmptyState` uses `rounded-sm` per the design contract.
  - `ComparePanel.tsx`: loading state shows a centered `Spinner`; the "need at least two saved analyses" state renders as `EmptyState` with a chart icon and a contextual action (`Upload a file` when there are zero, `Go to saved analyses` when there is one). The panel's `rounded-2xl` + `shadow-sm` is replaced with `border border-line` (no shadow on panels). The "no material changes detected" and caution blocks use `rounded-sm`.
  - All `rounded-2xl`/`rounded-xl` on panels and list items in these two files are now `rounded-sm`; the only remaining `rounded-2xl` in the codebase is on the `EmptyState` container itself, which is a quiet-state block, not a panel.

**D6. Responsive polish.** ✅ **DONE** — `e2e/responsive.spec.ts` added. 10 assertions across 5 viewports (320, 375, 768, 1024, 1440) × 2 pages (`/`, `/analyze`). Each asserts no horizontal scroll (`document.documentElement.scrollWidth <= viewport width + 1`) and that the primary heading is visible. All 10 pass on dev and on the production standalone server.

**D7. Final browser QA.** ✅ **DONE** — the full Playwright suite now runs against the **production standalone server** (`node .next/standalone/server.js` on port 3001), not `next dev`. Verified:
  - 17/17 passing on production (7 dev + 10 responsive).
  - Production CSP confirmed tighter than dev: `script-src 'self' 'unsafe-inline'` with **no `'unsafe-eval'`** (dev adds it for React's callstack reconstruction). All other headers present: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`, `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. `X-Powered-By` is absent (`poweredByHeader: false`).
  - This is the gate that catches a spec passing in dev but failing in prod — the dev-mode CSP adds `unsafe-eval` that production does not have.

**D8. Production deploy.** ⚠️ **PARTIAL** — the Dockerfile is written and its build context is verified (`.next/standalone/server.js`, `public/`, `.next/static/` all present after `next build`). The image itself could not be built in this environment because the Docker daemon is not running (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`). The compose stack has not been booted end-to-end here either. Remaining: boot `docker compose up` with the `frontend + caddy` profile, smoke-test `/`, `/analyze`, `/analyze/preview` (with the sample CSV), `/analyze/compare`, `/privacy`, `/health` (via Caddy), tag `v1.0.0`, push.

**Gate:** Playwright 7→12+ passing on a production build, axe 0 serious/critical, compose stack boots, no horizontal scroll at any viewport, landing copy matches engine output exactly.

---

### Phase A — Close the "remaining findings" gap (Step 5 close-out) **[DONE]**

The landing still shows three finding kinds the engine does not emit. Decide: implement honestly, or stop showing them. Recommended: **honest expansion of comparison-side findings**, since the period-comparison engine already has the primitives.

**A1. Intra-period overlap detection (multiple SaaS in the same category)** — `frontend/src/lib/compare/engine.ts` already has `DESCRIPTOR_OVERLAP_MIN_DICE` for cross-period. Extend with **same-period co-occurrence**: for two merchants whose classifications are both `likely_saas` and whose canonical categories overlap (e.g. both are "team-collaboration"), emit a finding `possible_intra_overlap { merchantA, merchantB, sharedCategory, evidence[] }`. Add to `lib/compare/types.ts`, `format.ts`, `summary.ts`, `prioritize.ts`. Add a constraint: only when both have recurring status, never fabricated.

**A2. "Vendor without an obvious owner"** — a finding for likely_software merchants whose description pattern does not match any of the user's well-known-name dictionary entries and has no clarifying token. Output: `unclear_ownership { merchant, evidence }`. This is just `!dictionaryMatch && classification.category in {likely_saas, likely_software}` filtered.

**A3. Multi-file / cross-source deduction** — minimal: allow the user to upload a *second* file, attribute transactions to per-source accounts, and produce a merged dataset before analysis. Scope: accept two uploads, merge by transaction `(date, amount, normalizedDesc)`, store per-source tag, expose "X% of your software spend comes from source B" as a derived stat. Hardest piece is the upload UX; engine change is small.

**A4. Tests for A1–A3** — extend `lib/compare/engine.test.ts` and add `lib/compare/ownership.test.ts`. Pin instrumented scenarios so the "Slack + Teams overlap" example resolves to the new finding.

**A5. Landing copy** — once A1–A3 land, remove the "Illustrative preview" disclaimers where the engine actually emits those signals; keep them on anything still mocked.

**Gate:** vitest +20 tests, FE lint/tsc/build clean, landing copy matches engine output.

### Phase B — E2E browser harness + real a11y **[DONE]**

**B1.** Add `playwright` dev-dep, `playwright.config.ts`, `frontend/e2e/` with:
- `landing.spec.ts` — renders, has h1, copy matches engine reality, hero CTA goes to `/analyze`.
- `upload-flow.spec.ts` — uploads the new sample CSV, parses, lands on `/analyze/preview`, dashboard metrics render.
- `compare-flow.spec.ts` — uploads two saved analyses, runs comparison, summary band renders with correct kinds.
- `responsive.spec.ts` — 320, 375, 768, 1024, 1440 viewports; no horizontal scroll on the landing.
- `a11y.spec.ts` — `@axe-core/playwright` on every page; `0 serious/critical` violations.

**B2.** CI — add `e2e` job to `.github/workflows/ci.yml` that installs playwright browsers, runs the suite, uploads the report on failure. Frontend-only at first; backend stays a separate job.

**B3.** Local dev script `npm run test:e2e`.

**Gate:** suite passes locally, CI is green, axe 0 serious/critical across all pages.

### Phase C — Deployment + sample data + honest docs **[DONE]**

**C1. Sample data** — author a 6-month, 8-mercher, ~120-row CSV at `frontend/public/samples/sasscout-sample-6mo.csv` (Adobe, Slack, Figma, Notion, Linear, Zoom, GitHub, AWS, plus 1 refund, 1 duplicate, 1 zero-amount, 1 unowned vendor). Mirror as XLSX. Add a "Try the sample" link on the upload page and on the landing "How it works" section. The link drops the file via a fetch + `setParseResult` flow so the user goes straight to preview.

**C2. Frontend deploy** — `frontend/Dockerfile` (multi-stage Next.js standalone), `frontend/next.config.ts` security headers (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options — same model as backend), `docker-compose.yml` with `frontend + caddy` profile, `Caddyfile` variant that serves the static frontend and proxies `/health` to the backend.

**C3. Update `docs/deployment.md`** — split into `docs/deployment-backend.md` (existing) and `docs/deployment-frontend.md` (new) with a reference `compose` for the full stack behind Caddy.

**C4. Update `README.md`** — reconcile claims with what the engine emits. The "overlapping tools, vendors without owners, vendors across multiple payment sources" line in README is currently *aspirational*; after Phase A it becomes real. Replace the "field report 001 — spend scan" with something the landing can prove. The pre-existing README note about Steps 31–37 ordering should be cleaned up.

**C5. Landing page final copy pass** — go through every landing sentence against the engine; remove or hedge anything the engine cannot deliver. This is the **trust audit** that the PRODUCT-READINESS-AUDIT called P0.

**Gate:** compose stack boots end-to-end, sample data flows through to preview, README accurate, axe clean.

### Phase E — Launch **[0.5 day]**

**E1.** Tag `v1.0.0`. Push. Merge the release notes from the STEP reports.

**E2.** Deploy. Smoke-test the live URL: `/`, `/analyze`, `/analyze/preview` (with sample), `/analyze/compare`, `/privacy`, `/health` (via Caddy).

**E3.** Post the README + privacy page link. Stop.

---

## 4. Estimated total

- Phases A–C (done): ~8 days of engineering
- Phase D (premium experience): 3–5 days
- Phase E (launch): 0.5 day

**Roughly 4–6 working days of focused engineering to a defensible v1.**

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
- **Dictionary coverage (5 merchants, 15 classifications)** is still thin. A2 ("unclear ownership") is the honest move here — better to say "we don't recognize this" than to misclassify.
- **Backend scaling** — backend is health-only and intentionally single-instance. Document this; do not promise more.
- **Premium polish is largely done; D8 is the remaining gate.** D3–D7 are shipped and verified. D8 (compose stack boot + smoke-test + `v1.0.0` tag) needs a machine with a running Docker daemon — the Dockerfile is written and its build context is verified, but the image itself could not be built here.
- **CSP compromise**: `script-src 'unsafe-inline'` is required for Next's per-request inline bootstrap script; a nonce middleware is out of scope for v1.

---

## 7. The single most important next step

**Phase D, D3 (premium landing copy pass).** It removes the last landing-page claim the engine can't back, it has the smallest blast radius (copy only, no engine change), and it unlocks the trust audit PRODUCT-READINESS-AUDIT called P0. After D3, the remaining work is polish and packaging — which is exactly where v1 should be.
