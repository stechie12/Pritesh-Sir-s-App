import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  isChunkLoadError,
  shouldAttemptChunkReload,
  type StorageLike,
} from './chunkRecovery.ts';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('isChunkLoadError detects Chromium, Safari, Firefox, and Webpack/Vite chunk errors', () => {
  assert.equal(
    isChunkLoadError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://example.com/assets/InteractiveFormulaReference-Bom988j4.js'
      )
    ),
    true
  );
  assert.equal(isChunkLoadError(new Error('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError(new Error('error loading dynamically imported module')), true);
  assert.equal(isChunkLoadError(new Error('Loading chunk 42 failed')), true);
  assert.equal(isChunkLoadError(new Error('Unable to preload CSS for /assets/app.css')), true);

  // Non-chunk runtime errors must not trigger reload
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false);
  assert.equal(isChunkLoadError(null), false);
});

test('shouldAttemptChunkReload allows first attempt, blocks rapid retries, and re-enables after cooldown', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  assert.equal(shouldAttemptChunkReload(t0, storage), true);
  assert.equal(shouldAttemptChunkReload(t0 + 2_000, storage), false);
  assert.equal(shouldAttemptChunkReload(t0 + CHUNK_RELOAD_COOLDOWN_MS - 1, storage), false);
  assert.equal(shouldAttemptChunkReload(t0 + CHUNK_RELOAD_COOLDOWN_MS + 1, storage), true);
});
