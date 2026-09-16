import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, executeTool } from "../helpers/webmcp";

test.slow();

test("execute search tool fills input and produces results", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Record a search flow
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("exec test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  // Stop and wait for synthesis
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Reload to inject tools
  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await demo.waitForTimeout(2000);

  // Find and execute the search tool
  const tools = await getRegisteredTools(demo);
  expect(tools.length).toBeGreaterThanOrEqual(1);

  const searchTool = tools.find((t) => t.name.includes("q") || t.name.includes("search"));
  expect(searchTool).toBeTruthy();

  await executeTool(demo, searchTool!.name, { q: "oggy" });
  await demo.waitForTimeout(500);

  // Verify the input was filled
  const inputValue = await demo.getByTestId("demo-search-input").inputValue();
  expect(inputValue).toBe("oggy");

  // Verify results appeared
  await expect(demo.getByTestId("demo-result")).toContainText("oggy");
});
