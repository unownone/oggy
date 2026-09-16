import type { Page } from "@playwright/test";
import {
  DEFAULT_VARIANTS,
  FIXTURE_ORIGIN,
  type BenchSpec,
} from "./types";

export const xFixture: BenchSpec = {
  id: "x-fixture",
  kind: "fixture",
  title: "X-like: search posts by keyword, open 3rd, fetch comments",
  site: "x.com (CSS fixture)",
  startUrl: `${FIXTURE_ORIGIN}/x/`,
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS,
  record: async (page: Page) => {
    await page.locator('input[name="q"]').fill("automation");
    await page.locator('button[type="submit"]').click();
    await page.locator(".cellInnerDiv").nth(2).waitFor();
    await page.locator(".cellInnerDiv .open-post").nth(2).click();
    await page.locator("#drawer.open .comment").first().waitFor();
  },
  assert: async (page: Page, variant) => {
    const count = await page.locator(".cellInnerDiv").count();
    if (count < 3) {
      return { ok: false, detail: `expected >= 3 posts, got ${count}` };
    }
    const drawerOpen = await page.locator("#drawer.open").count();
    const comments = await page.locator("#drawer .comment").count();
    if (drawerOpen !== 1 || comments < 1) {
      return {
        ok: false,
        detail: `comments drawer open=${drawerOpen} comments=${comments}`,
      };
    }
    const selectedRank = await page
      .locator('.cellInnerDiv[data-selected="true"]')
      .getAttribute("data-rank");
    if (selectedRank !== "3") {
      return {
        ok: false,
        detail: `selected post rank=${selectedRank ?? "none"}; expected 3`,
      };
    }
    return {
      ok: true,
      detail: `search "${variant.query}" opened 3rd post with ${comments} comments`,
    };
  },
};
