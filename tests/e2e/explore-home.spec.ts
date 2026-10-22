import { expect, test } from "@playwright/test";

test.describe("explore your home", () => {
  test("selecting a room updates the details panel and keeps a text alternative", async ({ page }) => {
    await page.goto("/actions");

    const section = page.locator("section.explore");
    await expect(section.getByRole("heading", { name: "Where could you start?" })).toBeVisible();

    const bathroom = section.getByRole("button", { name: /^Bathroom/ }).first();
    await expect(section.locator('.explore-hotspot[aria-pressed="true"]')).toHaveCount(1);

    await bathroom.click();
    await expect(bathroom).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("heading", { name: "Bathroom", level: 3 })).toBeVisible();
    await expect(section.getByText("Shorten water-heating time")).toBeVisible();
  });

  test("the room list is keyboard operable and the details link to the action plan", async ({ page }) => {
    await page.goto("/actions");
    const list = page.getByRole("group", { name: "Rooms and lighting" });
    const lighting = list.getByRole("button", { name: /^Lighting/ });

    await lighting.focus();
    await page.keyboard.press("Enter");
    await expect(lighting).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Lighting", level: 3 })).toBeVisible();

    const planLink = page.getByRole("link", { name: "Open your ranked action plan" });
    await expect(planLink).toHaveAttribute("href", "/actions#action-plan");
  });

  test("no appliance or room consumption is presented as recorded", async ({ page }) => {
    await page.goto("/actions");
    const section = page.locator("section.explore");
    const text = await section.innerText();

    expect(text).toContain("not per-room use");
    expect(text).toContain("No room-level percentage");
    expect(text).not.toMatch(/recorded.*\b(room|appliance)\b/i);
  });

  test("mobile keeps the room list and stacks the panel under the illustration", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/actions");

    await expect(page.getByRole("group", { name: "Rooms and lighting" }).getByRole("button")).toHaveCount(5);
    const illustration = page.locator(".explore-illustration");
    const details = page.locator(".explore-details");
    const illustrationBox = await illustration.boundingBox();
    const detailsBox = await details.boundingBox();

    expect(illustrationBox).not.toBeNull();
    expect(detailsBox).not.toBeNull();
    expect(detailsBox!.y).toBeGreaterThan(illustrationBox!.y + illustrationBox!.height - 1);
  });
});

