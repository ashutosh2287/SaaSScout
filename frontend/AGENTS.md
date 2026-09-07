<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design direction: "Sasscout is a printed spend field-report"

Do NOT build the generic AI-website look. Reject these on sight:
symmetric centered hero + three feature cards, soft floating cards
(`rounded-2xl` + `shadow-sm` on everything), `uppercase tracking-wider`
headers, `rounded-full` chip everywhere, pill badges, gradient/glow/`blur-3xl`
decorations, indigo/purple accents, perfect uniform spacing that nothing
authored. Two `blur-3xl` glows and a pill badge were added then removed in
STEP 3B as exact violations of this rule.

Instead, the product is a **printed spend field-report**:

- Display type: `font-display` (Newsreader serif) for h1/h2 and section heads.
- Meta/figures/labels: `font-mono` (Geist Mono), lowercase captions like
  ledger annotations (`merchant`, `est. $4,820/mo`).
- Money everywhere is `tabular-nums`, right-aligned columns, printed like a
  bank statement — no fluffy rounding.
- Shape: sharp 2–4px corners (`rounded-sm` at most), hairline `border-line`
  1px rules define panels ("ruled sheets"), NOT rounded floating cards with
  shadows. `shadow-card`/`shadow-pop` are for popovers/menus only, not panels.
- Color: paper (`surface`/`canvas`) + ink (`ink`) two-tone; emerald/`brand`
  used only as an annotation/stamp accent (a checkmark, a "reviewed" tag, an
  inline figure). No full-section color washes, no gradients.
- Section heads read like report margins: mono annotation + serif title, e.g.
  `01 · the problem` then a ruled serif headline.
- Correctness & honest analysis (evidence labels, confidence tiers, "fact vs
  claim" language) are the product's soul — styling must never obscure that.

Carry this into every step (data-viz in STEP 4 = ruled stone bars / donut /
sparklines in the same ledger language, pure SVG, no chart library).
