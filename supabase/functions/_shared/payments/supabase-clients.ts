import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getNamedKey } from "./http.ts";

export interface ServerConfig {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
  anonKey: string | undefined;
}

export function getServerConfig(): ServerConfig {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? getNamedKey(Deno.env.get("SUPABASE_SECRET_KEYS")),
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? getNamedKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")),
  };
}

/** Service-role client for the payment write RPCs, which are intentionally service-role-only. */
export function createAdminClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Anon-key client that forwards the caller's own Authorization header, so
 * `auth.uid()` inside RPCs resolves to the real signed-in customer. This is
 * how order-ownership checks (private.can_view_order, via ordering.get_order)
 * get enforced -- never by trusting an id the browser sends.
 */
export function createUserClient(supabaseUrl: string, anonKey: string, authorizationHeader: string): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorizationHeader } },
  });
}
