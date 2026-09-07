import { defineConfig, devices } from "@playwright/test";

// Playwright E2E config — keep it small. We boot the Next.js dev server
// from this config so `npm run test:e2e` works on a fresh clone with no
// separate `npm run dev` step. CI overrides the port and baseURL via
// env. Web server timeout is generous because the first `next dev`
// build of a fresh checkout can be slow.
export default defineConfig({
  testDir: "./e2e",
  // Run E2E serially. The dev server we boot for the test suite is a
  // single Next process; parallel workers hammering it during the
  // initial Turbopack compile cause intermittent first-load timeouts
  // that look like test failures. CI runs with a single worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
