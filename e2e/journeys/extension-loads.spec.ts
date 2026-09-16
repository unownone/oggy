import { test, expect } from "../fixtures/extension";

test("extension service worker starts and has a valid ID", async ({ extensionId }) => {
  expect(extensionId).toBeTruthy();
  expect(extensionId.length).toBeGreaterThan(0);
});

test("popup opens and shows oggy-popup testid", async ({ popupPage }) => {
  const popup = await popupPage();
  await expect(popup.getByTestId("oggy-popup")).toBeVisible();
});

test("popup shows tagline text", async ({ popupPage }) => {
  const popup = await popupPage();
  await expect(popup.getByText("Teaching AI to use a website")).toBeVisible();
});
