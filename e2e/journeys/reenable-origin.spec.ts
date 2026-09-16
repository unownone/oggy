import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";

test.slow();

test("re-enabling origin restores Oggy tools on reload", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Record + synthesize
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("reenable test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Disable
  await popup.reload();
  await popup.waitForTimeout(500);
  await popup.getByTestId("oggy-mcp-toggle").click();
  await popup.waitForTimeout(500);

  // Re-enable
  await popup.reload();
  await popup.waitForTimeout(500);
  await popup.getByTestId("oggy-mcp-toggle").click();
  await popup.waitForTimeout(500);

  // Reload demo and verify tools return
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForTimeout(2000);

  const tools = await getRegisteredTools(demo);
  const oggyTools = tools.filter((t) => t.name !== "demo_ping");
  expect(oggyTools.length).toBeGreaterThanOrEqual(1);
});
