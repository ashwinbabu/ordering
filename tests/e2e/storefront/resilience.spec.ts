import { expect, test } from "@playwright/test";
import {
  addSimpleProduct,
  clearCart,
  qaSimpleProduct,
} from "../helpers/storefront";

test("EXTRA-005 important Storefront routes survive hard refresh", async ({
  page,
}) => {
  const routes: Array<[string, RegExp]> = [
    ["/", /What are you craving\?/],
    ["/cart", /Your cart/],
    ["/account", /Account/],
    ["/your-addresses", /Saved addresses/],
    ["/orders", /Your orders/],
    [
      "/orders/38e8d426-b96e-46c3-a868-3e9545fa98ab",
      /Order #A2FO-260822-000002/,
    ],
  ];
  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
  }
});

test("EXTRA-006 browser back/forward preserves the active cart", async ({
  page,
}) => {
  await clearCart(page);
  await addSimpleProduct(page);
  await page.getByRole("button", { name: /Go to Cart/ }).click();
  await expect(
    page.getByRole("heading", { name: qaSimpleProduct }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "What are you craving?" }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: qaSimpleProduct }),
  ).toBeVisible();
});

test("NET-001 offline cart blocks checkout and recovers when online", async ({
  page,
  context,
}) => {
  await clearCart(page);
  await addSimpleProduct(page);
  await page.getByRole("button", { name: /Go to Cart/ }).click();
  await context.setOffline(true);
  await expect(
    page.getByRole("alert").filter({ hasText: /offline.*still review/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "You're offline -- reconnect to continue",
    }),
  ).toBeDisabled();
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "Continue to payment" }),
  ).toBeEnabled({ timeout: 15_000 });
});

test("NET-002 menu RPC failure exposes retry and recovers", async ({
  page,
}) => {
  await page.route("**/rest/v1/rpc/get_storefront_menu", (route) =>
    route.abort("failed"),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Menu unavailable" }),
  ).toBeVisible();
  await page.unroute("**/rest/v1/rpc/get_storefront_menu");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "What are you craving?" }),
  ).toBeVisible();
});

test("NET-003 unknown Storefront route has a recoverable 404", async ({
  page,
}) => {
  await page.goto("/qa-route-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Browse the menu" }).click();
  await expect(
    page.getByRole("heading", { name: "What are you craving?" }),
  ).toBeVisible();
});
