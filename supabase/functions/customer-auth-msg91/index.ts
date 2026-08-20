// customer-auth-msg91
//
// Public endpoint (verify_jwt = false, by definition - the caller has no
// session yet). Exchanges an MSG91 widget access token for a Supabase Auth
// session, without ever exposing the MSG91 authkey or the Supabase
// service-role key to the browser.
//
// Trust model: the client sends only an access token. This function decides
// which phone number that token proves by asking MSG91's own
// verifyAccessToken endpoint - it never trusts a client-claimed identifier.
// If MSG91's response does not report exactly one unambiguous verified
// identity, the request is rejected outright (fail closed).
//
// Response shape: failures are reported as { error: "<prose>" } and the
// browser derives its UI reason from the HTTP status - see codeFromStatus()
// in apps/storefront/features/auth/api/customer-auth-api.ts. Do not switch
// this to a coded object without changing that file in the same commit.
import { createClient } from "npm:@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("STOREFRONT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
// Dev fallbacks so a local `vite` server keeps working without extra setup.
// The real deployed origin(s) must be added via STOREFRONT_ALLOWED_ORIGINS -
// a browser calling from an origin that is not listed here gets no
// Access-Control-Allow-Origin header back and the sign-in fails in the
// client before it ever reaches this code.
const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = new Set([...configuredOrigins, ...devOrigins]);

// Bounds how often one phone number can burn verified tokens, independently
// of whatever throttling MSG91 applies on its side.
const identifierAttemptsPerWindow = 8;
const identifierWindowMinutes = 10;

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin))
    headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Supabase's newer API-key scheme exposes keys as a JSON map under
 * SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS rather than the legacy
 * single-value env vars. Both are read so this keeps working either way.
 */
function getNamedKey(raw: string | undefined, name = "default") {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[name];
  } catch {
    return undefined;
  }
}

function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return null;
  return `+${digits}`;
}

function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const decoded = atob(base64);
    const bytes = Uint8Array.from(decoded, (character) =>
      character.charCodeAt(0),
    );
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

const identityKeys = new Set([
  "identifier",
  "mobile",
  "mobileno",
  "mobile_number",
  "mobilenumber",
  "phone",
  "phone_number",
  "phonenumber",
  "user_identifier",
  "useridentifier",
]);

/**
 * MSG91 has no documented, stable response schema for verifyAccessToken, so
 * rather than guessing one field name this walks the whole response and
 * collects every value that both sits under an identity-ish key and parses
 * as a phone number. The caller requires exactly one distinct result: zero
 * means we cannot prove who this is, and more than one means the response is
 * ambiguous. Either way we refuse rather than pick.
 */
