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

  // Query background for the origin bundle
  const [worker] = context.serviceWorkers();
  const bundle = await worker.evaluate(async () => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "oggy/origin/get", origin: "http://127.0.0.1:4173" },
        resolve,
      );
    });
  });

  expect(bundle).toHaveProperty("ok", true);
  expect(bundle).toHaveProperty("bundle");

  const b = (bundle as any).bundle;
  expect(b).not.toBeNull();
  expect(b.mcp).not.toBeNull();
  expect(b.mcp.tools.length).toBeGreaterThanOrEqual(1);

  const tool = b.mcp.tools[0];
  expect(tool).toHaveProperty("name");
  expect(tool).toHaveProperty("inputSchema");
  expect(tool.inputSchema).toHaveProperty("properties");
});
