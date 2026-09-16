import { defineConfig } from "@playwright/test";
import { resolve } from "path";

export default defineConfig({
  testDir: "e2e/journeys",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "npx serve demo/site -l 4173 --no-clipboard",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
