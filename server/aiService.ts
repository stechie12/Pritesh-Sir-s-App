import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  CurriculumBoard,
  GradeLevel,
  HistoryTurn,
  LessonPlanResponse,
  ResumeContext,
  ValidatedLessonPlanRequest,
  ValidatedStudyPlannerRequest,
} from './types.ts';
import { buildMathJsPipelineContext } from './mathEngine.ts';
import { redactPii } from './security.ts';

export interface ResolvedGeminiModel {
  sdkModelName: 'gemini-4-hydrogen' | 'gemini-4-neon' | 'gemini-4-argon' | 'gemini-3.1-flash-lite';
  thinkingLevel?: ThinkingLevel;
  displayLabel: string;
  requiresPaidKey: boolean;
}

export type GeminiKeyDiagnostic = 'configured' | 'missing';

export type GeminiTutorResult =
  | {
      ok: true;
      text: string;
      displayLabel: string;
      webSources: Array<{ title: string; url: string; snippet: string }>;
    }
  | {
      ok: false;
      errorKind:
        | 'missing_key'
        | 'service_disabled'
        | 'billing_required'
        | 'auth'
        | 'quota'
        | 'not_found'
        | 'transient'
        | 'fatal';
      status: number;
      code: string;
      userMessage: string;
      retryable: boolean;
      displayLabel: string;
    };

/**
 * Resolves UI model identifiers to active Gemini 4 / 3.1 SDK models.
 * Defaults to `gemini-4-hydrogen` (Gemini 4 Flash, free-tier compatible).
 */
export function resolveGeminiModelConfig(requestedModel?: string): ResolvedGeminiModel {
  switch (requestedModel) {
    case 'gemini-4-neon':
    case 'gemini-4-pro':
      return {
        sdkModelName: 'gemini-4-neon',
        thinkingLevel: ThinkingLevel.MEDIUM,
        displayLabel: 'gemini-4-neon',
        requiresPaidKey: true,
      };
    case 'gemini-4-argon':
      return {
        sdkModelName: 'gemini-4-argon',
        thinkingLevel: ThinkingLevel.LOW,
        displayLabel: 'gemini-4-argon',
        requiresPaidKey: true,
      };
    case 'gemini-3.1-flash-lite':
      return {
        sdkModelName: 'gemini-3.1-flash-lite',
        displayLabel: 'gemini-3.1-flash-lite',
        requiresPaidKey: false,
      };
    case 'gemini-4-hydrogen':
    case 'gemini-3.8-flash':
    case 'gemini-flash-latest':
    default:
      return {
        sdkModelName: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.LOW,
        displayLabel: 'gemini-4-hydrogen',
        requiresPaidKey: false,
      };
  }
}

export function resolveConfiguredApiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

/**
 * Checks whether a non-placeholder Gemini API key (either newer `AQ.` or legacy `AIza...`) is configured.
 */
export function getGeminiKeyDiagnostic(
  rawKey: string | undefined = resolveConfiguredApiKey()
): GeminiKeyDiagnostic {
  const apiKey = (rawKey ?? '').trim();
  if (
    !apiKey ||
    apiKey === 'MY_GEMINI_API_KEY' ||
    apiKey.includes('YOUR_') ||
    apiKey.length < 15
  ) {
    return 'missing';
  }
  return 'configured';
}

/**
 * Classifies whether an upstream Gemini error is an API-not-enabled error, auth/config failure,
 * quota exhaustion, model-not-found, transient outage, or fatal request error.
 */
