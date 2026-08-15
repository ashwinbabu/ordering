// customer-auth-msg91
//
// Public endpoint (verify_jwt = false, by definition - the caller has no
// session yet). Exchanges an MSG91 widget access token for a Supabase Auth
// session, without ever exposing the MSG91 authkey or the Supabase
// service-role key to the browser.
//
// Trust model: the client sends only an access token. This function decides
// which phone number that token proves by asking MSG91 - it never trusts a
// client-claimed identifier. If MSG91's response does not clearly report a
// verified identifier, the request is rejected outright (fail closed) rather
// than falling back to anything the client said. See "Unknown 1" in the
// integration plan - the exact response shape is unconfirmed against a real
// MSG91 account, so `extractVerifiedIdentifier` below is the piece most
// likely to need adjustment once a live response has been captured.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const msg91AuthKey = Deno.env.get("MSG91_AUTHKEY");
const phoneEmailDomain = Deno.env.get("CUSTOMER_PHONE_EMAIL_DOMAIN") ?? "phone-customers.invalid";
const configuredOrigins = (Deno.env.get("STOREFRONT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
// Dev fallbacks so a local `vite` server keeps working without extra setup.
// Add the real deployed origin(s) via STOREFRONT_ALLOWED_ORIGINS before shipping.
const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", "https://terminal.local"];
const allowedOrigins = new Set([...configuredOrigins, ...devOrigins]);

const identifierAttemptsPerWindow = 8;
const identifierWindowMinutes = 10;

interface VerifyRequestBody {
  accessToken?: unknown;
}

type ErrorCode =
  | "invalid_request"
  | "provider_unreachable"
  | "incorrect_code"
  | "expired_code"
  | "rate_limited"
  | "identifier_missing"
  | "replayed_token"
  | "server_error";

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(code: ErrorCode, message: string, status: number, origin: string | null) {
  return jsonResponse({ error: { code, message } }, status, origin);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Normalizes whatever MSG91 reports as the verified identifier into E.164.
 * Accepts a bare phone (digits, optionally with a leading "+") or an email.
 * Returns null if the value cannot be confidently normalized - callers must
 * treat that as a failure, never as "assume it's fine".
 */
function normalizeVerifiedIdentifier(raw: string): { kind: "phone"; e164: string } | { kind: "email"; email: string } | null {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? { kind: "email", email: trimmed.toLowerCase() } : null;
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return { kind: "phone", e164: `+${digits}` };
}

/**
 * MSG91's documented pattern elsewhere is {"type":"success","message":"..."}.
 * This checks the handful of field names that plausibly carry the verified
 * identifier in that shape. Confirm the real shape in Phase 0 and tighten
 * this to match exactly - do not ship this unconfirmed to a production
 * MSG91 account without checking it against a real response first.
 */
function extractVerifiedIdentifier(body: Record<string, unknown>): string | null {
  const candidateKeys = ["identifier", "mobile", "phone", "message"];
  for (const key of candidateKeys) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) return value;
  }

  if (body.data && typeof body.data === "object") {
    return extractVerifiedIdentifier(body.data as Record<string, unknown>);
  }

  return null;
}

function isMsg91Success(body: Record<string, unknown>): boolean {
  if (typeof body.type === "string") return body.type.toLowerCase() === "success";
  if (typeof body.success === "boolean") return body.success;
  return false;
}

/** Best-effort mapping so the sheet can show its existing per-reason copy. Unmatched failures fall back to "incorrect_code". */
function classifyMsg91Failure(body: Record<string, unknown>): ErrorCode {
  const text = [body.message, body.error].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  if (text.includes("expire")) return "expired_code";
  if (text.includes("limit") || text.includes("attempt")) return "rate_limited";
  return "incorrect_code";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return errorResponse("invalid_request", "Use POST.", 405, origin);
  }

  if (!msg91AuthKey) {
    console.error("customer-auth-msg91: MSG91_AUTHKEY secret is not configured.");
    return errorResponse("server_error", "Verification is not configured yet.", 500, origin);
  }

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Expected a JSON body.", 400, origin);
  }

  const accessToken = body.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0 || accessToken.length > 8000) {
    return errorResponse("invalid_request", "accessToken is required.", 400, origin);
  }

  let providerBody: Record<string, unknown>;
  try {
    const providerResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: msg91AuthKey, "access-token": accessToken }),
    });
    providerBody = await providerResponse.json();
  } catch (error) {
    console.error("customer-auth-msg91: MSG91 request failed", error);
    return errorResponse("provider_unreachable", "Could not verify the code right now. Please try again.", 502, origin);
  }

  if (!isMsg91Success(providerBody)) {
    const code = classifyMsg91Failure(providerBody);
    const message = code === "expired_code"
      ? "This code has expired. Request a new code to continue."
      : code === "rate_limited"
        ? "Too many attempts. Please try again shortly."
        : "That code isn't right. Try again.";
    return errorResponse(code, message, 401, origin);
  }

  const rawIdentifier = extractVerifiedIdentifier(providerBody);
  const normalized = rawIdentifier ? normalizeVerifiedIdentifier(rawIdentifier) : null;
  if (!normalized) {
    console.error("customer-auth-msg91: could not extract a verified identifier from MSG91's response", providerBody);
    return errorResponse("identifier_missing", "Could not confirm your phone number. Please try again.", 502, origin);
  }
  if (normalized.kind === "email") {
    // Email OTP is a deliberate future seam (non-Indian customers) - not wired yet.
    return errorResponse("invalid_request", "Email verification is not available yet.", 400, origin);
  }

  const identifierE164 = normalized.e164;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const core = supabase.schema("core");

  const tokenHash = await sha256Hex(accessToken);
  const { error: replayInsertError } = await core
    .from("customer_auth_verifications")
    .insert({ token_hash: tokenHash, identifier_e164: identifierE164, channel: "sms" });

  if (replayInsertError) {
    if (replayInsertError.code === "23505") {
      return errorResponse("replayed_token", "This verification has already been used.", 409, origin);
    }
    console.error("customer-auth-msg91: failed to record verification", replayInsertError);
    return errorResponse("server_error", "Something went wrong. Please try again.", 500, origin);
  }

  const windowStart = new Date(Date.now() - identifierWindowMinutes * 60_000).toISOString();
  const { count: recentAttempts } = await core
    .from("customer_auth_verifications")
    .select("id", { count: "exact", head: true })
    .eq("identifier_e164", identifierE164)
    .gte("created_at", windowStart);

  if ((recentAttempts ?? 0) > identifierAttemptsPerWindow) {
    return errorResponse("rate_limited", "Too many attempts. Please try again shortly.", 429, origin);
  }

  const { data: existingCustomer, error: lookupError } = await core
    .from("customers")
    .select("id, auth_user_id")
    .eq("phone_e164", identifierE164)
    .maybeSingle();

  if (lookupError) {
    console.error("customer-auth-msg91: customer lookup failed", lookupError);
    return errorResponse("server_error", "Something went wrong. Please try again.", 500, origin);
  }

  let customerId = existingCustomer?.id as string | undefined;
  let authUserId = existingCustomer?.auth_user_id as string | null | undefined;

  if (!customerId) {
    const { data: createdCustomer, error: createCustomerError } = await core
      .from("customers")
      .insert({ phone_e164: identifierE164, phone_verified_at: new Date().toISOString() })
      .select("id, auth_user_id")
      .single();

    if (createCustomerError || !createdCustomer) {
      console.error("customer-auth-msg91: failed to create customer", createCustomerError);
      return errorResponse("server_error", "Something went wrong. Please try again.", 500, origin);
    }

    customerId = createdCustomer.id;
    authUserId = createdCustomer.auth_user_id;
  } else {
    await core.from("customers").update({ phone_verified_at: new Date().toISOString() }).eq("id", customerId);
  }

  await core.from("customer_auth_verifications").update({ customer_id: customerId }).eq("token_hash", tokenHash);

  // Deterministic so we never need to look an auth user up by email - the
  // same phone always maps to the same synthetic identity.
  const syntheticEmail = `p${identifierE164.replace("+", "")}@${phoneEmailDomain}`;

  if (!authUserId) {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      phone: identifierE164.replace("+", ""),
      phone_confirm: true,
      user_metadata: { source: "msg91_otp", customer_id: customerId },
    });

    if (createUserError) {
      // Most likely a concurrent request already created this auth user under
      // the same deterministic email. Non-fatal: generateLink below still
      // works against that existing user. Anything else, log for follow-up.
      console.warn("customer-auth-msg91: createUser did not return a new user, continuing", createUserError.message);
    } else if (createdUser.user) {
      authUserId = createdUser.user.id;
      await core.from("customers").update({ auth_user_id: authUserId }).eq("id", customerId);
    }
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    console.error("customer-auth-msg91: failed to mint a session link", linkError);
    return errorResponse("server_error", "Something went wrong. Please try again.", 500, origin);
  }

  return jsonResponse(
    {
      tokenHash: linkData.properties.hashed_token,
      email: syntheticEmail,
      customer: { id: customerId, phoneE164: identifierE164 },
    },
    200,
    origin,
  );
});
