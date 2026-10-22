import { expect, test } from "@playwright/test";

/**
 * Run against a server started with DEMO_MODE=false. Every assertion here is
 * about the app NOT presenting seeded data as real.
 */
test.describe("demo mode off", () => {
  test("fresh session shows an empty household, not the demo one", async ({ page }) => {
    await page.goto("/energy");
    const body = await page.locator("main").innerText();

    console.log("has demo name:", body.includes("Aiman"));
    console.log("has 300 kWh:", body.includes("300 kWh"));
    console.log("has 222.0:", body.includes("222.0"));

    // The demo household must not be seeded when the flag is off.
    expect(body).not.toContain("Aiman");
    expect(body).toContain("No confirmed periods yet");
  });

  test("zone is suppressed rather than seeded", async ({ page }) => {
    await page.goto("/community");
    const body = await page.locator("main").innerText();

    expect(body).not.toContain("Demo cohort · on");
    expect(body).toContain("Not enough data yet");
    expect(body).not.toContain("Seeded households");
  });

  test("climate feeds are honest about their source", async ({ page }) => {
    await page.goto("/community");
    const status = await page.locator(".live-data-state").innerText();
    console.log("status:", status.replace(/\n/g, " | "));

    // With demo off, the app may reach the live feeds. What must never happen
    // is claiming live while serving the recorded fallbacks, so the label has
    // to agree with the per-location Feed column.
    const table = page.getByRole("table", { name: /Same values as the map/i });
    const feedCells = await table.locator("tbody tr td:last-child").allInnerTexts();
    const liveCount = feedCells.filter((cell) => cell.trim() === "Live model").length;

    console.log("live feeds in table:", liveCount, "of", feedCells.length);

    if (/Live model feeds connected/.test(status)) {
      expect(liveCount).toBe(feedCells.length);
      await expect(table).toContainText(`${liveCount} of ${feedCells.length} township feeds live`);
    } else {
      expect(liveCount).toBe(0);
      expect(status).toMatch(/Fallback|Partial/);
    }
    expect(status).not.toContain("Demo mode");
  });

  test("overview renders without fabricating a trend", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("Good morning, Aiman");
    expect(body).toContain("No confirmed usage yet");
  });

  test("journey shows an honest first-run state and asks for the first bill", async ({ page }) => {
    await page.goto("/journey");
    const next = page.locator(".journey-next").first();
    await expect(next.getByRole("heading", { name: "Add your first bill" })).toBeVisible();
    await expect(next.getByRole("link", { name: "Add your first bill" })).toHaveAttribute("href", "/energy/upload");
    await expect(page.getByText("No billing periods yet")).toBeVisible();
    // No seeded milestone or completion is reconstructed for an empty household.
    await expect(page.getByText("Milestones appear after a confirmed bill meets your goal.")).toBeVisible();
    await expect(page.locator(".journey-actions")).toHaveCount(0);
  });

  test("one bill shows a starting point and asks for a second period", async ({ page }) => {
    await page.goto("/energy/upload");
    await page.getByLabel("Confirmed electricity usage").fill("300");
    await page.getByLabel("Billing period start").fill("2026-09-01");
    await page.getByLabel("Billing period end").fill("2026-10-01");
    await page.getByRole("button", { name: "Confirm & analyse" }).click();
    await expect(page).toHaveURL(/\/energy\?saved=manual/);

    await page.goto("/journey");
    // The recorded total is shown, and the comparison refuses to guess a trend.
    await expect(page.getByRole("heading", { name: "Progress, one confirmed bill at a time." })).toBeVisible();
    await expect(page.getByText("One bill is a starting point")).toBeVisible();
    await expect(page.getByText("Trend needs two comparable periods")).toBeVisible();
    await expect(page.getByText("Provisional", { exact: true }).first()).toBeVisible();
    // With a bill recorded, the next step moves on to the plan.
    await expect(page.locator(".journey-next").first().getByRole("link", { name: "Open this action" })).toBeVisible();
  });

  test("the demo toggle still requires demo mode to be available", async ({ page }) => {
    await page.goto("/community?demo=true");
    // DEMO_MODE is off, so the toggle cannot substitute a seeded cohort.
    await expect(page.getByText("Not enough data yet").first()).toBeVisible();
    await expect(page.getByText(/seeded demonstration cohort/)).toHaveCount(0);
  });
});
