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
      thoughtText?: string;
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
        thinkingLevel: ThinkingLevel.MEDIUM,
        displayLabel: 'gemini-4-hydrogen',
        requiresPaidKey: false,
      };
  }
}

export type AdaptiveComputeTier = 'eco' | 'balanced' | 'turbo';

export interface AdaptiveComputePlan {
  tier: AdaptiveComputeTier;
  thinkingLevel?: ThinkingLevel;
  includeThoughts: boolean;
  maxOutputTokens: number;
  maxHistoryTurns: number;
  maxHistoryCharsPerTurn: number;
  compactSystemPrompt: boolean;
  reason: string;
}

/**
 * Adaptive "Precision Boost" router: keeps simple greetings & quick formula/arithmetic
 * lookups lean (Eco), uses crisp balanced reasoning for standard ICSE/CBSE doubts (Balanced),
 * and unleashes full HIGH thinking + generous output tokens for proofs, calculus, Olympiads,
 * mistake audits, multi-part problems, and image/sketch analysis (Turbo).
 */
export function computeAdaptiveThinkingBudget(params: {
  question: string;
  history?: HistoryTurn[];
  hasImage?: boolean;
  isResume?: boolean;
  requestedModel?: string;
  hasVerifiedMathFact?: boolean;
}): AdaptiveComputePlan {
  const baseCfg = resolveGeminiModelConfig(params.requestedModel);
  const rawQ = (params.question || '').trim();
  const history = params.history || [];

  // Strip pedagogy tag prefixes like "[Mode: ...]" when measuring raw student prompt complexity
  const strippedQ = rawQ.replace(/^\[[^\]]+\]\s*/g, '').trim();
  const lower = strippedQ.toLowerCase();

  // Detect if the student is submitting answers to a prior quiz/worksheet (needs full history)
  const isQuizOrAnswerGrading =
    history.length >= 2 &&
    (/\b(check my|grade|my answers?|did i get|is it right|are these right|option\s+[a-d])\b/i.test(strippedQ) ||
      /(?:^|\s)(?:1[.)]|q1|a[.)])\s*.+(?:2[.)]|q2|b[.)])/i.test(strippedQ));

  // 1. TURBO BOOST: heavy reasoning, proofs, multi-step calculus/olympiad, images, or Neon model
  const isHeavyMathReasoning =
    /\b(prove\s+that|show\s+that|derive|derivation|proof|olympiad|jee|iit|imo|hardest|challenging|tough|tricky|calculus|integral|integrate|differentiate|derivative|differential\s+eq|matrix|matrices|determinant|eigen|vector|complex\s+number|induction|combinatorics|permutation|combination|bayes|conditional\s+probability|conic|parabola|ellipse|hyperbola|locus|circle\s+theorem|trigonometric\s+identity|verify\s+my\s+steps|check\s+(?:my\s+)?rough\s+work|find\s+(?:the\s+)?mistake|spot\s+(?:the\s+)?error|step[\s-]by[\s-]step\s+check|compare\s+both\s+methods|handwriting.*latex|transcribe.*latex)\b/i.test(
      strippedQ
    );

  const hasMultiPartStructure =
    strippedQ.length >= 220 ||
    (strippedQ.match(/\n/g)?.length ?? 0) >= 3 ||
    /\(\s*[ivx]+\s*\).*\(\s*[ivx]+\s*\)/i.test(strippedQ) ||
    /\(\s*a\s*\).*\(\s*b\s*\)/i.test(strippedQ);

  if (
    params.hasImage ||
    isHeavyMathReasoning ||
    hasMultiPartStructure ||
    baseCfg.sdkModelName === 'gemini-4-neon'
  ) {
    const turboThinking =
      baseCfg.sdkModelName === 'gemini-3.1-flash-lite'
        ? undefined
        : baseCfg.sdkModelName === 'gemini-4-argon'
          ? ThinkingLevel.MEDIUM
          : ThinkingLevel.HIGH;
    return {
      tier: 'turbo',
      thinkingLevel: turboThinking,
      includeThoughts: turboThinking !== undefined,
      maxOutputTokens: 4096,
      maxHistoryTurns: 12,
      maxHistoryCharsPerTurn: 2800,
      compactSystemPrompt: false,
      reason: params.hasImage
        ? 'visual_math_reasoning'
        : isHeavyMathReasoning
          ? 'deep_proof_or_advanced_math'
          : hasMultiPartStructure
            ? 'multi_part_problem'
            : 'pro_model_requested',
    };
  }

  // 2. ECO / IDLE: pure greetings, acknowledgements, identity checks, or short direct lookups
  const isCasualChitChat =
    /^(?:hi+|hello+|hey+|yo|sup|good\s+(?:morning|afternoon|evening)|thanks?(?:\s+you)?|ty|thx|ok(?:ay)?|got\s+it|cool|nice|great|awesome|bye|see\s+ya|who\s+are\s+you\??|what\s+can\s+you\s+do\??)(?:\s+(?:there|sir|bro|buddy|friend|ai|assistant))?[\s!.?]*$/i.test(
      lower
    );

  const isSimpleDirectLookup =
    !params.isResume &&
    !isQuizOrAnswerGrading &&
    strippedQ.length <= 56 &&
    !/\b(explain|why|how|solve|factori[sz]e|simplify|graph|plot|visuali[sz]e|simulate|quiz|test|practice|word\s+problem|train|boat|age|mixture|compound\s+interest|theorem)\b/i.test(
      lower
    ) &&
    (Boolean(params.hasVerifiedMathFact) ||
      /^(?:what\s+is\s+)?(?:the\s+)?(?:formula\s+(?:of|for)|value\s+of|definition\s+of|square\s+of|cube\s+of|sqrt|sin|cos|tan)\b/i.test(
        lower
      ) ||
      /^[\d\s+\-*/^().=%?]+$/.test(strippedQ));

  if (isCasualChitChat || isSimpleDirectLookup) {
    const ecoThinking =
      baseCfg.sdkModelName === 'gemini-3.1-flash-lite' ? undefined : ThinkingLevel.LOW;
    return {
      tier: 'eco',
      thinkingLevel: ecoThinking,
      includeThoughts: false,
      maxOutputTokens: 640,
      maxHistoryTurns: 4,
      maxHistoryCharsPerTurn: 750,
      compactSystemPrompt: true,
      reason: isCasualChitChat ? 'casual_greeting_or_ack' : 'quick_direct_lookup',
    };
  }

  // 3. BALANCED / CRUISE: standard syllabus doubts, homework, equations, word problems
  const balancedThinking =
    baseCfg.sdkModelName === 'gemini-3.1-flash-lite'
      ? undefined
      : baseCfg.thinkingLevel ?? ThinkingLevel.MEDIUM;

  return {
    tier: 'balanced',
    thinkingLevel: balancedThinking,
    includeThoughts: balancedThinking !== undefined,
    maxOutputTokens: params.isResume ? 2400 : 2048,
    maxHistoryTurns: isQuizOrAnswerGrading ? 12 : 8,
    maxHistoryCharsPerTurn: isQuizOrAnswerGrading ? 2400 : 1600,
    compactSystemPrompt: false,
    reason: isQuizOrAnswerGrading ? 'quiz_grading_context' : 'standard_syllabus_doubt',
  };
}

