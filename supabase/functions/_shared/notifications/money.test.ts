import { assertEquals } from "jsr:@std/assert@1";
import { formatMoney, isPositiveAmount } from "./money.ts";

Deno.test("formatMoney: whole INR amount", () => {
  assertEquals(formatMoney("500.00", "INR"), "₹500.00");
});

Deno.test("formatMoney: adds thousands separators", () => {
  assertEquals(formatMoney("123456.78", "INR"), "₹123,456.78");
});

Deno.test("formatMoney: negative amount", () => {
  assertEquals(formatMoney("-45.50", "INR"), "-₹45.50");
});

Deno.test("formatMoney: amount with no fractional part", () => {
  assertEquals(formatMoney("300", "INR"), "₹300.00");
});

Deno.test("formatMoney: non-INR currency falls back to code prefix", () => {
  assertEquals(formatMoney("10.00", "USD"), "USD 10.00");
});

Deno.test("formatMoney: null/empty returns empty string", () => {
  assertEquals(formatMoney(null, "INR"), "");
  assertEquals(formatMoney(undefined, "INR"), "");
  assertEquals(formatMoney("", "INR"), "");
});

Deno.test("isPositiveAmount: nonzero amount is positive", () => {
  assertEquals(isPositiveAmount("23.81"), true);
});

Deno.test("isPositiveAmount: zero amount (various decimal spellings) is not positive", () => {
  assertEquals(isPositiveAmount("0"), false);
  assertEquals(isPositiveAmount("0.00"), false);
});

Deno.test("isPositiveAmount: null/undefined is not positive", () => {
  assertEquals(isPositiveAmount(null), false);
  assertEquals(isPositiveAmount(undefined), false);
});
