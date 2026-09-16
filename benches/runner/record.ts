import type { BrowserContext, Page } from "@playwright/test";
import { openPopup } from "./browser";

export async function startRecording(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  const popup = await openPopup(context, extensionId);
  const btn = popup.getByTestId("oggy-record-toggle");
  await btn.click();
  await popup.waitForFunction(() => {
    return (
      document
        .querySelector('[data-testid="oggy-record-toggle"]')
        ?.getAttribute("aria-pressed") === "true"
    );
  });
  await popup.close();
}

export async function stopRecording(
  context: BrowserContext,
  extensionId: string,
): Promise<void> {
  const popup = await openPopup(context, extensionId);
  const btn = popup.getByTestId("oggy-record-toggle");
  const pressed = await btn.getAttribute("aria-pressed");
  if (pressed === "true") {
    await btn.click();
    await popup.waitForTimeout(200);
  }
  await popup.close();
}

export async function waitForToolsInStorage(
  context: BrowserContext,
  origin: string,
  timeoutMs = 8_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const [worker] = context.serviceWorkers();
    if (worker) {
      const count = await worker.evaluate(async (originKey) => {
        const data = await chrome.storage.local.get("oggy.origins");
        const origins = (data["oggy.origins"] || {}) as Record<
          string,
          { mcp?: { tools?: unknown[] } }
        >;
        return origins[originKey]?.mcp?.tools?.length ?? 0;
      }, origin);
      if (count > 0) return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function gotoStart(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
