# STEP 3B - Design Direction Lock + Landing Ledger Language

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Lock the "printed spend field-report" design direction from `AGENTS.md` into the live codebase: display font (Newsreader serif), mono annotation font (Geist Mono), hairline `border-line` ruled panels, sharp corners, paper+ink two-tone. Re-walk the landing page and app-page labels to the ledger language. Remove any leftover generic AI-website tells.

PASS criteria: (a) landing + app pages read as a single printed field-report artifact; (b) no `blur-3xl`, gradients, `uppercase tracking-wider` headers, or decorative pill badges; (c) all panels use `border-line` + sharp corners (no `rounded-2xl` + `shadow-sm` on landing); (d) gates green.

## 2. Baseline / HEAD

- Repo: `main` (uncommitted STEP 0–3 work).
- Frontend baseline: vitest 823/823 (42 files); lint/tsc/build clean (STEP 3 end-state).

## 3. Design-direction plumbing

- **`frontend/AGENTS.md`** — appended a "Design direction: Sasscout is a printed spend field-report" section that governs shape, type, color, and section-head language for all future steps.
- **`app/layout.tsx`** — added Newsreader (`--font-newsreader`, normal+italic, latin) as the 3rd `next/font/google` import.
- **`app/globals.css`** — `@theme` now maps `--font-sans`, `--font-mono`, `--font-display: var(--font-newsreader), Georgia, "Times New Roman", serif`.

## 4. Landing-page rewrites

- **`Hero.tsx`** — fully rewritten flat/paper: mono kicker (`● field report 001 — spend scan`), serif `font-display` H1 ("The software spend your business should review, printed like a scout's file."), ruled stat sheet with mono captions + `divide-y` review queue + `bg-surface-muted` footer bar, `lg:grid-cols-[1fr_28rem]`. No glows/gradient/pill.
- **`SectionHeading.tsx`** — rewritten: mono `eyebrow` brand kicker, `h2 font-display ... text-ink`, sub `text-ink-2`.
- **`DashboardPreview.tsx`** — already at ruled ledger grid (`grid gap-px bg-line`), sharp `border border-line` window chrome, mono captions, `AnimatedNumber` stats retained.
- **`HowItWorks.tsx`** — already at mono numerals/captions, sharp `border border-line` cards, serif `font-display` titles.
- **`FinalCta.tsx`** — already at `font-display` h2 + `font-mono` sub, `bg-ink text-canvas` band.

## 5. App-page label sweep (lowercase mono captions)

Converted Title Case inline labels to lowercase `font-mono text-[11px] text-ink-3` captions in the files listed in the work state:

- **`app/analyze/preview/page.tsx`** — 4 stat-card labels: `rows found`, `transactions parsed`, `skipped`, `need attention`.
- **`components/analyze/SoftwareBreakdown.tsx`** — table `thead th` labels: `merchant`, `category`, `confidence`, `recurring`, `payments`, `typical`, `est. monthly`, `review`.
- **`components/analyze/DataQualityCard.tsx`** — `QualityRow` labels: `dates`, `analyzed window`, `descriptions`, `amounts`, `coverage`.
- **`components/analyze/SoftwareSpendCard.tsx`** — stat-card `dt` labels: `total software spend`, `est. monthly recurring`, `est. yearly recurring`, `software merchants`.

## 6. Generic-tell audit (VERIFIED)

- **No `blur-3xl` or gradients** anywhere in `src/`.
- **No `uppercase tracking-wider` headers** anywhere in `src/`.
- **`rounded-full`** instances remaining are functional UI only: window-chrome dots in `DashboardPreview.tsx` / `Hero.tsx`, bullet indicators in `Philosophy.tsx`, and status/tier chips in `DashboardPreview.tsx` (landing preview). No decorative pill badges.
- **`rounded-2xl border border-zinc-200 bg-surface shadow-sm`** panels remain in analyze result components (`SoftwareBreakdown`, `DashboardMetrics`, `RecurringCard`, `ReviewQueue`, etc.) — these are **STEP 4 scope** (result-page panels) and were intentionally left untouched.

## 7. Verification logs (FE)

- `npx vitest run` → **823 passed (823)**, 42 files.
- `npm run lint` → clean (exit 0).
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → `Compiled successfully`; all routes prerendered/static.

## 8. Verification logs (BE)

- Not run — zero backend files touched this step.

## 9. Residual / NOT TESTED

- **NOT TESTED (browser)** — actual rendered look in light + dark + reduced-motion: no jsdom/RTL harness exists; visual passes belong to STEP 7 QA/Playwright.
- STEP 4 will convert remaining `rounded-2xl` + `shadow-sm` analyze panels to `border-line` ruled sheets and add pure-SVG data viz (stone bars / donut / sparklines).

## 10. Conclusion

**PASS.** Design direction is locked in code, landing is fully restyled to the ledger language, app-page labels are lowercase mono captions, no generic tells remain in STEP 3B scope, and gates are green.
