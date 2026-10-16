const CACHE_PREFIX = "stellantis-sales-cockpit:";
const DB_NAME = "stellantis-sales-cockpit-cache";
const DB_VERSION = 1;
const STORE_NAME = "datasets";

function openCacheDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

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
    return { data: parsed.data, cachedAt: parsed.cachedAt };
  } catch {
    return null;
  }
}

export async function readClientCacheAsync(key, maxAgeMs = Infinity) {
  const local = readClientCache(key, maxAgeMs);
  const db = await openCacheDb();
  if (!db) return local;
  const indexed = await new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const value = request.result;
        if (!value || !Array.isArray(value.data) || !Number.isFinite(value.cachedAt) || Date.now() - value.cachedAt > maxAgeMs) {
          return resolve(null);
        }
        resolve({ data: value.data, cachedAt: value.cachedAt });
      };
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
  if (!local) return indexed;
  if (!indexed) return local;
  return indexed.cachedAt > local.cachedAt ? indexed : local;
}

export function writeClientCache(key, data) {
  if (typeof window === "undefined") return Promise.resolve(false);
  const record = { key, cachedAt: Date.now(), data };
  let localStored = false;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ cachedAt: record.cachedAt, data }));
    localStored = true;
  } catch {
    // IndexedDB is the primary large-dataset fallback when localStorage quota is reached.
  }
  return openCacheDb().then((db) => {
    if (!db) return localStored;
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(record);
        transaction.oncomplete = () => { db.close(); resolve(true); };
        transaction.onerror = () => { db.close(); resolve(localStored); };
        transaction.onabort = () => { db.close(); resolve(localStored); };
      } catch {
        db.close();
        resolve(localStored);
      }
    });
  });
}

export function clearClientCache(key) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_PREFIX + key);
  } catch {}
  openCacheDb().then((db) => {
    if (!db) return;
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      if (key) transaction.objectStore(STORE_NAME).delete(key);
      else transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    } catch {
      db.close();
    }
  });
}
