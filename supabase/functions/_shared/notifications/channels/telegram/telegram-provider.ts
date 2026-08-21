export interface TelegramSendParams {
  botToken: string;
  chatId: string;
  text: string;
  parseMode: "HTML";
  buttonUrl?: string | null;
}

export type TelegramSendOutcome =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "retry"; error: string }
  | { outcome: "permanent_failure"; error: string };

// The Bot API has no Resend-style Idempotency-Key for sendMessage -- there is
// no provider-side dedup mechanism to reuse here. DB-level delivery status is
// the only thing preventing a resend on retry; a crash between "Telegram
// accepted the call" and "we persisted sent" can still produce a duplicate
// message. That's an accepted at-least-once risk for this channel, not a bug
// (see the project notes on Telegram delivery semantics).
export async function sendViaTelegram(params: TelegramSendParams): Promise<TelegramSendOutcome> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        parse_mode: params.parseMode,
        disable_web_page_preview: true,
        ...(params.buttonUrl
          ? { reply_markup: { inline_keyboard: [[{ text: "Open order", url: params.buttonUrl }]] } }
          : {}),
      }),
    });
  } catch (error) {
    return {
      outcome: "retry",
      error: `network error calling Telegram: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const body = (await response.json().catch(() => null)) as
    | { ok: true; result: { message_id: number } }
    | { ok: false; error_code?: number; description?: string }
    | null;

  if (body?.ok) {
    return { outcome: "sent", providerMessageId: String(body.result.message_id) };
  }

  const errorCode = body?.error_code ?? response.status;
  const description = body?.description ?? `HTTP ${response.status}`;

  // 429 (flood control) and 5xx (Telegram-side trouble) are transient.
  // Everything else -- 400 chat not found, 403 bot was blocked/kicked,
  // 401 invalid token, etc. -- is a permanent condition for this
  // destination and should not be retried forever.
  if (errorCode === 429 || errorCode >= 500) {
    return { outcome: "retry", error: `Telegram ${errorCode}: ${description}` };
  }
  return { outcome: "permanent_failure", error: `Telegram ${errorCode}: ${description}` };
}
