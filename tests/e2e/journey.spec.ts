import { expect, test } from "@playwright/test";

test.describe("carbon journey", () => {
  test("overview journey section shows the timeline, normalised comparison and next step", async ({ page }) => {
    await page.goto("/");
    const section = page.getByRole("region", { name: "Your carbon journey" });
    await expect(section).toBeVisible();

    await expect(section.getByRole("heading", { name: "Progress you can read at a glance" })).toBeVisible();
    await expect(section.getByText("Your next step")).toBeVisible();
    await expect(section.getByRole("heading", { name: "Every recorded step, in order" })).toBeVisible();

    // Recorded totals stay separate from the normalised metric.
    await expect(section.getByText("Recorded total").first()).toBeVisible();
    await expect(section.getByText(/kWh per day, like for like/)).toBeVisible();
    await expect(section.getByText(/Observed daily use/)).toBeVisible();

    // Completed actions are labelled as user-reported.
    await expect(section.getByText("User-reported").first()).toBeVisible();
  });

  test("dedicated journey view is reachable from the sidebar and keeps goal badges", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Journey" }).click();
    await expect(page).toHaveURL(/\/journey$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Progress, one confirmed bill at a time");

    // The demo household has six bills, so the confirmed badge must appear.
    const goalPanel = page.getByRole("region", { name: /kWh next period|No goal yet/ });
    await expect(goalPanel.getByText("Confirmed", { exact: true })).toBeVisible();

    // The usage-trend chart has an equivalent data table.
    const table = page.getByRole("table", { name: /Daily usage trend by billing period/i });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(7);
  });

  test("next step prioritises an open action, then falls back to review when all are complete", async ({ page }) => {
    await page.goto("/journey");
    const next = page.locator(".journey-next").first();
    await expect(next.getByText("Your next step")).toBeVisible();
    await expect(next.getByRole("link", { name: /Open this action|Review your plan/ })).toBeVisible();

    // Complete every open action, then confirm the card switches to review.
    await page.goto("/actions");
    const cards = page.locator(".plan-card");
    const total = await cards.count();
    const flipped: number[] = [];
    for (let index = 0; index < total; index += 1) {
      const card = cards.nth(index);
      const isDone = (await card.getAttribute("class"))?.includes("completed") ?? false;
      if (!isDone) {
        await card.getByRole("button", { name: /Mark complete/ }).click();
        await expect(card).toHaveClass(/completed/);
        flipped.push(index);
      }
    }

    await page.goto("/journey");
    await expect(page.locator(".journey-next").first().getByRole("heading", { name: "Review your plan" })).toBeVisible();
    await expect(page.locator(".journey-next").first().getByRole("link", { name: "Add the next bill" })).toBeVisible();

    // Restore the demo household so later specs see the seeded state.
    await page.goto("/actions");
    for (const index of flipped) {
      await page.locator(".plan-card").nth(index).getByRole("button", { name: /Mark incomplete/ }).click();
      await expect(page.locator(".plan-card").nth(index)).not.toHaveClass(/completed/);
    }
  });

  test("action completion is user-reported, survives a refresh, and can be undone", async ({ page }) => {
    await page.goto("/actions");
    const first = page.locator(".plan-card").first();
    const title = (await first.getByRole("heading").textContent()) ?? "";

    const wasDone = (await first.getAttribute("class"))?.includes("completed") ?? false;
    await first.getByRole("button", { name: /Mark (complete|incomplete)/ }).click();

    await page.reload();
    const afterReload = page.locator(".plan-card").first();
    if (wasDone) await expect(afterReload).not.toHaveClass(/completed/);
    else await expect(afterReload).toHaveClass(/completed/);

    // The journey timeline reflects the saved state, labelled user-reported.
    await page.goto("/journey");
    const completed = page.locator(".journey-actions");
    if (wasDone) {
      await expect(completed.getByText(title, { exact: false })).toHaveCount(0);
    } else {
      await expect(completed.getByText(title, { exact: false })).toBeVisible();
      await expect(completed.getByText("User-reported").first()).toBeVisible();
    }

    // Undo from the plan and confirm the timeline drops it again.
    await page.goto("/actions");
    await page.locator(".plan-card").first().getByRole("button", { name: /Mark incomplete/ }).click();
    await page.reload();
    await expect(page.locator(".plan-card").first()).not.toHaveClass(/completed/);

    await page.goto("/journey");
    if (wasDone) await expect(completed.getByText(title, { exact: false })).toBeVisible();
    else await expect(completed.getByText(title, { exact: false })).toHaveCount(0);
  });

  test("the next-step card marks its recommended action done and shows it as user-reported", async ({ page }) => {
    await page.goto("/journey");
    const next = page.locator(".journey-next").first();
    const actionId = await next.getAttribute("data-action-id");
    expect(actionId).toBeTruthy();
    const complete = next.getByRole("button", { name: "Mark as done" });
    await expect(complete).toBeVisible();

    await complete.click();
    // The card recomputes from saved state, so a different action is recommended.
    await expect(next).not.toHaveAttribute("data-action-id", actionId ?? "", { timeout: 10_000 });

    // The same household history remains, with the completion labelled user-reported.
    const timeline = page.locator(".journey-timeline-panel");
    await expect(timeline.getByText("User-reported").first()).toBeVisible();
    await expect(timeline.getByText("September 2026")).toBeVisible();

    // Undo through the plan so the seeded demo state is restored.
    await page.goto("/actions");
    const card = page.locator(`.plan-card[data-action-id="${actionId}"]`);
    await expect(card).toHaveClass(/completed/);
    await card.getByRole("button", { name: /Mark incomplete/ }).click();
    await expect(card).not.toHaveClass(/completed/);
  });


  test("journey timeline never claims an action caused a usage change", async ({ page }) => {
    await page.goto("/journey");
    await expect(page.getByText(/Completing an action never claims/)).toBeVisible();
    await expect(page.getByText(/you saved/i)).toHaveCount(0);
  });
});
