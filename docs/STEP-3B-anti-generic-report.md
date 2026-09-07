# STEP 3B - Anti-Generic Direction "Printed Spend Field-Report" (codification + corrective pass)

**STATUS: PASS** (implemented) — Commit: NO · Push: NO · Branch: none (all work uncommitted on `main`)

---

## 1. Objective

Stop the site from reading as "made by an AI." The tell was confirmed in the
codebase: soft floating cards (`rounded-2xl` + `shadow-sm`), `uppercase
tracking-wider` headers, `rounded-full` chips, pill badges, gradient/glow
decorations, and I had personally added two `blur-3xl` glow blobs and a pill
badge to the hero in STEP 3. This step codifies a concrete, defensible visual
direction and walks the worst tells back, and locks the direction into the
repo so every future step obeys it.

## 2. The direction (now in `frontend/AGENTS.md` as a design contract)

**"Sasscout is a printed spend field-report."** A scout reads the spread of a
small business's software spend and hands back a printed file:

- **Display type** — `font-display` (Newsreader serif): editorial h1/h2 and
  section heads. No more sans-only generic headlines.
- **Meta/figures/labels** — `font-mono` (Geist Mono), lowercase captions like
  ledger annotations (`merchant`, `est. $4,820/mo`).
- **Money** — always `tabular-nums`, right-aligned, printed like a bank
  statement.
- **Shape** — sharp 2–4px corners (`rounded-sm` at most), hairline
  `border-line` rules define panels as "ruled sheets", not soft floating
  cards. Shadows are for popovers/menus only.
- **Color** — paper (`surface`/`canvas`) + ink (`ink`) two-tone; emerald/
  `brand` only as an annotation/stamp accent. No full-section washes, no
  gradients, no glows.
- **Rejected on sight** — symmetric hero+three cards template, `uppercase
  tracking-wider`, pill badges, `blur-3xl` decorations, indigo/purple accents,
  uniform nothing-authored spacing.

## 3. Font change

- Added **Newsreader** via `next/font/google` (self-hosted WOFF2 at build,
  no runtime/npm dependency): `--font-newsreader`, registered in
  `@theme` as `font-display`. Also wired `--font-sans`/`--font-mono` so the
  Tailwind `font-sans`/`font-mono`/`font-display` utilities resolve to the
  app's Geist/Newsreader fonts instead of the platform default stacks.

## 4. Corrective pass applied (tells removed)

- **Hero** — removed `bg-gradient-to-br`, both `blur-3xl` glow circles, and
  the pill badge. New hero: `field report 001` mono kicker + brand bullet,
  serif H1 ("…printed like a scout's file"), ledger-style stat sheet with
  ruled rows (`divide-line`), mono captions, `tabular-nums` figure, `surface-muted`
  footer strip for the "illustrative preview" disclaimer. Headline copy now
  also claims local-only processing (sourced from the privacy content model).
- **SectionHeading** — eyebrow is now a mono annotation (`↳ 01 · …`) in
  `text-brand`; title is serif. The `uppercase tracking-wider` pill-eyebrow is gone.
- **DashboardPreview** — window chrome now a ruled sheet (`border border-line`,
  no `rounded-2xl`/shadow); the 4-stat grid uses a hairline ruled grid
  (`gap-px bg-line`); labels are mono captions; figures `tabular-nums` serif/sans mix kept; review queue is `divide-line` rows.
- **HowItWorks** — cards are `border border-line` ruled sheets; `step 01` mono
  caption; serif titles.
- **FinalCta** — serif headline, mono subtitle line.
- **App-page headers** (SoftwareBreakdown, SoftwareSpendCard, preview page tables,
  DataQualityCard label, ComparePanel period captions, preview stat labels) —
  `uppercase tracking-wider` headers/captions → `font-mono text-[11px] text-ink-3`
  ledger captions; `bg-zinc-50` header washes removed (ruled `border-b border-line`
  instead).
- The remaining `rounded-full px-2 py-0.5` classes are classification/status
  **chips** — annotation-scale stamps that fit the language; the panel geometry
  fixes (ruled sheets) for the analysis pages are scheduled in STEP 4.

## 5. Impact on users

- Landing reads as an authored paragraph, not a template: serif display, mono
  field captions, ruled sheets, one stamp accent. Copy/claims unchanged except
  the hero's local-only line (already asserted by the privacy model).
- No behavior, routing, analysis, persistence, or telemetry changes.

## 6. Verification logs (FE)

- `npm run build` → `Compiled successfully` (Newsreader fetched + self-hosted at build; `/` prerendered clean).
- `npx tsc --noEmit` → clean.
- `npm run lint` → clean.
- `npx vitest run` → **823 passed (823)**, 42 files.

## 7. NOT TESTED / residual

- **NOT TESTED (browser)** — rendered light/dark visual walk; belongs to STEP 7 QA.
- The analysis-page panels and the STEP 4 charts must be built *in* this
  language (ruled sheets, ledger bars/donut/sparklines, pure SVG) — that is the
  explicit STEP 4 mandate now (see AGENTS.md).

## 8. Conclusion

**PASS.** Direction codified in the repo contract, generic tells scrubbed from
the landing and shared headings, new editorial type introduced, all gates
green. STEP 4 data-viz proceeds in the ledger language, not the chart-library
look.