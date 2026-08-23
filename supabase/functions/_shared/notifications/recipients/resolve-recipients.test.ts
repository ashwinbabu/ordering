import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { resolveRecipient } from "./resolve-recipients.ts";

Deno.test("resolveRecipient: customer selector with real email resolves to pending", () => {
  const result = resolveRecipient(
    { type: "customer" },
    { customer: { id: "cust-1", email: "real@example.com", displayName: "Real Customer" } },
  );
  assertEquals(result, {
    recipientType: "customer",
    recipientId: "cust-1",
    address: "real@example.com",
    skipReason: null,
  });
});

Deno.test("resolveRecipient: customer selector with null email skips as no_email", () => {
  const result = resolveRecipient(
    { type: "customer" },
    { customer: { id: "cust-2", email: null, displayName: null } },
  );
  assertEquals(result, {
    recipientType: "customer",
    recipientId: "cust-2",
    address: null,
    skipReason: "no_email",
  });
});

Deno.test("resolveRecipient: customer selector with synthetic email skips as synthetic_email", () => {
  const result = resolveRecipient(
    { type: "customer" },
    { customer: { id: "cust-3", email: "msg91_919999999999@auth.invalid", displayName: null } },
  );
  assertEquals(result, {
    recipientType: "customer",
    recipientId: "cust-3",
    address: null,
    skipReason: "synthetic_email",
  });
});

Deno.test("resolveRecipient: customer selector with no order customer at all skips as no_email", () => {
  const result = resolveRecipient({ type: "customer" }, { customer: null });
  assertEquals(result, {
    recipientType: "customer",
    recipientId: null,
    address: null,
    skipReason: "no_email",
  });
});

Deno.test("resolveRecipient: literal email selector with a valid address resolves to pending", () => {
  const result = resolveRecipient(
    { type: "email", address: "ops@example.com" },
    { customer: null },
  );
  assertEquals(result, {
    recipientType: "email",
    recipientId: null,
    address: "ops@example.com",
    skipReason: null,
  });
});

Deno.test("resolveRecipient: business_user selector is not implemented in v1 and throws", () => {
  assertThrows(() => resolveRecipient({ type: "business_user", userId: "u1" }, { customer: null }));
});

Deno.test("resolveRecipient: location_admins selector is not implemented in v1 and throws", () => {
  assertThrows(() => resolveRecipient({ type: "location_admins" }, { customer: null }));
});