export function classifyGeminiError(
  err: unknown
): 'service_disabled' | 'billing_required' | 'auth' | 'quota' | 'not_found' | 'transient' | 'fatal' {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  const status = Number(
    (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code ?? 0
  );

  if (/requires billing to be enabled|BILLING_DISABLED|enable billing/i.test(msg)) {
    return 'billing_required';
  }
  if (
    /SERVICE_DISABLED|has not been used in project|is disabled\. Enable it/i.test(msg)
  ) {
    return 'service_disabled';
  }
  if (
    status === 401 ||
    status === 403 ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|invalid api key/i.test(msg)
  ) {
    return 'auth';
  }
  if (status === 404 || /NOT_FOUND|is not found for API version/i.test(msg)) {
    return 'not_found';
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return 'quota';
  }
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /UNAVAILABLE|Timeout exceeded|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg)
  ) {
    return 'transient';
  }
  return 'fatal';
}

/**
 * Circuit breaker with timed cooldowns so a single transient timeout never permanently
 * disables a valid GEMINI_API_KEY for the lifetime of the server process.
 */
export class GeminiCircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil = 0;
  private lastError = '';
  private readonly transientThreshold: number;
  private readonly transientCooldownMs: number;
  private readonly authCooldownMs: number;

  constructor(options: {
    transientThreshold?: number;
    transientCooldownMs?: number;
    authCooldownMs?: number;
  } = {}) {
    this.transientThreshold = options.transientThreshold ?? 3;
    this.transientCooldownMs = options.transientCooldownMs ?? 20_000;
    this.authCooldownMs = options.authCooldownMs ?? 60_000;
  }

  canRequest(now = Date.now()): boolean {
    if (now < this.openUntil) return false;
    if (this.openUntil > 0 && now >= this.openUntil) {
      // Half-open recovery: allow probe request
      this.openUntil = 0;
      this.consecutiveFailures = Math.max(0, this.transientThreshold - 1);
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastError = '';
  }

  recordFailure(
    kind:
      | 'service_disabled'
      | 'billing_required'
      | 'auth'
      | 'quota'
      | 'not_found'
      | 'transient'
      | 'fatal',
    now = Date.now(),
    reason?: string
  ): void {
    if (reason) {
      this.lastError = redactPii(reason).slice(0, 140);
    }
    if (kind === 'auth' || kind === 'service_disabled' || kind === 'billing_required') {
      this.openUntil = now + this.authCooldownMs;
      this.consecutiveFailures = this.transientThreshold;
      return;
    }
    if (kind === 'transient' || kind === 'quota') {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.transientThreshold) {
        this.openUntil = now + this.transientCooldownMs;
      }
    }
  }

  getState(now = Date.now()) {
    return {
      isOpen: now < this.openUntil,
      consecutiveFailures: this.consecutiveFailures,
      retryInMs: Math.max(0, this.openUntil - now),
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }
}

export const geminiCircuitBreaker = new GeminiCircuitBreaker();

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;
let searchGroundingCooldownUntil = 0;
let primaryModelHighDemandUntil = 0;

/**
 * Only attach Google Search grounding when the student actually asks for live/current web facts,
 * avoiding unnecessary search-tool latency and free-tier 429s on standard math questions.
 */
function shouldAttachGoogleSearchTool(question: string, enableWebSearch: boolean): boolean {
  if (!enableWebSearch || Date.now() < searchGroundingCooldownUntil) {
    return false;
  }
  return /\b(latest|recent|current|today|2025|2026|2027|news|date sheet|timetable|exam date|who is|who won|history of)\b/i.test(
    question
  );
}

/**
 * Returns a reused singleton GoogleGenAI client with required telemetry headers.
 * Uses the Gemini Developer API natively for both `AQ.` auth keys and `AIza...` keys.
 */
