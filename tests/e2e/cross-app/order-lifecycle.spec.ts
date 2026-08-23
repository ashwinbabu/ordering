import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  addOptionsProduct,
  clearCart,
  qaOptionsProduct,
} from "../helpers/storefront";

const storefrontUrl = "http://127.0.0.1:5173";
const adminUrl = "http://127.0.0.1:5174";

async function contexts(browser: Browser) {
  const customer = await browser.newContext({
    baseURL: storefrontUrl,
    storageState: "tests/.auth/customer.json",
    viewport: { width: 390, height: 844 },
  });
  const admin = await browser.newContext({
    baseURL: adminUrl,
    storageState: "tests/.auth/admin.json",
    viewport: { width: 1440, height: 1000 },
  });
  return { customer, admin };
}

async function openAdminOrders(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto(`${adminUrl}/`);
  await expect(
    page.getByRole("button", { name: /A2 Food and beverages · Arambol/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Order status" }),
  ).toBeVisible();
  return page;
}

async function placeCodOrder(
  page: Page,
  fulfilment: "delivery" | "pickup",
  note: string,
  doubleClick = false,
) {
  await clearCart(page);
  await addOptionsProduct(page, "Large");
  await page.getByRole("button", { name: /Go to Cart/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByLabel("Special instructions for the restaurant").fill(note);

  const delivery = page.getByRole("radio", { name: /^Delivery/ });
  const pickup = page.getByRole("radio", { name: /^Pickup/ });
  await expect(delivery).toHaveAttribute("aria-checked", "true");
  await pickup.click();
  await expect(pickup).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("₹0", { exact: true }).last()).toBeVisible();
  await delivery.click();
  await expect(delivery).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText("Delivery available", { exact: true }),
  ).toBeVisible();
  if (fulfilment === "pickup") {
    await pickup.click();
    await expect(pickup).toHaveAttribute("aria-checked", "true");
  }

  await page.getByLabel("Pay cash upon delivery").check();
  const place = page.getByRole("button", { name: "Place order" });
  if (doubleClick) await place.dblclick();
  else await place.click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/i, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Your order is in" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      fulfilment === "delivery" ? "Delivery order" : "Pickup order",
      { exact: true },
    ),
  ).toBeVisible();
  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  const header = await page.locator(".tracking-header small").textContent();
  const displayId = header?.replace(/^Order #/, "").trim();
  expect(displayId).toBeTruthy();
  return { orderId, displayId: displayId!, note };
}

function adminOrderCard(page: Page, displayId: string) {
  return page.locator("article.order-card").filter({
    has: page.getByRole("button", { name: `Open order ${displayId}` }),
  });
}

test("STF-FUL-001, STF-PAY-COD-001, RT-001/002/003, ADM-LIFE-001, EXTRA-003/004/008", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { customer, admin } = await contexts(browser);
  const adminPage = await openAdminOrders(admin);
  const tracking = await customer.newPage();
  const note = `QA TEST — no onions — ${Date.now()}`;

  const order = await placeCodOrder(tracking, "delivery", note, true);
  await expect(tracking.getByText(note, { exact: true })).toHaveCount(0);

  // The Admin page was open before checkout; finding this card proves the
  // location-scoped Realtime invalidation, rather than a page-load fetch.
  const card = adminOrderCard(adminPage, order.displayId);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("New", { exact: true })).toBeVisible();
  await expect(card.getByText(note, { exact: true })).toBeVisible();
  await expect(
    card.getByText(qaOptionsProduct, { exact: false }),
  ).toBeVisible();

  const ordersList = await customer.newPage();
  await ordersList.goto(`${storefrontUrl}/orders`);
  const listCard = ordersList
    .getByRole("button")
    .filter({ hasText: `Order #${order.displayId}` });
  await expect(listCard).toBeVisible();
  await expect(listCard.getByText("Placed", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Accept order" }).dblclick();
  await expect(
    card.getByText("Preparing", { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    tracking
      .locator(".order-status-timeline li.is-active")
      .getByText("Accepted", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(listCard.getByText("Accepted", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await card.getByRole("button", { name: "Mark out for delivery" }).click();
  await expect(
    card.getByText("Out for delivery", { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    tracking
      .locator(".order-status-timeline li.is-active")
      .getByText("Out for delivery", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    listCard.getByText("Out for delivery", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  await card.getByRole("button", { name: "Mark delivered" }).click();
  await expect(
    card.getByText("Delivered", { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    tracking
      .locator(".order-status-timeline li")
      .filter({ hasText: "Delivered" }),
  ).toHaveClass(/is-complete/, { timeout: 15_000 });
  await expect(listCard.getByText("Delivered", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    card.getByRole("button", { name: /Accept order|Mark out|Mark delivered/ }),
  ).toHaveCount(0);

  await tracking.reload();
  await expect(
    tracking.getByRole("heading", { name: "Order completed" }),
  ).toBeVisible();
  await expect(tracking.getByText(note, { exact: true })).toBeVisible();
  await expect(
    tracking.getByText("Payment pending", { exact: true }),
  ).toBeVisible();
  await expect(
    tracking.getByText(/Pay cash when it arrives\./),
  ).toBeVisible();
  await expect(
    tracking.getByText(/Payment confirmed and sent to/),
  ).toHaveCount(0);
  const cartCheck = await customer.newPage();
  await cartCheck.goto(`${storefrontUrl}/cart`);
  await expect(
    cartCheck.getByText("Your cart is empty", { exact: true }),
  ).toBeVisible();

  await customer.close();
  await admin.close();
});

test("STF-FUL-002 pickup checkout creates a pickup order", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { customer, admin } = await contexts(browser);
  const tracking = await customer.newPage();
  const order = await placeCodOrder(
    tracking,
    "pickup",
    `QA PICKUP ${Date.now()}`,
  );
  const snapshot = await tracking.evaluate(async (orderId) => {
    const { getSupabaseClient } = await import("/lib/supabase/client.ts");
    const response = await getSupabaseClient()
      .schema("ordering")
      .rpc("get_order", { p_order_id: orderId });
    if (response.error) throw new Error(response.error.message);
    const value = response.data as Record<string, unknown>;
    return {
      fulfillmentType: value.fulfillment_type,
      deliveryAddress: value.delivery_address,
      deliveryFee: value.delivery_fee,
    };
  }, order.orderId);
  expect(snapshot).toEqual({
    fulfillmentType: "pickup",
    deliveryAddress: null,
    deliveryFee: 0,
  });
  await customer.close();
  await admin.close();
});

test("RT-004 Storefront cancellation reaches Admin live", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { customer, admin } = await contexts(browser);
  const adminPage = await openAdminOrders(admin);
  const tracking = await customer.newPage();
  const order = await placeCodOrder(
    tracking,
    "delivery",
    `QA STOREFRONT CANCEL ${Date.now()}`,
  );
  const card = adminOrderCard(adminPage, order.displayId);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await tracking.reload();
  await expect(
    tracking.getByRole("heading", { name: "Your order is in" }),
  ).toBeVisible();
  await tracking.getByRole("button", { name: "Cancel order" }).click();
  await expect(
    tracking.getByRole("heading", { name: "Cancelled", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    tracking.getByText("Cancelled by customer", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByText("Cancelled", { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await customer.close();
  await admin.close();
});

test("RT-005 Admin cancellation reaches Storefront tracking live", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { customer, admin } = await contexts(browser);
  const adminPage = await openAdminOrders(admin);
  const tracking = await customer.newPage();
  const order = await placeCodOrder(
    tracking,
    "delivery",
    `QA ADMIN CANCEL ${Date.now()}`,
  );
  const card = adminOrderCard(adminPage, order.displayId);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: "Cancel order" }).click();
  const dialog = adminPage.getByRole("dialog", {
    name: `Cancel order #${order.displayId}`,
  });
  await dialog.getByLabel("Customer requested cancellation").check();
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    tracking.getByRole("heading", { name: "Cancelled", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    tracking.getByText("Customer requested cancellation", { exact: true }),
  ).toBeVisible();
  await customer.close();
  await admin.close();
});
