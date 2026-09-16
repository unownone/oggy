import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, executeTool, waitForOggyTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("execute search tool fills input and produces results", async ({
  popupPage,
  demoPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "exec test");

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await waitForOggyTools(demo);

  const tools = await getRegisteredTools(demo);
  const oggyTools = tools.filter((t) => t.name !== "demo_ping");
  const searchTool =
    oggyTools.find((t) => /q|search|submit/i.test(t.name)) ?? oggyTools[0];
  expect(searchTool).toBeTruthy();

  await executeTool(demo, searchTool!.name, { q: "oggy" });

  await expect(demo.getByTestId("demo-search-input")).toHaveValue("oggy");
  await expect(demo.getByTestId("demo-result")).toContainText("oggy");
});
