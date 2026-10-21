import { defineConfig, devices } from "@playwright/test";

/**
 * Two servers with different configuration:
 * - port 3100: DEMO_MODE unset (demo on), the default suite
 * - port 3101: DEMO_MODE=false, exercised by tests/e2e/demo-mode-off.spec.ts
 *
 * The demo-off spec is excluded from the default project and vice versa, so
 * neither can accidentally run against the wrong server.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // One worker: the suite includes a CPU-throttled LCP budget, and parallel
  // browsers on the same machine make that measurement unstable rather than
  // slow. Serial execution costs about 40 seconds in total.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /demo-mode-off\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /demo-mode-off\.spec\.ts/,
    },
    {
      name: "demo-off",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3101" },
      testMatch: /demo-mode-off\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "npm run build && npm run start -- --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        SESSION_SECRET: "playwright-e2e-session-secret-value",
        DEMO_MODE: "true",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      },
    },
    {
      command: "npm run start -- --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        SESSION_SECRET: "playwright-e2e-session-secret-value",
        DEMO_MODE: "false",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3101",
      },
    },
  ],
});