export function getGenAIClient(): GoogleGenAI | null {
  const apiKey = resolveConfiguredApiKey();
  if (getGeminiKeyDiagnostic(apiKey) === 'missing') {
    return null;
  }
  if (!geminiCircuitBreaker.canRequest()) {
    return null;
  }
  if (cachedClient && cachedApiKey === apiKey) {
    return cachedClient;
  }
  cachedApiKey = apiKey;
  cachedClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return getGeminiKeyDiagnostic() === 'configured';
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs = 12_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout exceeded (${timeoutMs}ms)`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Retries transient async operations with exponential backoff + jitter.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      geminiCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      lastError = err;
      const kind = classifyGeminiError(err);
      const errMsg = String((err as { message?: string })?.message ?? err ?? '');
      geminiCircuitBreaker.recordFailure(kind, Date.now(), errMsg);
      if (kind !== 'transient' || attempt >= maxRetries) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 120);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt + jitter));
    }
  }

  throw lastError;
}

export function buildTutorSystemInstruction(
  grade: GradeLevel,
  board: CurriculumBoard,
  resumeContext: ResumeContext | null
): string {
  const base =
    `You are Pritesh Sir's AI Maths Assistant — a sharp, encouraging AI study companion built for Standard ${grade} (${board} — ${
      board === 'ICSE' ? 'Selina Concise' : 'NCERT'
    }) students. ` +
    `Never introduce yourself as Pritesh Sir or pretend to be him; if asked who you are, clarify that you are Pritesh Sir's AI Assistant. ` +
    'You are equally expert across ALL branches of mathematics — Number Systems, Surds & Logarithms, Algebra, Commercial Maths (GST, Banking, Compound Interest), Geometry, Mensuration, Coordinate Geometry, Trigonometry, Statistics & Probability, Matrices, Vectors, and Calculus. Never claim to specialize only in Trigonometry or any single topic. ' +
    'Write fresh, conversational, tailored answers directly to what the student asked instead of a repetitive readymade textbook sheet. Do NOT open every message with a canned greeting like "Hello! I am..." unless the student greets you first, and do NOT force a boilerplate tip or sign-off onto every reply. ' +
    'Keep explanations crisp, clear, and complete without filler or mid-sentence cutoffs. Use GitHub Flavored Markdown with LaTeX ($...$ inline and $$...$$ display) for equations, **bold** for key ideas, and tables only when listing a reference table or direct comparison.';

  if (resumeContext && resumeContext.partialContent) {
    return (
      `${base} ` +
      'The student is resuming an interrupted explanation. Continue seamlessly from the exact point where the partial explanation stopped without repeating earlier paragraphs.'
    );
  }
  return base;
}

