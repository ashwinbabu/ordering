import { expect, type Page } from "@playwright/test";

export const qaSimpleProduct = "QA Veg Product 20260822043229";
export const qaOptionsProduct = "QA Options Product 20260822043306";

export async function clearCart(page: Page) {
  await page.goto("/cart");
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { name: "Your cart", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading your cart"),
  );
  const items = page.locator("article.cart-item");
  while ((await items.count()) > 0) {
    const before = await items.count();
    await items
      .first()
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(items).toHaveCount(before - 1);
  }
  await expect(
    page.getByText("Your cart is empty", { exact: true }),
  ).toBeVisible();
}

export async function addSimpleProduct(page: Page) {
  await page.goto("/");
  const card = page.locator("article.product-card").filter({
    has: page.getByText(qaSimpleProduct, { exact: true }),
  });
  await expect(card).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.url().includes("/rpc/set_cart_item"),
    ),
    card.getByRole("button", { name: "Add", exact: true }).click(),
  ]);
  if (!response.ok())
    throw new Error(
      `set_cart_item failed (${response.status()}): ${await response.text()}`,
    );
  await expect(card.getByLabel(`Quantity of ${qaSimpleProduct}`)).toContainText(
    "1",
  );
}

export async function addOptionsProduct(page: Page, option = "Small") {
  await page.goto("/");
  const card = page.locator("article.product-card").filter({
    has: page.getByText(qaOptionsProduct, { exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: qaOptionsProduct }),
  });
  await dialog.getByRole("button", { name: new RegExp(`^${option}`) }).click();
  await dialog.getByRole("button", { name: /Add to Cart/ }).click();
  await expect(
    card.getByLabel(`Quantity of ${qaOptionsProduct}`),
  ).toContainText("1");
}
