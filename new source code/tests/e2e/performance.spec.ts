import { expect, test } from "@playwright/test";

/**
 * Performance budget from PRD 01: LCP under 2.5 s on 4G for Overview.
 * Chromium-only: WebKit does not expose LCP the same way here.
 */
test.describe("performance budget", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "LCP measured on Chromium");

  test("overview LCP is under 2.5s on a throttled 4G profile", async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    await page.goto("/", { waitUntil: "load" });

    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let value = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) value = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          window.setTimeout(() => resolve(value), 2500);
        }),
    );

    console.log(`LCP: ${lcp.toFixed(0)} ms`);
    expect(lcp).toBeLessThan(2500);
  });

  test("overview transfers no third-party scripts", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).host));

    await page.goto("/", { waitUntil: "networkidle" });

    const allowed = new Set(["127.0.0.1:3100", "localhost:3100", "fonts.googleapis.com", "fonts.gstatic.com"]);
    const unexpected = [...new Set(requests)].filter((host) => !allowed.has(host));
    expect(unexpected).toEqual([]);
  });
});
