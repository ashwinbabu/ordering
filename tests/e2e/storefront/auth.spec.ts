import { expect, test } from "@playwright/test";
import { signInCustomer } from "../helpers/auth";
import { qaCredentials } from "../helpers/credentials";
import { capturePageDiagnostics } from "../helpers/diagnostics";

test.use({ storageState: { cookies: [], origins: [] } });

test("STF-AUTH-001 login honors the explicit account intent and restores the session", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await signInCustomer(page, qaCredentials());
  await expect(page).toHaveURL(/\/account$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Loading your account" }),
  ).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText(/@auth\.invalid/i)).toHaveCount(0);
  await finishDiagnostics();
});
