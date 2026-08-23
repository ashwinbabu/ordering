import { defineConfig, devices } from "@playwright/test";

const storefrontUrl = "http://127.0.0.1:5173";
const adminUrl = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "admin-auth-setup",
      testDir: "./tests/e2e/setup",
      testMatch: "admin.setup.ts",
      use: { ...devices["Desktop Chrome"], baseURL: adminUrl },
    },
    {
      name: "customer-auth-setup",
      testDir: "./tests/e2e/setup",
      testMatch: "customer.setup.ts",
      use: { ...devices["Pixel 7"], baseURL: storefrontUrl },
    },
    {
      name: "admin-chromium",
      testDir: "./tests/e2e/admin",
      testMatch: "**/*.spec.ts",
      dependencies: ["admin-auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminUrl,
        storageState: "tests/.auth/admin.json",
      },
    },
    {
      name: "storefront-chromium",
      testDir: "./tests/e2e/storefront",
      testMatch: "**/*.spec.ts",
      dependencies: ["customer-auth-setup"],
      use: {
        ...devices["Pixel 7"],
        baseURL: storefrontUrl,
        storageState: "tests/.auth/customer.json",
      },
    },
    {
      name: "cross-app-chromium",
      testDir: "./tests/e2e/cross-app",
      testMatch: "**/*.spec.ts",
      dependencies: ["admin-auth-setup", "customer-auth-setup"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "storefront-webkit",
      testDir: "./tests/e2e/storefront",
      testMatch: "smoke.spec.ts",
      dependencies: ["customer-auth-setup"],
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        baseURL: storefrontUrl,
        storageState: "tests/.auth/customer.json",
      },
    },
  ],
  webServer: [
    {
      command:
        "bash scripts/use-project-node.sh npm run dev --workspace @a2/storefront -- --host 127.0.0.1 --port 5173 --strictPort",
      url: storefrontUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        "bash scripts/use-project-node.sh npm run dev --workspace @a2/admin -- --host 127.0.0.1 --port 5174 --strictPort",
      url: adminUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
