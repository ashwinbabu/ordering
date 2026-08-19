// Shared CORS + JSON response helpers for the storefront-facing payment
// functions, following the same convention as customer-auth-msg91.
export function buildAllowedOrigins(): Set<string> {
  const configured = (Deno.env.get("STOREFRONT_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  // Dev fallback so a local `vite` server keeps working without extra setup.
  const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  return new Set([...configured, ...devOrigins]);
}

export function corsHeaders(origin: string | null, allowedOrigins: Set<string>): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export function jsonResponse(body: unknown, status: number, origin: string | null, allowedOrigins: Set<string>): Response {
  const headers = corsHeaders(origin, allowedOrigins);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Supabase's newer API-key scheme exposes keys as a JSON map under
 * SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS rather than the legacy
 * single-value env vars. Both are read so this keeps working either way
 * (mirrors customer-auth-msg91's getNamedKey).
 */
export function getNamedKey(raw: string | undefined, name = "default"): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[name];
  } catch {
    return undefined;
  }
}

/** Maps a Postgres error code raised by our RPCs onto an HTTP status. */
export function statusForPgErrorCode(code: string | undefined): number {
  switch (code) {
    case "42501":
      return 403; // access denied / service role required
    case "P0002":
      return 404; // not found
    case "22023":
      return 400; // invalid input
    case "55000":
    case "23505":
      return 409; // wrong object state / idempotency conflict
    default:
      return 500;
  }
}
