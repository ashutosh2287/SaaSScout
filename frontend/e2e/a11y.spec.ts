import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Per-page a11y audit. One spec per surface keeps the failure message
// small and points to the offending page without further digging.
// Severity is filtered to "serious" and "critical" so a stray
// color-contrast warning on a decorative element doesn't fail the
// build; those still surface in the report for follow-up.
const SURFACES = ["/", "/analyze", "/privacy"] as const;

for (const path of SURFACES) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    // The page must render something. A blank page would let axe pass
    // trivially; require a heading so we know real content was audited.
    await expect(page.getByRole("heading").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      blocking,
      `axe found ${blocking.length} serious/critical violations on ${path}: ${JSON.stringify(blocking.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })))}`,
    ).toEqual([]);
  });
}
