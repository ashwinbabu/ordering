import { assertEquals } from "jsr:@std/assert@1";
import { policyRulesForEvent } from "./notification-policy.ts";

Deno.test("policy: order.placed maps to exactly one customer email rule", () => {
  const rules = policyRulesForEvent("order.placed");
  assertEquals(rules.length, 1);
  assertEquals(rules[0].recipient, { type: "customer" });
  assertEquals(rules[0].channel, "email");
  assertEquals(rules[0].template, "customer_order_placed");
});

Deno.test("policy: order.cancelled maps to exactly one customer email rule", () => {
  const rules = policyRulesForEvent("order.cancelled");
  assertEquals(rules.length, 1);
  assertEquals(rules[0].recipient, { type: "customer" });
  assertEquals(rules[0].channel, "email");
  assertEquals(rules[0].template, "customer_order_cancelled");
});

Deno.test("policy: unknown event type has no rules", () => {
  assertEquals(policyRulesForEvent("payment.failed"), []);
});
