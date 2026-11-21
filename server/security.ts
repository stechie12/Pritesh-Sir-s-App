import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type {
  CurriculumBoard,
  GradeLevel,
  HistoryTurn,
  PlannerFeedbackMode,
  ResumeContext,
  StudyPace,
  ValidatedDoubtRequest,
  ValidatedLessonPlanRequest,
  ValidatedStudyPlannerRequest,
  ValidatedTtsRequest,
} from './types.ts';

const VALID_GRADES = new Set<GradeLevel>(['8', '9', '10', '11', '12']);
const VALID_BOARDS = new Set<CurriculumBoard>(['ICSE', 'CBSE']);
const VALID_PACES = new Set<StudyPace>(['Foundation-First', 'Balanced', 'Intensive']);
const VALID_FEEDBACK_MODES = new Set<PlannerFeedbackMode>([
  'normal',
  'need_more_time',
  'ready_for_harder',
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * Redacts PII (emails, phone numbers) and sensitive credentials (Bearer tokens, API keys)
 * before emitting any server log line.
 */
export function redactPii(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/\bAQ\.[0-9A-Za-z\-_.]{15,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
}

/**
 * Verifies base64 image magic bytes (PNG, JPEG, WebP, GIF) and enforces a 2.5MB decoded size cap.
 */
export function isValidImageBase64(base64Str: string): boolean {
  if (!base64Str || typeof base64Str !== 'string') {
    return false;
  }
  const cleaned = base64Str.replace(/\s+/g, '');
  if (cleaned.length < 16 || cleaned.length > 3_400_000) {
    return false;
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(cleaned.slice(0, 64))) {
    return false;
  }
  try {
    const headerBuf = Buffer.from(cleaned.slice(0, 32), 'base64');
    if (headerBuf.length < 4) return false;

    // PNG: 89 50 4E 47
    if (
      headerBuf[0] === 0x89 &&
      headerBuf[1] === 0x50 &&
      headerBuf[2] === 0x4e &&
      headerBuf[3] === 0x47
    ) {
      return true;
    }
    // JPEG: FF D8 FF
    if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
      return true;
    }
    // GIF: 47 49 46 38
    if (
      headerBuf[0] === 0x47 &&
      headerBuf[1] === 0x49 &&
      headerBuf[2] === 0x46 &&
      headerBuf[3] === 0x38
    ) {
      return true;
    }
    // WebP: RIFF....WEBP
    if (
      headerBuf.length >= 12 &&
      headerBuf[0] === 0x52 &&
      headerBuf[1] === 0x49 &&
      headerBuf[2] === 0x46 &&
      headerBuf[3] === 0x46 &&
      headerBuf[8] === 0x57 &&
      headerBuf[9] === 0x45 &&
      headerBuf[10] === 0x42 &&
      headerBuf[11] === 0x50
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function normalizeGrade(value: unknown, fallback: GradeLevel = '9'): GradeLevel {
  const s = String(value ?? '').trim() as GradeLevel;
  return VALID_GRADES.has(s) ? s : fallback;
}

export function normalizeBoard(value: unknown, fallback: CurriculumBoard = 'ICSE'): CurriculumBoard {
  const s = String(value ?? '').trim().toUpperCase() as CurriculumBoard;
  return VALID_BOARDS.has(s) ? s : fallback;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips prototype-pollution keys from untrusted JSON payloads.
 */
export function stripDangerousKeys<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripDangerousKeys(item, depth + 1)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    clean[k] = stripDangerousKeys(v, depth + 1);
  }
  return clean as T;
}

/**
 * Ensures any external link returned to clients uses safe http(s) protocols only.
 */
export function sanitizeHttpUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function validateMathVerifyRequest(
  body: unknown
): ValidationResult<{ expression: string; expected?: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }
  const raw = body as Record<string, unknown>;
  if (
    typeof raw.expression !== 'string' ||
    !raw.expression.trim() ||
    raw.expression.length > 200
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Please provide a valid math expression (1 to 200 characters).',
    };
  }
  const expected =
    typeof raw.expected === 'string' && raw.expected.trim()
      ? raw.expected.trim().slice(0, 200)
      : undefined;

  return {
    ok: true,
    data: {
      expression: raw.expression.trim(),
      expected,
    },
  };
}

export function validateDoubtRequest(body: unknown): ValidationResult<ValidatedDoubtRequest> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }

  const raw = stripDangerousKeys(body as Record<string, unknown>);
  const rawQuestion = raw.question;

  if (typeof rawQuestion !== 'string' || !rawQuestion.trim() || rawQuestion.length > 2000) {
    return {
      ok: false,
      status: 400,
      error: 'Please provide a valid message (1 to 2000 characters).',
    };
  }

  const question = rawQuestion.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!question) {
    return {
      ok: false,
      status: 400,
      error: 'Please provide a valid message (1 to 2000 characters).',
    };
  }
  const grade = normalizeGrade(raw.grade, '9');
  const board = normalizeBoard(raw.board, 'ICSE');
  const topic =
    typeof raw.topic === 'string' && raw.topic.trim()
      ? raw.topic.trim().slice(0, 120)
      : 'General';
  const model =
    typeof raw.model === 'string' && raw.model.trim()
      ? raw.model.trim().slice(0, 64)
      : 'gemini-4-hydrogen';
  const enableWebSearch = raw.enableWebSearch !== false;

  const rawHistory: HistoryTurn[] = Array.isArray(raw.history)
    ? raw.history
        .filter(
          (turn): turn is { role: 'user' | 'model'; text: string } =>
            Boolean(turn) &&
            typeof turn === 'object' &&
            ((turn as Record<string, unknown>).role === 'user' ||
              (turn as Record<string, unknown>).role === 'model') &&
            typeof (turn as Record<string, unknown>).text === 'string' &&
            Boolean(((turn as Record<string, unknown>).text as string).trim())
        )
        .slice(-8)
        .map((turn) => ({
          role: turn.role,
          text: turn.text.trim().slice(0, 450),
        }))
    : [];

  // Enforce a total character budget (<= 3200 chars) across history turns for fast latency
  const history: HistoryTurn[] = [];
  let charBudget = 3200;
  for (let i = rawHistory.length - 1; i >= 0; i--) {
    const turn = rawHistory[i];
    if (turn.text.length <= charBudget) {
      history.unshift(turn);
      charBudget -= turn.text.length;
    } else if (charBudget > 60) {
      history.unshift({ role: turn.role, text: turn.text.slice(0, charBudget) });
      charBudget = 0;
      break;
    } else {
      break;
    }
  }

  let imageBase64: string | undefined;
  if (typeof raw.imageBase64 === 'string' && raw.imageBase64.trim()) {
    if (!isValidImageBase64(raw.imageBase64)) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid or oversized image attachment. Supported formats: PNG, JPEG, WebP, GIF (max 2.5MB).',
      };
    }
    imageBase64 = raw.imageBase64.replace(/\s+/g, '');
  }

  const rawMime = typeof raw.imageMimeType === 'string' ? raw.imageMimeType.toLowerCase().trim() : '';
  const imageMimeType = ALLOWED_IMAGE_MIME_TYPES.has(rawMime)
    ? rawMime === 'image/jpg'
      ? 'image/jpeg'
      : rawMime
    : 'image/jpeg';

  let resumeContext: ResumeContext | null = null;
  if (raw.resumeContext && typeof raw.resumeContext === 'object' && !Array.isArray(raw.resumeContext)) {
    const rc = raw.resumeContext as Record<string, unknown>;
    if (typeof rc.originalQuestion === 'string' && rc.originalQuestion.trim()) {
      resumeContext = {
        originalQuestion: rc.originalQuestion.trim().slice(0, 1000),
        partialContent:
          typeof rc.partialContent === 'string' ? rc.partialContent.trim().slice(0, 4000) : '',
      };
    }
  }

  return {
    ok: true,
    data: {
      question,
      grade,
      board,
      topic,
      model,
      history,
      enableWebSearch,
      imageBase64,
      imageMimeType,
      resumeContext,
    },
  };
}

