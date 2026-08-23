import { expect, test } from "@playwright/test";
import { capturePageDiagnostics } from "../helpers/diagnostics";
import {
  addOptionsProduct,
  addSimpleProduct,
  clearCart,
  qaOptionsProduct,
  qaSimpleProduct,
} from "../helpers/storefront";

test.describe.serial("Storefront menu and persisted cart", () => {
  test("STF-MENU-001/002 category navigation and both menu layouts", async ({
    page,
  }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "What are you craving?" }),
    ).toBeVisible({ timeout: 20_000 });
    const categories = page
      .getByRole("region", { name: "Menu categories" })
      .locator("button");
    expect(await categories.count()).toBeGreaterThan(1);
    const categoryName = (
      await categories.nth(1).locator("span").nth(1).textContent()
    )?.trim();
    await categories.nth(1).click();
    await expect(categories.nth(1)).toHaveAttribute("data-active", "true");
    if (categoryName)
      await expect(
        page.getByRole("heading", { name: categoryName, exact: true }),
      ).toBeVisible();

    const productCount = await page.locator("article.product-card").count();
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(
      page.getByRole("button", { name: "Grid view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator(".product-collection--grid").first(),
    ).toBeVisible();
    expect(await page.locator("article.product-card").count()).toBe(
      productCount,
    );
    await page.getByRole("button", { name: "List view" }).click();
    await expect(
      page.getByRole("button", { name: "List view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator(".product-collection--list").first(),
    ).toBeVisible();
    expect(await page.locator("article.product-card").count()).toBe(
      productCount,
    );
    await finishDiagnostics();
  });

  test("STF-MENU-003/004 and EXTRA-002 add simple/configured products, navigate, and persist", async ({
    page,
  }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    await clearCart(page);
    await addSimpleProduct(page);
    await addOptionsProduct(page, "Small");
    await expect(
      page.getByRole("button", { name: /Go to Cart/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Go to Cart/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(
      page.getByRole("heading", { name: qaSimpleProduct }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: qaOptionsProduct }),
    ).toBeVisible();
    await expect(page.getByText("Small", { exact: true })).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: qaSimpleProduct }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: qaOptionsProduct }),
    ).toBeVisible();
    await finishDiagnostics();
  });

  test("EXTRA-001 quantity 1→2→3→2→1 persists", async ({ page }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    await page.goto("/cart");
    const item = page
      .locator("article.cart-item")
      .filter({ has: page.getByRole("heading", { name: qaSimpleProduct }) });
    const stepper = item.getByLabel(`Quantity of ${qaSimpleProduct}`);
    for (const expected of [2, 3]) {
      await stepper.getByRole("button", { name: "Increase quantity" }).click();
      await expect(stepper.locator("span")).toHaveText(String(expected));
    }
    for (const expected of [2, 1]) {
      await stepper.getByRole("button", { name: "Decrease quantity" }).click();
      await expect(stepper.locator("span")).toHaveText(String(expected));
    }
    await page.reload();
    await expect(
      item.getByLabel(`Quantity of ${qaSimpleProduct}`).locator("span"),
    ).toHaveText("1");
    await finishDiagnostics();
  });

  test("STF-CART-001 configured line edit updates in place and persists", async ({
    page,
  }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    await page.goto("/cart");
    const item = page
      .locator("article.cart-item")
      .filter({ has: page.getByRole("heading", { name: qaOptionsProduct }) });
    await item.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: qaOptionsProduct }) });
    await dialog.getByRole("button", { name: /^Large/ }).click();
    await dialog
      .getByRole("button", { name: /Update Cart|Add to Cart/ })
      .click();
    await expect(item.getByText("Large", { exact: true })).toBeVisible();
    await expect(page.locator("article.cart-item")).toHaveCount(2);
    await page.reload();
    await expect(item.getByText("Large", { exact: true })).toBeVisible();
    await finishDiagnostics();
  });

  test("STF-CART-002 removing a line persists after refresh", async ({
    page,
  }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    await page.goto("/cart");
    const item = page
      .locator("article.cart-item")
      .filter({ has: page.getByRole("heading", { name: qaSimpleProduct }) });
    await item.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(item).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: qaSimpleProduct }),
    ).toHaveCount(0);
    await finishDiagnostics();
  });

  test("STF-CART-003 instructions survive local navigation during checkout review", async ({
    page,
  }, testInfo) => {
    const finishDiagnostics = capturePageDiagnostics(page, testInfo);
    const note = `QA TEST — no onions — ${Date.now()}`;
    await page.goto("/cart");
    await page.getByLabel("Special instructions for the restaurant").fill(note);
    await page.getByRole("button", { name: "Add more" }).click();
    await page.goBack();
    await expect(
      page.getByLabel("Special instructions for the restaurant"),
    ).toHaveValue(note);
    await finishDiagnostics();
  });
});
