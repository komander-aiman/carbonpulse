import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test("session id is stable across requests and pages", async ({ page }) => {
  await page.goto(BASE);
  const first = (await page.context().cookies()).find((c) => c.name === "carbonpulse_session")?.value;
  expect(first).toBeTruthy();

  await page.reload();
  await page.goto(`${BASE}/energy`);
  const later = (await page.context().cookies()).find((c) => c.name === "carbonpulse_session")?.value;
  expect(later).toBe(first);
});

test("usage posted via the UI survives navigation", async ({ page }) => {
  await page.goto(`${BASE}/energy/upload`);
  await page.getByLabel("Confirmed electricity usage").fill("456");
  await page.getByRole("button", { name: "Confirm & analyse" }).click();
  await expect(page).toHaveURL(/saved=manual/);

  await page.goto(`${BASE}/energy`);
  await expect(page.locator("body")).toContainText("456");
});

test("overlapping billing periods are rejected", async ({ page }) => {
  await page.goto(`${BASE}/energy/upload`);
  await page.getByLabel("Confirmed electricity usage").fill("310");
  await page.getByLabel("Billing period start").fill("2026-07-01");
  await page.getByLabel("Billing period end").fill("2026-08-01");
  await page.getByRole("button", { name: "Confirm & analyse" }).click();
  await expect(page).toHaveURL(/saved=manual/);

  await page.goto(`${BASE}/energy/upload`);
  await page.getByLabel("Confirmed electricity usage").fill("280");
  await page.getByLabel("Billing period start").fill("2026-07-15");
  await page.getByLabel("Billing period end").fill("2026-08-15");
  await page.getByRole("button", { name: "Confirm & analyse" }).click();

  await expect(page.locator("body")).toContainText(/overlaps an existing record/i);
});

test("future billing period is rejected", async ({ page }) => {
  await page.goto(`${BASE}/energy/upload`);
  await page.getByLabel("Confirmed electricity usage").fill("120");
  await page.getByLabel("Billing period start").fill("2099-01-01");
  await page.getByLabel("Billing period end").fill("2099-02-01");

  // The input carries `max={today}`, so the browser blocks submission. Assert
  // the field is genuinely invalid rather than merely silent.
  const isValid = await page
    .getByLabel("Billing period end")
    .evaluate((element) => (element as HTMLInputElement).checkValidity());
  expect(isValid).toBe(false);

  // The server must reject it too, not only the client.
  const response = await page.request.post(`${BASE}/api/usage`, {
    headers: { origin: BASE },
    data: { periodStart: "2099-01-01", periodEnd: "2099-02-01", kwh: 120 },
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.error.message).toMatch(/cannot end in the future/i);
});

test("CSV row errors reach the user", async ({ page }) => {
  await page.goto(`${BASE}/energy/upload`);
  await page.getByRole("tab", { name: "Half-hourly CSV" }).click();

  const csv = [
    "timestamp,kwh",
    "2026-09-01T00:00:00+08:00,0.3",
    "2026-09-01T00:30:00+08:00,900",
    "2026-09-01T01:00:00+08:00,0.31",
  ].join("\n");

  await page.setInputFiles("#file", {
    name: "interval.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: /Validate & save intervals/ }).click();

  await expect(page.locator("body")).toContainText(/Wh reported as kWh/i);
});

test("oversized CSV span is rejected", async ({ page }) => {
  await page.goto(`${BASE}/energy/upload`);
  await page.getByRole("tab", { name: "Half-hourly CSV" }).click();

  const start = Date.parse("2026-01-01T00:00:00Z");
  const lines = ["timestamp,kwh"];
  for (let i = 0; i < 100 * 48; i += 1) {
    lines.push(`${new Date(start + i * 30 * 60_000).toISOString()},0.3`);
  }

  await page.setInputFiles("#file", {
    name: "long.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(lines.join("\n")),
  });
  await page.getByRole("button", { name: /Validate & save intervals/ }).click();

  await expect(page.locator("body")).toContainText(/more than 90 days/i);
});

test("security headers are present", async ({ page }) => {
  const response = await page.goto(BASE);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("cross-origin mutation is refused", async ({ request }) => {
  const response = await request.post("/api/consent", {
    headers: { origin: "https://evil.example" },
    data: { scope: "aggregation", action: "granted" },
  });
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error.code).toBe("cross_origin");
});

test("same-origin mutation is accepted", async ({ request }) => {
  const response = await request.post("/api/consent", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { scope: "aggregation", action: "granted" },
  });
  expect(response.status()).toBe(200);
});