export function validateTtsRequest(body: unknown): ValidationResult<ValidatedTtsRequest> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }
  const rawText = (body as Record<string, unknown>).text;
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { ok: false, status: 400, error: 'Text is required for voice synthesis.' };
  }
  if (rawText.length > 4000) {
    return { ok: false, status: 400, error: 'Text exceeds maximum length of 4000 characters.' };
  }
  return { ok: true, data: { text: rawText.trim().slice(0, 900) } };
}

export function validateLessonPlanRequest(
  body: unknown
): ValidationResult<ValidatedLessonPlanRequest> {
  if (body !== undefined && (typeof body !== 'object' || Array.isArray(body) || body === null)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }
  const raw = (body || {}) as Record<string, unknown>;
  const grade = normalizeGrade(raw.grade, '9');
  const board = normalizeBoard(raw.board, 'ICSE');

  const weakTopics = Array.isArray(raw.weakTopics)
    ? raw.weakTopics
        .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
        .map((t) => t.trim().slice(0, 100))
        .slice(0, 6)
    : ['Trigonometry', 'Quadratic Equations'];

  const ratingNum = Number(raw.adaptiveRating);
  const adaptiveRating = Number.isFinite(ratingNum)
    ? Math.max(400, Math.min(3000, Math.round(ratingNum)))
    : 1350;

  return {
    ok: true,
    data: {
      grade,
      board,
      weakTopics: weakTopics.length > 0 ? weakTopics : ['Trigonometry', 'Quadratic Equations'],
      adaptiveRating,
    },
  };
}

