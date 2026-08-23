import { expect, type Page } from "@playwright/test";
import type { QaCredentials } from "./credentials";

export async function signInAdmin(page: Page, credentials: QaCredentials) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Email & password" }).click();
  await page.getByLabel("Email address").fill(credentials.adminEmail);
  await page.getByLabel("Password").fill(credentials.adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /A2 Food and beverages · Arambol/i }),
  ).toBeVisible();
}

export async function signInCustomer(page: Page, credentials: QaCredentials) {
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await page
    .getByPlaceholder("Mobile number")
    .fill(credentials.customerPhone.replace(/^\+91/, ""));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your phone" }),
  ).toBeVisible({ timeout: 20_000 });

  const digits = page.locator('input[inputmode="numeric"]');
  if ((await digits.count()) === 1) {
    await digits.fill(credentials.customerOtp);
  } else {
    for (const [index, digit] of [...credentials.customerOtp].entries()) {
      await digits.nth(index).fill(digit);
    }
  }

  const accountHeading = page.getByRole("heading", { name: "Account" });
  const autoVerified = await accountHeading
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!autoVerified) {
    const verify = page.getByRole("button", { name: "Verify & continue" });
    await expect(verify).toBeEnabled();
    await verify.click();
  }
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible({
    timeout: 30_000,
  });
}