export async function generateGeminiTutorReply(params: {
  question: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  requestedModel: string;
  history: HistoryTurn[];
  enableWebSearch: boolean;
  imageBase64?: string;
  imageMimeType: string;
  resumeContext: ResumeContext | null;
}): Promise<GeminiTutorResult> {
  const { sdkModelName, thinkingLevel, displayLabel, requiresPaidKey } = resolveGeminiModelConfig(
    params.requestedModel
  );

  const keyDiagnostic = getGeminiKeyDiagnostic();
  if (keyDiagnostic === 'missing') {
    return {
      ok: false,
      errorKind: 'missing_key',
      status: 401,
      code: 'GEMINI_KEY_MISSING',
      userMessage:
        'No Gemini API key is configured. Open Settings > Secrets in AI Studio and set GEMINI_API_KEY.',
      retryable: false,
      displayLabel,
    };
  }

  const ai = getGenAIClient();
  if (!ai) {
    const breakerState = geminiCircuitBreaker.getState();
    const lastErr = breakerState.lastError || '';
    if (/requires billing to be enabled|BILLING_DISABLED|enable billing/i.test(lastErr)) {
      return {
        ok: false,
        errorKind: 'billing_required',
        status: 403,
        code: 'BILLING_REQUIRED',
        userMessage:
          `This model (${displayLabel}) or project requires billing to be enabled. Switch to gemini-4-hydrogen (free tier) or enable billing on your project.`,
        retryable: false,
        displayLabel,
      };
    }
    if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(lastErr)) {
      return {
        ok: false,
        errorKind: 'service_disabled',
        status: 403,
        code: 'API_NOT_ENABLED',
        userMessage:
          'The Generative Language API is not enabled in your Google Cloud project yet. Enable Generative Language API in Google Cloud Console, wait ~1 minute, and retry.',
        retryable: false,
        displayLabel,
      };
    }
    const isAuthHold = /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(lastErr);
    if (isAuthHold) {
      return {
        ok: false,
        errorKind: 'auth',
        status: 401,
        code: 'API_KEY_INVALID',
        userMessage:
          'Your Gemini API key was rejected (API_KEY_INVALID). Open Settings > Secrets in AI Studio and check or replace GEMINI_API_KEY.',
        retryable: false,
        displayLabel,
      };
    }
    return {
      ok: false,
      errorKind: 'transient',
      status: 503,
      code: 'GEMINI_CIRCUIT_OPEN',
      userMessage: `Gemini (${displayLabel}) is cooling down after temporary errors. Please retry in ${Math.max(1, Math.ceil(breakerState.retryInMs / 1000))} seconds.`,
      retryable: true,
      displayLabel,
    };
  }

  const systemInstruction = buildTutorSystemInstruction(
    params.grade,
    params.board,
    params.resumeContext
  );

  const mathContext = buildMathJsPipelineContext(
    params.resumeContext?.originalQuestion || params.question
  );

  const promptBody = params.resumeContext?.partialContent
    ? [
        `<student_query grade="${params.grade}" board="${params.board}">`,
        `Original question: ${params.resumeContext.originalQuestion}`,
        `Already delivered partial explanation (continue directly from the end without repeating):`,
        params.resumeContext.partialContent,
        `</student_query>`,
      ].join('\n')
    : [
        `<student_query grade="${params.grade}" board="${params.board}">`,
        params.question,
        mathContext.mathJsFact ? `[Verified Calculation: ${mathContext.mathJsFact}]` : '',
        `</student_query>`,
      ]
        .filter(Boolean)
        .join('\n');

  const extractGroundingSources = (
    resp: unknown
  ): Array<{ title: string; url: string; snippet: string }> => {
    try {
      const chunks =
        (resp as {
          candidates?: Array<{
            groundingMetadata?: {
              groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
            };
          }>;
        })?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seen = new Set<string>();
      const out: Array<{ title: string; url: string; snippet: string }> = [];
      for (const ch of chunks) {
        const uri = ch?.web?.uri;
        if (!uri || seen.has(uri)) continue;
        if (!uri.startsWith('https://') && !uri.startsWith('http://')) continue;
        seen.add(uri);
        out.push({
          title: (ch.web?.title || 'Verified Web Reference').slice(0, 140),
          url: uri,
          snippet: 'Verified source retrieved via Google Search grounding.',
        });
        if (out.length >= 4) break;
      }
      return out;
    } catch {
      return [];
    }
  };

  const executeGeminiCall = async (
    useSearchTool: boolean,
    modelOverride?: { sdkModelName: ResolvedGeminiModel['sdkModelName']; thinkingLevel?: ThinkingLevel },
    timeoutMs = 6_500
  ) => {
    const activeModel = modelOverride ? modelOverride.sdkModelName : sdkModelName;
    const activeThinking = modelOverride ? modelOverride.thinkingLevel : thinkingLevel;
    const callConfig = {
      systemInstruction,
      maxOutputTokens: 1200,
      ...(useSearchTool ? { tools: [{ googleSearch: {} }] } : {}),
      ...(activeThinking ? { thinkingConfig: { thinkingLevel: activeThinking } } : {}),
    };

    if (params.imageBase64) {
      const resp = await withTimeout(
        ai.models.generateContent({
          model: activeModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: params.imageMimeType,
                  data: params.imageBase64,
                },
              },
              { text: promptBody },
            ],
          },
          config: callConfig,
        }),
        Math.max(timeoutMs, 15_000)
      );
      return { text: (resp.text ?? '').trim(), webSources: extractGroundingSources(resp) };
    }

    const formattedHistory = params.history.slice(-6).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text.slice(0, 350) }],
    }));

    const chat = ai.chats.create({
      model: activeModel,
      history: formattedHistory,
      config: callConfig,
    });
    const resp = await withTimeout(chat.sendMessage({ message: promptBody }), timeoutMs);
    return { text: (resp.text ?? '').trim(), webSources: extractGroundingSources(resp) };
  };

  try {
    const canTrySearchTool = shouldAttachGoogleSearchTool(
      params.question,
      params.enableWebSearch
    );

    // If Gemini 4 recently hit a high-demand stall/503 within the last 5 minutes and the user
    // is on the default free model, route directly to gemini-3.1-flash-lite for fast ~2-4s replies.
    const skipDirectlyToFastModel =
      sdkModelName === 'gemini-4-hydrogen' && Date.now() < primaryModelHighDemandUntil;

    let resolvedLabel = skipDirectlyToFastModel ? 'gemini-3.1-flash-lite' : displayLabel;

    const runPrimary = async () => {
      try {
        const primaryRes = await executeGeminiCall(canTrySearchTool, undefined, 10_000);
        return { ...primaryRes, usedModel: displayLabel };
      } catch (err) {
        const kind = classifyGeminiError(err);
        // Free-tier keys often have 0 quota for googleSearch grounding (429) while standard
        // generation works cleanly. Retry without googleSearch and cool down grounding.
        if (
          canTrySearchTool &&
          kind !== 'auth' &&
          kind !== 'service_disabled' &&
          kind !== 'billing_required'
        ) {
          if (kind === 'quota') {
            searchGroundingCooldownUntil = Date.now() + 5 * 60_000;
          }
          const noSearchRes = await executeGeminiCall(false, undefined, 10_000);
          return { ...noSearchRes, usedModel: displayLabel };
        }
        throw err;
      }
    };

    const runFastLite = async () => {
      const fastRes = await executeGeminiCall(
        false,
        { sdkModelName: 'gemini-3.1-flash-lite' },
        11_000
      );
      return { ...fastRes, usedModel: 'gemini-3.1-flash-lite' };
    };

    let result: {
      text: string;
      webSources: Array<{ title: string; url: string; snippet: string }>;
      usedModel: string;
    };

    if (skipDirectlyToFastModel) {
      result = await runFastLite();
      geminiCircuitBreaker.recordSuccess();
      resolvedLabel = result.usedModel;
    } else if (sdkModelName === 'gemini-4-hydrogen' && !params.imageBase64) {
      // Hedged request: give Gemini 4 Hydrogen a 4.5s head start; if it hasn't replied yet
      // (or fails transiently), launch gemini-3.1-flash-lite in parallel and return whichever
      // finishes first cleanly so students never wait 15-20s.
      result = await new Promise((resolve, reject) => {
        let settled = false;
        let hedgeLaunched = false;
        let primaryErr: unknown = null;
        let hedgeErr: unknown = null;
        let pendingCount = 1;

        const finishSuccess = (
          res: {
            text: string;
            webSources: Array<{ title: string; url: string; snippet: string }>;
            usedModel: string;
          },
          fromHedge: boolean
        ) => {
          if (settled) return;
          settled = true;
          clearTimeout(hedgeTimer);
          if (fromHedge) {
            primaryModelHighDemandUntil = Date.now() + 5 * 60_000;
          }
          geminiCircuitBreaker.recordSuccess();
          resolvedLabel = res.usedModel;
          resolve(res);
        };

        const launchHedge = () => {
          if (settled || hedgeLaunched) return;
          hedgeLaunched = true;
          pendingCount += 1;
          runFastLite()
            .then((res) => finishSuccess(res, true))
            .catch((err) => {
              hedgeErr = err;
              pendingCount -= 1;
              if (!settled && pendingCount === 0) {
                settled = true;
                clearTimeout(hedgeTimer);
                const finalErr = primaryErr ?? hedgeErr;
                geminiCircuitBreaker.recordFailure(
                  classifyGeminiError(finalErr),
                  Date.now(),
                  String((finalErr as { message?: string })?.message ?? finalErr ?? '')
                );
                reject(finalErr);
              }
            });
        };

        const hedgeTimer = setTimeout(launchHedge, 4_500);

        runPrimary()
          .then((res) => finishSuccess(res, false))
          .catch((err) => {
            primaryErr = err;
            pendingCount -= 1;
            const kind = classifyGeminiError(err);
            if (kind === 'transient') {
              clearTimeout(hedgeTimer);
              launchHedge();
              return;
            }
            if (!settled && pendingCount === 0) {
              settled = true;
              clearTimeout(hedgeTimer);
              geminiCircuitBreaker.recordFailure(
                kind,
                Date.now(),
                String((err as { message?: string })?.message ?? err ?? '')
              );
              reject(err);
            }
          });
      });
    } else {
      result = await runPrimary().catch(async (primaryErr) => {
        const kind = classifyGeminiError(primaryErr);
        const errMsg = String((primaryErr as { message?: string })?.message ?? primaryErr ?? '');
        if (kind === 'transient' && sdkModelName !== 'gemini-3.1-flash-lite') {
          const failover = await runFastLite();
          geminiCircuitBreaker.recordSuccess();
          resolvedLabel = failover.usedModel;
          return failover;
        }
        geminiCircuitBreaker.recordFailure(kind, Date.now(), errMsg);
        throw primaryErr;
      });
      geminiCircuitBreaker.recordSuccess();
      resolvedLabel = result.usedModel;
    }

    if (!result.text) {
      return {
        ok: false,
        errorKind: 'transient',
        status: 502,
        code: 'GEMINI_EMPTY_RESPONSE',
        userMessage: `Gemini (${resolvedLabel}) returned an empty response. Please try asking again.`,
        retryable: true,
        displayLabel: resolvedLabel,
      };
    }

    return { ok: true, text: result.text, displayLabel: resolvedLabel, webSources: result.webSources };
  } catch (err) {
    const kind = classifyGeminiError(err);
    if (kind === 'billing_required') {
      return {
        ok: false,
        errorKind: 'billing_required',
        status: 403,
        code: 'BILLING_REQUIRED',
        userMessage:
          `This model (${displayLabel}) or project requires billing to be enabled. Switch to gemini-4-hydrogen (free tier) or enable billing on your project.`,
        retryable: false,
        displayLabel,
      };
    }
    if (kind === 'service_disabled') {
      return {
        ok: false,
        errorKind: 'service_disabled',
        status: 403,
        code: 'API_NOT_ENABLED',
        userMessage:
          'The Generative Language API is not enabled in your Google Cloud project yet. Enable Generative Language API in Google Cloud Console, wait ~1 minute, and retry.',
        retryable: false,
        displayLabel,
      };
    }
    if (kind === 'auth') {
      return {
        ok: false,
        errorKind: 'auth',
        status: 401,
        code: 'API_KEY_INVALID',
        userMessage:
          'Your Gemini API key was rejected (API_KEY_INVALID / PERMISSION_DENIED). Please open Settings > Secrets in AI Studio and check or replace GEMINI_API_KEY.',
        retryable: false,
        displayLabel,
      };
    }
    if (kind === 'not_found') {
      return {
        ok: false,
        errorKind: 'not_found',
        status: 404,
        code: 'MODEL_NOT_AVAILABLE',
        userMessage: `Model "${displayLabel}" is not available on this API key / endpoint. Try selecting gemini-3.1-flash-lite or gemini-4-hydrogen from the Model selector.`,
        retryable: false,
        displayLabel,
      };
    }
    if (kind === 'quota') {
      return {
        ok: false,
        errorKind: 'quota',
        status: 429,
        code: 'GEMINI_QUOTA_EXCEEDED',
        userMessage: requiresPaidKey
          ? `${displayLabel} requires a billing-enabled API key or exceeded its quota (429). Switch to gemini-4-hydrogen (free tier) or select a billing-enabled key in Settings > Secrets.`
          : 'Gemini API rate limit reached (429). Please wait a few seconds and retry, or select a billing-enabled key in Settings > Secrets.',
        retryable: !requiresPaidKey,
        displayLabel,
      };
    }
    if (kind === 'transient') {
      return {
        ok: false,
        errorKind: 'transient',
        status: 503,
        code: 'GEMINI_UNAVAILABLE',
        userMessage: `Gemini (${displayLabel}) is temporarily unavailable or timed out. Please tap Retry in a moment.`,
        retryable: true,
        displayLabel,
      };
    }
    return {
      ok: false,
      errorKind: 'fatal',
      status: 502,
      code: 'GEMINI_REQUEST_FAILED',
      userMessage: `Gemini (${displayLabel}) could not process this request. Try switching to gemini-4-hydrogen or rephrasing your question.`,
      retryable: false,
      displayLabel,
    };
  }
}

