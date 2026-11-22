/**
 * Pure detection & safe recovery helpers for stale Vite dynamic-import chunks.
 *
 * When a browser tab or stale Service Worker holds an older `index.html` after
 * a fresh build, requesting a retired `/assets/<Chunk>-<oldHash>.js` URL throws
 * a module fetch error. These utilities identify those errors reliably across
 * Chromium, Safari, and Firefox and perform a rate-limited cache-clearing reload.
 */

export const CHUNK_RELOAD_STORAGE_KEY = 'selina_chunk_reload_at';
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading chunk [\w-]+ failed/i,
  /loading css chunk [\w-]+ failed/i,
  /unable to preload css/i,
  /chunkloaderror/i,
];

export function extractErrorMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : '';
  }
  return String(err);
}

export function isChunkLoadError(err: unknown): boolean {
  const message = extractErrorMessage(err);
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Allows an automatic reload at most once every CHUNK_RELOAD_COOLDOWN_MS so a
 * genuinely broken network never enters an infinite reload loop, while a fresh
 * deployment later in the same session still recovers cleanly.
 */
export function shouldAttemptChunkReload(
  nowMs: number = Date.now(),
  storage?: StorageLike | null
): boolean {
  try {
    const target =
      storage !== undefined
        ? storage
        : typeof window !== 'undefined'
          ? window.sessionStorage
          : null;
    if (!target) return false;

    const raw = target.getItem(CHUNK_RELOAD_STORAGE_KEY);
    if (raw) {
      const lastAttempt = Number(raw);
      if (Number.isFinite(lastAttempt) && nowMs - lastAttempt < CHUNK_RELOAD_COOLDOWN_MS) {
        return false;
      }
    }
    target.setItem(CHUNK_RELOAD_STORAGE_KEY, String(nowMs));
    return true;
  } catch {
    return false;
  }
}

/**
 * Unregisters active Service Workers and purges browser Cache Storage before
 * reloading so stale precached HTML/JS assets cannot persist across refreshes.
 */
export async function clearServiceWorkerAndCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  const tasks: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
    );
  }

  if ('caches' in window && typeof window.caches?.keys === 'function') {
    tasks.push(
      window.caches
        .keys()
        .then((names) => Promise.all(names.map((name) => window.caches.delete(name))))
        .catch(() => {})
    );
  }

  await Promise.race([
    Promise.all(tasks),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

/**
 * Triggers a single cooldown-guarded cache-busting reload when a stale dynamic
 * import chunk fails to load. Returns true if a reload was initiated.
 */
export function triggerChunkRecoveryReload(): boolean {
  if (typeof window === 'undefined') return false;
  if (!shouldAttemptChunkReload()) return false;

  void clearServiceWorkerAndCaches().finally(() => {
    window.location.reload();
  });
  return true;
}
