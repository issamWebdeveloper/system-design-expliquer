import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against the static export in ./out (`npm run test:e2e` builds it first).
// Set PLAYWRIGHT_CHANNEL=msedge or chrome to use an installed browser instead of
// downloading Playwright's Chromium (`npx playwright install chromium`).
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "node scripts/serve-out.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
