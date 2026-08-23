export interface ResendSendParams {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** delivery.id -- second, provider-level idempotency layer independent of
   * the DB-level dedupe_key. Reused unchanged on every retry of the same
   * delivery so a crash between "Resend accepted" and "DB recorded it" can't
   * produce a duplicate send. */
  idempotencyKey: string;
}

export type ResendSendOutcome =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "retry"; error: string }
  | { outcome: "permanent_failure"; error: string };

export async function sendViaResend(params: ResendSendParams): Promise<ResendSendOutcome> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
  } catch (error) {
    return {
      outcome: "retry",
      error: `network error calling Resend: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as { id?: string } | null;
    return { outcome: "sent", providerMessageId: body?.id ?? "" };
  }

  const status = response.status;
  const bodyText = await response.text().catch(() => "");
  const truncatedBody = bodyText.slice(0, 500);

  // 429 and 5xx are transient -- everything else (bad request, invalid
  // recipient, auth error, etc.) is a permanent 4xx we should not retry.
  if (status === 429 || status >= 500) {
    return { outcome: "retry", error: `Resend ${status}: ${truncatedBody}` };
  }
  return { outcome: "permanent_failure", error: `Resend ${status}: ${truncatedBody}` };
}
