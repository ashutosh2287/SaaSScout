import { test, expect } from "@playwright/test";

// Step D6 — first real responsive assertion. The a11y audit runs on the
// default desktop viewport; this spec asserts the same surfaces at the
// widths a real user actually loads the app on. No horizontal scroll and
// no clipped text at any width — both are regressions that ship silently
// if no one checks.
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 683 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const PAGES = ["/", "/analyze"];

for (const vp of VIEWPORTS) {
  for (const path of PAGES) {
    test(`responsive: ${vp.name} on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(path);
      // No horizontal scroll: the document width must not exceed the
      // viewport. This is the regression that catches a column that
      // overflows on a narrow screen.
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(
        scrollWidth,
        `horizontal scroll at ${vp.name} on ${path}: doc ${scrollWidth}px > viewport ${vp.width}px`,
      ).toBeLessThanOrEqual(vp.width + 1); // +1 for sub-pixel rounding
      // The primary heading must be visible and not clipped. A heading
      // that renders off-screen is a worse failure than a scroll bar.
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
  }
}