import { expect, test } from "@playwright/test";
import { capturePageDiagnostics } from "../helpers/diagnostics";

test("Storefront resolves A2 Arambol and exposes menu controls", async ({
  page,
}, testInfo) => {
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What are you craving?" }),
  ).toBeVisible();
  await expect(
    page.getByText("Arambol", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Menu categories" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Grid view" })).toBeVisible();
  await finishDiagnostics();
});
