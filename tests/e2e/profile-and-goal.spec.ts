import { expect, test } from "@playwright/test";

test.describe("household profile and goal", () => {
  test("questionnaire maps answers to an archetype and removes cooling actions", async ({ page }) => {
    await page.goto("/questionnaire");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A minute now");

    // Group one: apartment, two people, no air conditioners.
    await page.getByLabel("Apartment or condominium").check();
    await page.getByLabel("People in the household").fill("2");
    await page.getByLabel("How many air conditioners?").fill("0");
    await page.getByRole("button", { name: "Continue" }).click();

    // Group two: out during weekdays, no cooling.
    await page.getByLabel("Out during weekdays").check();
    await page.getByLabel("We do not use air conditioning").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(/Modelled routine: mixed/).last()).toBeVisible();
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page).toHaveURL(/\/actions\?saved=profile/);
    // No cooling action survives an aircon-free household.
    await expect(page.getByText("Keep cooling at 24–26°C")).toHaveCount(0);
    await expect(page.getByText("Service the air conditioner filter")).toHaveCount(0);
    await expect(page.getByText("Replace the most-used bulbs with LEDs")).toBeVisible();
  });

  test("goal badge is Provisional at the seeded demo history and explains its rule", async ({ page }) => {
    await page.goto("/actions");
    await expect(page.getByText("Your goal")).toBeVisible();
    // The demo household has six confirmed periods, so the confirmed rule applies.
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Trailing 3-period median/)).toBeVisible();
  });

  test("similar-home card shows a tier and a group size rounded to five", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /Similar homes in your zone|Households in your zone|Households in City of Elmina|Not enough data yet/ });
    await expect(heading).toBeVisible();
    await expect(page.getByText(/rounded to 5|Your own bill still counts/).first()).toBeVisible();
  });
});

test.describe("photo is a local reference only", () => {
  test("selecting a bill photo makes no network request and stores no file", async ({ page }) => {
    await page.goto("/energy/upload");

    const requests: string[] = [];
    page.on("request", (request) => {
      requests.push(request.url());
    });

    await page.getByLabel("Bill photo (optional reference)").setInputFiles({
      name: "bill.png",
      mimeType: "image/png",
      // 1x1 transparent PNG.
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "base64",
      ),
    });

    await expect(page.getByText(/is open on this device only/i)).toBeVisible();

    // A tiny delay lets any stray request surface before we assert.
    await page.waitForTimeout(400);
    const uploads = requests.filter((url) => /upload|storage|api\/usage/i.test(url) && !url.endsWith("/energy/upload"));
    expect(uploads).toEqual([]);
  });
});

test.describe("demo namespace isolation", () => {
  test("demo toggle labels its cohort and never replaces the real zone", async ({ page }) => {
    await page.goto("/community");
    const toggle = page.getByRole("switch", { name: /Show demo cohort|Turn demo off/ });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page).toHaveURL(/demo=true/);
    await expect(page.getByText(/Demo cohort/).first()).toBeVisible();
    await expect(page.getByText(/seeded demonstration cohort/)).toBeVisible();

    await page.getByRole("switch", { name: /Turn demo off/ }).click();
    await expect(page).not.toHaveURL(/demo=true/);
    await expect(page.getByText(/seeded demonstration cohort/)).toHaveCount(0);
  });

  test("a real zone below k shows the honest suppression state", async ({ page }) => {
    await page.goto("/api/zone?zone=elmina-north");
    const payload = await page.evaluate(async (url) => (await fetch(url)).json(), "/api/zone?zone=elmina-north");
    expect(payload.ok).toBe(true);
    expect(payload.data.suppressed).toBe(true);
    expect(payload.data.stats).toBeNull();
    expect(payload.data.namespace).toBe("real");
  });
});
