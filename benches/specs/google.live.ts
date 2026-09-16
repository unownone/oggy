import type { Page } from "@playwright/test";
import { DEFAULT_VARIANTS, type BenchSpec } from "./types";
import { clickIfVisible, firstVisible } from "./live-helpers";

export const googleLive: BenchSpec = {
  id: "google-live",
  kind: "live",
  title: "google.com: search then click the 3rd organic result",
  site: "https://www.google.com",
  startUrl: "https://www.google.com/ncr",
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS.slice(0, 3),
  prepare: async (page: Page) => {
    await clickIfVisible(page, [
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
    ]);
    const blocked = await firstVisible(page, [
      "text=/unusual traffic/i",
      "text=/sorry/i",
      "#captcha",
      "iframe[src*='recaptcha']",
    ]);
    return blocked ? `blocked by interstitial (${blocked})` : null;
  },
  record: async (page: Page) => {
    const box = page.locator('textarea[name="q"], input[name="q"]').first();
    await box.waitFor({ timeout: 15_000 });
    await box.fill("automation");
    await box.press("Enter");
    await page.waitForURL(/google\.[^/]+\/search/, { timeout: 15_000 }).catch(() => undefined);
    await page.waitForLoadState("domcontentloaded");
    const third = page
      .locator("#rso .g a h3, #search h3, a h3")
      .nth(2);
    await third.waitFor({ timeout: 20_000 });
    await third.click();
  },
  assert: async (page: Page, variant) => {
    const url = page.url();
    if (/google\.[^/]+\/?$/.test(url) || url.includes("google.com/ncr")) {
      return { ok: false, detail: `still on google home after replay (${url})` };
    }
    return {
      ok: true,
      detail: `left google home after "${variant.query}" → ${url.slice(0, 120)}`,
    };
  },
};
