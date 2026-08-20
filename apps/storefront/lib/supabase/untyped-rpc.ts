import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Calls an RPC that isn't (yet) present in the generated Database types
 * (see AGENTS.md: generated types are never handwritten, so a freshly added
 * function stays untyped here until the next `supabase gen types` run). The
 * cast is isolated to this one call site instead of leaking `never`/`any`
 * through call sites that consume the result.
 */
export async function callUntypedRpc(
  client: ReturnType<SupabaseClient["schema"]>,
  name: string,
  args: Record<string, unknown>,
): Promise<{
  data: unknown;
  error: { message: string; code?: string } | null;
}> {
  const result = await (
    client as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string; code?: string } | null;
      }>;
    }
  ).rpc(name, args);
  return result;
}
