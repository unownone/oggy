import { test, expect } from "../fixtures/extension";
import { recordAndStop } from "../helpers/record";

test.slow();

test("record search flow produces tools and never stores password", async ({
  popupPage,
  demoPage,
  context,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordAndStop(popup, demo, async (page) => {
    await page.getByTestId("demo-search-input").fill("test query");
    await page.getByTestId("demo-search-submit").click();
    await page.getByTestId("demo-password").fill("superSecretP@ss123");
  });

  const countText = await popup.getByTestId("oggy-tool-count").textContent();
  expect(Number(countText)).toBeGreaterThanOrEqual(1);

  const [worker] = context.serviceWorkers();
  const storageData = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  });
  expect(storageData).not.toContain("superSecretP@ss123");
});
