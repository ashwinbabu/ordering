import { readJson, writeJson } from "./safe-json-storage";

// A stable, unguessable per-device identifier. The trusted cart RPCs treat a
// matching anonymous_session_id as proof of ownership of an anonymous cart,
// the same bearer-token pattern most guest-cart implementations use. It is
// intentionally not scoped to one business/location: the (business_id,
// location_id, anonymous_session_id) tuple on the server is what forms the
// actual cart namespace, so one device identity is enough here.
const storageKey = "a2-storefront-anonymous-session-id";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

let cached: string | undefined;

export function getAnonymousSessionId(): string {
  if (cached) return cached;

  const stored = readJson(storageKey, isUuid);
  if (stored) {
    cached = stored;
    return stored;
  }

  const created = window.crypto.randomUUID();
  writeJson(storageKey, created);
  cached = created;
  return created;
}