/**
 * Synthesizes speech via Gemini 3.8 Flash Lite TTS with a realistic 8s timeout.
 */
export async function synthesizeTutorSpeech(
  text: string
): Promise<{ audioWavBase64: string | null; fallbackWebSpeech: boolean }> {
  const ai = getGenAIClient();
  if (!ai) {
    return { audioWavBase64: null, fallbackWebSpeech: true };
  }
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: text.slice(0, 900) }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }),
      8000
    );
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return { audioWavBase64: null, fallbackWebSpeech: true };
    }
    return { audioWavBase64: base64Audio, fallbackWebSpeech: false };
  } catch {
    return { audioWavBase64: null, fallbackWebSpeech: true };
  }
}

export function buildDefaultLessonPlan(req: ValidatedLessonPlanRequest): LessonPlanResponse {
  const { grade, board, weakTopics, adaptiveRating } = req;
  return {
    summary: `Personalized 4-Stage Mastery Plan for Standard ${grade} (${board}) calibrated at ${adaptiveRating} ELO.`,
    dailyGoalMinutes: 45,
    modules: [
      {
        stage: 'Stage 01 · Prerequisite Recap & Formula Bridge',
        topic: weakTopics[0] || 'Trigonometry & Heights',
        durationMin: 10,
        objective:
          'Consolidate previous standard identities and eliminate sign/rationalization errors before attempting Section B sums.',
        keyFormula: 'sin²θ + cos²θ = 1 · 1 + tan²θ = sec²θ · Δ = b² − 4ac',
      },
      {
        stage: 'Stage 02 · Guided Selina Concise Worked Examples',
        topic: weakTopics[1] || 'Quadratic Equations & Commercial Maths',
        durationMin: 15,
        objective:
          'Step-by-step marking-scheme walkthrough of 3 high-weightage ICSE/CBSE board problems.',
        keyFormula: 'x = (−b ± √(b² − 4ac)) / 2a · Maturity Value = P×n + P×n(n+1)/24 × r/100',
      },
      {
        stage: 'Stage 03 · Adaptive Challenging Drill',
        topic: weakTopics[2] || 'Mixed Multi-Concept Application',
        durationMin: 15,
        objective:
          'Timed practice on sums that combine algebra with geometric properties to boost ELO rating by +45 pts.',
        keyFormula:
          'Section Formula: P(x,y) = ((m₁x₂ + m₂x₁)/(m₁+m₂), (m₁y₂ + m₂y₁)/(m₁+m₂))',
      },
      {
        stage: 'Stage 04 · 5-Minute Rapid Retention Check',
        topic: 'Board MCQ & Assertion-Reasoning Sprint',
        durationMin: 5,
        objective:
          'Lock in long-term retention with instant feedback on 3 assertion-reason questions.',
        keyFormula: 'Sum of roots = −b/a · Product of roots = c/a',
      },
    ],
  };
}

