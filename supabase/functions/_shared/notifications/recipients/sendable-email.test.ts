import { assertEquals } from "jsr:@std/assert@1";
import { guardSendableEmail } from "./sendable-email.ts";

Deno.test("guardSendableEmail: real email is sendable", () => {
  const result = guardSendableEmail("meera.shah@example.com");
  assertEquals(result, { sendable: true, address: "meera.shah@example.com" });
});

Deno.test("guardSendableEmail: trims whitespace", () => {
  const result = guardSendableEmail("  meera.shah@example.com  ");
  assertEquals(result, { sendable: true, address: "meera.shah@example.com" });
});

Deno.test("guardSendableEmail: null is no_email", () => {
  assertEquals(guardSendableEmail(null), { sendable: false, reason: "no_email" });
});

Deno.test("guardSendableEmail: undefined is no_email", () => {
  assertEquals(guardSendableEmail(undefined), { sendable: false, reason: "no_email" });
});

Deno.test("guardSendableEmail: empty/whitespace-only is no_email", () => {
  assertEquals(guardSendableEmail("   "), { sendable: false, reason: "no_email" });
});

Deno.test("guardSendableEmail: msg91 synthetic address is synthetic_email", () => {
  assertEquals(
    guardSendableEmail("msg91_917305630515@auth.invalid"),
    { sendable: false, reason: "synthetic_email" },
  );
});

Deno.test("guardSendableEmail: synthetic suffix match is case-insensitive", () => {
  assertEquals(
    guardSendableEmail("msg91_917305630515@AUTH.INVALID"),
    { sendable: false, reason: "synthetic_email" },
  );
});

Deno.test("guardSendableEmail: a real address that merely contains 'invalid' is still sendable", () => {
  const result = guardSendableEmail("invalid.looking.name@gmail.com");
  assertEquals(result, { sendable: true, address: "invalid.looking.name@gmail.com" });
});
