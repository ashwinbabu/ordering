import { expect, test, type Page } from "@playwright/test";
import { capturePageDiagnostics } from "../helpers/diagnostics";

const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

async function openMenuEditor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByText("Menu availability", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await expect(
    page.getByText("Categories", { exact: true }).first(),
  ).toBeVisible();
}

async function reloadMenuEditor(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await expect(
    page.getByText("Categories", { exact: true }).first(),
  ).toBeVisible();
}

async function addCategory(page: Page, name: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add category" });
  await dialog.getByLabel("Category name *").fill(name);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function saveMenu(page: Page) {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Menu changes saved.", { exact: true }),
  ).toBeVisible();
}

async function openCategoryActions(page: Page, name: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  return page.getByRole("menu");
}

test("ADM-CAT-001 add category persists after refresh", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const name = `QA Category Add ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, name);
  await saveMenu(page);
  await reloadMenuEditor(page);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await finishDiagnostics();
});

test("ADM-CAT-002 rename preserves the category across refresh", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const original = `QA Category Rename ${runId}`;
  const renamed = `${original} Updated`;
  await openMenuEditor(page);
  await addCategory(page, original);
  await saveMenu(page);
  const menu = await openCategoryActions(page, original);
  await menu.getByRole("button", { name: "Rename" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename category" });
  await dialog.getByLabel("Category name *").fill(renamed);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(original, { exact: true })).toHaveCount(0);
  await saveMenu(page);
  await reloadMenuEditor(page);
  await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();
  await finishDiagnostics();
});

test("ADM-CAT-003 duplicate creates an independent category", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const original = `QA Category Duplicate ${runId}`;
  const duplicate = `Copy of ${original}`;
  await openMenuEditor(page);
  await addCategory(page, original);
  await saveMenu(page);
  const menu = await openCategoryActions(page, original);
  await menu.getByRole("button", { name: "Duplicate" }).click();
  await expect(
    page.getByText(duplicate, { exact: true }).first(),
  ).toBeVisible();
  await saveMenu(page);
  await reloadMenuEditor(page);
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(duplicate, { exact: true }).first(),
  ).toBeVisible();
  await finishDiagnostics();
});

test("ADM-CAT-004 category availability schedule persists", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const name = `QA Category Schedule ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, name);
  const menu = await openCategoryActions(page, name);
  await menu.getByRole("button", { name: "Edit availability times" }).click();
  const dialog = page.getByRole("dialog", { name: "Availability times" });
  await dialog.getByLabel("Same time for all days").check();
  await dialog.getByLabel("Start").fill("10:15");
  await dialog.getByLabel("End").fill("18:45");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Daily, 10:15 AM–6:45 PM")).toBeVisible();
  await saveMenu(page);
  await reloadMenuEditor(page);
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByText("Daily, 10:15 AM–6:45 PM")).toBeVisible();
  await finishDiagnostics();
});

test("ADM-CAT-005 saved empty category can be deleted through the UI", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const name = `QA Category Delete ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, name);
  await saveMenu(page);
  const menu = await openCategoryActions(page, name);
  const deleteButton = menu.getByRole("button", { name: "Delete" });
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();
  await page
    .getByRole("dialog", { name: "Delete category" })
    .getByRole("button", { name: "Delete category" })
    .click();
  await saveMenu(page);
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await finishDiagnostics();
});

test("ADM-CAT-006 category reordering persists", async ({ page }, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const first = `QA Category Order A ${runId}`;
  const second = `QA Category Order B ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, first);
  await addCategory(page, second);
  await saveMenu(page);
  await page.getByRole("button", { name: `Move ${second} up` }).click();
  await saveMenu(page);
  await reloadMenuEditor(page);
  const names = await page
    .locator(".category-editor-list .category-select-button strong")
    .allTextContents();
  expect(names.indexOf(second)).toBeLessThan(names.indexOf(first));
  await finishDiagnostics();
});