/**
 * Generates a structured 4-stage lesson plan via Gemini structured JSON (`responseSchema`)
 * with guaranteed deterministic fallback.
 */
export async function generateAdaptiveLessonPlan(
  req: ValidatedLessonPlanRequest
): Promise<LessonPlanResponse> {
  const fallback = buildDefaultLessonPlan(req);
  const ai = getGenAIClient();
  if (!ai) return fallback;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a concise 4-stage daily mathematics mastery plan for a Standard ${req.grade} (${req.board}) student with ELO rating ${req.adaptiveRating} focusing on these weak topics: ${req.weakTopics.join(', ')}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              dailyGoalMinutes: { type: Type.INTEGER },
              modules: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stage: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    durationMin: { type: Type.INTEGER },
                    objective: { type: Type.STRING },
                    keyFormula: { type: Type.STRING },
                  },
                  required: ['stage', 'topic', 'durationMin', 'objective', 'keyFormula'],
                },
              },
            },
            required: ['summary', 'dailyGoalMinutes', 'modules'],
          },
        },
      }),
      10_000
    );

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<LessonPlanResponse>;
    if (
      typeof parsed.summary === 'string' &&
      Array.isArray(parsed.modules) &&
      parsed.modules.length >= 2
    ) {
      return {
        summary: parsed.summary.slice(0, 260),
        dailyGoalMinutes: Math.max(15, Math.min(180, Number(parsed.dailyGoalMinutes) || 45)),
        modules: parsed.modules.slice(0, 4).map((m, idx) => ({
          stage: String(m.stage || `Stage 0${idx + 1}`).slice(0, 100),
          topic: String(m.topic || req.weakTopics[idx] || 'Core Maths').slice(0, 100),
          durationMin: Math.max(5, Math.min(90, Number(m.durationMin) || 15)),
          objective: String(m.objective || '').slice(0, 260),
          keyFormula: String(m.keyFormula || '').slice(0, 180),
        })),
      };
    }
  } catch {
    // Graceful fallback to deterministic plan
  }

  return fallback;
}

