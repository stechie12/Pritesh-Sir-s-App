import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { Request, Response, NextFunction } from 'express';

export type SupportedEncoding = 'br' | 'gzip';

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.webmanifest',
  '.txt',
  '.xml',
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const NO_CACHE_BASENAMES = new Set([
  'index.html',
  'sw.js',
  'registerSW.js',
  'manifest.webmanifest',
]);

/**
 * Picks the best supported compression encoding from an HTTP Accept-Encoding header.
 * Prefers Brotli (`br`) over Gzip (`gzip`), while honoring explicit `q=0` rejections.
 */
export function selectCompressionEncoding(
  acceptEncodingHeader: string | string[] | undefined
): SupportedEncoding | null {
  if (!acceptEncodingHeader) return null;
  const raw = Array.isArray(acceptEncodingHeader)
    ? acceptEncodingHeader.join(',')
    : acceptEncodingHeader;
  const tokens = raw
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  let brQ = 0;
  let gzipQ = 0;

  for (const token of tokens) {
    const [encoding, ...params] = token.split(';').map((s) => s.trim());
    let q = 1;
    for (const param of params) {
      if (param.startsWith('q=')) {
        const parsed = Number.parseFloat(param.slice(2));
        if (Number.isFinite(parsed)) {
          q = Math.max(0, Math.min(1, parsed));
        }
      }
    }
    if (encoding === 'br') brQ = q;
    if (encoding === 'gzip') gzipQ = q;
  }

  if (brQ > 0 && brQ >= gzipQ) return 'br';
  if (gzipQ > 0) return 'gzip';
  return null;
}

export function isCompressiblePath(filePath: string): boolean {
  return COMPRESSIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function compressBuffer(data: Buffer, encoding: SupportedEncoding): Buffer {
  if (encoding === 'br') {
    return zlib.brotliCompressSync(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
      },
    });
  }
  return zlib.gzipSync(data, { level: 6 });
}

interface CachedCompressedAsset {
  buffer: Buffer;
  mtimeMs: number;
  size: number;
}

/**
 * Serves Brotli/Gzip compressed static assets from `distPath` with a bounded in-memory LRU cache.
 * Falls through to `express.static` for binary files, HEAD/range requests, or unsupported encodings.
 */
export function createStaticCompressionMiddleware(
  distPath: string,
  options: { maxCacheEntries?: number; minBytes?: number } = {}
) {
  const resolvedDistRoot = path.resolve(distPath);
  const maxCacheEntries = options.maxCacheEntries ?? 96;
  const minBytes = options.minBytes ?? 512;
  const cache = new Map<string, CachedCompressedAsset>();

  function getCachedOrCompress(
    fullPath: string,
    encoding: SupportedEncoding,
    mtimeMs: number,
    size: number
  ): Buffer {
    const key = `${encoding}:${fullPath}`;
    const existing = cache.get(key);
    if (existing && existing.mtimeMs === mtimeMs && existing.size === size) {
      cache.delete(key);
      cache.set(key, existing);
      return existing.buffer;
    }

    const raw = fs.readFileSync(fullPath);
    const compressed = compressBuffer(raw, encoding);

    if (cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, { buffer: compressed, mtimeMs, size });
    return compressed;
  }

  return function staticCompressionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (req.method !== 'GET' || req.headers.range) {
      next();
      return;
    }

    const encoding = selectCompressionEncoding(req.headers['accept-encoding']);
    if (!encoding) {
      next();
      return;
    }

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(req.path);
    } catch {
      next();
      return;
    }

    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    if (!isCompressiblePath(relativePath)) {
      next();
      return;
    }

    const candidatePath = path.resolve(resolvedDistRoot, relativePath);
    if (
      candidatePath !== resolvedDistRoot &&
      !candidatePath.startsWith(`${resolvedDistRoot}${path.sep}`)
    ) {
      next();
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(candidatePath);
      if (!stat.isFile() || stat.size < minBytes) {
        next();
        return;
      }
    } catch {
      next();
      return;
    }

    try {
      const compressed = getCachedOrCompress(candidatePath, encoding, stat.mtimeMs, stat.size);
      const ext = path.extname(candidatePath).toLowerCase();
      const basename = path.basename(candidatePath);

      res.setHeader('Content-Type', MIME_BY_EXTENSION[ext] || 'application/octet-stream');
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', String(compressed.length));

      if (NO_CACHE_BASENAMES.has(basename)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (candidatePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

      res.status(200).end(compressed);
    } catch {
      next();
    }
  };
}

/**
 * Compresses large JSON API responses (> 1 KB) on the fly when the client accepts `br` or `gzip`.
 */
export function apiJsonCompressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const encoding = selectCompressionEncoding(req.headers['accept-encoding']);
  if (!encoding) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.headersSent) {
      return res;
    }
    try {
      const jsonStr = JSON.stringify(body);
      if (!jsonStr || jsonStr.length < 1024) {
        return originalJson(body);
      }
      const compressed = compressBuffer(Buffer.from(jsonStr, 'utf8'), encoding);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', String(compressed.length));
      res.end(compressed);
      return res;
    } catch {
      return originalJson(body);
    }
  }) as typeof res.json;

  next();
}
