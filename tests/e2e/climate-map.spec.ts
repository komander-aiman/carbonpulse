import { expect, test } from "@playwright/test";

test("the township climate map renders with layer switcher, legend, and a table equivalent", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/community");
  await page.waitForFunction(
    () =>
      document.querySelector("#climateMap.leaflet-container") !== null ||
      document.querySelector("#mapFallback") !== null,
    { timeout: 25_000 },
  );

  await expect(page.getByRole("heading", { name: "Township climate pulse" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Map data layer" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Same values as the map/ })).toBeVisible();

  const canvases = await page.locator("#climateMap.leaflet-container").count();
  const fallbacks = await page.locator("#mapFallback").count();
  expect(canvases > 0 || fallbacks === 1).toBe(true);

  console.log("console errors:", errors.filter((error) => !/favicon|tile/i.test(error)).slice(0, 4));
});

test("household layer is labelled an estimate, and no household location is drawn", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByRole("button", { name: "Household footprint" })).toBeVisible();
  await expect(page.getByText(/not a Scope 3 inventory result/)).toBeVisible();
  await expect(page.getByText(/this map carries no household-level location/)).toBeVisible();
  // The layer is a scenario, not a measured township figure.
  await expect(page.getByText(/Illustrative monthly electricity-use scenario/)).toBeVisible();
});

test("switching layers changes the legend copy", async ({ page }) => {
  await page.goto("/community");
  const description = page.locator("#mapLayerDescription");
  await expect(description).toContainText("electricity-use scenario");

  await page.getByRole("button", { name: "Atmospheric CO₂" }).click();
  await expect(description).toContainText("background concentration");

  await page.getByRole("button", { name: "Air quality & CO" }).click();
  await expect(description).toContainText("CAMS ENSEMBLE");
});

test("timeline entries are context, not a household deduction", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByText(/1850–2030/).first()).toBeVisible();
  await expect(page.getByText(/never deducted from a household estimate/)).toBeVisible();
});

test("township map is separate from the consent-gated zone map", async ({ page }) => {
  await page.goto("/community");
  // Both maps exist for different jobs, and only one of them is cohort-driven.
  await expect(page.getByRole("heading", { name: "Zone shading and the shared goal" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Zone aggregates/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Township climate pulse" })).toBeVisible();
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