function normalizeHistoryWindow(
  history: HistoryTurn[],
  maxTurns: number,
  maxCharsPerTurn: number
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const normalized: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const turn of history.slice(-maxTurns)) {
    const cleanText = turn.text.trim().slice(0, maxCharsPerTurn);
    if (!cleanText) continue;
    if (normalized.length === 0 && turn.role !== 'user') continue;
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts[0].text = `${prev.parts[0].text}\n\n${cleanText}`.slice(0, maxCharsPerTurn);
    } else {
      normalized.push({ role: turn.role, parts: [{ text: cleanText }] });
    }
  }
  return normalized;
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
    this.transientThreshold = options.transientThreshold ?? 5;
    this.transientCooldownMs = options.transientCooldownMs ?? 12_000;
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
  resumeContext: ResumeContext | null,
  options: { compact?: boolean } = {}
): string {
  const syllabusBook = board === 'ICSE' ? 'Selina Concise' : 'NCERT';
  const core =
    `You are Pritesh Sir's AI Maths Assistant — a sharp, warm mentor for Standard ${grade} (${board} — ${syllabusBook}). ` +
    `Never introduce yourself as Pritesh Sir; if asked, state you are Pritesh Sir's AI Assistant. ` +
    `You master ALL branches of mathematics (Number Systems, Surds & Logarithms, Algebra, Commercial Maths, Geometry, Mensuration, Coordinate Geometry, Trigonometry, Statistics & Probability, Matrices, Vectors, Calculus). ` +
    `Match depth to the question: keep casual/quick queries crisp and direct; for math doubts, give the core intuition in one line, then clean step-by-step reasoning using Markdown and LaTeX ($...$ inline, $$...$$ display on own lines) with **bold** highlights. Do NOT open every reply with a canned greeting or boilerplate footer. ` +
    `Use any internal arithmetic check silently only for accuracy—never mention it. Remember conversation history and grade quiz/follow-up answers against the exact numbered questions asked.`;

  const simDirective = options.compact
    ? ''
    : ' INTERACTIVE SIMULATIONS (selective): Only when a diagram truly helps or is requested, end with ONE tag on the last line: ' +
      '[[SIM:trig angle=30]] | [[SIM:quadratic a=1 b=-4 c=3]] | [[SIM:coordinate x1=-2 y1=-1 x2=4 y2=3]] | [[SIM:circle angle=100 radius=5]] | [[SIM:compound_interest principal=10000 rate=10 years=5]] | [[SIM:calculus preset=x2 x=1]] | [[SIM:progression mode=AP a=3 step=4 n=8]] | [[SIM:mensuration shape=cylinder radius=5 height=10]]. Never emit tags for greetings, tips, or quizzes.';

  const base = `${core}${simDirective}`;

  if (resumeContext && resumeContext.partialContent) {
    return `${base} Resume seamlessly from where the partial explanation stopped without repeating earlier text.`;
  }
  return base;
}

