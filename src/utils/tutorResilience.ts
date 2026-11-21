export interface RetryAttemptInfo {
  attempt: number;
  maxRetries: number;
  delayMs: number;
  reason: string;
}

export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  signal?: AbortSignal;
  onRetry?: (info: RetryAttemptInfo) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Computes exponential backoff delay with optional bounded jitter.
 * attemptIndex is 0-based (0 -> baseDelayMs, 1 -> 2*baseDelayMs, 2 -> 4*baseDelayMs, ...).
 */
export function computeBackoffDelayMs(
  attemptIndex: number,
  baseDelayMs = 600,
  maxDelayMs = 8000,
  jitterRatio = 0.2,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attemptIndex));
  const raw = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt));
  if (jitterRatio <= 0) return Math.round(raw);
  const clampedJitter = Math.min(0.5, Math.max(0, jitterRatio));
  const spread = raw * clampedJitter;
  const offset = (randomFn() * 2 - 1) * spread;
  return Math.max(50, Math.round(Math.min(maxDelayMs, raw + offset)));
}

/**
 * Abort-aware sleep helper so backoff delays cancel immediately if user stops or navigates away.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export class RetryableHttpError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;
  constructor(status: number, message?: string, options?: { code?: string; retryable?: boolean }) {
    super(message || `HTTP ${status}`);
    this.name = 'RetryableHttpError';
    this.status = status;
    this.code = options?.code;
    this.retryable = options?.retryable;
  }
}

export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof Error && error.name === 'AbortError') return false;
  if (error instanceof RetryableHttpError) {
    if (error.retryable === false) return false;
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof TypeError) {
    // Standard fetch network failure (offline, connection reset, CORS/proxy hiccup)
    return true;
  }
  if (error instanceof Error) {
    return /timeout|network|failed to fetch|temporarily|econnreset|502|503|504|429/i.test(
      error.message
    );
  }
  return false;
}

/**
 * Executes an async operation with exponential backoff retries on transient errors.
 * Throws immediately on AbortError or non-retryable 4xx client errors.
 */
export async function executeWithExponentialBackoff<T>(
  operation: (attemptNumber: number) => Promise<T>,
  options: BackoffOptions = {}
): Promise<{ result: T; attempts: number }> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 600;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const jitterRatio = options.jitterRatio ?? 0.2;
  const sleepFn = options.sleep ?? abortableSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const result = await operation(attempt + 1);
      return { result, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');

      if (isAbort || options.signal?.aborted) {
        throw err;
      }

      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }

      const delayMs = computeBackoffDelayMs(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      const reason =
        err instanceof Error && err.message ? err.message : 'Temporary connection interruption';

      options.onRetry?.({
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        reason,
      });

      await sleepFn(delayMs, options.signal);
    }
  }

  throw lastError;
}

/**
 * Heuristic check to detect whether an AI explanation appears truncated/halted mid-thought.
 */
