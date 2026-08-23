import { expect, test } from "@playwright/test";

test("EXTRA-005 Admin root refresh preserves authenticated outlet resolution", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tablist", { name: "Order status" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("tablist", { name: "Order status" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A2 Food and beverages · Arambol/i }),
  ).toBeVisible();
});
