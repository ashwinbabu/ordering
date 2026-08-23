import { expect, test } from "@playwright/test";

const ownDeliveredOrder = "38e8d426-b96e-46c3-a868-3e9545fa98ab";
const anotherCustomerOrder = "d2941240-3bae-4bcf-a679-94666622f043";

test("SEC-RLS-001 customer can read own order but not another customer's order", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: "tests/.auth/customer.json",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  const result = await page.evaluate(
    async ({ own, other }) => {
      const { getSupabaseClient } = await import("/lib/supabase/client.ts");
      const client = getSupabaseClient();
      const ownResult = await client
        .schema("ordering")
        .rpc("get_order", { p_order_id: own });
      const otherResult = await client
        .schema("ordering")
        .rpc("get_order", { p_order_id: other });
      return {
        own: {
          hasData: Boolean(ownResult.data),
          code: ownResult.error?.code ?? null,
        },
        other: {
          hasData: Boolean(otherResult.data),
          code: otherResult.error?.code ?? null,
        },
      };
    },
    { own: ownDeliveredOrder, other: anotherCustomerOrder },
  );
  expect(result.own).toEqual({ hasData: true, code: null });
  expect(result.other.hasData).toBe(false);
  expect(result.other.code).toBe("42501");
  await context.close();
});

test("SEC-RLS-002 anonymous menu access works while private order access is denied", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await expect(
    page.getByRole("heading", { name: "What are you craving?" }),
  ).toBeVisible();
  const result = await page.evaluate(async (orderId) => {
    const { getSupabaseClient } = await import("/lib/supabase/client.ts");
    const response = await getSupabaseClient()
      .schema("ordering")
      .rpc("get_order", { p_order_id: orderId });
    return {
      hasData: Boolean(response.data),
      code: response.error?.code ?? null,
    };
  }, ownDeliveredOrder);
  expect(result.hasData).toBe(false);
  expect(result.code).toBe("42501");
  await context.close();
});
