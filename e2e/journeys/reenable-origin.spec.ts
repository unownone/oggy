import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, waitForOggyTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("re-enabling origin restores Oggy tools on reload", async ({
  popupPage,
  demoPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "reenable test");

  await popup.reload();
  await popup.waitForLoadState("domcontentloaded");
  const mcpToggle = popup.getByTestId("oggy-mcp-toggle");
  await expect(mcpToggle).toBeEnabled();
  await mcpToggle.click();
  await expect(mcpToggle).toHaveAttribute("aria-pressed", "false");

  await popup.reload();
  await popup.waitForLoadState("domcontentloaded");
  await expect(mcpToggle).toBeEnabled();
  await mcpToggle.click();
  await expect(mcpToggle).toHaveAttribute("aria-pressed", "true");

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await waitForOggyTools(demo);

  const tools = await getRegisteredTools(demo);
  const oggyTools = tools.filter((t) => t.name !== "demo_ping");
  expect(oggyTools.length).toBeGreaterThanOrEqual(1);
});
