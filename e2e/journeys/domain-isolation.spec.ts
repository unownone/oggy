import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";

test.slow();

test("tools from one origin do not leak to another", async ({
  popupPage,
  demoPage,
  context,
  extensionId,
}) => {
  // Record on demo page
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("isolation test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Open a different-origin page (the extension popup itself is chrome-extension://)
  const otherPage = await context.newPage();
  await otherPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await otherPage.waitForLoadState("domcontentloaded");

  // The extension popup page should not have demo tools
  const otherTools = await getRegisteredTools(otherPage);
  const demoTools = otherTools.filter(
    (t) => t.name !== "demo_ping" && t.description?.includes("127.0.0.1"),
  );
  expect(demoTools.length).toBe(0);
});
