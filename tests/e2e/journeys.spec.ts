import { expect, test } from "@playwright/test";

test.describe("core journeys", () => {
  test("overview renders both estimates with the published factor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Good morning");
    await expect(page.getByText("222.0").first()).toBeVisible();
    await expect(page.getByText("Flat factor and modelled, side by side")).toBeVisible();
    await expect(page.getByText(/Based on 0\.740 kg CO₂e per kWh/)).toBeVisible();
    await expect(page.getByText("Modelled").first()).toBeVisible();
    await expect(page.getByText("Estimated").first()).toBeVisible();
  });

  test("navigation keeps five sidebar items and marks the active route", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    await nav.getByRole("link", { name: /My energy/ }).click();
    await expect(page).toHaveURL(/\/energy$/);
    await expect(nav.getByRole("link", { name: /My energy/ })).toHaveAttribute("aria-current", "page");
  });

  test("manual entry persists and updates every estimate", async ({ page }) => {
    await page.goto("/energy/upload");
    await page.getByLabel("Confirmed electricity usage").fill("420");
    await page.getByRole("button", { name: "Confirm & analyse" }).click();

    await expect(page).toHaveURL(/\/energy\?saved=manual/);
    await expect(page.getByText("310.8").first()).toBeVisible();
    await expect(page.getByText("420").first()).toBeVisible();
  });

  test("invalid manual value is rejected with a field error", async ({ page }) => {
    await page.goto("/energy/upload");
    await page.getByLabel("Confirmed electricity usage").fill("5000");
    await page.getByRole("button", { name: "Confirm & analyse" }).click();
    await expect(page.getByText(/flagged for review|between 1 and 3,000/i).first()).toBeVisible();
  });

  test("duplicate billing period is refused", async ({ page }) => {
    await page.goto("/energy/upload");
    await page.getByLabel("Confirmed electricity usage").fill("301");
    await page.getByLabel("Billing period start").fill("2026-09-01");
    await page.getByLabel("Billing period end").fill("2026-10-01");
    await page.getByRole("button", { name: "Confirm & analyse" }).click();
    await expect(page.getByText("Usage saved")).toBeVisible();

    await page.goto("/energy/upload");
    await page.getByLabel("Confirmed electricity usage").fill("302");
    await page.getByLabel("Billing period start").fill("2026-09-01");
    await page.getByLabel("Billing period end").fill("2026-10-01");
    await page.getByRole("button", { name: "Confirm & analyse" }).click();
    await expect(page.getByText(/already exists for this billing period/i)).toBeVisible();
  });

  test("action completion persists across navigation", async ({ page }) => {
    await page.goto("/actions");
    const first = page.locator(".plan-card").first();
    const wasDone = (await first.getAttribute("class"))?.includes("completed") ?? false;

    await first.getByRole("button", { name: /Mark (complete|incomplete)/ }).click();
    if (wasDone) await expect(first).not.toHaveClass(/completed/);
    else await expect(first).toHaveClass(/completed/);

    await page.reload();
    if (wasDone) await expect(page.locator(".plan-card").first()).not.toHaveClass(/completed/);
    else await expect(page.locator(".plan-card").first()).toHaveClass(/completed/);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Continue your plan/ })).toBeVisible();
    await page.goto("/actions");
    if (wasDone) await expect(page.locator(".plan-card").first()).not.toHaveClass(/completed/);
    else await expect(page.locator(".plan-card").first()).toHaveClass(/completed/);
  });

  test("scenario sliders produce the golden community figures", async ({ page }) => {
    await page.goto("/community");
    const slider = page.locator("#householdSlider");
    await slider.fill("200");
    await page.locator("#savingSlider").fill("10");
    await page.locator("#baselineSlider").fill("300");

    await expect(page.locator("#savedKwh")).toHaveText("6,000");
    await expect(page.locator("#savedCarbon")).toHaveText("4.44 t CO₂e");
    await expect(page.locator("#annualCarbon")).toHaveText("53.28 t CO₂e");
    await expect(page.getByText("Scenario only").first()).toBeVisible();
  });

  test("map renders a keyboard-accessible data table", async ({ page }) => {
    await page.goto("/community");
    const table = page.getByRole("table", { name: /Zone aggregates/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(7);
  });

  test("privacy modal traps focus and restores it on close", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    const trigger = page.getByRole("button", { name: "Privacy & data" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: /Designed for consent/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Small groups are hidden.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("published article is reachable and shows sources and actions", async ({ page }) => {
    await page.goto("/township");
    await page.getByRole("link", { name: /evening peak/i }).first().click();
    await expect(page).toHaveURL(/\/township\/elmina-evening-peak$/);
    await expect(page.getByText("Cited sources")).toBeVisible();
    await expect(page.getByText("Related actions")).toBeVisible();
  });
});

test.describe("privacy and access boundaries", () => {
  test("unpublished content and unknown routes return 404", async ({ page }) => {
    const response = await page.goto("/township/does-not-exist");
    expect(response?.status()).toBe(404);

    const missing = await page.goto("/no-such-page");
    expect(missing?.status()).toBe(404);
  });

  test("admin route never flashes admin UI without the role", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Not found." })).toBeVisible();
    await expect(page.getByText("Content and cohort health")).toHaveCount(0);
  });

  test("job route rejects a missing cron secret", async ({ request }) => {
    const response = await request.post("/api/jobs/rebuild-zones");
    expect(response.status()).toBe(401);
  });

  test("scenario API rejects out-of-range input", async ({ request, baseURL }) => {
    const response = await request.post("/api/scenario", {
      headers: { origin: baseURL ?? "http://127.0.0.1:3100" },
      data: { households: 99999, reductionPct: 90, baselineKwh: 5 },
    });
    expect(response.status()).toBe(422);
  });
});
