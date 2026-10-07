const CACHE_PREFIX = "stellantis-sales-cockpit:";

export function readClientCache(key, maxAgeMs = Infinity) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || !Number.isFinite(parsed.cachedAt)) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    if (Date.now() - parsed.cachedAt > maxAgeMs) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return {
      data: parsed.data,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
}

export function writeClientCache(key, data) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      })
    );
  } catch {
    // Cache failures must never block the cockpit.
  }
}

export function clearClientCache(key) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // Ignore cache cleanup failures.
  }
}
