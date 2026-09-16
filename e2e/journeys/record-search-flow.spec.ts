import { test, expect } from "../fixtures/extension";

test.slow();

test("record search flow produces tools and never stores password", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Start recording
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();
  await expect(popup.getByTestId("oggy-record-toggle")).toHaveAttribute("aria-pressed", "true");

  // Interact with demo
  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("test query");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  // Type into password field while recording
  await demo.getByTestId("demo-password").fill("superSecretP@ss123");
  await demo.waitForTimeout(500);

  // Stop recording
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await expect(popup.getByTestId("oggy-record-toggle")).toHaveAttribute("aria-pressed", "false");
  await popup.waitForTimeout(1000);

  // Verify tool count is >= 1
  const countText = await popup.getByTestId("oggy-tool-count").textContent();
  expect(Number(countText)).toBeGreaterThanOrEqual(1);

  // Verify password is never in storage
  const [worker] = context.serviceWorkers();
  const storageData = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  });
  expect(storageData).not.toContain("superSecretP@ss123");
});
