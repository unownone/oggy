import { test, expect } from "../fixtures/extension";

test.slow();

test("password value is never stored in extension storage", async ({
  popupPage,
  demoPage,
  context,
}) => {
  const PASSWORD = "superSecretP@ss123";

  // Start recording
  const popup = await popupPage();
  await popup.getByTestId("oggy-record-toggle").click();

  // Type password
  const demo = await demoPage();
  await demo.getByTestId("demo-password").fill(PASSWORD);
  await demo.waitForTimeout(500);

  // Stop recording
  await popup.bringToFront();
  await popup.getByTestId("oggy-record-toggle").click();
  await popup.waitForTimeout(1500);

  // Dump all extension storage
  const [worker] = context.serviceWorkers();
  const storageJson = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get(null);
    return JSON.stringify(data);
  });

  // The password must not appear anywhere in storage
  expect(storageJson).not.toContain(PASSWORD);
});
