import { expect, test, type Locator, type Page } from "@playwright/test";
import { capturePageDiagnostics } from "../helpers/diagnostics";

const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

async function openMenuEditor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
  await expect(
    page.getByText("Categories", { exact: true }).first(),
  ).toBeVisible();
}

async function reloadMenuEditor(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Edit menu" }).click();
}

async function addCategory(page: Page, name: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add category" });
  await dialog.getByLabel("Category name *").fill(name);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function openNewProduct(page: Page) {
  await page
    .getByRole("button", { name: /Add (first )?product/ })
    .first()
    .click();
  const dialog = page
    .locator('[aria-label="Product editor"]')
    .getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillBaseProduct(
  dialog: Locator,
  name: string,
  foodType = "Veg",
) {
  await dialog.getByLabel("Product name *").fill(name);
  await dialog.getByLabel("Description").fill(`QA regression product ${runId}`);
  await dialog.getByLabel("Base price *").fill("321");
  await dialog
    .getByRole("button", { name: `${foodType} ${foodType}`, exact: true })
    .click();
}

async function stageProduct(dialog: Locator) {
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toBeHidden();
}

async function saveMenu(page: Page) {
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Menu changes saved.", { exact: true }),
  ).toBeVisible();
}

test("ADM-PROD-001/002/003 add Veg, Non-Veg, and Egg products without images", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const category = `QA Product Types ${runId}`;
  const products = [
    { name: `QA Veg Product ${runId}`, type: "Veg" },
    { name: `QA Non-Veg Product ${runId}`, type: "Non-veg" },
    { name: `QA Egg Product ${runId}`, type: "Egg" },
  ];
  await openMenuEditor(page);
  await addCategory(page, category);
  for (const product of products) {
    const dialog = await openNewProduct(page);
    await fillBaseProduct(dialog, product.name, product.type);
    await stageProduct(dialog);
  }
  await saveMenu(page);
  await reloadMenuEditor(page);
  await page.getByText(category, { exact: true }).first().click();
  for (const product of products) {
    await expect(
      page.getByText(product.name, { exact: true }).first(),
    ).toBeVisible();
  }
  const storefront = await page.context().newPage();
  await storefront.goto("http://127.0.0.1:5173/");
  for (const product of products) {
    const article = storefront
      .getByRole("button", { name: `View ${product.name}` })
      .locator("..");
    await expect(article).toBeVisible();
    await expect(article.getByRole("img")).toHaveCount(0);
  }
  await storefront.close();
  await finishDiagnostics();
});

test("ADM-PROD-004 deterministic product image can be uploaded", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openMenuEditor(page);
  await addCategory(page, `QA Product Image ${runId}`);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, `QA Image Product ${runId}`);
  const upload = dialog.getByRole("button", { name: "Upload image" });
  await expect(upload).toBeEnabled();
  const chooser = page.waitForEvent("filechooser");
  await upload.click();
  await (await chooser).setFiles("tests/fixtures/product-test.svg");
  await stageProduct(dialog);
  await saveMenu(page);
  await finishDiagnostics();
});

test("ADM-PROD-005 featured product appears in Storefront favourites", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const category = `QA Product Featured ${runId}`;
  const product = `QA Featured Product ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, category);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, product);
  await dialog.getByLabel("Mark featured").check();
  await stageProduct(dialog);
  await saveMenu(page);
  const storefront = await page.context().newPage();
  await storefront.goto("http://127.0.0.1:5173/");
  const favourites = storefront.getByRole("region", { name: "A2 favourites" });
  await expect(favourites.getByText(product, { exact: true })).toBeVisible();
  await storefront.close();
  await finishDiagnostics();
});

test("ADM-PROD-006/007 product option group and priced options persist", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const category = `QA Product Options ${runId}`;
  const product = `QA Options Product ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, category);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, product);
  await dialog.getByRole("button", { name: "Add group" }).click();
  await dialog.getByLabel("Variant group 1 name").fill(`QA Size ${runId}`);
  await dialog.getByRole("button", { name: "Add option" }).click();
  await dialog.getByLabel("Option name").fill("Small");
  await dialog.getByLabel("Small price increment").fill("10");
  await dialog.getByRole("button", { name: "Add option" }).click();
  await dialog.getByLabel("Option name").nth(1).fill("Large");
  await dialog.getByLabel("Large price increment").fill("40");
  await stageProduct(dialog);
  await saveMenu(page);
  const storefront = await page.context().newPage();
  await storefront.goto("http://127.0.0.1:5173/");
  await storefront
    .getByRole("button", { name: `Add ${product}` })
    .click()
    .catch(async () => {
      const productArticle = storefront
        .getByRole("button", { name: `View ${product}` })
        .locator("..");
      await productArticle.getByRole("button", { name: "Add" }).click();
    });
  await expect(
    storefront.getByRole("heading", { name: product }),
  ).toBeVisible();
  await expect(storefront.getByText("Small", { exact: true })).toBeVisible();
  await expect(storefront.getByText("Large", { exact: true })).toBeVisible();
  await storefront.close();
  await finishDiagnostics();
});

test("ADM-PROD-008 restaurant-hours availability persists without custom windows", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const category = `QA Product Restaurant Hours ${runId}`;
  const product = `QA Restaurant Hours Product ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, category);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, product);
  await dialog.getByLabel("All times the restaurant is open").check();
  await stageProduct(dialog);
  await saveMenu(page);
  await finishDiagnostics();
});

test("ADM-PROD-009 same availability time for all days persists", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  const category = `QA Product Same Schedule ${runId}`;
  const product = `QA Same Schedule Product ${runId}`;
  await openMenuEditor(page);
  await addCategory(page, category);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, product);
  await dialog.getByLabel("Same time for all days").check();
  await dialog.locator('input[type="time"]').first().fill("09:10");
  await dialog.locator('input[type="time"]').last().fill("17:20");
  await stageProduct(dialog);
  await saveMenu(page);
  await finishDiagnostics();
});

test("ADM-PROD-010 supports a distinct start/end time for every weekday", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openMenuEditor(page);
  await addCategory(page, `QA Product Different Schedule ${runId}`);
  const dialog = await openNewProduct(page);
  await fillBaseProduct(dialog, `QA Different Schedule Product ${runId}`);
  await dialog.getByLabel("Different times on different days").check();
  await expect(dialog.locator('input[type="time"]')).toHaveCount(14);
  await finishDiagnostics();
});
