import { test, expect } from "@playwright/test";
import path from "node:path";

// Upload → preview happy path. The fixtures/sample.csv is a small but
// non-trivial statement with software spend, a refund, a duplicate
// charge, and an unowned charge. The spec asserts the preview page
// surfaces the headline numbers rather than rendering an empty state.
test("upload → preview renders headline metrics", async ({ page }) => {
  await page.goto("/analyze");
  const filePath = path.join(__dirname, "fixtures", "sample.csv");
  // The hidden file input lives in UploadZone; we target it by its
  // aria-label so we don't depend on the visible dropzone layout.
  await page
    .getByLabel("Choose a transaction data file")
    .setInputFiles(filePath);
  // The Continue button is gated on phase === "selected" — wait for it
  // to be enabled before clicking so we never race the React state.
  const continueBtn = page.getByRole("button", { name: /continue/i });
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();
  await expect(page).toHaveURL(/\/analyze\/preview/);
  await expect(page.getByRole("heading", { name: /ready for analysis/i })).toBeVisible();
  // The software-spend card must surface at least one merchant from
  // the fixture (Adobe, Slack, Figma, Notion, Linear, Zoom, GitHub, AWS).
  await expect(page.getByText(/adobe/i).first()).toBeVisible();
});
