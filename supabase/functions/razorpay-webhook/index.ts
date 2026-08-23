// razorpay-webhook
//
// verify_jwt = false - Razorpay calls this directly with no Supabase session,
// so this function authenticates the request itself via the webhook HMAC
// signature before trusting anything in the body.
//
// The `provider` query parameter is a ROUTING identifier only (which
// location_payment_providers row's webhook secret to check against) - it is
// never treated as proof of authenticity on its own. That comes only from a
// valid X-Razorpay-Signature computed over the untouched raw request body.
//
// No webhook inbox/events table exists yet by design (out of scope for this
// pass); durability against duplicate/out-of-order delivery is delegated
// entirely to ordering.record_payment_result's own idempotency (the
// payments.status = 'paid' guard, and the provider_event_id replay check).
import {
  createAdminClient,
  getServerConfig,
} from "../_shared/payments/supabase-clients.ts";
import { getPaymentAdapter } from "../_shared/payments/registry.ts";
import { webhookContextFromResolution } from "../_shared/payments/provider-config.ts";
import { statusForPgErrorCode } from "../_shared/payments/http.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Razorpay payment.method values map straight onto payments.method as free
// text, so this only needs to normalize casing/whitespace, not translate.
function normalizeMethod(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

/** Keeps gateway_payload bounded to the parts useful for reconciliation. */
function boundedPayload(
  paymentEntity: Record<string, unknown>,
): Record<string, unknown> {
  const {
    id,
    order_id,
    status,
    method,
    amount,
    currency,
    fee,
    tax,
    captured,
    email,
    contact,
    created_at,
  } = paymentEntity;
  return {
    id,
    order_id,
    status,
    method,
    amount,
    currency,
    fee,
    tax,
    captured,
    email,
    contact,
    created_at,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const providerConfigurationId = url.searchParams.get("provider");
  if (!providerConfigurationId || !UUID_RE.test(providerConfigurationId)) {
    return json({ error: "Missing or invalid provider routing id." }, 400);
  }

  const signature =
    request.headers.get("X-Razorpay-Signature") ??
    request.headers.get("x-razorpay-signature");
  if (!signature) {
    return json({ error: "Missing signature." }, 400);
  }

  // Must be read before any JSON parsing - the signature is computed over
  // these exact bytes, and re-serializing a parsed body is not guaranteed to
  // reproduce them.
  const rawBody = await request.text();

  const { supabaseUrl, serviceRoleKey } = getServerConfig();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("razorpay-webhook: required server configuration is missing");
    return json({ error: "Webhook service is not configured." }, 500);
  }
  const admin = createAdminClient(supabaseUrl, serviceRoleKey);

  const webhookConfigLookup = await admin
    .schema("ordering")
    .rpc("get_payment_provider_webhook_config", {
      p_provider_configuration_id: providerConfigurationId,
    });
  if (webhookConfigLookup.error) {
    console.warn(
      "razorpay-webhook: webhook config lookup failed",
      webhookConfigLookup.error.code,
    );
    return json(
      { error: "Unknown payment provider configuration." },
      statusForPgErrorCode(webhookConfigLookup.error.code),
    );
  }

  const webhookContext = webhookContextFromResolution(
    webhookConfigLookup.data as Record<string, unknown>,
  );
  if (webhookContext.provider !== "razorpay") {
    console.error(
      "razorpay-webhook: provider configuration is not razorpay",
      webhookContext.provider,
    );
    return json({ error: "Provider mismatch." }, 400);
  }

  const adapter = getPaymentAdapter("razorpay");
  const signatureValid = await adapter.verifyWebhookSignature({
    rawBody,
    signature,
    webhookSecret: webhookContext.webhookSecret,
  });
  if (!signatureValid) {
    console.warn(
      "razorpay-webhook: invalid signature for provider configuration",
      providerConfigurationId,
    );
    return json({ error: "Invalid signature." }, 401);
  }

  // Only parse JSON after the signature has been proven valid.
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const eventType = typeof event.event === "string" ? event.event : "";
  const providerEventId =
    request.headers.get("x-razorpay-event-id") ??
    (typeof event.id === "string" ? event.id : null);

  const handledEvents = new Set([
    "payment.captured",
    "payment.failed",
    "order.paid",
  ]);
  if (!handledEvents.has(eventType)) {
    // Acknowledge anything we don't act on so Razorpay stops retrying it.
    return json({ ok: true, ignored: eventType }, 200);
  }

  const payload = event.payload as Record<string, unknown> | undefined;
  const paymentEntity = (
    payload?.payment as Record<string, unknown> | undefined
  )?.entity as Record<string, unknown> | undefined;

  if (
    !paymentEntity ||
    typeof paymentEntity.id !== "string" ||
    typeof paymentEntity.order_id !== "string"
  ) {
    console.warn(
      "razorpay-webhook: event carried no usable payment entity",
      eventType,
    );
    return json({ ok: true, ignored: "no_payment_entity" }, 200);
  }

  if (!providerEventId) {
    console.warn(
      "razorpay-webhook: event carried no event id, refusing to process without one",
    );
    return json({ error: "Missing event id." }, 400);
  }

  // provider_order_id is our own idempotency/uniqueness key (see
  // location_payment_providers migration notes) - trusted here only because
  // it comes from an HMAC-verified body, never from the URL or the browser.
  const paymentLookup = await admin
    .schema("ordering")
    .from("payments")
    .select("id, status")
    .eq("provider", "razorpay")
    .eq("provider_order_id", paymentEntity.order_id)
    .maybeSingle();

  if (paymentLookup.error) {
    console.error(
      "razorpay-webhook: payment lookup failed",
      paymentLookup.error.message,
    );
    return json({ error: "Unable to resolve payment." }, 500);
  }

  if (!paymentLookup.data) {
    // Nothing on our side references this Razorpay order yet. Acknowledge
    // rather than have Razorpay retry indefinitely for an event we will
    // never be able to place.
    console.warn(
      "razorpay-webhook: no matching payment for provider_order_id",
      paymentEntity.order_id,
    );
    return json({ ok: true, ignored: "unmatched_order" }, 200);
  }

  const resultStatus =
    eventType === "payment.failed"
      ? "failed"
      : paymentEntity.status === "captured"
        ? "paid"
        : "authorized";

  const occurredAtEpoch =
    typeof event.created_at === "number" ? event.created_at : null;

  const recordResult = await admin
    .schema("ordering")
    .rpc("record_payment_result", {
      p_payment_id: paymentLookup.data.id,
      p_result_status: resultStatus,
      p_provider_event_id: providerEventId,
      p_provider_payment_id: paymentEntity.id,
      p_method: normalizeMethod(paymentEntity.method),
      p_gateway_payload: boundedPayload(paymentEntity),
      p_gateway_fee:
        typeof paymentEntity.fee === "number" ? paymentEntity.fee / 100 : null,
      p_gateway_tax:
        typeof paymentEntity.tax === "number" ? paymentEntity.tax / 100 : null,
      p_occurred_at: occurredAtEpoch
        ? new Date(occurredAtEpoch * 1000).toISOString()
        : new Date().toISOString(),
    });

  if (recordResult.error) {
    console.error(
      "razorpay-webhook: record_payment_result failed",
      recordResult.error.code,
      recordResult.error.message,
    );
    // 5xx so Razorpay retries - this is very likely transient (e.g. the
    // order was mid-transition), not a permanent rejection.
    return json({ error: "Unable to record payment result." }, 500);
  }

  return json({ ok: true }, 200);
});
