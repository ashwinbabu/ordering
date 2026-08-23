import { expect, test, type Page } from "@playwright/test";
import { capturePageDiagnostics } from "../helpers/diagnostics";

async function openOrders(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Orders", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Order status" }),
  ).toBeVisible();
}

test("ADM-ORD-001 date selector scopes the queue to the chosen local day", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  await page.getByRole("button", { name: "Yesterday & today" }).click();
  const menu = page.getByRole("menu");
  await menu.getByLabel("From").fill("2026-08-21");
  await menu.getByLabel("To").fill("2026-08-21");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: "21 Aug 2026" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Open order / }).first(),
  ).toBeVisible();
  await finishDiagnostics();
});

test("ADM-ORD-002/003 accepting-orders toggle propagates to Storefront and restores ON", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  const storefront = await page.context().newPage();
  await storefront.goto("http://127.0.0.1:5173/");
  await expect(
    storefront.getByText("Menu updated live", { exact: true }),
  ).toBeVisible();

  const toggle = page.getByRole("switch", {
    name: "Toggle restaurant ordering",
  });
  await expect(toggle).toBeChecked();
  try {
    await toggle.click();
    await page
      .getByRole("dialog", { name: "Pause new orders?" })
      .getByRole("button", { name: "Pause ordering" })
      .click();
    await expect(
      page.getByText("Orders paused", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      storefront.getByText("Not accepting orders right now", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    if (!(await toggle.isChecked())) await toggle.click();
  }
  await expect(
    page.getByText("Accepting orders", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    storefront.getByText("Menu updated live", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await storefront.close();
  await finishDiagnostics();
});

test("ADM-ORD-004 search supports display order number and customer name", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  const search = page.getByPlaceholder("Order or customer");
  await search.fill("A2FO-260821-000009");
  await expect(
    page.getByRole("button", { name: "Open order A2FO-260821-000009" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open order / })).toHaveCount(
    1,
  );
  await search.fill("Meera Shah");
  await expect(
    page.getByText("Meera Shah", { exact: true }).first(),
  ).toBeVisible();
  await search.fill("");
  await expect(
    page.getByRole("button", { name: /^Open order / }).first(),
  ).toBeVisible();
  await finishDiagnostics();
});

test("ADM-ORD-005..010 status tabs contain only their mapped status", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  for (const status of [
    "All",
    "New",
    "Preparing",
    "Out for delivery",
    "Delivered",
    "Cancelled",
  ]) {
    const tab = page.getByRole("tab", { name: new RegExp(`^${status} `) });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const cards = page.locator(".order-card");
    if (status !== "All" && (await cards.count()) > 0) {
      for (const card of await cards.all()) {
        await expect(
          card.getByText(status, { exact: true }).first(),
        ).toBeVisible();
      }
    }
  }
  await finishDiagnostics();
});

test("Admin Order Details inventories customer, kitchen, bill, timeline, contact, copy, KOT, and navigation", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  await page.getByRole("tab", { name: /^Delivered / }).click();
  await page
    .getByRole("button", { name: /^Open order / })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /^Order #/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kitchen" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Customer & delivery" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bill" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute(
    "href",
    /^tel:/,
  );
  await expect(page.getByRole("button", { name: "Copy phone" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy address" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Print KOT" })).toBeVisible();
  await page.getByRole("button", { name: "Back to orders" }).click();
  await expect(
    page.getByRole("tablist", { name: "Order status" }),
  ).toBeVisible();
  await finishDiagnostics();
});

test("Order Details KOT uses the active Arambol outlet", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await openOrders(page);
  await page.getByRole("tab", { name: /^Delivered / }).click();
  await page
    .getByRole("button", { name: /^Open order / })
    .first()
    .click();
  await page.getByRole("button", { name: "Print KOT" }).click();
  await expect(page.getByText("A2 · ARAMBOL", { exact: true })).toBeVisible();
  await finishDiagnostics();
});
