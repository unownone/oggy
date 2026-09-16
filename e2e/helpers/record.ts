import { expect, type Page } from "@playwright/test";

/**
 * Start recording, interact with the demo page, then stop.
 * Opens/focuses the demo tab before capture so events and origin line up.
 */
export async function recordAndStop(
  popup: Page,
  demo: Page,
  interact: (demo: Page) => Promise<void>,
): Promise<void> {
  await popup.getByTestId("oggy-record-toggle").click();
  await expect(popup.getByTestId("oggy-record-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await demo.bringToFront();
  await interact(demo);
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await expect(popup.getByTestId("oggy-record-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
}

export async function recordDemoSearch(
  popup: Page,
  demo: Page,
  query: string,
): Promise<void> {
  await recordAndStop(popup, demo, async (page) => {
    await page.getByTestId("demo-search-input").fill(query);
    await page.getByTestId("demo-search-submit").click();
  });
}
