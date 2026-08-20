// Persisted browser data is untrusted: it may be absent, corrupted, or from
// an older shape. Every read is guarded so a bad value degrades to "not
// present" instead of throwing during render.
export function readJson<T>(
  key: string,
  isValid: (value: unknown) => value is T,
): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or unavailable (private browsing); the cart still
    // works for this tab, it just won't survive a reload.
  }
}

export function removeJson(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore: nothing to clean up if storage is unavailable.
  }
}