function collectIdentityCandidates(
  value: unknown,
  depth = 0,
  out = new Set<string>(),
): Set<string> {
  if (depth > 5 || value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectIdentityCandidates(item, depth + 1, out);
    return out;
  }
  if (typeof value !== "object") return out;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[\s-]/g, "_");
    if (identityKeys.has(normalizedKey) && typeof child === "string") {
      const phone = normalizePhone(child);
      if (phone) out.add(phone);
    }
    if (child && typeof child === "object")
      collectIdentityCandidates(child, depth + 1, out);
  }
  return out;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyMsg91AccessToken(authKey: string, accessToken: string) {
  const response = await fetch(
    "https://control.msg91.com/api/v5/widget/verifyAccessToken",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
    },
  );

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Fail closed below if MSG91 did not return a usable JSON response.
  }

  if (!response.ok || !body || typeof body !== "object") {
    return { ok: false as const, status: response.status || 502 };
  }

  const record = body as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const status =
    typeof record.status === "string" ? record.status.toLowerCase() : "";
  if (
    type === "error" ||
    type === "failed" ||
    type === "failure" ||
    status === "failed" ||
    record.success === false
  ) {
    return { ok: false as const, status: 401 };
  }

  const candidates = collectIdentityCandidates(body);
  // Only inspect the access token's own claims after MSG91's server-side
  // endpoint has accepted it - the token is untrusted input until then.
  if (candidates.size === 0) {
    collectIdentityCandidates(decodeJwtPayload(accessToken), 0, candidates);
  }

  if (candidates.size !== 1) {
    return {
      ok: false as const,
      status: 401,
      reason: "verified identity was missing or ambiguous",
    };
  }

  return { ok: true as const, phoneE164: [...candidates][0] };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    getNamedKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const publicKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    getNamedKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  const msg91AuthKey = Deno.env.get("MSG91_AUTHKEY");

  if (!supabaseUrl || !adminKey || !publicKey || !msg91AuthKey) {
    console.error(
      "customer-auth-msg91: required server configuration is missing",
    );
    return jsonResponse(
      { error: "Authentication service is not configured." },
      500,
      origin,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, origin);
  }

  const accessToken = [
    payload.accessToken,
    payload.access_token,
    payload.token,
  ].find(
    (value): value is string =>
      typeof value === "string" && value.length > 20 && value.length <= 8000,
  );
  if (!accessToken) {
    return jsonResponse({ error: "Missing MSG91 access token." }, 400, origin);
  }

  const verified = await verifyMsg91AccessToken(msg91AuthKey, accessToken);
  if (!verified.ok) {
    console.warn(
      `customer-auth-msg91: MSG91 access-token verification failed (${verified.status})`,
    );
    return jsonResponse(
      { error: "OTP verification could not be confirmed." },
      401,
      origin,
    );
  }

  const phoneE164 = verified.phoneE164;
  const suppliedIdentifier =
    typeof payload.identifier === "string"
      ? normalizePhone(payload.identifier)
      : null;
  if (suppliedIdentifier && suppliedIdentifier !== phoneE164) {
    console.warn(
      "customer-auth-msg91: client identifier did not match MSG91 verified identity",
    );
    return jsonResponse(
      { error: "Verified phone number mismatch." },
      401,
      origin,
    );
  }

  const admin = createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const publicClient = createClient(supabaseUrl, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Burn the token before anything is created or touched on its behalf, so a
  // replayed token cannot re-stamp phone_verified_at or mint a second session.
  const tokenHash = await sha256Hex(accessToken);
  const replayInsert = await admin
    .schema("core")
    .from("customer_auth_verifications")
    .insert({
      token_hash: tokenHash,
      identifier_e164: phoneE164,
      channel: "sms",
    });

  if (replayInsert.error) {
    if (replayInsert.error.code === "23505") {
      console.warn("customer-auth-msg91: rejected replayed MSG91 access token");
      return jsonResponse(
        {
          error:
            "This verification has already been used. Please request a new code.",
        },
        409,
        origin,
      );
    }
    console.error(
      "customer-auth-msg91: replay guard insert failed",
      replayInsert.error.code,
    );
    return jsonResponse(
      { error: "Unable to complete authentication safely." },
      500,
      origin,
    );
  }

  const windowStart = new Date(
    Date.now() - identifierWindowMinutes * 60_000,
  ).toISOString();
  const { count: recentAttempts } = await admin
    .schema("core")
    .from("customer_auth_verifications")
    .select("id", { count: "exact", head: true })
    .eq("identifier_e164", phoneE164)
    .gte("created_at", windowStart);

  if ((recentAttempts ?? 0) > identifierAttemptsPerWindow) {
    console.warn(
      "customer-auth-msg91: identifier exceeded the verification rate limit",
    );
    return jsonResponse(
      { error: "Too many attempts. Please try again shortly." },
      429,
      origin,
    );
  }

  let { data: customer, error: customerLookupError } = await admin
    .schema("core")
    .from("customers")
    .select("id, auth_user_id, phone_e164")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (customerLookupError) {
    console.error(
      "customer-auth-msg91: customer lookup failed",
      customerLookupError.code,
    );
    return jsonResponse(
      { error: "Unable to resolve customer account." },
      500,
      origin,
    );
  }

  if (!customer) {
    const inserted = await admin
      .schema("core")
      .from("customers")
      .insert({
        phone_e164: phoneE164,
        phone_verified_at: new Date().toISOString(),
      })
      .select("id, auth_user_id, phone_e164")
      .single();

    if (inserted.error) {
      // Most likely a concurrent request already created this row - re-read
      // rather than failing a legitimate sign-in.
      const retry = await admin
        .schema("core")
        .from("customers")
        .select("id, auth_user_id, phone_e164")
        .eq("phone_e164", phoneE164)
        .maybeSingle();
      if (retry.error || !retry.data) {
        console.error(
          "customer-auth-msg91: customer creation failed",
          inserted.error.code,
        );
        return jsonResponse(
          { error: "Unable to create customer account." },
          500,
          origin,
        );
      }
      customer = retry.data;
    } else {
      customer = inserted.data;
    }
  } else {
    await admin
      .schema("core")
      .from("customers")
      .update({ phone_verified_at: new Date().toISOString() })
      .eq("id", customer.id);
  }

  await admin
    .schema("core")
    .from("customer_auth_verifications")
    .update({ customer_id: customer.id })
    .eq("token_hash", tokenHash);

  const digits = phoneE164.slice(1);
  const syntheticEmail = `msg91_${digits}@auth.invalid`;
  let authUserId: string | null = customer.auth_user_id;
  let authEmail = syntheticEmail;

  if (authUserId) {
    const existing = await admin.auth.admin.getUserById(authUserId);
    if (existing.error || !existing.data.user) {
      console.error("customer-auth-msg91: linked auth user is missing");
      return jsonResponse(
        { error: "Customer authentication link is invalid." },
        500,
        origin,
      );
    }
    if (existing.data.user.email) {
      authEmail = existing.data.user.email;
    } else {
      const updated = await admin.auth.admin.updateUserById(authUserId, {
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { phone_e164: phoneE164, auth_provider: "msg91_widget" },
      });
      if (updated.error) {
        console.error(
          "customer-auth-msg91: could not attach synthetic email to auth user",
          updated.error.code,
        );
        return jsonResponse(
          { error: "Unable to prepare customer session." },
          500,
          origin,
        );
      }
      authEmail = syntheticEmail;
    }
  } else {
    // Create the auth user explicitly, WITH the verified phone attached.
    //
    // This is load-bearing for more than the auth record itself. The trigger
    // auth_users_10_sync_customer fires on insert into auth.users and only
    // takes its phone-adoption branch (which links this uuid onto the
    // existing core.customers row via `on conflict (phone_e164)`) when
    // new.phone is set. If the user is instead created implicitly by
    // generateLink below - email only, phone null - the trigger falls
    // through to its OAuth-only branch and inserts a SECOND customer row
    // with a null phone_e164 that claims this auth uuid. The link update
    // further down then violates customers_auth_user_id_key and the whole
    // sign-in fails 409, leaving an orphan row behind. Verified against the
    // live trigger: no phone => 1 orphan / 0 linked, phone set => 0 orphan /
    // 1 linked.
    const created = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      phone: digits,
      phone_confirm: true,
      user_metadata: { phone_e164: phoneE164, auth_provider: "msg91_widget" },
    });

    if (created.error) {
      // Most likely a concurrent request already created this identity.
      // generateLink still resolves it by email below, and the trigger has
      // already run for whichever request won the race.
      console.warn(
        "customer-auth-msg91: createUser did not return a new user, continuing",
        created.error.code,
      );
    } else if (created.data.user) {
      authUserId = created.data.user.id;
    }
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
    options: { data: { phone_e164: phoneE164, auth_provider: "msg91_widget" } },
  });

  if (generated.error || !generated.data.user) {
    console.error(
      "customer-auth-msg91: Supabase magic-link generation failed",
      generated.error?.code ?? "unknown",
    );
    return jsonResponse(
      { error: "Unable to create customer session." },
      500,
      origin,
    );
  }

  authUserId = generated.data.user.id;
  const properties = generated.data.properties as Record<
    string,
    unknown
  > | null;
  let tokenHashForSupabase =
    properties && typeof properties.hashed_token === "string"
      ? properties.hashed_token
      : null;

  if (
    !tokenHashForSupabase &&
    properties &&
    typeof properties.action_link === "string"
  ) {
    try {
      tokenHashForSupabase = new URL(properties.action_link).searchParams.get(
        "token",
      );
    } catch {
      tokenHashForSupabase = null;
    }
  }

  if (!tokenHashForSupabase) {
    console.error("customer-auth-msg91: Supabase did not return a token hash");
    return jsonResponse(
      { error: "Unable to create customer session." },
      500,
      origin,
    );
  }

  if (customer.auth_user_id !== authUserId) {
    // The .or() guard is the anti-hijack condition: the link only lands if the
    // row is still unclaimed (or already claimed by this same auth user).
    const linked = await admin
      .schema("core")
      .from("customers")
      .update({
        auth_user_id: authUserId,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
      .or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`)
      .select("id, auth_user_id, phone_e164")
      .maybeSingle();

    if (
      linked.error ||
      !linked.data ||
      linked.data.auth_user_id !== authUserId
    ) {
      console.error(
        "customer-auth-msg91: refused or failed customer/auth-user link",
      );
      return jsonResponse(
        { error: "Unable to link customer authentication safely." },
        409,
        origin,
      );
    }
    customer = linked.data;
  }

  // Redeeming the magic link server-side is what actually mints the session.
  // The browser never sees the link; it receives the resulting tokens and
  // adopts them via setSession().
  const verifiedSession = await publicClient.auth.verifyOtp({
    token_hash: tokenHashForSupabase,
    type: "email",
  });

  if (
    verifiedSession.error ||
    !verifiedSession.data.session ||
    !verifiedSession.data.user
  ) {
    console.error(
      "customer-auth-msg91: Supabase session exchange failed",
      verifiedSession.error?.code ?? "unknown",
    );
    return jsonResponse(
      { error: "Unable to establish customer session." },
      500,
      origin,
    );
  }

  const session = verifiedSession.data.session;
  console.log(`customer-auth-msg91: authenticated customer ${customer.id}`);

  return jsonResponse(
    {
      session,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: verifiedSession.data.user,
      customer: {
        id: customer.id,
        phone_e164: customer.phone_e164,
        auth_user_id: customer.auth_user_id,
      },
    },
    200,
    origin,
  );
});
