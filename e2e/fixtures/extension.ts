// ---------------------------------------------------------------------------
// Oggy Playwright extension fixture
// Loads the built extension in Chromium persistent context.
// ---------------------------------------------------------------------------

import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OggyFixtures {
  context: BrowserContext;
  extensionId: string;
  popupPage: () => Promise<Page>;
  sidePanelPage: () => Promise<Page>;
  demoPage: () => Promise<Page>;
}

export const test = base.extend<OggyFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, "../../.output/chrome-mv3");
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    const url = worker.url();
    // URL format: chrome-extension://<id>/background.js
    const id = url.split("/")[2];
    await use(id);
  },

  popupPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForLoadState("domcontentloaded");
      return page;
    });
  },

  sidePanelPage: async ({ context, extensionId }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await page.waitForLoadState("domcontentloaded");
      return page;
    });
  },

  demoPage: async ({ context }, use) => {
    await use(async () => {
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4173");
      await page.waitForLoadState("domcontentloaded");
      return page;
    });
  },
});

export { expect } from "@playwright/test";
