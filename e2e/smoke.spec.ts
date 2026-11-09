import { expect, test } from "@playwright/test";

test.skip(({ isMobile }) => isMobile, "Desktop flows");

test("home lists systems and filters by category", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How are large systems built?" })).toBeVisible();

  const count = page.getByText(/\d+ of \d+ systems/);
  const before = await count.textContent();
  await page.getByRole("button", { name: "Building Blocks" }).click();
  await expect(count).not.toHaveText(before ?? "");
  await expect(page.getByRole("link", { name: /URL shortener/ }).first()).toBeVisible();
});

test("provider switch relabels the diagram and node details open", async ({ page }) => {
  await page.goto("/systems/youtube/");
  const node = page.locator(".architecture-node", { hasText: "Video CDN" });
  await expect(node).toBeVisible();

  await page.getByRole("button", { name: "AWS", exact: true }).click();
  await expect(node).toContainText("Amazon CloudFront");
  await expect(page).toHaveURL(/cloud=aws/);

  await node.click();
  await expect(page.getByRole("heading", { name: "Video CDN" })).toBeVisible();
  await expect(page.getByText("Options by provider")).toBeVisible();
});

test("walkthrough steps through a flow", async ({ page }) => {
  await page.goto("/systems/youtube/");
  await page.getByRole("tab", { name: "Walkthrough" }).click();
  await expect(page.getByText(/Upload a video · \d\/9/)).toBeVisible();
  await expect(page).toHaveURL(/flow=upload/);

  // Starting a walkthrough auto-plays, so pause first and compare relative steps.
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByText(/Upload a video · 1\/9/)).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText(/Upload a video · 2\/9/)).toBeVisible();
  await expect(page).toHaveURL(/flow=upload&step=1/);
});

test("search palette finds a component by cloud service name", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search systems/).fill("dynamodb");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/components\/nosql-db\/?$/);
  await expect(page.getByRole("heading", { name: "Key-value / document DB" })).toBeVisible();
});

test("concept page links back to systems", async ({ page }) => {
  await page.goto("/concepts/fan-out/");
  await expect(page.getByRole("heading", { name: /Fan-out/ })).toBeVisible();
  await page.getByRole("link", { name: /Instagram/ }).first().click();
  await expect(page).toHaveURL(/\/systems\/instagram\/?$/);
});

test("unknown system is a 404", async ({ page }) => {
  const response = await page.goto("/systems/does-not-exist/");
  expect(response?.status()).toBe(404);
});

test("theme toggle switches and remembers light mode", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(250, 250, 249)");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("details panel tabs switch content and follow the URL", async ({ page }) => {
  await page.goto("/systems/uber/");
  await page.getByRole("tab", { name: "Data" }).click();
  await expect(page).toHaveURL(/tab=data/);
  await expect(page.getByRole("heading", { name: "Ride", exact: true })).toBeVisible();

  await page.goto("/systems/uber/?tab=reliability");
  await expect(page.getByText("Bottlenecks & fixes")).toBeVisible();
});

test("concept pages have interactive visuals and step-through diagrams", async ({ page }) => {
  await page.goto("/concepts/consistent-hashing/");
  await expect(page.getByRole("heading", { name: "See it in action" })).toBeVisible();
  await expect(page.getByText(/0\s*of 16 keys moved/)).toBeVisible();
  await page.getByRole("button", { name: "Add server D" }).click();
  await expect(page.getByText(/[1-9]\d*\s*of 16 keys moved/)).toBeVisible();

  await page.goto("/concepts/caching/");
  await page.getByRole("tab", { name: "Cache miss" }).click();
  await expect(page.getByText("1/4")).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText("2/4")).toBeVisible();
  await expect(page.locator(".react-flow__node-architecture")).toHaveCount(4);
});

test("learning paths track visited systems", async ({ page }) => {
  await page.goto("/systems/url-shortener/");
  await expect(page.getByRole("heading", { level: 1, name: "URL shortener" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("img", { name: "1 of 4 visited" })).toBeVisible();
});
