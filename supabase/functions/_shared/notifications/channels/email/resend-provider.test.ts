import { assertEquals } from "jsr:@std/assert@1";
import { sendViaResend } from "./resend-provider.ts";

const baseParams = {
  apiKey: "test-key",
  from: "Test <test@example.com>",
  to: "customer@example.com",
  subject: "Subject",
  html: "<p>hi</p>",
  text: "hi",
  idempotencyKey: "delivery-1",
};

function withMockedFetch(response: Response | (() => Promise<Response>), fn: () => Promise<void>) {
  const original = globalThis.fetch;
  // @ts-ignore -- test-only stub
  globalThis.fetch = () => (typeof response === "function" ? response() : Promise.resolve(response));
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("sendViaResend: 200 with id is sent", async () => {
  await withMockedFetch(
    new Response(JSON.stringify({ id: "msg-123" }), { status: 200 }),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result, { outcome: "sent", providerMessageId: "msg-123" });
    },
  );
});

Deno.test("sendViaResend: 429 is retryable", async () => {
  await withMockedFetch(
    new Response("rate limited", { status: 429 }),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result.outcome, "retry");
    },
  );
});

Deno.test("sendViaResend: 500 is retryable", async () => {
  await withMockedFetch(
    new Response("server error", { status: 500 }),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result.outcome, "retry");
    },
  );
});

Deno.test("sendViaResend: 400 is a permanent failure", async () => {
  await withMockedFetch(
    new Response("invalid recipient", { status: 400 }),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result.outcome, "permanent_failure");
    },
  );
});

Deno.test("sendViaResend: 401 is a permanent failure (not endlessly retried)", async () => {
  await withMockedFetch(
    new Response("unauthorized", { status: 401 }),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result.outcome, "permanent_failure");
    },
  );
});

Deno.test("sendViaResend: network error is retryable", async () => {
  await withMockedFetch(
    () => Promise.reject(new Error("network down")),
    async () => {
      const result = await sendViaResend(baseParams);
      assertEquals(result.outcome, "retry");
    },
  );
});
