import { test, expect } from "../fixtures/extension";
import { getRegisteredTools, waitForOggyTools } from "../helpers/webmcp";
import { recordDemoSearch } from "../helpers/record";

test.slow();

test("native demo_ping tool coexists with Oggy tools after injection", async ({
  popupPage,
  demoPage,
}) => {
  const demo = await demoPage();
  const popup = await popupPage();
  await recordDemoSearch(popup, demo, "native coexist test");

  await demo.bringToFront();
  await demo.reload();
  await demo.waitForLoadState("domcontentloaded");
  await waitForOggyTools(demo);
  await expect
    .poll(
      async () => (await getRegisteredTools(demo)).map((t) => t.name),
      { timeout: 10_000 },
    )
    .toContain("demo_ping");

  const tools = await getRegisteredTools(demo);
  const names = tools.map((t) => t.name);

  expect(names).toContain("demo_ping");
  const oggyTools = names.filter((n) => n !== "demo_ping");
  expect(oggyTools.length).toBeGreaterThanOrEqual(1);
});
