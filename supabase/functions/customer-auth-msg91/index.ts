import { createClient } from "npm:@supabase/supabase-js@2";

const configuredOrigins = (Deno.env.get("STOREFRONT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://ordering-storefront-dev.vercel.app",
]);

function corsHeaders(origin: string | null) {
  const h = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}

function json(body: unknown, status: number, origin: string | null) {
  const h = corsHeaders(origin);
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: h });
}

function getNamedKey(raw: string | undefined, name = "default") {
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as Record<string, string>)[name];
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

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const decoded = atob(b64);
    const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

const phoneKeys = new Set([
  "identifier",
  "mobile",
  "mobileno",
  "mobilenumber",
  "phone",
  "phonenumber",
  "useridentifier",
  "telnum",
  "msisdn",
]);
const requestIdKeys = new Set(["requestid", "reqid"]);

function collectPhoneCandidates(value: unknown, depth = 0, out = new Set<string>()): Set<string> {
  if (depth > 7 || value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectPhoneCandidates(item, depth + 1, out);
    return out;
  }
  if (typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (phoneKeys.has(normalizeKey(key)) && typeof child === "string") {
      const phone = normalizePhone(child);
      if (phone) out.add(phone);
    }
    if (child && typeof child === "object") collectPhoneCandidates(child, depth + 1, out);
  }
  return out;
}

