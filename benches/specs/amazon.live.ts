import type { Page } from "@playwright/test";
import { DEFAULT_VARIANTS, type BenchSpec } from "./types";
import { clickIfVisible, firstVisible } from "./live-helpers";

export const amazonLive: BenchSpec = {
  id: "amazon-live",
  kind: "live",
  title: "amazon.com: search then click the 3rd listing",
  site: "https://www.amazon.com",
  startUrl: "https://www.amazon.com/",
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS.slice(0, 3),
  prepare: async (page: Page) => {
    await clickIfVisible(page, [
      'button:has-text("Continue shopping")',
      'input[name="accept"]',
      'input[data-action-type="DISMISS"]',
    ]);
    const blocked = await firstVisible(page, [
      "text=/enter the characters/i",
      "text=/robot/i",
      "img[alt*='captcha' i]",
    ]);
    return blocked ? `blocked by interstitial (${blocked})` : null;
  },
  record: async (page: Page) => {
    const box = page.locator("#twotabsearchtextbox, input[name='field-keywords']").first();
    await box.waitFor({ timeout: 15_000 });
    await box.fill("automation");
    await box.press("Enter");
    await page.waitForLoadState("domcontentloaded");
    const listing = page
      .locator('[data-component-type="s-search-result"] h2 a, .s-result-item h2 a')
      .nth(2);
    await listing.waitFor({ timeout: 20_000 });
    await listing.click();
  },
  assert: async (page: Page, variant) => {
    const url = page.url();
    const onResults = /[?&]k=/.test(url) || url.includes("/s?");
    const onProduct = url.includes("/dp/") || url.includes("/gp/");
    if (!onResults && !onProduct) {
      return { ok: false, detail: `unexpected url after replay: ${url.slice(0, 160)}` };
    }
    if (onResults && !onProduct) {
      return {
        ok: false,
        detail: `search ran but 3rd listing did not open (${url.slice(0, 120)})`,
      };
    }
    return {
      ok: true,
      detail: `opened listing after "${variant.query}" → ${url.slice(0, 120)}`,
    };
  },
};
