import { expect, test } from "@playwright/test";
import { signInAdmin } from "../helpers/auth";
import { qaCredentials } from "../helpers/credentials";
import { capturePageDiagnostics } from "../helpers/diagnostics";

test.use({ storageState: { cookies: [], origins: [] } });

test("Admin QA account resolves to A2 Arambol", async ({ page }, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await signInAdmin(page, qaCredentials());
  await expect(
    page.getByRole("button", { name: /A2 Food and beverages · Arambol/i }),
  ).toBeVisible();
  await finishDiagnostics();
});
