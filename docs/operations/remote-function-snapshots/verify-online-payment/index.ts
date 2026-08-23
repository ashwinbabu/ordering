// verify-online-payment
//
// Called by the storefront right after Razorpay Standard Checkout reports
// success in the browser. That report is never trusted on its own:
//   - the caller's access to the order is re-checked via ordering.get_order
//     (private.can_view_order), same as every other order read
//   - the Razorpay order id used for verification is our own stored
//     payments.provider_order_id, never the order id the browser sends
//   - the checkout signature is verified server-side against Razorpay's
//     secret, then the payment is re-fetched from Razorpay's API to confirm
//     it is genuinely captured before anything is written
//   - the actual write goes through ordering.record_payment_result, which is
//     already idempotent (guards on payments.status = 'paid' and on
//     provider_event_id), so this function is safe to call whether or not
//     razorpay-webhook has already processed the same payment.
import { buildAllowedOrigins, corsHeaders, jsonResponse, statusForPgErrorCode } from "../_shared/payments/http.ts";
import { createAdminClient, createUserClient, getServerConfig } from "../_shared/payments/supabase-clients.ts";
import { credentialsFromProviderResolution } from "../_shared/payments/provider-config.ts";
import { getPaymentAdapter } from "../_shared/payments/registry.ts";

const allowedOrigins = buildAllowedOrigins();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin, allowedOrigins);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Missing authorization." }, 401, origin, allowedOrigins);
  }

  const { supabaseUrl, serviceRoleKey, anonKey } = getServerConfig();
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("verify-online-payment: required server configuration is missing");
    return jsonResponse({ error: "Payment service is not configured." }, 500, origin, allowedOrigins);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, origin, allowedOrigins);
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  const razorpayPaymentId = firstString(payload.razorpayPaymentId, payload.razorpay_payment_id);
  // Browser-supplied order id is accepted only to satisfy the SDK's handler
  // signature; it is never used for anything - see module comment.
  const razorpaySignature = firstString(payload.razorpaySignature, payload.razorpay_signature);

  if (!orderId || !UUID_RE.test(orderId) || !razorpayPaymentId || !razorpaySignature) {
    return jsonResponse(
      { error: "orderId, razorpayPaymentId and razorpaySignature are required." },
      400,
      origin,
      allowedOrigins,
    );
  }

  const userClient = createUserClient(supabaseUrl, anonKey, authorization);
  const admin = createAdminClient(supabaseUrl, serviceRoleKey);

  // Access check under the caller's own JWT - identical guard to every other
  // order read, so a customer cannot probe or verify someone else's order.
  const orderLookup = await userClient.schema("ordering").rpc("get_order", { p_order_id: orderId });
  if (orderLookup.error) {
    console.warn("verify-online-payment: order lookup failed", orderLookup.error.code);
    return jsonResponse({ error: "Order could not be accessed." }, statusForPgErrorCode(orderLookup.error.code), origin, allowedOrigins);
  }

  const order = orderLookup.data as Record<string, unknown>;
  if (order.payment_method !== "online") {
    return jsonResponse({ error: "This order was not placed for online payment." }, 409, origin, allowedOrigins);
  }

  // Our own payment record is the only trusted source for the Razorpay order
  // id - find the most recent razorpay attempt for this order.
  const paymentLookup = await admin
    .schema("ordering")
    .from("payments")
    .select("id, order_id, provider, provider_order_id, status")
    .eq("order_id", orderId)
    .eq("provider", "razorpay")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentLookup.error || !paymentLookup.data) {
    console.warn("verify-online-payment: no razorpay payment attempt found for order", orderId);
    return jsonResponse({ error: "No payment attempt was found for this order." }, 404, origin, allowedOrigins);
  }

  const payment = paymentLookup.data as { id: string; provider_order_id: string | null; status: string };

  // razorpay-webhook may have already recorded this as paid - nothing further
  // to verify or write in that case, just hand back the current order.
  if (payment.status === "paid") {
    const current = await admin.schema("ordering").rpc("get_order", { p_order_id: orderId });
    if (current.error) {
      console.error("verify-online-payment: could not re-read already-paid order", current.error.code);
      return jsonResponse({ error: "Unable to load order." }, 500, origin, allowedOrigins);
    }
    return jsonResponse({ order: current.data, alreadyPaid: true }, 200, origin, allowedOrigins);
  }

  if (!payment.provider_order_id) {
    return jsonResponse({ error: "Payment has not been started for this order." }, 409, origin, allowedOrigins);
  }

  const providerLookup = await admin.schema("ordering").rpc("get_payment_provider_for_order", { p_order_id: orderId });
  if (providerLookup.error) {
    console.warn("verify-online-payment: provider lookup failed", providerLookup.error.code);
    return jsonResponse(
      { error: "Online payments are not available for this outlet." },
      statusForPgErrorCode(providerLookup.error.code),
      origin,
      allowedOrigins,
    );
  }

  const providerResult = providerLookup.data as Record<string, unknown>;
  if (providerResult.provider !== "razorpay") {
    console.error("verify-online-payment: unsupported provider", providerResult.provider);
    return jsonResponse({ error: "Configured payment provider is not supported." }, 500, origin, allowedOrigins);
  }

  const credentials = credentialsFromProviderResolution(providerResult);
  const adapter = getPaymentAdapter("razorpay");

  const signatureValid = await adapter.verifyCheckoutSignature(credentials, {
    providerOrderId: payment.provider_order_id,
    providerPaymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!signatureValid) {
    console.warn("verify-online-payment: checkout signature verification failed", orderId);
    return jsonResponse({ error: "Payment verification failed." }, 401, origin, allowedOrigins);
  }

  // Signature alone proves the payload was signed with our key secret; the
  // actual capture state is only trustworthy once confirmed by Razorpay's API.
  let fetchedPayment;
  try {
    fetchedPayment = await adapter.fetchPayment(credentials, razorpayPaymentId);
  } catch (fetchError) {
    console.error("verify-online-payment: fetching payment from razorpay failed", fetchError);
    return jsonResponse({ error: "Unable to confirm payment with the payment provider." }, 502, origin, allowedOrigins);
  }

  if (fetchedPayment.providerOrderId && fetchedPayment.providerOrderId !== payment.provider_order_id) {
    console.error("verify-online-payment: razorpay payment belongs to a different order", orderId);
    return jsonResponse({ error: "Payment does not belong to this order." }, 409, origin, allowedOrigins);
  }

  const resultStatus = fetchedPayment.captured ? "paid" : fetchedPayment.status === "failed" ? "failed" : "authorized";

  const recordResult = await admin.schema("ordering").rpc("record_payment_result", {
    p_payment_id: payment.id,
    p_result_status: resultStatus,
    p_provider_event_id: `checkout:${fetchedPayment.providerPaymentId}`,
    p_provider_payment_id: fetchedPayment.providerPaymentId,
    p_method: fetchedPayment.method,
    p_gateway_payload: fetchedPayment.raw,
    p_gateway_fee: null,
    p_gateway_tax: null,
  });

  if (recordResult.error) {
    console.error("verify-online-payment: record_payment_result failed", recordResult.error.code);
    return jsonResponse(
      { error: "Unable to record payment result." },
      statusForPgErrorCode(recordResult.error.code),
      origin,
      allowedOrigins,
    );
  }

  if (resultStatus !== "paid") {
    return jsonResponse({ error: "Payment was not captured.", order: recordResult.data }, 402, origin, allowedOrigins);
  }

  return jsonResponse({ order: recordResult.data }, 200, origin, allowedOrigins);
});

