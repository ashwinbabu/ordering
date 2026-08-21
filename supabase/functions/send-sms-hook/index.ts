// Supabase Send SMS Auth Hook -> MSG91 delivery adapter.
// Supabase owns OTP generation/verification; this function only delivers the OTP.
// Requests are authenticated with Standard Webhooks signatures, so verify_jwt stays false.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const rawHookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
const msg91AuthKey = Deno.env.get("MSG91_AUTHKEY");
const msg91TemplateId = Deno.env.get("MSG91_TEMPLATE_ID");
const msg91OtpVariableName = Deno.env.get("MSG91_OTP_VARIABLE_NAME") ?? "VAR1";
const E164_RE = /^\+[1-9][0-9]{7,14}$/;

interface SendSmsHookPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

type FailureCategory =
  | "provider_auth_error"
  | "provider_rate_limited"
  | "provider_rejected"
  | "provider_unavailable"
  | "provider_invalid_response";

function isSendSmsHookPayload(value: unknown): value is SendSmsHookPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | undefined;
  const sms = record.sms as Record<string, unknown> | undefined;
  return Boolean(
    user && typeof user.id === "string" && typeof user.phone === "string" &&
      E164_RE.test(user.phone) && sms && typeof sms.otp === "string" &&
      /^[0-9]{4,10}$/.test(sms.otp),
  );
}

function maskPhone(phone: string) {
  return phone.length <= 5
    ? "***"
    : `${phone.slice(0, Math.min(4, phone.length - 3))}***${phone.slice(-2)}`;
}

function errorResponse(httpCode: number, message: string) {
  console.error(`send-sms-hook: ${message}`);
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { "Content-Type": "application/json" },
  });
}

function classifyFailure(status: number): FailureCategory {
  if (status === 401 || status === 403) return "provider_auth_error";
  if (status === 429) return "provider_rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

async function sendViaMsg91(phone: string, otp: string) {
  const response = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authkey: msg91AuthKey!,
    },
    body: JSON.stringify({
      template_id: msg91TemplateId,
      short_url: "0",
      recipients: [{ mobiles: phone.slice(1), [msg91OtpVariableName]: otp }],
    }),
  });

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    return { ok: false as const, status: 502, category: "provider_invalid_response" as const, providerMessage: "non_json_response" };
  }

  const type = typeof body.type === "string" ? body.type.toLowerCase() : undefined;
  if (!(response.ok && type !== "error" && body.hasError !== true)) {
    return {
      ok: false as const,
      status: response.status >= 400 ? response.status : 502,
      category: classifyFailure(response.status >= 400 ? response.status : 502),
      providerMessage: typeof body.message === "string" ? body.message : undefined,
    };
  }
  return { ok: true as const, requestId: typeof body.message === "string" ? body.message : undefined };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return errorResponse(405, "Use POST.");
  if (!rawHookSecret) return errorResponse(500, "SEND_SMS_HOOK_SECRET is not configured.");
  if (!msg91AuthKey || !msg91TemplateId) return errorResponse(500, "MSG91 delivery is not configured.");

  const payloadText = await request.text();
  const headers = Object.fromEntries(request.headers);
  const webhook = new Webhook(rawHookSecret.replace("v1,whsec_", ""));
  let payload: unknown;
  try {
    payload = webhook.verify(payloadText, headers);
  } catch {
    return errorResponse(401, "Invalid hook signature.");
  }
  if (!isSendSmsHookPayload(payload)) return errorResponse(400, "Malformed Send SMS Hook payload or non-E.164 phone number.");

  const { user, sms } = payload;
  const maskedPhone = maskPhone(user.phone);
  console.log(JSON.stringify({ event: "sms_delivery_requested", provider: "msg91", phone_masked: maskedPhone }));
  const result = await sendViaMsg91(user.phone, sms.otp);
  if (!result.ok) {
    console.error(JSON.stringify({
      event: "sms_delivery_failed",
      provider: "msg91",
      category: result.category,
      provider_status: result.status,
      provider_message: result.providerMessage ?? null,
      phone_masked: maskedPhone,
    }));
    return new Response(JSON.stringify({ error: { http_code: result.status, message: "SMS delivery could not be completed." } }), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.log(JSON.stringify({ event: "sms_delivery_accepted", provider: "msg91", phone_masked: maskedPhone, request_id: result.requestId ?? null }));
  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
