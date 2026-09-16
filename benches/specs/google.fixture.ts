import type { Page } from "@playwright/test";
import {
  DEFAULT_VARIANTS,
  FIXTURE_ORIGIN,
  type BenchSpec,
} from "./types";

export const googleFixture: BenchSpec = {
  id: "google-fixture",
  kind: "fixture",
  title: "Google-like: search then open the 3rd result",
  site: "google (CSS fixture)",
  startUrl: `${FIXTURE_ORIGIN}/google/`,
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS,
  record: async (page: Page) => {
    await page.locator('textarea[name="q"]').fill("automation");
    await page.locator('button[type="submit"]').click();
    await page.locator("#rso .g").nth(2).waitFor();
    await page.locator("#rso .g a").nth(2).click();
  },
  assert: async (page: Page, variant) => {
    const results = page.locator("#rso .g");
    const count = await results.count();
    if (count < 3) {
      return { ok: false, detail: `expected >= 3 results, got ${count}` };
    }
    const selected = page.locator('#rso .g[data-selected="true"]');
    if ((await selected.count()) !== 1) {
      return { ok: false, detail: "3rd result was not selected after replay" };
    }
    const preview = (await page.locator("#preview").textContent()) ?? "";
    const openedThird = preview.includes("Opened result 3");
    if (!openedThird) {
      return {
        ok: false,
        detail: `preview was "${preview.trim() || "(empty)"}"; expected 3rd result`,
      };
    }
    return {
      ok: true,
      detail: `search "${variant.query}" opened 3rd result (${count} hits)`,
    };
  },
};
