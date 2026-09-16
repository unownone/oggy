import { test, expect } from "../fixtures/extension";

test("record toggle flips aria-pressed on click", async ({ popupPage }) => {
  const popup = await popupPage();
  const btn = popup.getByTestId("oggy-record-toggle");

  await expect(btn).toHaveAttribute("aria-pressed", "false");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
});

test("record state persists across popup reopen", async ({ popupPage }) => {
  const popup1 = await popupPage();
  const btn1 = popup1.getByTestId("oggy-record-toggle");
  await btn1.click();
  await expect(btn1).toHaveAttribute("aria-pressed", "true");
  await popup1.close();

  const popup2 = await popupPage();
  const btn2 = popup2.getByTestId("oggy-record-toggle");
  await expect(btn2).toHaveAttribute("aria-pressed", "true");

  // Clean up: stop recording
  await btn2.click();
  await expect(btn2).toHaveAttribute("aria-pressed", "false");
});
