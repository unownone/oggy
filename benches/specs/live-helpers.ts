import type { Page } from "@playwright/test";

export async function clickIfVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 2500,
): Promise<boolean> {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    try {
      if (await loc.isVisible({ timeout: timeoutMs })) {
        await loc.click({ timeout: timeoutMs });
        return true;
      }
    } catch {
      // not present
    }
  }
  return false;
}

export async function firstVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 2500,
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if (await loc.isVisible({ timeout: timeoutMs })) return selector;
    } catch {
      // not present
    }
  }
  return null;
}
