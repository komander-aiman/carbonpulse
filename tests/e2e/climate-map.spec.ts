import { expect, test } from "@playwright/test";

test("the one map renders with zone shading, legend and a table equivalent", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/community");
  await page.waitForFunction(
    () =>
      document.querySelector(".maplibregl-canvas") !== null ||
      document.querySelector(".map-fallback") !== null,
    { timeout: 25_000 },
  );

  await expect(page.getByRole("heading", { name: "Zone shading and the shared goal" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Zone aggregates/ })).toBeVisible();
  await expect(page.getByText(/OSM-derived/).first()).toBeVisible();

  const canvases = await page.locator(".maplibregl-canvas").count();
  const fallbacks = await page.locator(".map-fallback").count();
  expect(canvases > 0 || fallbacks === 1).toBe(true);

  console.log("console errors:", errors.filter((error) => !/favicon/i.test(error)).slice(0, 4));
});

test("climate context panel carries sources and no household numbers", async ({ page }) => {
  await page.goto("/community");
  const panel = page.getByRole("region", { name: /The atmosphere around the pilot/i });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/regional CAMS estimate/)).toBeVisible();
  await expect(panel.getByRole("table", { name: /Regional model estimates/ })).toBeVisible();
  // The panel is context only: no household kWh or comparison figures.
  await expect(panel.getByText(/kWh/)).toHaveCount(0);
});

test("timeline entries are context, not a household deduction", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByText(/1850–2030/).first()).toBeVisible();
  await expect(page.getByText(/never deducted from a household estimate/)).toBeVisible();
});

test("shared-goal bar publishes with a text equivalent at k", async ({ page }) => {
  await page.goto("/community?demo=true");
  const bar = page.getByRole("progressbar", { name: "Shared goal progress" });
  if ((await bar.count()) > 0) {
    await expect(bar).toHaveAttribute("aria-valuenow");
    await expect(page.getByText(/Shared goal ·/)).toBeVisible();
  } else {
    await expect(page.getByText("Not enough data yet").first()).toBeVisible();
  }
});
