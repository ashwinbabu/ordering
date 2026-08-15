// send-sms-hook
//
// Supabase's "Send SMS" Auth Hook. Supabase Auth generates and owns the OTP
// end to end (signInWithOtp / verifyOtp) - this function's only job is to
// take the OTP Supabase already generated and hand it to MSG91 for SMS
// delivery. It must never generate, verify, or judge authentication itself;
// it is a delivery adapter, not an auth authority.
//
// Security: this endpoint is invoked by Supabase's own infrastructure, not
// the browser, and is authenticated via the Standard Webhooks signature
// scheme (https://www.standardwebhooks.com/), not a Supabase JWT - hence
// verify_jwt is disabled on deployment and every request is verified with
// `wh.verify()` below instead. A request with a missing or invalid
// signature is rejected before anything else runs.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const rawHookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
const msg91AuthKey = Deno.env.get("MSG91_AUTHKEY");
const msg91TemplateId = Deno.env.get("MSG91_TEMPLATE_ID");
// Name of the DLT template's substitution variable that receives the OTP
// (commonly "VAR1", or a custom name chosen when the template was
// registered). Confirm the exact name against the approved template.
const msg91OtpVariableName = Deno.env.get("MSG91_OTP_VARIABLE_NAME") ?? "VAR1";

interface SendSmsHookPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

function isSendSmsHookPayload(value: unknown): value is SendSmsHookPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | undefined;
  const sms = record.sms as Record<string, unknown> | undefined;
  return Boolean(
    user && typeof user.id === "string" &&
    typeof user.phone === "string" && user.phone.length > 0 &&
    sms && typeof sms.otp === "string" && /^[0-9]{4,10}$/.test(sms.otp),
  );
}

function maskPhone(phone: string) {
  return phone.length <= 4 ? "***" : `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}

function errorResponse(httpCode: number, message: string) {
  console.error(`send-sms-hook: ${message}`);
  return new Response(
    JSON.stringify({ error: { http_code: httpCode, message } }),
    { status: httpCode, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * MSG91's Flow (template/DLT) SMS API. Field names below follow MSG91's
 * commonly documented v5 Flow shape (template_id + per-recipient mobiles +
 * template variables) but could not be verified against a live MSG91
 * account or the current API reference during implementation - confirm the
 * exact endpoint/field names against the real dashboard/template before
 * relying on this in production. Keep any correction isolated to this
 * function; nothing else in the hook depends on MSG91's specific shape.
 */
async function sendViaMsg91(phone: string, otp: string): Promise<{ ok: true; requestId?: string } | { ok: false; status: number; message: string }> {
  const mobile = phone.replace("+", "");
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
      recipients: [{ mobiles: mobile, [msg91OtpVariableName]: otp }],
    }),
  });

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: 502, message: "MSG91 returned a non-JSON response." };
  }

  const type = typeof body.type === "string" ? body.type.toLowerCase() : undefined;
  const accepted = response.ok && type !== "error" && body.hasError !== true;

  if (!accepted) {
    const providerMessage = typeof body.message === "string" ? body.message : `HTTP ${response.status}`;
    return { ok: false, status: response.status >= 400 ? response.status : 502, message: `MSG91 rejected the SMS request: ${providerMessage}` };
  }

  const requestId = typeof body.message === "string" ? body.message : undefined;
  return { ok: true, requestId };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return errorResponse(405, "Use POST.");
  }

  if (!rawHookSecret) {
    return errorResponse(500, "SEND_SMS_HOOK_SECRET is not configured.");
  }
  if (!msg91AuthKey || !msg91TemplateId) {
    return errorResponse(500, "MSG91_AUTHKEY / MSG91_TEMPLATE_ID are not configured.");
  }

  const payloadText = await request.text();
  const headers = Object.fromEntries(request.headers);
  const webhook = new Webhook(rawHookSecret.replace("v1,whsec_", ""));

  let payload: unknown;
  try {
    payload = webhook.verify(payloadText, headers);
  } catch {
    // Signature missing/invalid - do not process, do not send an SMS.
    return errorResponse(401, "Invalid hook signature.");
  }

  if (!isSendSmsHookPayload(payload)) {
    return errorResponse(400, "Malformed Send SMS Hook payload.");
  }

  const { user, sms } = payload;
  console.log(`send-sms-hook: invoked for ${maskPhone(user.phone)}`);

  const result = await sendViaMsg91(user.phone, sms.otp);

  if (!result.ok) {
    return errorResponse(result.status, `delivery failed for ${maskPhone(user.phone)} - ${result.message}`);
  }

  console.log(`send-sms-hook: MSG91 accepted delivery for ${maskPhone(user.phone)}${result.requestId ? ` (request ${result.requestId})` : ""}`);
  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