export function isResponsePotentiallyHalted(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;

  // Unclosed fenced code block
  const fenceMatches = trimmed.match(/```/g);
  if (fenceMatches && fenceMatches.length % 2 === 1) return true;

  // Unclosed display math block $$ ... $$
  const blockMathMatches = trimmed.match(/\$\$/g);
  if (blockMathMatches && blockMathMatches.length % 2 === 1) return true;

  // Ends with a Markdown table header separator line without data rows
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || '';
  if (/^\|[\s:|-]+\|$/.test(lastLine)) {
    return true;
  }

  if (trimmed.length < 24) return false;

  // Ends with dangling punctuation or trailing mathematical operator / ellipsis
  if (/(?:[,;:\-+=*/(\[{]|\\frac|\\sqrt|\.\.\.)$/.test(trimmed)) {
    return true;
  }

  // Long explanation ending without terminal punctuation (., !, ?, `, $, ), ], |, *, ")
  if (trimmed.length > 140 && !/[.!?`$)|*"'\]]$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Safely parses a tutor API response body, converting unexpected HTML error pages
 * (e.g. "<!doctype html>" during a server restart or proxy hiccup) into a clean
 * retryable error instead of throwing raw SyntaxError ("Unexpected token '<'").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTutorApiResponse<T = any>(
  status: number,
  ok: boolean,
  rawBody: string
): T {
  const trimmed = (rawBody || '').trim();
  const looksLikeHtml =
    trimmed.startsWith('<!') || /^<html[\s>]/i.test(trimmed) || /^<head[\s>]/i.test(trimmed);

  let parsed: Record<string, unknown> | null = null;
  if (trimmed && !looksLikeHtml) {
    try {
      const candidate = JSON.parse(trimmed);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }

  if (!ok) {
    let serverMessage =
      status === 429
        ? 'Tutor is momentarily busy (rate limit)'
        : looksLikeHtml
        ? `Tutor service briefly restarted (HTTP ${status}). Please retry in a moment.`
        : `Tutor server returned HTTP ${status}`;
    let serverCode: string | undefined = looksLikeHtml ? 'HTML_ERROR_PAGE' : undefined;
    let serverRetryable: boolean | undefined = looksLikeHtml ? true : undefined;

    if (parsed) {
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        serverMessage = parsed.error.trim();
      }
      if (typeof parsed.code === 'string') {
        serverCode = parsed.code;
      }
      if (typeof parsed.retryable === 'boolean') {
        serverRetryable = parsed.retryable;
      }
    }

    throw new RetryableHttpError(status, serverMessage, {
      code: serverCode,
      retryable: serverRetryable,
    });
  }

  if (!parsed) {
    throw new RetryableHttpError(
      503,
      looksLikeHtml
        ? 'The app server briefly returned an HTML page while restarting. Please retry in a moment.'
        : 'Tutor server returned an incomplete response. Please retry in a moment.',
      {
        code: looksLikeHtml ? 'NON_JSON_HTML_RESPONSE' : 'INVALID_JSON_RESPONSE',
        retryable: true,
      }
    );
  }

  return parsed as T;
}

/**
 * Constructs a focused continuation prompt for resuming a halted/interrupted explanation.
 * Strictly capped under 1900 chars so it always passes backend validation.
 */
export function buildResumePrompt(originalQuestion: string, partialContent: string): string {
  const safeQuestion = originalQuestion.trim().slice(0, 1200);
  const cleanPartial = partialContent.trim();
  if (!cleanPartial) {
    return safeQuestion;
  }
  const tailExcerpt = cleanPartial.slice(-260);
  return `Continue and finish your explanation for: "${safeQuestion}". Your previous response stopped here:\n"""\n${tailExcerpt}\n"""\nResume seamlessly from that exact point without repeating earlier paragraphs, and complete all remaining steps, formulas, or table rows.`;
}

/**
 * Stitches a resumed continuation onto an existing partial explanation cleanly,
 * avoiding duplicated overlapping tail/head fragments or restarted full responses.
 */
export function mergeResumedExplanation(partialContent: string, continuation: string): string {
  const base = partialContent.trimEnd();
  const next = continuation.trimStart();

  if (!base) return next;
  if (!next) return base;

  // If the resumed response is a complete regenerated explanation starting with the same heading/prefix
  // as the halted partial (and is longer), replace the halted partial cleanly to avoid duplication.
  const baseFirstLine = base.split('\n')[0]?.trim() || '';
  const nextFirstLine = next.split('\n')[0]?.trim() || '';
  if (
    baseFirstLine.length >= 16 &&
    nextFirstLine === baseFirstLine &&
    next.length > base.length
  ) {
    return next;
  }
  const prefixCheckLen = Math.min(48, base.length, next.length);
  if (
    prefixCheckLen >= 24 &&
    next.slice(0, prefixCheckLen) === base.slice(0, prefixCheckLen) &&
    next.length > base.length
  ) {
    return next;
  }

  // If continuation starts with an overlapping substring from the end of base, trim the overlap
  const maxOverlap = Math.min(120, base.length, next.length);
  let overlapLen = 0;
  for (let len = maxOverlap; len >= 12; len--) {
    if (base.endsWith(next.slice(0, len))) {
      overlapLen = len;
      break;
    }
  }

  const dedupedNext = (overlapLen > 0 ? next.slice(overlapLen) : next).replace(/^\n+/, '');
  if (!dedupedNext.trim()) return base;

  // Decide separator: newline if heading/list/table/paragraph break, space if mid-sentence
  const startsBlock = /^(?:#{1,4}\s|[-*•]\s|\d+\.\s|\||\$\$|```|>)/.test(dedupedNext);
  const endsSentence = /[.!?]$/.test(base) || base.endsWith('$$') || base.endsWith('```');

  if (startsBlock || endsSentence) {
    return `${base}\n\n${dedupedNext}`;
  }

  const needsSpace = !/[\s(\[{/]$/.test(base) && !/^[,.;:!?)\]}]/.test(dedupedNext);
  return `${base}${needsSpace ? ' ' : ''}${dedupedNext}`;
}
