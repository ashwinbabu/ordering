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

  if (errorCode === 429 || errorCode >= 500) {
    return { outcome: "retry", error: `Telegram ${errorCode}: ${description}` };
  }
  return { outcome: "permanent_failure", error: `Telegram ${errorCode}: ${description}` };
}

