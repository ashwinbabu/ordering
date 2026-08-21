import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, getServerConfig } from "../_shared/payments/supabase-clients.ts";
import { sendViaTelegram } from "../_shared/notifications/channels/telegram/telegram-provider.ts";

// Onboarding-only webhook: the only inputs it understands are /connect
// <token> (expected inside a staff group) and /start <token> (Telegram's
// deep-link command, expected in a private chat). Everything else --
// ordinary staff chatter, unrelated commands, edited messages, non-message
// updates -- is safely ignored. This is not a general chat bot and it never
// reads or stores ordinary conversation content.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string; title?: string };
  from?: { id: number };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return ok();
  }

  const serverConfig = getServerConfig();
  if (!serverConfig.supabaseUrl || !serverConfig.serviceRoleKey) {
    console.error(JSON.stringify({ msg: "telegram webhook missing Supabase service credentials" }));
    return ok();
  }
  const adminClient = createAdminClient(serverConfig.supabaseUrl, serverConfig.serviceRoleKey);

  const { data: webhookConfig, error: configError } = await adminClient.rpc("notifications_get_telegram_webhook_config");
  if (configError || !webhookConfig?.webhookSecret || !webhookConfig?.botToken) {
    console.error(JSON.stringify({ msg: "telegram webhook config unavailable", error: configError?.message }));
    return ok();
  }

  // Authenticate before doing any other work -- reject invalid/missing
  // secret requests up front, not after parsing/DB calls.
  const suppliedSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!timingSafeEqual(suppliedSecret, webhookConfig.webhookSecret as string)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  // Telegram redelivers updates it never got a fast 2xx for. Recognize an
  // already-fully-handled update_id before doing anything else, so a replay
  // can't send a second (misleading "invalid code") reply for a pairing that
  // already succeeded on the first delivery.
  const { data: isNewUpdate, error: dedupeError } = await adminClient.rpc(
    "notifications_claim_telegram_webhook_update",
    { p_update_id: update.update_id },
  );
  if (dedupeError) {
    console.error(JSON.stringify({ msg: "telegram webhook dedupe check failed", error: dedupeError.message }));
    return ok();
  }
  if (!isNewUpdate) {
    return ok();
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) {
    return ok();
  }

  const match = text.match(/^\/(connect|start)(?:@\S+)?(?:\s+(\S+))?/i);
  if (!match) {
    return ok();
  }
  const token = match[2];
  if (!token) {
    return ok();
  }

  const botToken = webhookConfig.botToken as string;
  const chatId = String(message.chat.id);

  const tokenHash = await sha256Hex(token);
  const { data: result, error: consumeError } = await adminClient.rpc("notifications_consume_telegram_pairing", {
    p_token_hash: tokenHash,
    p_telegram_chat_id: chatId,
    p_telegram_chat_type: message.chat.type,
    p_telegram_chat_title: message.chat.title ?? null,
    p_telegram_user_id: message.from ? String(message.from.id) : null,
  });

  if (consumeError) {
    console.error(JSON.stringify({ msg: "telegram pairing consumption failed", error: consumeError.message }));
    return ok();
  }

  let replyText: string;
  if (result.ok) {
    const target = result.destinationType === "staff_group"
      ? `${escapeHtml(result.businessName ?? "")}${result.locationName ? " · " + escapeHtml(result.locationName) : ""}`
      : "your account";
    replyText = result.destinationType === "staff_group"
      ? `✅ Connected to ${target}\nThis group will now receive staff order alerts.`
      : `✅ Connected!\nYou'll receive order alerts here for ${target}.`;
  } else if (result.reason === "wrong_chat_type" && result.destinationType === "staff_group") {
    replyText = "This code is for a staff group chat. Add this bot to your restaurant's Telegram group and send the code there instead.";
  } else if (result.reason === "wrong_chat_type" && result.destinationType === "business_user") {
    replyText = "This code is for connecting your personal Telegram. Open a private chat with this bot and send the code there instead.";
  } else {
    replyText = "That code is invalid, expired, or already used. Generate a new one from the admin dashboard.";
  }

  const sendResult = await sendViaTelegram({ botToken, chatId, text: replyText, parseMode: "HTML" });
  if (sendResult.outcome !== "sent") {
    console.error(JSON.stringify({ msg: "telegram webhook confirmation reply failed", error: sendResult.outcome === "sent" ? undefined : sendResult.error }));
  }

  return ok();
});
