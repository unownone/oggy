import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, waitForOggyTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("tools appear on document.modelContext after reload", async ({
  popupPage,
  demoPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "inject test");

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await waitForOggyTools(demo);

  const tools = await getRegisteredTools(demo);
  expect(tools.length).toBeGreaterThanOrEqual(1);
});