function findRequestId(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRequestId(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (requestIdKeys.has(normalizeKey(key)) && typeof child === "string" && child.length > 4) return child;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child && typeof child === "object") {
      const found = findRequestId(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function collectPhonesForRequest(value: unknown, requestId: string, depth = 0, out = new Set<string>()): Set<string> {
  if (depth > 9 || value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectPhonesForRequest(item, requestId, depth + 1, out);
    return out;
  }
  if (typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  const matches = Object.entries(record).some(([key, child]) =>
    requestIdKeys.has(normalizeKey(key)) && typeof child === "string" && child === requestId
  );
  if (matches) collectPhoneCandidates(record, 0, out);
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") collectPhonesForRequest(child, requestId, depth + 1, out);
  }
  return out;
}

async function fetchPhoneFromWidgetLogs(authKey: string, requestId: string): Promise<string | null> {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = new URL("https://control.msg91.com/api/v5/report/logs/p/widget");
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  for (const delay of [0, 350, 800]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", Authkey: authKey },
    });
    if (!response.ok) {
      console.warn(`customer-auth-msg91: widget-log lookup failed (${response.status})`);
      return null;
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      return null;
    }
    const candidates = collectPhonesForRequest(body, requestId);
    if (candidates.size === 1) return [...candidates][0];
    if (candidates.size > 1) {
      console.warn("customer-auth-msg91: widget-log identity was ambiguous");
      return null;
    }
  }
  return null;
}

async function verifyMsg91AccessToken(authKey: string, accessToken: string) {
  const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // handled below
  }
  if (!response.ok || !body || typeof body !== "object") {
    return { ok: false as const, status: response.status || 502 };
  }

  const record = body as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
  if (type === "error" || type === "failed" || type === "failure" || status === "failed" || record.success === false) {
    return { ok: false as const, status: 401 };
  }

  const jwtPayload = decodeJwtPayload(accessToken);
  const directCandidates = collectPhoneCandidates(body);
  collectPhoneCandidates(jwtPayload, 0, directCandidates);
  if (directCandidates.size === 1) {
    return { ok: true as const, phoneE164: [...directCandidates][0] };
  }
  if (directCandidates.size > 1) {
    return { ok: false as const, status: 401 };
  }

  const requestId = findRequestId(jwtPayload);
  if (!requestId) {
    console.warn("customer-auth-msg91: verified MSG91 token had no requestId");
    return { ok: false as const, status: 401 };
  }

  const phoneE164 = await fetchPhoneFromWidgetLogs(authKey, requestId);
  if (!phoneE164) {
    console.warn("customer-auth-msg91: could not resolve verified phone from MSG91 requestId");
    return { ok: false as const, status: 401 };
  }
  return { ok: true as const, phoneE164 };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? getNamedKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? getNamedKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  const msg91AuthKey = Deno.env.get("MSG91_AUTHKEY");
  if (!supabaseUrl || !adminKey || !publicKey || !msg91AuthKey) {
    console.error("customer-auth-msg91: required server configuration is missing");
    return json({ error: "Authentication service is not configured." }, 500, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400, origin);
  }
  const accessToken = [payload.accessToken, payload.access_token, payload.token].find(
    (v): v is string => typeof v === "string" && v.length > 20 && v.length <= 8000,
  );
  if (!accessToken) return json({ error: "Missing MSG91 access token." }, 400, origin);

  const verified = await verifyMsg91AccessToken(msg91AuthKey, accessToken);
  if (!verified.ok) {
    return json({ error: "OTP verification could not be confirmed." }, 401, origin);
  }
  const phoneE164 = verified.phoneE164;
  const suppliedIdentifier = typeof payload.identifier === "string" ? normalizePhone(payload.identifier) : null;
  if (suppliedIdentifier && suppliedIdentifier !== phoneE164) {
    console.warn("customer-auth-msg91: client identifier did not match MSG91 verified identity");
    return json({ error: "Verified phone number mismatch." }, 401, origin);
  }

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const publicClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const tokenHash = await sha256Hex(accessToken);
  const replay = await admin.schema("core").from("customer_auth_verifications").insert({
    token_hash: tokenHash,
    identifier_e164: phoneE164,
    channel: "sms",
  });
  if (replay.error) {
    if (replay.error.code === "23505") {
      return json({ error: "This verification has already been used. Please request a new code." }, 409, origin);
    }
    console.error("customer-auth-msg91: replay guard insert failed", replay.error.code);
    return json({ error: "Unable to complete authentication safely." }, 500, origin);
  }

  const windowStart = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin.schema("core").from("customer_auth_verifications")
    .select("id", { count: "exact", head: true })
    .eq("identifier_e164", phoneE164)
    .gte("created_at", windowStart);
  if ((count ?? 0) > 8) return json({ error: "Too many attempts. Please try again shortly." }, 429, origin);

  let { data: customer, error: lookupError } = await admin.schema("core").from("customers")
    .select("id, auth_user_id, phone_e164")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (lookupError) return json({ error: "Unable to resolve customer account." }, 500, origin);

  if (!customer) {
    const inserted = await admin.schema("core").from("customers")
      .insert({ phone_e164: phoneE164, phone_verified_at: new Date().toISOString() })
      .select("id, auth_user_id, phone_e164")
      .single();
    if (inserted.error) {
      const retry = await admin.schema("core").from("customers")
        .select("id, auth_user_id, phone_e164")
        .eq("phone_e164", phoneE164)
        .maybeSingle();
      if (retry.error || !retry.data) return json({ error: "Unable to create customer account." }, 500, origin);
      customer = retry.data;
    } else {
      customer = inserted.data;
    }
  } else {
    await admin.schema("core").from("customers")
      .update({ phone_verified_at: new Date().toISOString() })
      .eq("id", customer.id);
  }

  await admin.schema("core").from("customer_auth_verifications")
    .update({ customer_id: customer.id })
    .eq("token_hash", tokenHash);

  const digits = phoneE164.slice(1);
  const syntheticEmail = `msg91_${digits}@auth.invalid`;
  let authUserId: string | null = customer.auth_user_id;
  let authEmail = syntheticEmail;

  if (authUserId) {
    const existing = await admin.auth.admin.getUserById(authUserId);
    if (existing.error || !existing.data.user) return json({ error: "Customer authentication link is invalid." }, 500, origin);
    if (existing.data.user.email) {
      authEmail = existing.data.user.email;
    } else {
      const updated = await admin.auth.admin.updateUserById(authUserId, {
        email: syntheticEmail,
        email_confirm: true,
        user_metadata: { phone_e164: phoneE164, auth_provider: "msg91_widget" },
      });
      if (updated.error) return json({ error: "Unable to prepare customer session." }, 500, origin);
    }
  } else {
    // Important: create the Supabase Auth user with the already-MSG91-verified
    // phone number. Our auth.users trigger can then adopt/link the existing
    // core.customers row instead of creating a second phone-less customer row.
    const created = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: { phone_e164: phoneE164, auth_provider: "msg91_widget" },
    });
    if (!created.error && created.data.user) authUserId = created.data.user.id;
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authEmail,
    options: { data: { phone_e164: phoneE164, auth_provider: "msg91_widget" } },
  });
  if (generated.error || !generated.data.user) {
    console.error("customer-auth-msg91: Supabase magic-link generation failed", generated.error?.code ?? "unknown");
    return json({ error: "Unable to create customer session." }, 500, origin);
  }

  authUserId = generated.data.user.id;
  const props = generated.data.properties as Record<string, unknown> | null;
  let supabaseTokenHash = props && typeof props.hashed_token === "string" ? props.hashed_token : null;
  if (!supabaseTokenHash && props && typeof props.action_link === "string") {
    try {
      supabaseTokenHash = new URL(props.action_link).searchParams.get("token");
    } catch {
      supabaseTokenHash = null;
    }
  }
  if (!supabaseTokenHash) return json({ error: "Unable to create customer session." }, 500, origin);

  if (customer.auth_user_id !== authUserId) {
    const linked = await admin.schema("core").from("customers")
      .update({ auth_user_id: authUserId, phone_verified_at: new Date().toISOString() })
      .eq("id", customer.id)
      .or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`)
      .select("id, auth_user_id, phone_e164")
      .maybeSingle();
    if (linked.error || !linked.data || linked.data.auth_user_id !== authUserId) {
      return json({ error: "Unable to link customer authentication safely." }, 409, origin);
    }
    customer = linked.data;
  }

  const sessionResult = await publicClient.auth.verifyOtp({ token_hash: supabaseTokenHash, type: "email" });
  if (sessionResult.error || !sessionResult.data.session || !sessionResult.data.user) {
    console.error("customer-auth-msg91: Supabase session exchange failed", sessionResult.error?.code ?? "unknown");
    return json({ error: "Unable to establish customer session." }, 500, origin);
  }

  const session = sessionResult.data.session;
  return json({
    session,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: sessionResult.data.user,
    customer: { id: customer.id, phone_e164: customer.phone_e164, auth_user_id: customer.auth_user_id },
  }, 200, origin);
});
