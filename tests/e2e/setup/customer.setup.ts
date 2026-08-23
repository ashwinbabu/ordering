import { mkdir } from "node:fs/promises";
import { test as setup } from "@playwright/test";
import { signInCustomer } from "../helpers/auth";
import { qaCredentials } from "../helpers/credentials";

setup("save Storefront customer state", async ({ page }) => {
  await mkdir("tests/.auth", { recursive: true });
  await signInCustomer(page, qaCredentials());
  await page.waitForFunction(
    () =>
      Object.keys(window.localStorage).some(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      ),
    undefined,
    { timeout: 15_000 },
  );
  await page.context().storageState({ path: "tests/.auth/customer.json" });
});