/**
 * Generates a concise adaptive coach note for the Study Planner using Gemini when available,
 * falling back cleanly to a calibrated deterministic note.
 */
export async function generateStudyPlannerCoachNote(
  req: ValidatedStudyPlannerRequest
): Promise<string> {
  const focusLabel = req.weakTopics[0] || 'Trigonometry & Algebra';
  const feedbackNote =
    req.feedbackMode === 'need_more_time'
      ? 'Extra revision buffers have been added around foundation steps.'
      : req.feedbackMode === 'ready_for_harder'
      ? 'Challenging board-style multi-concept drills have been prioritized.'
      : 'Balanced theory recap and timed problem drills are scheduled.';

  const fallback = `Schedule dynamically calibrated for Standard ${req.grade} (${req.board}) at ${req.pace} pace with ${req.daysUntilMock} days until your next Mock Test. Prioritizing ${focusLabel}. ${feedbackNote}`;

  const ai = getGenAIClient();
  if (!ai) return fallback;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Write a single 2-sentence actionable study coaching note for a Standard ${req.grade} (${req.board}) mathematics student on a ${req.pace} pace with ${req.daysUntilMock} days until their mock test. Weak topics: ${req.weakTopics.join(', ') || 'General revision'}. Student feedback: ${req.feedbackMode}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            "You are Pritesh Sir's AI Maths Assistant, a concise study coach covering all branches of mathematics. Never claim to be Pritesh Sir himself. Return plain text only (no markdown headings), maximum 2 sentences.",
        },
      }),
      8_000
    );
    const note = (response.text ?? '').trim();
    if (note && note.length >= 20) {
      return note.slice(0, 420);
    }
  } catch {
    // Fall back deterministically
  }

  return fallback;
}
