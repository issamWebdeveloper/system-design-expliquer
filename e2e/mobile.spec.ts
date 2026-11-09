import { expect, test } from "@playwright/test";

test("phones get a drawer nav and a tiered component list", async ({ page }) => {
  await page.goto("/systems/uber/");

  // Drawer navigation.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();

  // List view instead of the canvas.
  const architecture = page.locator("#architecture");
  await architecture.scrollIntoViewIfNeeded();
  await expect(architecture.locator(".react-flow")).toHaveCount(0);
  await architecture.getByRole("button", { name: /Matching \/ dispatch/ }).click();

  // Full-screen details panel.
  await expect(page.getByRole("heading", { name: "Matching / dispatch" })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("heading", { name: "Matching / dispatch" })).toHaveCount(0);
});
