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

  test("cohort is suppressed rather than seeded", async ({ page }) => {
    await page.goto("/community");
    const body = await page.locator("main").innerText();

    expect(body).not.toContain("Demo cohort");
    expect(body).toContain("Not enough participants");
    expect(body).not.toContain("Opted-in households");
  });

  test("climate feeds are honest about their source", async ({ page }) => {
    await page.goto("/community");
    await page.waitForFunction(
      () => document.querySelector(".leaflet-container") !== null || document.querySelector(".map-fallback") !== null,
      { timeout: 25_000 },
    );
    const status = await page.locator(".live-data-state").innerText();
    console.log("status:", status.replace(/\n/g, " | "));

    // With demo off, the app may reach the live feeds. What must never happen
    // is claiming live while serving the recorded fallbacks, so the label has
    // to agree with the per-precinct Feed column.
    const table = page.getByRole("table", { name: /Same values as the map/i });
    const feedCells = await table.locator("tbody tr td:last-child").allInnerTexts();
    const liveCount = feedCells.filter((cell) => cell.trim() === "Live model").length;

    console.log("live precincts in table:", liveCount, "of", feedCells.length);

    if (/Live model feeds connected/.test(status)) {
      expect(liveCount).toBe(feedCells.length);
      await expect(table).toContainText(`${liveCount} of ${feedCells.length} precinct feeds live`);
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
});
