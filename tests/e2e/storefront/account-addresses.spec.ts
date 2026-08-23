import { expect, test } from "@playwright/test";
import { signInCustomer } from "../helpers/auth";
import { qaCredentials } from "../helpers/credentials";
import { capturePageDiagnostics } from "../helpers/diagnostics";

test("STF-ACC-001 personal details persist after refresh", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const qaName = `QA Customer ${Date.now()}`;
  await page.goto("/account");
  await expect(page.getByText("Email · Add email")).toBeVisible();
  await expect(page.getByText(/@auth\.invalid/i)).toHaveCount(0);
  await page.getByRole("button", { name: /^(Edit|Add details)$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Edit personal details" });
  await dialog.getByLabel("Name").fill(qaName);
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog.getByRole("status")).toContainText("Details saved");
  await expect(page.getByRole("heading", { name: qaName })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: qaName })).toBeVisible();
  await finishDiagnostics();
});

test("STF-ACC-002 sign out protects routes and re-login succeeds", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/your-addresses");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await signInCustomer(page, qaCredentials());
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await finishDiagnostics();
});

test("STF-ADDR-001/002/003 add, edit, persist, and delete only a QA address", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const stamp = Date.now();
  const line1 = `QA Customer Test Address ${stamp}`;
  const edited = `${line1} Edited`;
  const label = `QA ${String(stamp).slice(-6)}`;

  await page.goto("/your-addresses");
  await page
    .getByRole("button", { name: /Add new address|Add address/ })
    .last()
    .click();
  const add = page.getByRole("dialog", { name: "Add delivery address" });
  await add.getByPlaceholder("Your name").fill("QA Customer");
  await add.getByPlaceholder("+91 98765 43210").fill("9940376914");
  await add.getByPlaceholder("e.g. Palm Grove Guest House").fill(line1);
  await add.getByText("Mandrem", { exact: true }).click();
  await add.getByRole("radio", { name: "Arambol" }).click();
  await add.getByLabel("Other").check();
  await add.getByPlaceholder("e.g. Beach house").fill(label);
  await add.getByRole("button", { name: "Save and check delivery" }).click();
  const card = page
    .locator("article.saved-address-card")
    .filter({ has: page.getByText(line1, { exact: true }) });
  await expect(card).toBeVisible();
  await page.reload();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit address" });
  await edit.getByPlaceholder("e.g. Palm Grove Guest House").fill(edited);
  await edit.getByRole("button", { name: "Save and check delivery" }).click();
  const editedCard = page
    .locator("article.saved-address-card")
    .filter({ has: page.getByText(edited, { exact: true }) });
  await expect(editedCard).toBeVisible();
  await page.reload();
  await expect(editedCard).toBeVisible();

  await editedCard.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Remove this address?" })
    .getByRole("button", { name: "Remove address", exact: true })
    .click();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(edited, { exact: true })).toHaveCount(0);
  await finishDiagnostics();
});
