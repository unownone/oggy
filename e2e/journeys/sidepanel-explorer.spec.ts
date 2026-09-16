import { test, expect } from "../fixtures/extension";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("side panel shows origin list with tool rows after recording", async ({
  popupPage,
  demoPage,
  sidePanelPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "sidepanel test");

  const panel = await sidePanelPage();

  const originRow = panel.locator(
    '[data-testid="oggy-origin-row"][data-origin*="127.0.0.1"]',
  );
  await expect(originRow).toBeVisible();

  const toolRows = panel.getByTestId("oggy-tool-row");
  await expect.poll(async () => toolRows.count()).toBeGreaterThanOrEqual(1);

  await expect(panel.getByTestId("oggy-delete-mcp")).toBeVisible();
});
