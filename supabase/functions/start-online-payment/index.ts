// start-online-payment
//
// Called by an authenticated storefront customer right after
// ordering.checkout_cart() has created an online order in `payment_pending`.
// verify_jwt = true - Supabase rejects requests with no/invalid JWT before
// this code runs, but a valid JWT alone does not prove the caller owns THIS
// order, so ordering.get_order (called with the caller's own JWT below) is
// what actually enforces that, via private.can_view_order.
//
// Amount and currency are always read back from the order row; nothing the
// browser sends is trusted for either. Idempotency is delegated entirely to
// ordering.create_payment_attempt / ordering.mark_payment_pending, which are
// themselves safe to call twice with the same paymentAttemptId - this
// function does not invent any additional idempotency layer on top.
import {
  buildAllowedOrigins,
  corsHeaders,
  jsonResponse,
  statusForPgErrorCode,
} from "../_shared/payments/http.ts";
import {
  createAdminClient,
  createUserClient,
  getServerConfig,
} from "../_shared/payments/supabase-clients.ts";
import { credentialsFromProviderResolution } from "../_shared/payments/provider-config.ts";
import { getPaymentAdapter } from "../_shared/payments/registry.ts";

const allowedOrigins = buildAllowedOrigins();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin, allowedOrigins),
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
      origin,
      allowedOrigins,
    );
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse(
      { error: "Missing authorization." },
      401,
      origin,
      allowedOrigins,
    );
  }

  const { supabaseUrl, serviceRoleKey, anonKey } = getServerConfig();
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error(
      "start-online-payment: required server configuration is missing",
    );
    return jsonResponse(
      { error: "Payment service is not configured." },
      500,
      origin,
      allowedOrigins,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body." },
      400,
      origin,
      allowedOrigins,
    );
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : null;
  const paymentAttemptId =
    typeof payload.paymentAttemptId === "string"
      ? payload.paymentAttemptId
      : null;
  if (
    !orderId ||
    !UUID_RE.test(orderId) ||
    !paymentAttemptId ||
    !UUID_RE.test(paymentAttemptId)
  ) {
    return jsonResponse(
      { error: "orderId and paymentAttemptId must be valid UUIDs." },
      400,
      origin,
      allowedOrigins,
    );
  }

  const userClient = createUserClient(supabaseUrl, anonKey, authorization);
  const admin = createAdminClient(supabaseUrl, serviceRoleKey);

  // Access + authoritative order state, resolved under the caller's own JWT.
  const orderLookup = await userClient
    .schema("ordering")
    .rpc("get_order", { p_order_id: orderId });
  if (orderLookup.error) {
    console.warn(
      "start-online-payment: order lookup failed",
      orderLookup.error.code,
    );
    return jsonResponse(
      { error: "Order could not be accessed." },
      statusForPgErrorCode(orderLookup.error.code),
      origin,
      allowedOrigins,
    );
  }

  const order = orderLookup.data as Record<string, unknown>;
  if (order.payment_method !== "online" || order.status !== "payment_pending") {
    return jsonResponse(
      { error: "Order is not awaiting an online payment." },
      409,
      origin,
      allowedOrigins,
    );
  }

  const amount = Number(order.grand_total);
  const currency = typeof order.currency === "string" ? order.currency : "";
  if (!Number.isFinite(amount) || amount <= 0 || !currency) {
    console.error(
      "start-online-payment: order snapshot has an invalid amount/currency",
      orderId,
    );
    return jsonResponse(
      { error: "Order amount could not be resolved." },
      500,
      origin,
      allowedOrigins,
    );
  }

  // Provider resolution requires service_role and returns the decrypted
  // private credential - never derivable or reachable from the browser.
  const providerLookup = await admin
    .schema("ordering")
    .rpc("get_payment_provider_for_order", { p_order_id: orderId });
  if (providerLookup.error) {
    console.warn(
      "start-online-payment: provider lookup failed",
      providerLookup.error.code,
    );
    return jsonResponse(
      { error: "Online payments are not available for this outlet." },
      statusForPgErrorCode(providerLookup.error.code),
      origin,
      allowedOrigins,
    );
  }

  const providerResult = providerLookup.data as Record<string, unknown>;
  const providerName =
    typeof providerResult.provider === "string" ? providerResult.provider : "";
  if (providerName !== "razorpay") {
    console.error("start-online-payment: unsupported provider", providerName);
    return jsonResponse(
      { error: "Configured payment provider is not supported." },
      500,
      origin,
      allowedOrigins,
    );
  }

  const credentials = credentialsFromProviderResolution(providerResult);
  if (credentials.authMode !== "api_key") {
    console.error(
      "start-online-payment: unsupported auth mode",
      credentials.authMode,
    );
    return jsonResponse(
      { error: "Payment provider authentication mode is not supported yet." },
      500,
      origin,
      allowedOrigins,
    );
  }

  const adapter = getPaymentAdapter(providerName);

  // create_payment_attempt is idempotent (on conflict do nothing + a fact
  // check against the existing row), so replaying the same paymentAttemptId
  // after a lost response is always safe and returns the same attempt.
  const attemptResult = await admin
    .schema("ordering")
    .rpc("create_payment_attempt", {
      p_payment_id: paymentAttemptId,
      p_order_id: orderId,
      p_provider: "razorpay",
      p_amount: amount,
      p_currency: currency,
      p_method: null,
    });
  if (attemptResult.error) {
    console.warn(
      "start-online-payment: create_payment_attempt failed",
      attemptResult.error.code,
    );
    return jsonResponse(
      { error: "Unable to start payment." },
      statusForPgErrorCode(attemptResult.error.code),
      origin,
      allowedOrigins,
    );
  }

  const attempt = attemptResult.data as Record<string, unknown>;
  let providerOrderId =
    typeof attempt.provider_order_id === "string"
      ? attempt.provider_order_id
      : null;

  if (!providerOrderId) {
    // First attempt for this paymentAttemptId (or a retry that never reached
    // mark_payment_pending last time) - create the Razorpay order now. Our
    // own ids go in notes/receipt purely for reconciliation on Razorpay's
    // dashboard; Razorpay never learns anything about our schema beyond that.
    const amountMinorUnits = Math.round(amount * 100);
    let created;
    try {
      created = await adapter.createOrder(credentials, {
        amountMinorUnits,
        currency,
        receipt: paymentAttemptId,
        notes: { order_id: orderId, payment_id: paymentAttemptId },
      });
    } catch (razorpayError) {
      console.error(
        "start-online-payment: razorpay order creation failed",
        razorpayError,
      );
      return jsonResponse(
        { error: "Unable to start payment with the payment provider." },
        502,
        origin,
        allowedOrigins,
      );
    }
    providerOrderId = created.providerOrderId;

    const markResult = await admin
      .schema("ordering")
      .rpc("mark_payment_pending", {
        p_payment_id: paymentAttemptId,
        p_provider_order_id: providerOrderId,
        p_gateway_payload: created.raw,
      });
    if (markResult.error) {
      console.error(
        "start-online-payment: mark_payment_pending failed",
        markResult.error.code,
      );
      return jsonResponse(
        { error: "Unable to record payment start." },
        statusForPgErrorCode(markResult.error.code),
        origin,
        allowedOrigins,
      );
    }
  }

  return jsonResponse(
    {
      paymentAttemptId,
      provider: "razorpay",
      providerOrderId,
      checkoutKey: credentials.publicConfig.checkoutKey ?? null,
      amount: Math.round(amount * 100),
      currency,
      display: credentials.publicConfig,
    },
    200,
    origin,
    allowedOrigins,
  );
});
