import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";

test.slow();

test("disabling origin removes Oggy tools", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Record + synthesize
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("disable test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Verify tools exist after reload
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForTimeout(2000);
  const toolsBefore = await getRegisteredTools(demo);
  expect(toolsBefore.length).toBeGreaterThanOrEqual(1);

  // Disable via popup
  await popup.bringToFront();
  await popup.reload();
  await popup.waitForTimeout(500);
  const mcpToggle = popup.getByTestId("oggy-mcp-toggle");
  await mcpToggle.click();
  await popup.waitForTimeout(500);

  // Reload demo and check tools are gone
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForTimeout(2000);
  const toolsAfter = await getRegisteredTools(demo);

  // Filter to only Oggy tools (exclude native demo_ping)
  const oggyToolsAfter = toolsAfter.filter((t) => t.name !== "demo_ping");
  expect(oggyToolsAfter.length).toBe(0);
});
