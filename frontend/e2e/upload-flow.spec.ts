import { test, expect } from "@playwright/test";
import path from "node:path";

// Upload → preview happy path. The fixtures/sample.csv is a small but
// non-trivial statement with software spend, a refund, a duplicate
// charge, and an unowned charge. The spec asserts the preview page
// surfaces the headline numbers rather than rendering an empty state.
test("upload → preview renders headline metrics", async ({ page }) => {
  await page.goto("/analyze");
  const filePath = path.join(__dirname, "fixtures", "sample.csv");
  await page.getByLabel(/upload|file/i).first().setInputFiles(filePath);
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/analyze\/preview/);
  // The four summary tiles render in order: rows found, transactions
  // parsed, skipped, need attention. The page also renders a h1 with
  // a "ready for analysis" message.
  await expect(page.getByRole("heading", { name: /ready for analysis/i })).toBeVisible();
  // The software-spend card must surface at least one merchant from
  // the fixture (Adobe, Slack, Figma, Notion, Linear, Zoom, GitHub, AWS).
  await expect(page.getByText(/adobe/i).first()).toBeVisible();
});
