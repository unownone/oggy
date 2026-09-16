import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";

test.slow();

test("native demo_ping tool coexists with Oggy tools after injection", async ({
  popupPage,
  demoPage,
}) => {
  // Record a flow to generate Oggy tools
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("native coexist test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Reload demo to inject
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await demo.waitForTimeout(2000);

  const tools = await getRegisteredTools(demo);
  const names = tools.map((t) => t.name);

  // Both demo_ping (native) and at least one Oggy tool should exist
  expect(names).toContain("demo_ping");
  const oggyTools = names.filter((n) => n !== "demo_ping");
  expect(oggyTools.length).toBeGreaterThanOrEqual(1);
});
