import { expect, test } from "@playwright/test";

test("RT-006 ordering status converges after an offline/reconnect interval", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const customer = await browser.newContext({
    storageState: "tests/.auth/customer.json",
    viewport: { width: 390, height: 844 },
  });
  const admin = await browser.newContext({
    storageState: "tests/.auth/admin.json",
    viewport: { width: 1440, height: 1000 },
  });
  const menu = await customer.newPage();
  const orders = await admin.newPage();
  await menu.goto("http://127.0.0.1:5173/");
  await orders.goto("http://127.0.0.1:5174/");
  await expect(
    menu.getByText("Menu updated live", { exact: true }),
  ).toBeVisible();
  const toggle = orders.getByRole("switch", {
    name: "Toggle restaurant ordering",
  });
  await expect(toggle).toBeChecked();

  try {
    await customer.setOffline(true);
    await toggle.click();
    await orders
      .getByRole("dialog", { name: "Pause new orders?" })
      .getByRole("button", { name: "Pause ordering" })
      .click();
    await expect(
      orders.getByText("Orders paused", { exact: true }).first(),
    ).toBeVisible();
    await customer.setOffline(false);
    await expect(
      menu.getByText("Not accepting orders right now", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await customer.setOffline(false).catch(() => undefined);
    if (!(await toggle.isChecked())) await toggle.click();
  }

  await expect(
    menu.getByText("Menu updated live", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await customer.close();
  await admin.close();
});
