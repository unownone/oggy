import { test, expect } from "../fixtures/extension";

test.slow();

test("side panel shows origin list with tool rows after recording", async ({
  popupPage,
  demoPage,
  sidePanelPage,
}) => {
  // Record a flow
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("sidepanel test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Open side panel
  const panel = await sidePanelPage();

  // Verify origin list is visible
  await expect(panel.getByTestId("oggy-origin-list")).toBeVisible();

  // Verify an origin row exists for the demo site
  const originRow = panel.locator('[data-testid="oggy-origin-row"][data-origin*="127.0.0.1"]');
  await expect(originRow).toBeVisible();

  // Verify tool rows exist
  const toolRows = panel.getByTestId("oggy-tool-row");
  expect(await toolRows.count()).toBeGreaterThanOrEqual(1);

  // Verify delete button exists
  await expect(panel.getByTestId("oggy-delete-mcp")).toBeVisible();
});
