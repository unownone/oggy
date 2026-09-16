import type { Page } from "@playwright/test";
import {
  DEFAULT_VARIANTS,
  FIXTURE_ORIGIN,
  type BenchSpec,
} from "./types";

export const amazonFixture: BenchSpec = {
  id: "amazon-fixture",
  kind: "fixture",
  title: "Amazon-like: search then open the 3rd listing",
  site: "amazon (CSS fixture)",
  startUrl: `${FIXTURE_ORIGIN}/amazon/`,
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS,
  record: async (page: Page) => {
    await page.locator("#twotabsearchtextbox").fill("automation");
    await page.locator('button[type="submit"]').click();
    await page.locator(".s-result-item").nth(2).waitFor();
    await page.locator(".s-result-item a").nth(2).click();
  },
  assert: async (page: Page, variant) => {
    const count = await page.locator(".s-result-item").count();
    if (count < 3) {
      return { ok: false, detail: `expected >= 3 listings, got ${count}` };
    }
    const preview = (await page.locator("#product").textContent()) ?? "";
    if (!preview.includes("Opened listing 3")) {
      return {
        ok: false,
        detail: `product pane was "${preview.trim() || "(empty)"}"; expected 3rd listing`,
      };
    }
    return {
      ok: true,
      detail: `search "${variant.query}" opened 3rd listing (${count} hits)`,
    };
  },
};