export function validateStudyPlannerRequest(
  body: unknown
): ValidationResult<ValidatedStudyPlannerRequest> {
  if (body !== undefined && (typeof body !== 'object' || Array.isArray(body) || body === null)) {
    return { ok: false, status: 400, error: 'Request body must be a JSON object.' };
  }
  const raw = (body || {}) as Record<string, unknown>;
  const grade = normalizeGrade(raw.grade, '9');
  const board = normalizeBoard(raw.board, 'ICSE');

  const rawPace = String(raw.pace ?? 'Balanced').trim() as StudyPace;
  const pace: StudyPace = VALID_PACES.has(rawPace) ? rawPace : 'Balanced';

  const rawFeedback = String(raw.feedbackMode ?? 'normal').trim() as PlannerFeedbackMode;
  const feedbackMode: PlannerFeedbackMode = VALID_FEEDBACK_MODES.has(rawFeedback)
    ? rawFeedback
    : 'normal';

  const weakTopics = Array.isArray(raw.weakTopics)
    ? raw.weakTopics
        .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
        .map((t) => t.trim().slice(0, 100))
        .slice(0, 6)
    : [];

  const daysNum = Number(raw.daysUntilMock);
  const daysUntilMock = Number.isFinite(daysNum)
    ? Math.max(1, Math.min(365, Math.round(daysNum)))
    : 5;

  return {
    ok: true,
    data: {
      grade,
      board,
      pace,
      weakTopics,
      feedbackMode,
      daysUntilMock,
    },
  };
}

/**
 * Bounded LRU Cache with TTL expiry and hit/miss telemetry.
 */
export class LruCache<T> {
  private readonly store = new Map<string, { ts: number; value: T }>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 250, ttlMs = 30 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string, now = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (now - entry.ts > this.ttlMs) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    // Refresh recency order
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { ts: now, value });
  }

  clear(): void {
    this.store.clear();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(3)) : 0,
    };
  }
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

/**
 * Memory-bounded fixed-window rate limiter that actively prunes expired IP buckets.
 */
export function createRateLimiter(options: {
  maxRequests?: number;
  windowMs?: number;
  maxBuckets?: number;
} = {}) {
  const maxRequests = options.maxRequests ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const maxBuckets = options.maxBuckets ?? 5000;

  const buckets = new Map<string, { count: number; resetAt: number }>();

  function pruneExpired(now: number): void {
    for (const [key, bucket] of buckets) {
      if (now >= bucket.resetAt) {
        buckets.delete(key);
      }
    }
    // Hard cap safeguard against IP-flood OOM
    while (buckets.size >= maxBuckets) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  }

  function check(identifier: string, now = Date.now()): RateLimitCheckResult {
    if (buckets.size > Math.floor(maxBuckets * 0.8)) {
      pruneExpired(now);
    }

    const existing = buckets.get(identifier);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      buckets.set(identifier, { count: 1, resetAt });
      return {
        allowed: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - 1),
        resetAt,
        retryAfterSec: 0,
      };
    }

    existing.count += 1;
    const remaining = Math.max(0, maxRequests - existing.count);
    const allowed = existing.count <= maxRequests;
    const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    return {
      allowed,
      limit: maxRequests,
      remaining,
      resetAt: existing.resetAt,
      retryAfterSec,
    };
  }

  return {
    check,
    pruneExpired,
    size: () => buckets.size,
  };
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'local';
}

export function createEndpointMetricsTracker() {
  const stats = new Map<string, { count: number; errors: number; totalMs: number }>();

  function record(routeKey: string, status: number, durationMs: number): void {
    const existing = stats.get(routeKey) || { count: 0, errors: 0, totalMs: 0 };
    existing.count += 1;
    if (status >= 400) existing.errors += 1;
    existing.totalMs += durationMs;
    stats.set(routeKey, existing);
  }

  function snapshot() {
    const out: Record<string, { count: number; errors: number; avgMs: number }> = {};
    for (const [k, v] of stats) {
      out[k] = {
        count: v.count,
        errors: v.errors,
        avgMs: v.count > 0 ? Number((v.totalMs / v.count).toFixed(1)) : 0,
      };
    }
    return out;
  }

  return { record, snapshot };
}

export const apiEndpointMetrics = createEndpointMetricsTracker();

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');

  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
  }
  next();
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].slice(0, 64)) ||
    crypto.randomUUID();
  const startedAt = Date.now();

  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;

  const originalEnd = res.end.bind(res);
  // Emit X-Response-Time-Ms right before headers flush
  res.end = ((...args: Parameters<typeof originalEnd>) => {
    if (!res.headersSent) {
      res.setHeader('X-Response-Time-Ms', String(Date.now() - startedAt));
    }
    return originalEnd(...args);
  }) as typeof res.end;

  if (req.path.startsWith('/api/')) {
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      apiEndpointMetrics.record(`${req.method} ${req.path}`, res.statusCode, durationMs);
      const logEntry = {
        ts: new Date().toISOString(),
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
      };
      if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify(logEntry));
      }
    });
  }

  next();
}
