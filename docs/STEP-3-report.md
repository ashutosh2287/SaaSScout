# STEP 3 - Landing Transformation (premium hero + section rhythm + theme-inversion fixes)

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Restyle the landing page on the STEP 1 tokens / STEP 2 motion layer into a coherent, premium surface: an elevated hero, a firm alternating section rhythm, and a closing brand band. Because this step re-walked every landing section, it also swept up three **dark-mode theme-inversion bugs** that the STEP 1 family-flip introduced into non-landing UI (a correct-by-construction dark theme must never render white-on-white or bright-on-white).

PASS criteria: (a) landing reads as one designed artifact, not a stack of gray sections; (b) every section uses semantic tokens; (c) no white-on-(dark-flipped-to-light) text anywhere in the app; (d) gates green (FE 823/823 × multiple runs, lint/tsc/build clean) including a de-flaked perf test.

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21); Steps 22–25 + STEP 0/1/2 artifacts uncommitted.
- Frontend baseline: vitest 823/823 (42 files); lint/tsc/build clean (STEP 2 end-state).

## 3. The three theme-inversion bugs (VERIFIED by trace, fixed)

The dark palette flips zinc-scale values (light `zinc-900` becomes dark-mode `zinc-100`, etc.). Any `bg-zinc-9xx` + `text-white` combination renders white-on-white or bright-on-light-gray in dark mode:

1. **`landing/FinalCta.tsx`** — `bg-zinc-950 text-white` section. In dark, `zinc-950` → near-white (`zinc-50` value): the CTA band would render light background + white text (invisible).
2. **`analyze/ReviewQueue.tsx:117`** — active filter chip `bg-zinc-900 text-white`. In dark → light chip + white text (invisible/reversed).
3. **`components/ui/Button.tsx` (danger) + `app/analyze/saved/page.tsx` delete confirm** — `bg-*red text-white`. Dark red shades map to bright red (`red-400`), where white text fails contrast.

Fix pattern: replace with **inverted-band tokens** that invert *with* the theme:
- `FinalCta` → `bg-ink text-canvas` (+ muted subtitle `text-canvas/70`) — a statement band that stays legible in both themes (dark band+light text in light mode; light band+dark text in dark mode).
- `ReviewQueue` chip → `bg-ink text-canvas`.
- Danger buttons → `bg-danger text-brand-ink` (`brand-ink` = the "ink that sits on fill colors" token: white in light, near-black in dark).

## 4. Landing transformation

- **Hero** — `relative overflow-hidden` with a soft diagonal gradient (`from-brand-soft via-surface to-surface`) and two blurred ambient glows (brand + amber, `blur-3xl`, `pointer-events-none`, `aria-hidden`). Leading with a brand badge pill ("Files never leave your device · No account needed" — copy sourced from the privacy content model, VERIFIED claim). Headline + supporting text now use `text-ink`; stat card upgraded `shadow-sm`→`shadow-card` and `border-line`.
- **Section rhythm** — semantic alternation `surface` / `canvas` (previously `surface` / `zinc-50`): Hero(surface)→CoreValue(canvas)→HowItWorks(surface)→Philosophy(canvas)→DashboardPreview(surface)→FinalCta(ink). All section top borders now `border-line`.
- **SectionHeading** — eyebrow from `text-emerald-700` → `text-brand` (matches the brand-consistent accent used across the app).
- **HowItWorks** — step numerals → `text-brand`; step cards remain `Reveal`-staggered.
- **DashboardPreview / CoreValue / Philosophy** — token sweep only (already restyled earlier); chrome-bar look retained.

## 5. Flaky perf test — root-caused and fixed

- **Symptom:** 1 test failed in several full runs: `step24/decision-value.test.ts > scales ~O(n log n) with deterministic output`. `AssertionError: expected 67.25 to be less than 62.42` — the guard `ms[3] < ms[2]*4 + 10` comparing **two single timing samples**.
- **Root cause:** single-sample `performance.now()` deltas on a shared CPU jitter past a +10ms slack on a 13ms base measurement; unrelated to any code change (reproduced on clean tree, ~1-in-3 runs).
- **Fix:** the O(n log n) shape guard now uses **best-of-3 (min) timing** per input size. This de-noises shared-machine jitter without weakening the algorithm guard (quadratic regressions still exceed the bound by an order of magnitude) and without touching the sort logic. The determinism/content assertions are unchanged.
- **Verified:** 4 consecutive full-suite runs all PASS (previously ~1/3 failed). Other perf guards use generous absolute ceilings (2000–10000ms) and were unaffected.

## 6. Impact on users

- Landing: hero elevation (gradient + glows), badge proof point, consistent section rhythm, brand-consistent accents.
- Dark mode (thematized): the CTA band and filter/danger controls now render correctly in both themes; previously broken controls were entirely invisible in dark mode.
- No copy, routing, persistence, analysis, or telemetry changes.

## 7. Verification logs (FE)

- `npx tsc --noEmit` → clean (exit 0).
- `npm run lint` → clean (exit 0).
- `npm run build` → `Compiled successfully`; `/` prerendered (hero gradient badges, client components SSR-safe).
- `npx vitest run` ×4 → **823 passed (823)**, 42 files, all runs green (post-fix).

## 8. Verification logs (BE)

- Not run — zero backend files touched this step.

## 9. Residual / NOT TESTED

- **NOT TESTED (browser)** — actual rendered landing look in light + dark + reduced-motion: no jsdom/RTL harness exists; visual passes belong to STEP 7 QA/Playwright.
- Other perf tests with generous single-sample ceilings (2s–10s) left as-is; only the tight shape-bound test was flaky and is fixed.
- `finally` — the CTA band compaction / copy panel restyle is unchanged; further copy refinements can ride on STEP 7 QA.

## 10. Conclusion

**PASS.** Landing transformed on the token+motion foundation, and this sweep surfaced + fixed three real dark-mode inversion bugs plus a flaky perf assertion — gates green across 4 consecutive runs.