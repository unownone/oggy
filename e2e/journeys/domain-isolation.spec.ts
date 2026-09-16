import { test, expect } from "../fixtures/extension";
import { getRegisteredTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("tools from one origin do not leak to another", async ({
  popupPage,
  demoPage,
  context,
  extensionId,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "isolation test");

  const otherPage = await context.newPage();
  await otherPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await otherPage.waitForLoadState("domcontentloaded");

  const otherTools = await getRegisteredTools(otherPage);
  const demoTools = otherTools.filter(
    (t) => t.name !== "demo_ping" && t.description?.includes("127.0.0.1"),
  );
  expect(demoTools.length).toBe(0);
});
