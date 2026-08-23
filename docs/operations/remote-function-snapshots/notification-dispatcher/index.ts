import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, getServerConfig } from "../_shared/payments/supabase-clients.ts";
import { jsonResponse } from "../_shared/payments/http.ts";
import { loadDispatcherConfig } from "../_shared/notifications/config.ts";
import { policyRulesForEvent } from "../_shared/notifications/policy/notification-policy.ts";
import { resolveRecipients } from "../_shared/notifications/recipients/resolve-recipients.ts";
import { getChannelHandler } from "../_shared/notifications/channels/registry.ts";
import {
  buildOrderCancelledEmailData,
  buildOrderPlacedEmailData,
} from "../_shared/notifications/templates/email/template-data.ts";
import {
  buildDailySalesSummaryTelegramData,
  buildOrderCancelledTelegramData,
  buildOrderWaitingTelegramData,
  buildStaffNewOrderTelegramData,
  buildStoreStatusTelegramData,
} from "../_shared/notifications/templates/telegram/template-data.ts";
import type {
  DeliverySpec,
  NotificationDeliveryRow,
  NotificationEventRow,
  OrderActorType,
  PlanningContext,
} from "../_shared/notifications/types.ts";

const EVENTS_BATCH_LIMIT = 20;
const DELIVERIES_BATCH_LIMIT = 20;
const EVENT_PLANNING_LEASE_SECONDS = 120;
const DELIVERY_SENDING_LEASE_SECONDS = 120;
const EVENT_MAX_ATTEMPTS = 8;
const DELIVERY_MAX_ATTEMPTS = 5;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// deno-lint-ignore no-explicit-any
type OrderContext = any;

const WAITING_MINUTES_BY_EVENT: Record<string, number> = {
  "order.waiting_3m": 3,
  "order.waiting_8m": 8,
};

async function planClaimedEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  event: NotificationEventRow,
  devDefaultStorefrontUrl: string | null,
  environment: "development" | "production",
): Promise<void> {
  // entity_type decides which context RPC to fetch: order-scoped events
  // (placed/cancelled/waiting_*) share notifications_get_order_context;
  // location-scoped events (store.*, sales.daily_summary) have no single
  // order to hang off, so they use notifications_get_location_context
  // instead. Both return the same "telegram" shape, so everything downstream
  // of building the PlanningContext is identical either way.
  let context: OrderContext;
  if (event.entity_type === "order") {
    const { data, error } = await adminClient.rpc(
      "notifications_get_order_context",
      { p_order_id: event.payload.orderId },
    ) as { data: OrderContext; error: { message: string } | null };
    if (error) throw new Error(`failed to load order context: ${error.message}`);
    context = data;
  } else {
    const { data, error } = await adminClient.rpc(
      "notifications_get_location_context",
      { p_location_id: event.entity_id, p_summary_date: event.payload.summaryDate ?? null },
    ) as { data: OrderContext; error: { message: string } | null };
    if (error) throw new Error(`failed to load location context: ${error.message}`);
    context = data;
  }

  const opts = { devDefaultStorefrontUrl, environment };
  const planningContext: PlanningContext = {
    customer: context.customer
      ? { id: context.customer.id, email: context.customer.email, displayName: context.customer.displayName }
      : null,
    telegram: context.telegram ?? { staffGroup: null, businessOwners: [] },
    preferences: context.preferences ?? { notifyOwnerOnCancellation: false },
  };

  const rules = policyRulesForEvent(event.event_type, {
    notifyOwnerOnCancellation: planningContext.preferences.notifyOwnerOnCancellation,
  });

  // rule -> 0..N recipients -> 0..N independent deliveries. business_owners
  // rules fan out to one delivery per connected owner.
  const deliveries: DeliverySpec[] = rules.flatMap((rule) => {
    let payload: Record<string, unknown>;
    if (rule.template === "customer_order_placed") {
      payload = buildOrderPlacedEmailData(context, opts) as unknown as Record<string, unknown>;
    } else if (rule.template === "customer_order_cancelled") {
      const actorType = (event.payload.actorType ?? "system") as OrderActorType;
      payload = buildOrderCancelledEmailData(context, actorType, opts) as unknown as Record<string, unknown>;
    } else if (rule.template === "staff_new_order") {
      payload = buildStaffNewOrderTelegramData(context) as unknown as Record<string, unknown>;
    } else if (rule.template === "order_cancelled_alert") {
      const actorType = (event.payload.actorType ?? "system") as OrderActorType;
      payload = buildOrderCancelledTelegramData(context, actorType) as unknown as Record<string, unknown>;
    } else if (rule.template === "order_waiting_alert") {
      const waitingMinutes = WAITING_MINUTES_BY_EVENT[event.event_type] ?? 0;
      payload = buildOrderWaitingTelegramData(context, waitingMinutes) as unknown as Record<string, unknown>;
    } else if (rule.template === "store_status_alert") {
      const isAccepting = event.event_type === "store.resumed";
      payload = buildStoreStatusTelegramData(context, isAccepting) as unknown as Record<string, unknown>;
    } else if (rule.template === "daily_sales_summary") {
      payload = buildDailySalesSummaryTelegramData(context) as unknown as Record<string, unknown>;
    } else {
      throw new Error(`no template-data builder registered for template "${rule.template}"`);
    }

    return resolveRecipients(rule.recipient, planningContext).map((resolved) => ({
      channel: rule.channel,
      templateKey: rule.template,
      recipientType: resolved.recipientType,
      recipientId: resolved.recipientId,
      recipientAddress: resolved.address,
      locale: "en-IN",
      payload,
      status: resolved.address ? "pending" : "skipped",
      skipReason: resolved.skipReason,
    }));
  });

  const { error: planError } = await adminClient.rpc("notifications_plan_event", {
    p_event_id: event.id,
    p_deliveries: deliveries,
  });
  if (planError) {
    throw new Error(`failed to plan event: ${planError.message}`);
  }
}

