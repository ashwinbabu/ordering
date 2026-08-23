import { mkdir } from "node:fs/promises";
import { test as setup } from "@playwright/test";
import { signInAdmin } from "../helpers/auth";
import { qaCredentials } from "../helpers/credentials";

setup("save Admin authenticated state", async ({ page }) => {
  await mkdir("tests/.auth", { recursive: true });
  await signInAdmin(page, qaCredentials());
  await page.context().storageState({ path: "tests/.auth/admin.json" });
});
