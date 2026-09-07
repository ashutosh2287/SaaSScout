# STEP 1 - Premium Design Foundation (theme-adaptive tokens + UI primitives)

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Lay the design foundation for the premium UI program: a theme-adaptive token system in `globals.css` plus a small set of UI primitives, then apply them to shared layout (Nav/Footer/BrandMark) and every non-landing page shell. Landing overhaul is deliberately deferred to STEP 3; this step only keeps landing components token-correct (semantic `bg-surface` + `bg-brand` swaps) without redesigning them.

PASS criteria: (a) the app's existing zinc/emerald/amber/red palette becomes theme-adaptive via CSS variables flipped at the `prefers-color-scheme: dark` media query — no class toggles introduced; (b) primitives are thin (className-forwarding, no new deps); (c) the entire app (pages + components) uses the new semantic tokens (`bg-surface`, `bg-canvas`, `text-ink*`, `border-line*`, `bg-brand`/`text-brand-ink`) for surfaces and CTAs; (d) every gate stays green: FE 823/823 (42 files), lint/tsc/build clean, BE 46/46 + build clean.

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21) with Steps 22–25 uncommitted. STEP 0 audit report present (`docs/STEP-0-working-tree-audit.md`).
- Frontend baseline: vitest 823/823 (42 files); `tsc --noEmit`, ESLint, `next build` clean (re-verified in STEP 0 and again in §10).
- Backend baseline: 46/46; build clean (verified §11).

## 3. Design decisions

- **Theme adaptivity without a toggle.** Re-mapped every zinc/emerald/amber/red/teal/blue utility through CSS variables (`--color-zinc-*` …) that swap families in dark mode (e.g. `zinc-100 ↔ zinc-900`, `emerald-600 ↔ emerald-400`). Existing utility classes therefore dark-adapt automatically with zero component changes. `prefers-color-scheme` only; an explicit light/dark class toggle is deferred (out of scope for this step).
- **Semantic tokens** added: `canvas`, `surface`, `surface-muted`, `line`, `line-strong`, `ink`, `ink-2`, `ink-3`, plus brand/warn/danger families (`brand`, `brand-hover`, `brand-ink`, `brand-soft`, `brand-line`, `warn`, `warn-soft`, `danger`, `danger-soft`). Body background is `var(--canvas)`.
- **Elevation + motion tokens**: `shadow-card`, `shadow-card-hover`, `shadow-pop`; `--ease-smooth` for later STEP 2 motion work.
- **Primitives are thin**: `Button` (with named export `buttonClasses` for anchor/`Link` CTAs, variants primary/secondary/ghost/danger, sizes sm/md/lg), `Card` (no interactive styling; `interactive` adds hover lift gated by `motion-reduce`), `Badge` (neutral/brand/warn/danger, optional dot), `EmptyState` (icon/title/description/action), `Spinner` (motion-reduce renders static), `Skeleton` (`aria-hidden` shimmer). All className-forwarding; zero new dependencies.
- **`BrandMark`** centralizes the 8 logo headers (`bg-brand text-brand-ink` wordmark) so the mark is defined once.

## 4. What changed (files)

- `frontend/src/app/globals.css` — full token foundation (rewrite).
- New: `frontend/src/components/ui/{Button,Card,Badge,EmptyState,Spinner,Skeleton}.tsx`, `frontend/src/components/layout/BrandMark.tsx`.
- Reworked: `frontend/src/components/layout/Nav.tsx`, `Footer.tsx`.
- Page shells: `frontend/src/app/analyze/page.tsx`, `analyze/preview/page.tsx` (incl. "No file selected" → `EmptyState` + Button), `analyze/saved/page.tsx`, `analyze/saved/[id]/page.tsx`, `analyze/compare/page.tsx`, `privacy/page.tsx` — headers → `BrandMark`, roots `bg-zinc-50`→`bg-canvas`, headers `bg-white`→`bg-surface`/`border-line`, inline logo/CTA → `bg-brand text-brand-ink`.
- Components swept (`bg-white`→`bg-surface`, `hover:bg-white`→`hover:bg-surface`, emerald buttons→`bg-brand text-brand-ink hover:bg-brand-hover`, focus rings→`brand`): analyze suite (`UploadZone`, `SelectedFile`, `ComparePanel`, `SaveAnalysisCard`, `ExportCard`, `ReviewQueue`, `ReviewCard`, `RecurringCard`, `ClassificationCard`, `MerchantSummaryCard`, `MerchantDetailView`, `DashboardMetrics`, `SoftwareBreakdown`, `SoftwareSpendCard`, `DataQualityCard`), layout (`ServiceStatusBar`), landing (`CtaButton`, `Hero`, `HowItWorks`, `DashboardPreview`, `CoreValue`, `Philosophy`).

## 5. Why emerald buttons moved to `bg-brand`

`bg-emerald-700` + `text-white` was the old app-default CTA. Under the dark flip, emerald-700 becomes a bright (~`#34d399`) green, and white text on it fails contrast. `bg-brand`/`text-brand-ink`/`hover:bg-brand-hover` is a semantic pair that keeps strong contrast in both themes (bright-rect + near-black ink in dark; deep-rect + white ink in light).

## 6. Verification methodology

- Re-ran every gate unchanged from STEP 0 methodology (see `docs/STEP-0-working-tree-audit.md`): FE vitest full suite, ESLint, `tsc --noEmit`, `next build`; BE `tsc` build.
- No new tests added: this step is brand-only token/class changes; existing test suite is the regression net (823 FE / 46 BE), which passed untouched.

## 7. Stress-tested logic

None — this step introduces no new business logic, algorithms, or data transformations. The only mechanical decision (token mapping) is enforced by the palette block in `globals.css` and the passing 823-test suite.

## 8. Impact on users

- Visual only, and only where the token swap is visible: consistent surfaces, brand-hued CTAs, and (opt-in via OS setting) a coherent dark mode that was previously daylight-only. No copy, routing, persistence, analysis, or telemetry changes.

## 9. Risk / residual

- **NOT TESTED** — dark mode has not been visually walked in a browser this step (CSS `@media` logic is straightforward; a full visual pass is scheduled for STEP 2/7 QA). Caveat: any hardcoded `#fff`/`#000` left in components outside the token system would not adapt; a `bg-`/`text-` grep across `app/` and `components/` for hardcoded hex found none in use.
- Landing visual restyle (hero, copy, how-it-works, preview mock chrome) is intentionally deferred to STEP 3; only tokenization was applied there.
- `motion-reduce` gates the card hover lift and spinner; no other motion introduced yet.

## 10. Verification logs (FE)

- FE: `npx vitest run` → **823 passed (823)**, 42 files.
- FE: `npm run lint` → clean (empty output, exit 0).
- FE: `npx tsc --noEmit` → clean (empty output, exit 0).
- FE: `npm run build` → success; route table rendered (incl. `/privacy` static).

## 11. Verification logs (BE)

- BE: `npm run build` (`tsc`) → clean (exit 0). Backend source untouched this step; re-verified to keep the STEP 0 gate baseline.

## 12. Conclusion

**PASS.** The foundation is in: a theme-adaptive token system, thin className-forwarding primitives, and a full token sweep of surfaces/CTAs across every non-landing page and all shared components, with all gates still green. STEP 2 (interaction + animation: `useInView`/reveal, `useCountUp`, reduced-motion guards) can build directly on `--ease-smooth` and the elevation tokens.