import { test, expect } from "../fixtures/extension";
import { recordAndStop } from "../helpers/record";

test.slow();

test("password value is never stored in extension storage", async ({
  popupPage,
  demoPage,
  context,
}) => {
  const PASSWORD = "superSecretP@ss123";

  const demo = await demoPage();
  const popup = await popupPage();
  await recordAndStop(popup, demo, async (page) => {
    await page.getByTestId("demo-password").fill(PASSWORD);
  });

  const [worker] = context.serviceWorkers();
  const storageJson = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  });

  expect(storageJson).not.toContain(PASSWORD);
});
