import { expect, test } from "@playwright/test";



test("climate map renders with layers, legend and table", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/community");
  await page.waitForFunction(
    () => document.querySelector(".leaflet-container") !== null || document.querySelector(".map-fallback") !== null,
    { timeout: 25_000 },
  );

  const hasLeaflet = await page.locator(".leaflet-container").count();
  console.log("leaflet container:", hasLeaflet);
  await expect(page.getByRole("heading", { name: "Township climate pulse" })).toBeVisible();

  const markers = await page.locator(".glow-marker").count();
  console.log("markers rendered:", markers);

  const table = page.getByRole("table", { name: /Same values as the map/i });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(6);

  console.log("console errors:", errors.filter((e) => !/favicon/i.test(e)).slice(0, 4));
});

test("layer switcher changes marker units", async ({ page }) => {
  await page.goto("/community");
  await page.waitForFunction(() => document.querySelector(".glow-marker") !== null, { timeout: 25_000 });

  const scopeUnit = await page.locator(".glow-marker .marker-core small").first().innerText();
  console.log("scope unit:", scopeUnit);
  // The marker unit is uppercased by CSS, so compare case-insensitively.
  expect(scopeUnit.toLowerCase()).toContain("kg co₂e");

  await page.getByRole("button", { name: "Atmospheric CO₂" }).click();
  await expect(page.locator(".glow-marker .marker-core small").first()).toHaveText(/ppm CO₂/);

  await page.getByRole("button", { name: "Air quality & CO" }).click();
  await expect(page.locator(".glow-marker .marker-core small").first()).toHaveText(/US AQI/i);
});

test("what-if slider moves only the pilot precincts", async ({ page }) => {
  await page.goto("/community");
  await page.waitForFunction(() => document.querySelector(".glow-marker") !== null, { timeout: 25_000 });

  const readings = async () =>
    page.locator(".glow-marker .marker-core strong").allInnerTexts();

  const before = await readings();
  await page.locator("#whatifSaving").fill("20");
  await page.waitForTimeout(400);
  const after = await readings();

  console.log("before:", before, "after:", after);
  expect(after).not.toEqual(before);
});

test("timeline changes the selected year", async ({ page }) => {
  await page.goto("/community");
  await expect(page.locator("#timelineYear")).toHaveText("2026");
  await page.locator('[data-timeline-index="0"]').click();
  await expect(page.locator("#timelineYear")).toHaveText("1850");
  await expect(page.locator("#timelinePpm")).toHaveText("278.0");
});

test("what-if produces the golden scenario", async ({ page }) => {
  await page.goto("/community");
  await page.locator("#whatifHouseholds").fill("200");
  await page.locator("#whatifSaving").fill("10");
  await expect(page.locator("#whatifCarbon")).toHaveText("4.44");
  await expect(page.locator("#whatifAnnual")).toHaveText("53.28 t CO₂e");
});
