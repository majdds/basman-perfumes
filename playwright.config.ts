import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a PRODUCTION build (`next build && next start`)
 * backed by DynamoDB Local with a dedicated table, so CSP, headers and
 * server behaviour match what customers get.
 */
const PORT = 3100;
export const E2E_TABLE = "basman-e2e";
const env = {
  APP_ENV: "test",
  SITE_URL: `http://localhost:${PORT}`,
  AWS_REGION: "eu-central-1",
  DYNAMODB_TABLE: E2E_TABLE,
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
  STORAGE_DRIVER: "local",
  TRUST_PROXY: "true",
  PROXY_HOPS: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ar-PS",
    timezoneId: "Asia/Hebron",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    // robots.txt needs no database, so the server is "ready" before global setup seeds data.
    url: `http://localhost:${PORT}/robots.txt`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { ...env, NEXT_TELEMETRY_DISABLED: "1" },
    stdout: "pipe",
  },
  metadata: { env },
});
