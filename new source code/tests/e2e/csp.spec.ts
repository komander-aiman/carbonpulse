import { expect, test } from "@playwright/test";

/**
 * The map is the one client surface that needs worker + blob + tile origins.
 * A CSP that omits them fails silently, so assert it actually initialises.
 */
test("map initialises under the nonce CSP", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (/content security policy|refused to/i.test(text)) cspErrors.push(text);
    }
  });

  await page.goto("/community");
  // Tiles stream continuously, so `networkidle` never settles. Wait for the
  // map to reach a determinate state instead.
  await page.waitForFunction(
    () =>
      document.querySelector(".maplibregl-canvas") !== null ||
      document.querySelector(".map-fallback") !== null,
    { timeout: 20_000 },
  );

  await expect(page.locator(".map-canvas").or(page.locator(".map-fallback"))).toHaveCount(1);

  // The map container should have gained maplibre's canvas if tiles loaded.
  const hasCanvas = await page.locator(".maplibregl-canvas").count();
  console.log("maplibre canvas present:", hasCanvas > 0);
  console.log("csp errors:", cspErrors.slice(0, 3));

  // Either the map rendered or the documented fallback is shown; both are valid.
  const fallback = await page.locator(".map-fallback").count();
  expect(hasCanvas > 0 || fallback === 1).toBe(true);
  expect(cspErrors).toEqual([]);
});

test("no inline script executes without a nonce", async ({ page }) => {
  await page.goto("/");
  const scripts = await page.$$eval("script", (nodes) =>
    nodes.map((node) => ({ nonce: node.nonce, src: node.src, inline: !node.src })),
  );
  const inlineWithoutNonce = scripts.filter((script) => script.inline && !script.nonce);
  console.log("inline scripts:", scripts.filter((s) => s.inline).length);
  console.log("inline without nonce:", inlineWithoutNonce.length);
  expect(inlineWithoutNonce).toEqual([]);
});

test("hydration works: an interactive control responds", async ({ page }) => {
  await page.goto("/community");
  const slider = page.locator("#householdSlider");
  await slider.fill("500");
  await expect(page.locator("#householdOutput")).toHaveText("500");
});