function extractPartsFromResponse(resp: unknown): { text: string; thoughtText: string } {
  const parts =
    (resp as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>;
    })?.candidates?.[0]?.content?.parts || [];
  let text = '';
  let thoughtText = '';
  for (const part of parts) {
    if (!part || typeof part.text !== 'string' || !part.text) continue;
    if (part.thought) {
      thoughtText += part.text;
    } else {
      text += part.text;
    }
  }
  if (!text) {
    const fallbackText = (resp as { text?: string })?.text;
    if (typeof fallbackText === 'string') {
      text = fallbackText;
    }
  }
  return { text, thoughtText };
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
  verifiedMathReference?: string | null;
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

  const mathContext = buildMathJsPipelineContext(
    params.resumeContext?.originalQuestion || params.question
  );

  const adaptivePlan = computeAdaptiveThinkingBudget({
    question: params.resumeContext?.originalQuestion || params.question,
    history: params.history,
    hasImage: Boolean(params.imageBase64),
    isResume: Boolean(params.resumeContext?.partialContent),
    requestedModel: params.requestedModel,
    hasVerifiedMathFact: Boolean(mathContext.mathJsFact),
  });

  const systemInstruction = buildTutorSystemInstruction(
    params.grade,
    params.board,
    params.resumeContext,
    { compact: adaptivePlan.compactSystemPrompt }
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
        params.verifiedMathReference
          ? `[Verified Symbolic Check (do not copy verbatim, explain naturally in your own voice): ${params.verifiedMathReference}]`
          : '',
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
    timeoutMs = 15_000
  ) => {
    const activeModel = modelOverride ? modelOverride.sdkModelName : sdkModelName;
    const activeThinking = modelOverride
      ? modelOverride.thinkingLevel
      : adaptivePlan.thinkingLevel ?? thinkingLevel;
    const includeThoughts = modelOverride ? activeThinking !== undefined : adaptivePlan.includeThoughts;
    const callConfig = {
      systemInstruction,
      maxOutputTokens: adaptivePlan.maxOutputTokens,
      ...(useSearchTool ? { tools: [{ googleSearch: {} }] } : {}),
      ...(activeThinking
        ? { thinkingConfig: { thinkingLevel: activeThinking, includeThoughts } }
        : {}),
    };

    const normalizedHistory = normalizeHistoryWindow(
      params.history,
      adaptivePlan.maxHistoryTurns,
      adaptivePlan.maxHistoryCharsPerTurn
    );

    if (params.imageBase64) {
      const recentContextText =
        normalizedHistory.length > 0
          ? `Recent conversation context:\n${normalizedHistory
              .slice(-4)
              .map((h) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.parts[0].text.slice(0, 800)}`)
              .join('\n')}\n\nCurrent question about the attached image:\n`
          : '';
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
              { text: `${recentContextText}${promptBody}` },
            ],
          },
          config: callConfig,
        }),
        Math.max(timeoutMs, 18_000)
      );
      const extracted = extractPartsFromResponse(resp);
      return {
        text: extracted.text.trim(),
        thoughtText: extracted.thoughtText.trim(),
        webSources: extractGroundingSources(resp),
      };
    }

    if (normalizedHistory.length === 0) {
      const resp = await withTimeout(
        ai.models.generateContent({
          model: activeModel,
          contents: promptBody,
          config: callConfig,
        }),
        timeoutMs
      );
      const extracted = extractPartsFromResponse(resp);
      return {
        text: extracted.text.trim(),
        thoughtText: extracted.thoughtText.trim(),
        webSources: extractGroundingSources(resp),
      };
    }

    const chat = ai.chats.create({
      model: activeModel,
      history: normalizedHistory,
      config: callConfig,
    });
    const resp = await withTimeout(chat.sendMessage({ message: promptBody }), timeoutMs);
    const extracted = extractPartsFromResponse(resp);
    return {
      text: extracted.text.trim(),
      thoughtText: extracted.thoughtText.trim(),
      webSources: extractGroundingSources(resp),
    };
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

    const runPrimary = async (timeoutMs = 15_000) => {
      try {
        const primaryRes = await executeGeminiCall(canTrySearchTool, undefined, timeoutMs);
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
          const noSearchRes = await executeGeminiCall(false, undefined, timeoutMs);
          return { ...noSearchRes, usedModel: displayLabel };
        }
        throw err;
      }
    };

    const runFastLite = async (timeoutMs = 11_000) => {
      const fastRes = await executeGeminiCall(
        false,
        { sdkModelName: 'gemini-3.1-flash-lite' },
        timeoutMs
      );
      return { ...fastRes, usedModel: 'gemini-3.1-flash-lite' };
    };

    // Runs a list of staggered model attempts in parallel and resolves with the first clean reply,
    // preventing silent upstream socket stalls from hanging for 20+ seconds and returning 503.
    const raceStaggeredAttempts = (
      attempts: Array<{
        delayMs: number;
        fromHedge: boolean;
        run: () => Promise<{
          text: string;
          thoughtText: string;
          webSources: Array<{ title: string; url: string; snippet: string }>;
          usedModel: string;
        }>;
      }>
    ) =>
      new Promise<{
        text: string;
        thoughtText: string;
        webSources: Array<{ title: string; url: string; snippet: string }>;
        usedModel: string;
      }>((resolve, reject) => {
        let settled = false;
        let launched = 0;
        let completed = 0;
        let lastErr: unknown = null;
        const timers: ReturnType<typeof setTimeout>[] = [];

        const clearAllTimers = () => {
          for (const t of timers) clearTimeout(t);
        };

        const launchAt = (idx: number) => {
          if (settled || idx >= attempts.length) return;
          const attempt = attempts[idx];
          launched += 1;
          attempt
            .run()
            .then((res) => {
              if (settled) return;
              settled = true;
              clearAllTimers();
              if (attempt.fromHedge) {
                primaryModelHighDemandUntil = Date.now() + 5 * 60_000;
              } else {
                primaryModelHighDemandUntil = 0;
              }
              geminiCircuitBreaker.recordSuccess();
              resolvedLabel = res.usedModel;
              resolve(res);
            })
            .catch((err) => {
              lastErr = err;
              completed += 1;
              const kind = classifyGeminiError(err);
              // Abort immediately on non-retryable auth/billing/disabled errors
              if (
                !settled &&
                (kind === 'auth' || kind === 'service_disabled' || kind === 'billing_required')
              ) {
                settled = true;
                clearAllTimers();
                geminiCircuitBreaker.recordFailure(
                  kind,
                  Date.now(),
                  String((err as { message?: string })?.message ?? err ?? '')
                );
                reject(err);
                return;
              }
              // If the first attempt failed transiently, immediately kick off the next unlaunched fallback
              if (!settled && launched < attempts.length) {
                const nextIdx = launched;
                if (timers[nextIdx]) clearTimeout(timers[nextIdx]);
                launchAt(nextIdx);
                return;
              }
              if (!settled && completed >= attempts.length) {
                settled = true;
                clearAllTimers();
                geminiCircuitBreaker.recordFailure(
                  classifyGeminiError(lastErr),
                  Date.now(),
                  String((lastErr as { message?: string })?.message ?? lastErr ?? '')
                );
                reject(lastErr);
              }
            });
        };

        attempts.forEach((attempt, idx) => {
          if (attempt.delayMs <= 0) {
            launchAt(idx);
          } else {
            timers[idx] = setTimeout(() => {
              if (!settled && launched <= idx) {
                launchAt(idx);
              }
            }, attempt.delayMs);
          }
        });
      });

    let result: {
      text: string;
      thoughtText: string;
      webSources: Array<{ title: string; url: string; snippet: string }>;
      usedModel: string;
    };

    if (skipDirectlyToFastModel || sdkModelName === 'gemini-3.1-flash-lite') {
      // Fast-lite primary with 5.5s fresh-socket retry hedge + 10s primary fallback
      result = await raceStaggeredAttempts([
        { delayMs: 0, fromHedge: skipDirectlyToFastModel, run: () => runFastLite(10_000) },
        { delayMs: 5_500, fromHedge: skipDirectlyToFastModel, run: () => runFastLite(12_000) },
        { delayMs: 10_000, fromHedge: false, run: () => runPrimary(18_000) },
      ]);
    } else if (sdkModelName === 'gemini-4-hydrogen' && !params.imageBase64) {
      // Gemini 4 Hydrogen primary (with MEDIUM thinking) + 6.5s flash-lite hedge + 11.5s retry hedge
      result = await raceStaggeredAttempts([
        { delayMs: 0, fromHedge: false, run: () => runPrimary(18_000) },
        { delayMs: 6_500, fromHedge: true, run: () => runFastLite(11_000) },
        { delayMs: 11_500, fromHedge: true, run: () => runFastLite(12_000) },
      ]);
    } else {
      result = await raceStaggeredAttempts([
        { delayMs: 0, fromHedge: false, run: () => runPrimary(24_000) },
        { delayMs: 12_000, fromHedge: true, run: () => runFastLite(14_000) },
      ]);
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

    return {
      ok: true,
      text: result.text,
      thoughtText: result.thoughtText,
      displayLabel: resolvedLabel,
      webSources: result.webSources,
    };
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
 * Streams real-time Gemini reasoning thoughts (`includeThoughts: true`) and answer tokens
 * via `generateContentStream` / `chat.sendMessageStream` for a live, ChatGPT-like experience.
 * Automatically fails over to `gemini-3.1-flash-lite` if the primary stream fails before emitting output.
 */
export async function streamGeminiTutorReply(
  params: {
    question: string;
    grade: GradeLevel;
    board: CurriculumBoard;
    requestedModel: string;
    history: HistoryTurn[];
    enableWebSearch: boolean;
    imageBase64?: string;
    imageMimeType: string;
    resumeContext: ResumeContext | null;
    verifiedMathReference?: string | null;
    signal?: AbortSignal;
  },
  callbacks: {
    onThought?: (delta: string) => void;
    onToken?: (delta: string) => void;
  }
): Promise<GeminiTutorResult> {
  const { sdkModelName, thinkingLevel, displayLabel, requiresPaidKey } = resolveGeminiModelConfig(
    params.requestedModel
  );

  if (getGeminiKeyDiagnostic() === 'missing') {
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

  const mathContext = buildMathJsPipelineContext(
    params.resumeContext?.originalQuestion || params.question
  );

  const adaptivePlan = computeAdaptiveThinkingBudget({
    question: params.resumeContext?.originalQuestion || params.question,
    history: params.history,
    hasImage: Boolean(params.imageBase64),
    isResume: Boolean(params.resumeContext?.partialContent),
    requestedModel: params.requestedModel,
    hasVerifiedMathFact: Boolean(mathContext.mathJsFact),
  });

  const systemInstruction = buildTutorSystemInstruction(
    params.grade,
    params.board,
    params.resumeContext,
    { compact: adaptivePlan.compactSystemPrompt }
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
        mathContext.mathJsFact ? `[Internal arithmetic verification — do not mention: ${mathContext.mathJsFact}]` : '',
        params.verifiedMathReference
          ? `[Internal arithmetic verification — do not mention in thoughts or reply: ${params.verifiedMathReference}]`
          : '',
        `</student_query>`,
      ]
        .filter(Boolean)
        .join('\n');

  const normalizedHistory = normalizeHistoryWindow(
    params.history,
    adaptivePlan.maxHistoryTurns,
    adaptivePlan.maxHistoryCharsPerTurn
  );

  const canTrySearchTool = shouldAttachGoogleSearchTool(params.question, params.enableWebSearch);
  const effectiveThinking = adaptivePlan.thinkingLevel ?? thinkingLevel;

  const runStreamAttempt = async (
    activeModel: ResolvedGeminiModel['sdkModelName'],
    activeThinking: ThinkingLevel | undefined,
    useSearchTool: boolean
  ): Promise<{
    text: string;
    thoughtText: string;
    webSources: Array<{ title: string; url: string; snippet: string }>;
    usedModel: string;
  }> => {
    const callConfig = {
      systemInstruction,
      maxOutputTokens: adaptivePlan.maxOutputTokens,
      ...(useSearchTool ? { tools: [{ googleSearch: {} }] } : {}),
      ...(activeThinking
        ? {
            thinkingConfig: {
              thinkingLevel: activeThinking,
              includeThoughts: adaptivePlan.includeThoughts,
            },
          }
        : {}),
    };

    const handshakeTimeoutMs =
      activeModel === 'gemini-4-hydrogen' && !params.imageBase64
        ? adaptivePlan.tier === 'turbo'
          ? 12_000
          : 7_500
        : 12_000;

    let streamIter: AsyncIterable<unknown>;
    if (params.imageBase64) {
      const recentContextText =
        normalizedHistory.length > 0
          ? `Recent conversation context:\n${normalizedHistory
              .slice(-4)
              .map((h) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.parts[0].text.slice(0, 800)}`)
              .join('\n')}\n\nCurrent question about the attached image:\n`
          : '';
      streamIter = await withTimeout(
        ai.models.generateContentStream({
          model: activeModel,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: params.imageMimeType,
                  data: params.imageBase64,
                },
              },
              { text: `${recentContextText}${promptBody}` },
            ],
          },
          config: callConfig,
        }),
        18_000
      );
    } else if (normalizedHistory.length === 0) {
      streamIter = await withTimeout(
        ai.models.generateContentStream({
          model: activeModel,
          contents: promptBody,
          config: callConfig,
        }),
        handshakeTimeoutMs
      );
    } else {
      const chat = ai.chats.create({
        model: activeModel,
        history: normalizedHistory,
        config: callConfig,
      });
      streamIter = await withTimeout(chat.sendMessageStream({ message: promptBody }), handshakeTimeoutMs);
    }

    let fullText = '';
    let fullThought = '';
    const webSourcesMap = new Map<string, { title: string; url: string; snippet: string }>();

    for await (const chunk of streamIter) {
      if (params.signal?.aborted) {
        break;
      }
      const c = chunk as {
        text?: string;
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          groundingMetadata?: {
            groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
          };
        }>;
      };

      const parts = c.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        for (const part of parts) {
          if (!part || typeof part.text !== 'string' || !part.text) continue;
          if (part.thought) {
            fullThought += part.text;
            callbacks.onThought?.(part.text);
          } else {
            fullText += part.text;
            callbacks.onToken?.(part.text);
          }
        }
      } else if (typeof c.text === 'string' && c.text) {
        fullText += c.text;
        callbacks.onToken?.(c.text);
      }

      const groundingChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const ch of groundingChunks) {
        const uri = ch?.web?.uri;
        if (!uri || webSourcesMap.has(uri)) continue;
        if (!uri.startsWith('https://') && !uri.startsWith('http://')) continue;
        if (webSourcesMap.size >= 4) break;
        webSourcesMap.set(uri, {
          title: (ch.web?.title || 'Verified Web Reference').slice(0, 140),
          url: uri,
          snippet: 'Verified source retrieved via Google Search grounding.',
        });
      }
    }

    return {
      text: fullText.trim(),
      thoughtText: fullThought.trim(),
      webSources: Array.from(webSourcesMap.values()),
      usedModel: activeModel,
    };
  };

  let emittedAny = false;
  const originalOnThought = callbacks.onThought;
  const originalOnToken = callbacks.onToken;
  callbacks.onThought = (d: string) => {
    emittedAny = true;
    originalOnThought?.(d);
  };
  callbacks.onToken = (d: string) => {
    emittedAny = true;
    originalOnToken?.(d);
  };

  try {
    let streamed: {
      text: string;
      thoughtText: string;
      webSources: Array<{ title: string; url: string; snippet: string }>;
      usedModel: string;
    };

    const skipCongestedPrimary =
      sdkModelName === 'gemini-4-hydrogen' &&
      !params.imageBase64 &&
      Date.now() < primaryModelHighDemandUntil;

    const fallbackThinking = effectiveThinking ?? ThinkingLevel.MEDIUM;

    try {
      if (skipCongestedPrimary) {
        streamed = await runStreamAttempt('gemini-3.1-flash-lite', fallbackThinking, false);
        geminiCircuitBreaker.recordSuccess();
      } else {
        streamed = await runStreamAttempt(sdkModelName, effectiveThinking, canTrySearchTool);
        primaryModelHighDemandUntil = 0;
        geminiCircuitBreaker.recordSuccess();
      }
    } catch (primaryErr) {
      const kind = classifyGeminiError(primaryErr);
      console.warn(
        `[streamGeminiTutorReply] Primary model ${sdkModelName} failed (${kind}):`,
        String((primaryErr as { message?: string })?.message ?? primaryErr ?? '').slice(0, 220)
      );
      if (
        params.signal?.aborted ||
        emittedAny ||
        kind === 'auth' ||
        kind === 'service_disabled' ||
        kind === 'billing_required'
      ) {
        throw primaryErr;
      }

      if (sdkModelName === 'gemini-4-hydrogen' && (kind === 'transient' || kind === 'quota')) {
        primaryModelHighDemandUntil = Date.now() + 3 * 60_000;
      }

      // Retry without googleSearch grounding first if grounding caused failure
      if (canTrySearchTool && !skipCongestedPrimary) {
        if (kind === 'quota') {
          searchGroundingCooldownUntil = Date.now() + 5 * 60_000;
        }
        try {
          streamed = await runStreamAttempt(sdkModelName, effectiveThinking, false);
          geminiCircuitBreaker.recordSuccess();
        } catch {
          try {
            streamed = await runStreamAttempt('gemini-3.1-flash-lite', fallbackThinking, false);
            geminiCircuitBreaker.recordSuccess();
          } catch {
            streamed = await runStreamAttempt('gemini-3.1-flash-lite', undefined, false);
            geminiCircuitBreaker.recordSuccess();
          }
        }
      } else if (sdkModelName !== 'gemini-3.1-flash-lite' && !skipCongestedPrimary) {
        // Keep real Gemini thinking + thought summaries active on flash-lite failover
        try {
          streamed = await runStreamAttempt('gemini-3.1-flash-lite', fallbackThinking, false);
          geminiCircuitBreaker.recordSuccess();
        } catch {
          streamed = await runStreamAttempt('gemini-3.1-flash-lite', undefined, false);
          geminiCircuitBreaker.recordSuccess();
        }
      } else if (thinkingLevel || skipCongestedPrimary) {
        streamed = await runStreamAttempt('gemini-3.1-flash-lite', undefined, false);
        geminiCircuitBreaker.recordSuccess();
      } else {
        throw primaryErr;
      }
    }

    callbacks.onThought = originalOnThought;
    callbacks.onToken = originalOnToken;

    if (!streamed.text && !params.signal?.aborted) {
      return {
        ok: false,
        errorKind: 'transient',
        status: 502,
        code: 'GEMINI_EMPTY_RESPONSE',
        userMessage: `Gemini (${streamed.usedModel}) returned an empty response. Please try asking again.`,
        retryable: true,
        displayLabel: streamed.usedModel,
      };
    }

    return {
      ok: true,
      text: streamed.text,
      thoughtText: streamed.thoughtText,
      displayLabel: streamed.usedModel,
      webSources: streamed.webSources,
    };
  } catch (err) {
    callbacks.onThought = originalOnThought;
    callbacks.onToken = originalOnToken;
    const kind = classifyGeminiError(err);
    geminiCircuitBreaker.recordFailure(
      kind,
      Date.now(),
      String((err as { message?: string })?.message ?? err ?? '')
    );

    if (kind === 'billing_required') {
      return {
        ok: false,
        errorKind: 'billing_required',
        status: 403,
        code: 'BILLING_REQUIRED',
        userMessage: `This model (${displayLabel}) or project requires billing to be enabled. Switch to gemini-4-hydrogen (free tier) or enable billing on your project.`,
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
    if (kind === 'quota') {
      return {
        ok: false,
        errorKind: 'quota',
        status: 429,
        code: 'GEMINI_QUOTA_EXCEEDED',
        userMessage: requiresPaidKey
          ? `${displayLabel} requires a billing-enabled API key or exceeded its quota (429). Switch to gemini-4-hydrogen (free tier).`
          : 'Gemini API rate limit reached (429). Please wait a few seconds and retry.',
        retryable: !requiresPaidKey,
        displayLabel,
      };
    }
    return {
      ok: false,
      errorKind: kind === 'transient' ? 'transient' : 'fatal',
      status: kind === 'transient' ? 503 : 502,
      code: kind === 'transient' ? 'GEMINI_UNAVAILABLE' : 'GEMINI_REQUEST_FAILED',
      userMessage: `Gemini (${displayLabel}) is temporarily unavailable. Please tap Retry in a moment.`,
      retryable: true,
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
