import { defineConfig, devices } from "@playwright/test";

const AI_SPECS = ["**/pengaturan-ai.spec.ts", "**/quick-add-ai.spec.ts", "**/struk.spec.ts"];

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/helpers/global-setup.ts",
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", caret: "hide" },
  },
  // spesifikasi AI berbagi satu baris ai_settings rumah tangga, jadi dijalankan satu per satu setelah yang lain
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: AI_SPECS },
    { name: "chromium-ai", use: { ...devices["Desktop Chrome"] }, testMatch: AI_SPECS, workers: 1, dependencies: ["chromium"] },
    // WebKit mewakili Safari iOS; di container dev hanya Chromium yang terpasang
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: AI_SPECS },
    { name: "webkit-ai", use: { ...devices["Desktop Safari"] }, testMatch: AI_SPECS, workers: 1, dependencies: ["webkit"] },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
