import { test, expect } from "../fixtures/extension";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("synthesize-on-stop produces MCP with tools and inputSchema", async ({
  popupPage,
  demoPage,
  context,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "synthesis test");

  const [worker] = context.serviceWorkers();
  type OriginBundle = {
    mcp?: {
      tools: Array<{ name: string; inputSchema: { properties?: unknown } }>;
    } | null;
  };

  let bundle: OriginBundle | null = null;
  await expect
    .poll(
      async () => {
        bundle = await worker.evaluate(async () => {
          const data = await chrome.storage.local.get("oggy.origins");
          const origins = (data["oggy.origins"] || {}) as Record<
            string,
            OriginBundle
          >;
          return origins["http://127.0.0.1:4173"] ?? null;
        });
        return bundle?.mcp?.tools?.length ?? 0;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1);

  expect(bundle).not.toBeNull();
  expect(bundle!.mcp).not.toBeNull();
  const tool = bundle!.mcp!.tools[0];
  expect(tool).toHaveProperty("name");
  expect(tool).toHaveProperty("inputSchema");
  expect(tool.inputSchema).toHaveProperty("properties");
});
