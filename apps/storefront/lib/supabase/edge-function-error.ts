/**
 * supabase-js reports a non-2xx Edge Function response as a FunctionsError
 * whose `context` is the raw Response, not the parsed body -- the error
 * message itself is a generic "Edge Function returned a non-2xx status
 * code" and tells the caller nothing. This reads the JSON body our own
 * functions actually send back (`{ error: "..." }`, optionally with other
 * fields) so callers can surface the real reason.
 */
export async function functionErrorBody<T extends Record<string, unknown> = Record<string, unknown>>(
  error: unknown,
): Promise<T | null> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return null;
  try {
    return (await context.clone().json()) as T;
  } catch {
    return null;
  }
}
