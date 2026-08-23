export interface ResendSendParams {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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

  if (status === 429 || status >= 500) {
    return { outcome: "retry", error: `Resend ${status}: ${truncatedBody}` };
  }
  return { outcome: "permanent_failure", error: `Resend ${status}: ${truncatedBody}` };
}
