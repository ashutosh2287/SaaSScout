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
| **9** Premium experience polish | Design system, animation, premium landing, viz, responsive | ⚠️ **NOT STARTED** | This is now the **largest remaining workstream** — see Phase D below |

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

**D1. Design system audit.** Go through `components/ui/*` and `globals.css` for consistency: spacing scale, elevation (none — panels are hairline `border-line`, `shadow-card`/`shadow-pop` are for popovers/menus only), type scale, color usage. Fix anything that drifts from the "printed field-report" contract (no rounded-2xl, no gradient/glow, no pill badges, no `uppercase tracking-wider` headers). The anti-generic report (`STEP-3B-anti-generic-report.md`) is the reference.

**D2. Animation system.** `Reveal.tsx` + `lib/motion.ts` exist but are only used on the landing. Wire them into the analysis pages: entrance reveal on the dashboard metrics, a subtle hover state on the merchant rows, a loading→content transition when the preview finishes parsing. Keep `prefers-reduced-motion` honored everywhere — this is a hard gate, not a nice-to-have.

**D3. Premium landing copy pass.** Go through every landing sentence against the engine. The engine now emits `possible_overlap`, `unclear_ownership`, and cross-source spend — remove or hedge anything it cannot deliver. This is the trust audit PRODUCT-READINESS-AUDIT called P0. The "Illustrative preview" labels should come off where the engine actually emits the signal.

**D4. Data visualization polish.** `StoneBars.tsx`, `Donut.tsx` are rule-based pure SVG and ship today. Polish: axis labels, hover states that don't require a tooltip library, empty-state rendering when a category has zero spend, and a tabular-nums alignment check across every figure. No new chart library — the constraint is the point.

**D5. Loading / empty / error states.** `Spinner`, `Skeleton`, `EmptyState` exist. Wire them into the real flows: parse-in-flight, saved-analysis load, comparison run, merchant drill-down. The error states need a retry affordance, not just a message.

**D6. Responsive polish.** Add `responsive.spec.ts` to the Playwright suite: 320, 375, 768, 1024, 1440 viewports on `/`, `/analyze`, `/analyze/preview`. Assert no horizontal scroll and no clipped text. The a11y audit already runs on the default viewport — extend it.

**D7. Final browser QA.** Run the full Playwright suite on a production build (`next build` + `next start`), not just `next dev`. The dev-mode CSP adds `unsafe-eval` that production does not have; a spec that passes in dev can fail in prod. This is the gate before the production deploy.

**D8. Production deploy.** Boot the compose stack (`docker compose up` with the `frontend + caddy` profile) end-to-end. Smoke-test `/`, `/analyze`, `/analyze/preview` (with the sample CSV), `/analyze/compare`, `/privacy`, `/health` (via Caddy). Tag `v1.0.0`. Push.

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
- **Premium polish is the remaining trust gap.** The engine is honest; the presentation is still functional-not-polished. Phase D closes this.
- **CSP compromise**: `script-src 'unsafe-inline'` is required for Next's per-request inline bootstrap script; a nonce middleware is out of scope for v1.

---

## 7. The single most important next step

**Phase D, D3 (premium landing copy pass).** It removes the last landing-page claim the engine can't back, it has the smallest blast radius (copy only, no engine change), and it unlocks the trust audit PRODUCT-READINESS-AUDIT called P0. After D3, the remaining work is polish and packaging — which is exactly where v1 should be.
