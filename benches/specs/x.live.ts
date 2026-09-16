import type { Page } from "@playwright/test";
import { DEFAULT_VARIANTS, type BenchSpec } from "./types";
import { firstVisible } from "./live-helpers";

export const xLive: BenchSpec = {
  id: "x-live",
  kind: "live",
  title: "x.com: search keyword automation, open 3rd post, fetch comments",
  site: "https://x.com",
  startUrl: "https://x.com/search?q=automation&src=typed_query&f=live",
  recordQuery: "automation",
  variants: DEFAULT_VARIANTS.slice(0, 3),
  prepare: async (page: Page) => {
    const blocked = await firstVisible(page, [
      'text=/sign in/i',
      'text=/log in/i',
      'a[href="/login"]',
      'input[name="text"][autocomplete="username"]',
    ], 4_000);
    return blocked
      ? `login wall (${blocked}) — x.com does not expose search without a session`
      : null;
  },
  record: async (page: Page) => {
    const box = page.locator('input[data-testid="SearchBox_Search_Input"], input[aria-label="Search query"]').first();
    await box.waitFor({ timeout: 15_000 });
    await box.fill("automation");
    await box.press("Enter");
    const posts = page.locator('article[data-testid="tweet"], [data-testid="cellInnerDiv"] article');
    await posts.nth(2).waitFor({ timeout: 20_000 });
    await posts.nth(2).click();
    await page.locator('[data-testid="reply"], [data-testid="tweet"]').nth(1).waitFor({ timeout: 15_000 });
  },
  assert: async (page: Page, variant) => {
    const url = page.url();
    const onStatus = url.includes("/status/");
    const replies = await page.locator('[data-testid="tweet"]').count();
    if (!onStatus) {
      return { ok: false, detail: `did not open a post (${url.slice(0, 120)})` };
    }
    if (replies < 1) {
      return { ok: false, detail: "opened a post but no comments/tweets rendered" };
    }
    return {
      ok: true,
      detail: `opened 3rd post for "${variant.query}" with ${replies} tweet nodes`,
    };
  },
};
