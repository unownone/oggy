import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";

test.slow();

test("tools appear on document.modelContext after reload", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Record a flow
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("inject test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  // Stop recording
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Reload demo page
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await demo.waitForTimeout(2000); // Wait for injection

  // Check tools
  const tools = await getRegisteredTools(demo);
  expect(tools.length).toBeGreaterThanOrEqual(1);
});
