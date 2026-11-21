/**
 * Quota-safe, schema-versioned localStorage wrapper with in-memory fallback
 * for partitioned iframes, Safari Private Mode, and Node test environments.
 */

const memoryFallback = new Map<string, string>();

interface VersionedEnvelope<T> {
  v: number;
  updatedAt: number;
  data: T;
}

function getStorageAdapter(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readVersionedStorage<T>(
  key: string,
  expectedVersion: number,
  fallback: T
): T {
  const storage = getStorageAdapter();
  let raw: string | null = null;
  try {
    raw = storage ? storage.getItem(key) : memoryFallback.get(key) ?? null;
  } catch {
    raw = memoryFallback.get(key) ?? null;
  }

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<VersionedEnvelope<T>>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.v === expectedVersion &&
      'data' in parsed
    ) {
      return parsed.data as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeVersionedStorage<T>(
  key: string,
  version: number,
  data: T
): boolean {
  const payload = JSON.stringify({
    v: version,
    updatedAt: Date.now(),
    data,
  } satisfies VersionedEnvelope<T>);

  memoryFallback.set(key, payload);
  const storage = getStorageAdapter();
  if (!storage) return false;

  try {
    storage.setItem(key, payload);
    return true;
  } catch {
    // QuotaExceededError or restricted iframe storage — keep in-memory copy safely
    return false;
  }
}

export function removeVersionedStorage(key: string): void {
  memoryFallback.delete(key);
  const storage = getStorageAdapter();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore restricted storage errors
  }
}

export function clearAppStorageCache(prefixes = ['selina_', 'psma_']): number {
  let removed = 0;
  for (const key of Array.from(memoryFallback.keys())) {
    if (prefixes.some((p) => key.startsWith(p))) {
      memoryFallback.delete(key);
      removed += 1;
    }
  }
  const storage = getStorageAdapter();
  if (!storage) return removed;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      storage.removeItem(k);
      removed += 1;
    }
  } catch {
    // Ignore storage errors
  }
  return removed;
}
