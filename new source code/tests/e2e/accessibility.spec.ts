import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/energy",
  "/energy/upload",
  "/actions",
  "/community",
  "/learn",
  "/township",
  "/township/elmina-evening-peak",
] as const;

/**
 * WCAG 2.2 A and AA. Only serious and critical violations fail the suite;
 * minor and moderate issues are reported in the test output.
 */
for (const route of ROUTES) {
  test(`axe: ${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );

    if (serious.length > 0) {
      console.log(
        JSON.stringify(
          serious.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target),
          })),
          null,
          2,
        ),
      );
    }

    expect(serious).toEqual([]);
  });
}

test("axe: privacy modal has no serious violations", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page.getByRole("button", { name: "Privacy & data" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
});

test("every chart exposes a text or table equivalent", async ({ page }) => {
  await page.goto("/energy");
  const table = page.getByRole("table", { name: /Confirmed billing periods/i });
  await expect(table).toBeVisible();

  await page.goto("/");
  const srTable = page.locator("table.sr-only");
  await expect(srTable).toHaveCount(1);
  await expect(srTable.getByRole("caption")).toContainText("Monthly recorded electricity usage");
});

test("keyboard user can reach the primary action and open the modal", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await page.getByRole("link", { name: "Add latest bill" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/energy\/upload$/);
  await expect(page.getByLabel("Confirmed electricity usage")).toBeVisible();
});
