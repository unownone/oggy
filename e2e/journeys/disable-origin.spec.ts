import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, waitForOggyTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("disabling origin removes Oggy tools", async ({
  popupPage,
  demoPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "disable test");

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await waitForOggyTools(demo);

  await popup.bringToFront();
  await popup.reload();
  await popup.waitForLoadState("domcontentloaded");
  const mcpToggle = popup.getByTestId("oggy-mcp-toggle");
  await expect(mcpToggle).toBeEnabled();
  await mcpToggle.click();

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await demo.waitForTimeout(2000);
  const toolsAfter = await getRegisteredTools(demo);

  const oggyToolsAfter = toolsAfter.filter((t) => t.name !== "demo_ping");
  expect(oggyToolsAfter.length).toBe(0);
});
