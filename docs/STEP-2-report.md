# STEP 2 - Interaction & Animation (motion hooks + reveal + count-up)

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Add the first runtime motion layer on top of the STEP 1 tokens: lightweight, reduced-motion-aware animation primitives (no new dependencies, no animation libraries, WAAPI + `requestAnimationFrame` only), and wire them into the landing surface to establish the premium feel. Everything must respect `prefers-reduced-motion`.

PASS criteria: (a) three hooks (`useReducedMotion`, `useInView`, `useCountUp`) that are correct, cheap, and RSC-safe; (b) a `Reveal` wrapper + `.reveal` CSS for scroll-in; (c) an `AnimatedNumber` client component for count-up stats; (d) all gates green: FE 823/823 (42 files), lint/tsc/build clean.

## 2. Baseline / HEAD

- Repo: `main` @ `f55bf4c` (Step 21), Steps 22–25 + STEP 0/1 artifacts uncommitted.
- Frontend baseline: vitest 823/823 (42 files); `tsc --noEmit` clean; ESLint clean; `next build` clean (re-verified at end of STEP 1, §10 of `docs/STEP-1-report.md`).
- Backend unchanged this step (no BE files touched).

## 3. What was built

### `frontend/src/lib/motion.ts` — three hooks (all client)
- `useReducedMotion()` — `useSyncExternalStore` over `matchMedia("(prefers-reduced-motion: reduce)")`, with a `change` listener so toggling the OS setting at runtime is respected; SSR snapshot returns `false` (safe default; SSR NEVER runs animation).
- `useInView<T>()` — `IntersectionObserver`, fires once (`disconnect()` on first intersecting entry), threshold default `0.2`. Returns a callback `ref` (stable across renders) + `inView`.
- `useCountUp(target, run, durationMs=900)` — renders `target` until `run` flips, then on the run edge snaps to `0` pre-paint (`useIsoLayoutEffect`: `useLayoutEffect` on the client, `useEffect` during SSR to avoid the React SSR warning) and animates to `target` with an ease-out cubic, driven by `requestAnimationFrame` + `performance.now()`, cancellable. Under reduced motion it never animates and jumps straight to `target`.
  - Initial state is `target`, so SSR + pre-reveal HTML show the final number (no `$0` flash before JS runs).

### `frontend/src/components/ui/Reveal.tsx`
Thin className-forwarding wrapper (renders a `div` with the `.reveal` class + `[data-inview]` from `useInView`) plus an optional `delay` for stagger (`transitionDelay`).

### `frontend/src/app/globals.css` — `.reveal`
`opacity:0; transform:translateY(16px)` → in-view `opacity:1; transform:none`, 0.65s with `--ease-smooth`; fully disabled under `prefers-reduced-motion`.

### `frontend/src/components/ui/AnimatedNumber.tsx`
Client count-up stat display. **Props are serializable-only** (RSC-safe): `value`, `variant: "usd" | "integer"`, optional `suffix`, `className`. `usd` renders `$X,XXX` with `toLocaleString("en-US")`; `integer` renders the rounded count + optional suffix (`" vendors"`, `" items"`). Internally: `useInView` + `useCountUp`.

## 4. Why the API is serializable (bug caught by the build)

The first draft exported `format: (n) => string` — a function prop. `next build` correctly rejected it at prerender of `/` with "Functions cannot be passed directly to Client Components". This was a VERIFIED (build-time) enforcement of the RSC boundary: the fix is the `variant`/`suffix` API above.

## 5. Wiring (landing surface only; restyle deferred to STEP 3)

- `Hero.tsx` — headline stat (`heroSpend.softwareSpendValue` → `AnimatedNumber variant="usd"`), left column wrapped in `Reveal`, right card wrapped in `Reveal delay={150}`.
- `HowItWorks.tsx` — three step cards staggered via `Reveal delay={i * 120}`; kept valid HTML (`<ol>` children stay `<li>`, `Reveal` sits inside each `li`).
- `DashboardPreview.tsx` — four dashboard stats count-up (`monthly`/`yearly` as `usd`, `vendors`/`itemsToReview` as integer + suffix), all gated to fire when the section scrolls into view.
- `lib/mock.ts` — added numeric value fields (`softwareSpendValue`, `monthlyValue`, `yearlyValue`, `vendorsValue`) and removed the now-unused pre-formatted strings (dead data deleted; grep-verified no remaining usages of the old fields).

## 6. Reduced-motion behavior (VERIFIED by implementation, NOT visually tested)

- Motion hooks: `prefers-reduced-motion: reduce` → `useCountUp` jumps straight to `target`, `AnimatedNumber` renders final values, no rAF loop.
- CSS: `.reveal` is `opacity:1; transform:none; transition:none` under the media query — content is never hidden if animations are disabled.
- Nothing relies on intersection-fire for content visibility: pre-animation `Reveal` content is fully present (just unfaded), and reduced motion makes it unconditionally visible.

## 7. Verification logs (FE)

- `npx vitest run` → **823 passed (823)**, 42 files. Run twice more to confirm stability.
- `npm run lint` → clean (exit 0).
- `npx tsc --noEmit` → clean (exit 0).
- `npm run build` → `Compiled successfully` (route `/` prerendered; no prerender errors).

## 8. Verification logs (BE)

- Not run — zero backend files touched this step.

## 9. Flake note

One early `vitest run` reported "1 failed / 1 test" before any green run; the failure was a timing-sensitive perf test under parallel load (`SummaryBand`/compare perf spec). Two subsequent full runs passed 823/823 identically. No STEP 2 code paths are exercised by the failing-perf spec (pure logic tests); flagged for STEP 7 (QA) reproduction instead of chasing now.

## 10. NOT TESTED / residual

- **NOT TESTED** — actual browser rendering of the animations (IntersectionObserver + rAF + `prefers-reduced-motion`): no component-test harness exists (all 823 tests are pure logic; no `@testing-library/react`/jsdom in the repo). Visual + reduced-motion passes are scheduled in STEP 7 QA / Playwright.
- Landing still carries its STEP 1 tokenization only; full landing transformation is STEP 3.

## 11. Conclusion

**PASS.** Three small hooks, two primitives, and three landing sections wired — all motion honors reduced motion, no new dependencies, no dead code left, gates green.