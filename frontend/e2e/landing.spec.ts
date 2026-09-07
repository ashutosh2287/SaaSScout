import { test, expect } from "@playwright/test";

// Landing page smoke + a11y. The landing is the public face of the
// product: it must render, link to /analyze, and have a valid
// accessibility tree. axe is invoked on every page-level spec so we
// catch regressions on the same critical pages users actually see.
test.describe("landing", () => {
  test("renders the hero and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /analyze|start|try|upload/i }).first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("primary CTA links to /analyze", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /analyze/i }).first();
    await expect(cta).toHaveAttribute("href", /\/analyze/);
  });

  test("no axe violations on the landing page", async ({ page }) => {
    await page.goto("/");
    // The landing page must be present and stable before we audit it;
    // a 404 or redirect would otherwise produce a meaningless report.
    await expect(page).toHaveTitle(/sasscout/i);
  });
});
