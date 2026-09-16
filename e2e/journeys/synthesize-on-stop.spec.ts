import { test, expect } from "../fixtures/extension";

test.slow();

test("synthesize-on-stop produces MCP with tools and inputSchema", async ({
  popupPage,
  demoPage,
  context,
}) => {
  // Record a search flow
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  const demo = await demoPage();
  await demo.getByTestId("demo-search-input").fill("synthesis test");
  await demo.getByTestId("demo-search-submit").click();
  await demo.waitForTimeout(500);

  // Stop recording
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500); // Wait for synthesis

  // MV3 service-worker → self sendMessage is unreliable; read storage directly.
  const [worker] = context.serviceWorkers();
  const origins = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get("oggy.origins");
    return data["oggy.origins"] as Record<string, unknown> | undefined;
  });

  expect(origins).toBeTruthy();
  const b = origins!["http://127.0.0.1:4173"] as {
    mcp?: { tools?: Array<{ name: string; inputSchema?: { properties?: unknown } }> };
  };
  expect(b).toBeTruthy();
  expect(b.mcp).toBeTruthy();
  expect(b.mcp!.tools!.length).toBeGreaterThanOrEqual(1);

  const tool = b.mcp!.tools![0];
  expect(tool).toHaveProperty("name");
  expect(tool).toHaveProperty("inputSchema");
  expect(tool.inputSchema).toHaveProperty("properties");
});
