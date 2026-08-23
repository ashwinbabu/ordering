import { expect, test } from "@playwright/test";
import { addSimpleProduct, clearCart } from "../helpers/storefront";
import { capturePageDiagnostics } from "../helpers/diagnostics";

test("STF-PAY-RZP-001/003 starts test checkout and recovers after modal close", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const finishDiagnostics = capturePageDiagnostics(page, testInfo);
  await clearCart(page);
  await addSimpleProduct(page);
  await page.getByRole("button", { name: /Go to Cart/ }).click();
  await expect(
    page.getByRole("button", { name: "Continue to payment" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  const frame = page.locator("iframe.razorpay-checkout-frame");
  const changedQuote = page.getByRole("button", { name: /^Continue with ₹/ });
  let paymentStartResponses = 0;
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().includes("/functions/v1/start-online-payment") &&
      response.ok()
    )
      paymentStartResponses += 1;
  });
  await expect(changedQuote).toBeVisible({ timeout: 30_000 });
  await expect(changedQuote).toBeEnabled();
  await changedQuote.click();
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => paymentStartResponses).toBe(1);
  await expect(frame).toHaveAttribute("src", /razorpay\.com/);

  const framePage = page.frameLocator("iframe.razorpay-checkout-frame");
  // Razorpay's mobile test checkout renders the top-left back control
  // without an accessible name, so exercise the visible control by its
  // stable viewport position inside the provider frame.
  await framePage.locator("body").click({ position: { x: 42, y: 42 } });
  const confirmClose = framePage.getByRole("button", {
    name: /Yes, exit|Close|Exit/i,
  });
  if (await confirmClose.isVisible().catch(() => false))
    await confirmClose.click();
  await expect(
    page.getByRole("heading", { name: "Payment cancelled" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "Try payment again" }),
  ).toBeVisible();
  await finishDiagnostics();
});