async function runEventPlanningPhase(
  adminClient: ReturnType<typeof createAdminClient>,
  devDefaultStorefrontUrl: string | null,
  environment: "development" | "production",
) {
  const { data: events, error } = await adminClient.rpc("notifications_claim_events", {
    p_limit: EVENTS_BATCH_LIMIT,
    p_lease_seconds: EVENT_PLANNING_LEASE_SECONDS,
  }) as { data: NotificationEventRow[] | null; error: { message: string } | null };

  if (error) {
    throw new Error(`failed to claim notification events: ${error.message}`);
  }

  let planned = 0;
  let failed = 0;

  for (const event of events ?? []) {
    try {
      await planClaimedEvent(adminClient, event, devDefaultStorefrontUrl, environment);
      planned++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ msg: "notification event planning failed", eventId: event.id, error: message }));
      const { error: markError } = await adminClient.rpc("notifications_mark_event_failed", {
        p_event_id: event.id,
        p_error: message,
        p_max_attempts: EVENT_MAX_ATTEMPTS,
      });
      if (markError) {
        console.error(JSON.stringify({ msg: "failed to record event planning failure", eventId: event.id, error: markError.message }));
      }
    }
  }

  return { claimed: events?.length ?? 0, planned, failed };
}

async function runDeliverySendingPhase(
  adminClient: ReturnType<typeof createAdminClient>,
  config: Awaited<ReturnType<typeof loadDispatcherConfig>>,
) {
  const { data: deliveries, error } = await adminClient.rpc("notifications_claim_deliveries", {
    p_limit: DELIVERIES_BATCH_LIMIT,
    p_lease_seconds: DELIVERY_SENDING_LEASE_SECONDS,
  }) as { data: NotificationDeliveryRow[] | null; error: { message: string } | null };

  if (error) {
    throw new Error(`failed to claim notification deliveries: ${error.message}`);
  }

  let sent = 0;
  let retried = 0;
  let dead = 0;
  let skipped = 0;

  for (const delivery of deliveries ?? []) {
    try {
      const handler = getChannelHandler(delivery.channel);
      const result = await handler(
        {
          deliveryId: delivery.id,
          recipientAddress: delivery.recipient_address ?? "",
          templateKey: delivery.template_key,
          payload: delivery.payload,
        },
        config,
      );

      if (result.outcome === "sent") sent++;
      else if (result.outcome === "retry") retried++;
      else if (result.outcome === "skipped") skipped++;
      else dead++;

      const { error: recordError } = await adminClient.rpc("notifications_record_delivery_result", {
        p_delivery_id: delivery.id,
        p_outcome: result.outcome,
        p_provider: result.provider,
        p_provider_message_id: result.providerMessageId ?? null,
        p_error: result.error ?? null,
        p_max_attempts: DELIVERY_MAX_ATTEMPTS,
        p_skip_reason: result.skipReason ?? null,
      });
      if (recordError) {
        console.error(JSON.stringify({ msg: "failed to record delivery result", deliveryId: delivery.id, error: recordError.message }));
      }
    } catch (error) {
      retried++;
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ msg: "delivery send threw unexpectedly", deliveryId: delivery.id, error: message }));
      const { error: recordError } = await adminClient.rpc("notifications_record_delivery_result", {
        p_delivery_id: delivery.id,
        p_outcome: "retry",
        p_error: message,
        p_max_attempts: DELIVERY_MAX_ATTEMPTS,
      });
      if (recordError) {
        console.error(JSON.stringify({ msg: "failed to record delivery failure", deliveryId: delivery.id, error: recordError.message }));
      }
    }
  }

  return { claimed: deliveries?.length ?? 0, sent, retried, dead, skipped };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const allowedOrigins = new Set<string>();

  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200, origin, allowedOrigins);
  }

  const serverConfig = getServerConfig();
  if (!serverConfig.supabaseUrl || !serverConfig.serviceRoleKey) {
    return jsonResponse({ ok: false, error: "server is missing Supabase service credentials" }, 500, origin, allowedOrigins);
  }
  const adminClient = createAdminClient(serverConfig.supabaseUrl, serverConfig.serviceRoleKey);

  let config;
  try {
    config = await loadDispatcherConfig(adminClient);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ msg: "failed to load dispatcher config", error: message }));
    return jsonResponse({ ok: false, error: "failed to load dispatcher config" }, 500, origin, allowedOrigins);
  }

  const suppliedKey = req.headers.get("x-notification-dispatcher-key");
  if (!config.dispatcherAuthSecret || !suppliedKey || !timingSafeEqual(suppliedKey, config.dispatcherAuthSecret)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401, origin, allowedOrigins);
  }

  try {
    const planningResult = await runEventPlanningPhase(adminClient, config.devDefaultStorefrontUrl, config.notificationsEnvironment);
    const sendingResult = await runDeliverySendingPhase(adminClient, config);

    return jsonResponse(
      {
        ok: true,
        events: planningResult,
        deliveries: sendingResult,
      },
      200,
      origin,
      allowedOrigins,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ msg: "notification dispatcher run failed", error: message }));
    return jsonResponse({ ok: false, error: message }, 500, origin, allowedOrigins);
  }
});

