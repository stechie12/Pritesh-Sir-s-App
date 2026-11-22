import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  LruCache,
  apiEndpointMetrics,
  createRateLimiter,
  extractClientIp,
  redactPii,
  requestContextMiddleware,
  securityHeadersMiddleware,
  validateDoubtRequest,
  validateLessonPlanRequest,
  validateMathVerifyRequest,
  validateStudyPlannerRequest,
  validateTtsRequest,
} from './server/security.ts';
import {
  apiJsonCompressionMiddleware,
  compressBuffer,
  createStaticCompressionMiddleware,
  selectCompressionEncoding,
} from './server/compression.ts';
import { contextSummarizerMiddleware } from './server/contextSummarizer.ts';

type MathEngineModule = typeof import('./server/mathEngine.ts');
let mathEnginePromise: Promise<MathEngineModule> | null = null;
function getMathEngine(): Promise<MathEngineModule> {
  if (!mathEnginePromise) {
    mathEnginePromise = import('./server/mathEngine.ts');
  }
  return mathEnginePromise;
}
import { getWebSearchCacheStats } from './server/webSearch.ts';
import {
  geminiCircuitBreaker,
  generateAdaptiveLessonPlan,
  generateGeminiTutorReply,
  generateStudyPlannerCoachNote,
  getGeminiKeyDiagnostic,
  isGeminiConfigured,
  resolveGeminiModelConfig,
  streamGeminiTutorReply,
  synthesizeTutorSpeech,
} from './server/aiService.ts';
import { attachGeminiLiveWebSocket } from './server/liveVoice.ts';
import {
  detectInlineVisualizerSpec,
  parseAiVisualizerDirective,
} from './src/utils/visualizerDetector.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sendApiError(
  res: Response,
  status: number,
  code: string,
  error: string,
  extra: Record<string, unknown> = {}
) {
  res.status(status).json({
    error,
    code,
    requestId: res.locals.requestId || null,
    ...extra,
  });
}

export function createBackendApp(options: { getActiveLiveConnections?: () => number } = {}) {
  const app = express();
  const startedAtMs = Date.now();
  const responseCache = new LruCache<Record<string, unknown>>(250, 30 * 60 * 1000);
  type LiveTutorOutcome =
    | { ok: true; payload: Record<string, unknown> }
    | {
        ok: false;
        status: number;
        code: string;
        error: string;
        retryable: boolean;
        modelUsed: string;
      };
  const inFlightRequests = new Map<string, Promise<LiveTutorOutcome>>();
  const apiRateLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000, maxBuckets: 5000 });
  const aiBurstLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000, maxBuckets: 5000 });

  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(requestContextMiddleware);
  app.use('/api', apiJsonCompressionMiddleware);

  // Clean CORS preflight guard for API routes
  app.options('/api/*', (_req, res) => {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(204).end();
  });

  // API request timeout guard to prevent hung connections (45s for AI tutor, 30s for other API routes)
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') {
      next();
      return;
    }
    const timeoutMs = req.path === '/tutor/doubt' ? 45_000 : 30_000;
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        sendApiError(
          res,
          504,
          'REQUEST_TIMEOUT',
          'The request took too long to complete. Please retry in a moment.',
          { retryable: true }
        );
      }
    }, timeoutMs);
    timeoutId.unref();
    res.on('finish', () => clearTimeout(timeoutId));
    res.on('close', () => clearTimeout(timeoutId));
    next();
  });

  app.use(express.json({ limit: '2500kb' }));

  // Malformed JSON / Payload Too Large error handler (always returns clean JSON)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!err) {
      next();
      return;
    }
    const errObj = err as { type?: string; status?: number; statusCode?: number };
    if (errObj.type === 'entity.too.large' || errObj.status === 413) {
      sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds the 2.5MB limit.');
      return;
    }
    if (err instanceof SyntaxError && errObj.status === 400) {
      sendApiError(res, 400, 'MALFORMED_JSON', 'Malformed JSON in request body.');
      return;
    }
    if (req.path.startsWith('/api/')) {
      console.error('Unhandled API middleware error:', redactPii(String(err)));
      sendApiError(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
      return;
    }
    next(err);
  });

  // Memory-bounded API Rate Limiter (exempting health checks)
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') {
      next();
      return;
    }
    const ip = extractClientIp(req);
    const result = apiRateLimiter.check(ip);
    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      sendApiError(
        res,
        429,
        'RATE_LIMITED',
        'Rate limit exceeded. Please wait a moment before sending more requests.',
        { retryAfterSec: result.retryAfterSec, retryable: true }
      );
      return;
    }
    next();
  });

  // Stricter burst guard for high-compute AI endpoints
  const enforceAiBurstLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = extractClientIp(req);
    const burst = aiBurstLimiter.check(ip);
    if (!burst.allowed) {
      res.setHeader('Retry-After', String(burst.retryAfterSec));
      sendApiError(
        res,
        429,
        'AI_BURST_LIMITED',
        'You are asking questions very quickly. Pause a few seconds and try again.',
        { retryAfterSec: burst.retryAfterSec, retryable: true }
      );
      return;
    }
    next();
  };

  // GET /api/health — Readiness, memory, caches, rate-limiter, endpoint metrics, and Gemini circuit status
  app.get('/api/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'pritesh-sirs-maths-backend',
      uptimeSec: Math.round((Date.now() - startedAtMs) / 1000),
      memoryMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      },
      cache: responseCache.getStats(),
      webSearchCache: getWebSearchCacheStats(),
      rateLimiterBuckets: apiRateLimiter.size(),
      aiBurstBuckets: aiBurstLimiter.size(),
      endpointMetrics: apiEndpointMetrics.snapshot(),
      liveVoiceConnections: options.getActiveLiveConnections?.() ?? 0,
      gemini: {
        configured: isGeminiConfigured(),
        keyStatus: getGeminiKeyDiagnostic(),
        defaultModel: 'gemini-4-hydrogen',
        circuitBreaker: geminiCircuitBreaker.getState(),
      },
    });
  });

  // POST /api/math/verify — Deterministic sandboxed expression evaluator & equivalence checker
  app.post('/api/math/verify', async (req, res) => {
    const validated = validateMathVerifyRequest(req.body);
    if (!validated.ok) {
      sendApiError(res, validated.status, 'INVALID_EXPRESSION', validated.error);
      return;
    }
    const { verifyMathExpression } = await getMathEngine();
    const result = verifyMathExpression(validated.data.expression, validated.data.expected);
    res.json({
      ...result,
      requestId: res.locals.requestId || null,
    });
  });

  // POST /api/tutor/doubt — Validated, context-summarized, cached, resilient AI + sandboxed mathjs solver
  app.post('/api/tutor/doubt', enforceAiBurstLimit, contextSummarizerMiddleware, async (req, res) => {
    try {
      const validated = validateDoubtRequest(req.body);
      if (!validated.ok) {
        sendApiError(res, validated.status, 'VALIDATION_ERROR', validated.error);
        return;
      }

      const {
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
      } = validated.data;

      const {
        analyzeStudentIntent,
        buildSmartTutorResponse,
        sliceResumedReply,
      } = await getMathEngine();
      const isResumeRequest = Boolean(resumeContext);
      const intentTarget = resumeContext ? resumeContext.originalQuestion : question;
      const intent = analyzeStudentIntent(intentTarget, grade, board);
      const activeGrade = intent.detectedGrade;
      const activeBoard = intent.detectedBoard;
      const { sdkModelName, displayLabel } = resolveGeminiModelConfig(model);

      const isCacheable = !isResumeRequest && !imageBase64 && history.length === 0;
      const cacheKey = `${activeBoard}:${activeGrade}:${sdkModelName}:web=${enableWebSearch ? 1 : 0}:${question.toLowerCase()}`;

      if (isCacheable) {
        const cached = responseCache.get(cacheKey);
        if (cached) {
          res.json({ ...cached, modelUsed: displayLabel, cached: true });
          return;
        }
      }

      const smartQuery = resumeContext ? resumeContext.originalQuestion : question;
      const rawSmartResponse = buildSmartTutorResponse(
        smartQuery,
        activeGrade,
        activeBoard,
        topic,
        history
      );

      const needsLiveLLM =
        rawSmartResponse.chatReply === '__NEEDS_LIVE_LLM__' ||
        Boolean(rawSmartResponse.chatReply?.startsWith('__NEEDS_LIVE_LLM__'));

      const verifiedMathReference =
        !needsLiveLLM && rawSmartResponse.responseType === 'math' && rawSmartResponse.finalAnswer
          ? `${rawSmartResponse.conceptTitle} | Verified exact answer: ${rawSmartResponse.finalAnswer}`
          : null;

      // Only short-circuit with deterministic offline templates when no live Gemini API key is configured
      if (!needsLiveLLM && !isGeminiConfigured()) {
        let resolvedChatReply = rawSmartResponse.chatReply;
        if (
          isResumeRequest &&
          resumeContext?.partialContent &&
          rawSmartResponse.responseType === 'chat' &&
          typeof rawSmartResponse.chatReply === 'string'
        ) {
          resolvedChatReply = sliceResumedReply(
            rawSmartResponse.chatReply,
            resumeContext.partialContent
          );
        }

        const responsePayload: Record<string, unknown> = {
          ...rawSmartResponse,
          ...(resolvedChatReply !== undefined ? { chatReply: resolvedChatReply } : {}),
          visualizerSpec:
            rawSmartResponse.responseType === 'math'
              ? detectInlineVisualizerSpec({ question })
              : null,
          suggestedPrompts: [],
          resumed: isResumeRequest,
          ...intent,
          modelUsed: displayLabel,
          thinkingTrace:
            rawSmartResponse.responseType === 'math'
              ? [
                  isResumeRequest
                    ? `Resumed halted derivation for "${smartQuery.slice(0, 80)}"`
                    : `Parsed mathematical expression in "${question.slice(0, 80)}"`,
                  `Applied ${rawSmartResponse.conceptTitle}`,
                  `Verified exact result: ${rawSmartResponse.finalAnswer}`,
                ]
              : [
                  isResumeRequest
                    ? `Resumed interrupted explanation for "${smartQuery.slice(0, 80)}"`
                    : `Parsed user message: "${question.slice(0, 80)}"`,
                  `Calibrated context for Standard ${activeGrade} (${activeBoard})`,
                ],
        };

        if (isCacheable) {
          responseCache.set(cacheKey, responsePayload);
        }
        res.json(responsePayload);
        return;
      }

      const computeLiveResponse = async (): Promise<LiveTutorOutcome> => {
        const geminiResult = await generateGeminiTutorReply({
          question,
          grade: activeGrade,
          board: activeBoard,
          requestedModel: model,
          history,
          enableWebSearch,
          imageBase64,
          imageMimeType,
          resumeContext,
          verifiedMathReference,
        });

        if (geminiResult.ok) {
          const parsedSim = parseAiVisualizerDirective(geminiResult.text);
          return {
            ok: true,
            payload: {
              responseType: 'chat',
              chatReply: parsedSim.cleanText,
              thoughtText: geminiResult.thoughtText || undefined,
              visualizerSpec: parsedSim.spec,
              suggestedPrompts: [],
              conceptTitle: 'AI Assistant',
              prerequisiteRecap: '',
              steps: [],
              finalAnswer: '',
              examTip: '',
              resumed: isResumeRequest,
              ...intent,
              modelUsed: geminiResult.displayLabel,
              webSources: geminiResult.webSources || [],
              thinkingTrace: geminiResult.thoughtText
                ? undefined
                : [
                    isResumeRequest
                      ? `Resumed interrupted explanation for "${smartQuery.slice(0, 60)}"`
                      : `Reasoned with ${geminiResult.displayLabel}`,
                    ...(parsedSim.spec
                      ? [`Summoned interactive ${parsedSim.spec.kind} simulation`]
                      : []),
                  ],
            },
          };
        }

        return {
          ok: false,
          status: geminiResult.status,
          code: geminiResult.code,
          error: geminiResult.userMessage,
          retryable: geminiResult.retryable,
          modelUsed: geminiResult.displayLabel,
        };
      };

      let outcome: LiveTutorOutcome;
      if (isCacheable) {
        let inflight = inFlightRequests.get(cacheKey);
        if (!inflight) {
          inflight = computeLiveResponse().finally(() => {
            inFlightRequests.delete(cacheKey);
          });
          inFlightRequests.set(cacheKey, inflight);
        }
        outcome = await inflight;
        if (outcome.ok) {
          responseCache.set(cacheKey, outcome.payload);
        }
      } else {
        outcome = await computeLiveResponse();
      }

      if (!res.headersSent) {
        if (outcome.ok) {
          res.json(outcome.payload);
        } else {
          sendApiError(res, outcome.status, outcome.code, outcome.error, {
            retryable: outcome.retryable,
            modelUsed: outcome.modelUsed,
          });
        }
      }
    } catch (err) {
      console.error('Chat endpoint error:', redactPii(String(err)));
      if (!res.headersSent) {
        sendApiError(
          res,
          503,
          'TUTOR_TEMPORARY_ERROR',
          'The tutor service encountered a temporary error. Please retry in a moment.',
          { retryable: true }
        );
      }
    }
  });

  // POST /api/tutor/doubt/stream — Real-time Server-Sent Events streaming of Gemini thoughts + tokens
  app.post('/api/tutor/doubt/stream', enforceAiBurstLimit, contextSummarizerMiddleware, async (req, res) => {
    const validated = validateDoubtRequest(req.body);
    if (!validated.ok) {
      sendApiError(res, validated.status, 'VALIDATION_ERROR', validated.error);
      return;
    }

    const {
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
    } = validated.data;

    const { analyzeStudentIntent, buildSmartTutorResponse } = await getMathEngine();
    const intentTarget = resumeContext?.originalQuestion || question;
    const intent = analyzeStudentIntent(intentTarget, grade, board);
    const activeGrade = intent.detectedGrade;
    const activeBoard = intent.detectedBoard;
    const { displayLabel } = resolveGeminiModelConfig(model);

    const smartQuery = resumeContext ? resumeContext.originalQuestion : question;
    const rawSmartResponse = buildSmartTutorResponse(
      smartQuery,
      activeGrade,
      activeBoard,
      topic,
      history
    );
    const needsLiveLLM =
      rawSmartResponse.chatReply === '__NEEDS_LIVE_LLM__' ||
      Boolean(rawSmartResponse.chatReply?.startsWith('__NEEDS_LIVE_LLM__'));

    const verifiedMathReference =
      !needsLiveLLM && rawSmartResponse.responseType === 'math' && rawSmartResponse.finalAnswer
        ? `${rawSmartResponse.conceptTitle} | Verified exact answer: ${rawSmartResponse.finalAnswer}`
        : null;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientClosed = false;
    const streamAbort = new AbortController();
    req.on('close', () => {
      clientClosed = true;
      streamAbort.abort();
    });

    const sendEvent = (payload: Record<string, unknown>) => {
      if (clientClosed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      sendEvent({
        type: 'meta',
        modelUsed: displayLabel,
        detectedGrade: activeGrade,
        detectedBoard: activeBoard,
        summonTool: intent.summonTool ?? null,
      });

      // Offline fallback only when no Gemini API key is configured
      if (!isGeminiConfigured()) {
        if (!needsLiveLLM) {
          const offlineText =
            rawSmartResponse.responseType === 'math'
              ? [
                  `**${rawSmartResponse.conceptTitle}**`,
                  rawSmartResponse.prerequisiteRecap,
                  ...rawSmartResponse.steps,
                  `**Final Answer:** ${rawSmartResponse.finalAnswer}`,
                  rawSmartResponse.examTip ? `> ${rawSmartResponse.examTip}` : '',
                ]
                  .filter(Boolean)
                  .join('\n\n')
              : rawSmartResponse.chatReply || '';
          const offlineSpec =
            rawSmartResponse.responseType === 'math'
              ? detectInlineVisualizerSpec({ question })
              : null;
          sendEvent({ type: 'token', delta: offlineText });
          sendEvent({
            type: 'done',
            cleanText: offlineText,
            thoughtText: '',
            visualizerSpec: offlineSpec,
            webSources: [],
            modelUsed: displayLabel,
            detectedGrade: activeGrade,
            detectedBoard: activeBoard,
            summonTool: intent.summonTool ?? null,
          });
        } else {
          sendEvent({
            type: 'error',
            status: 401,
            code: 'GEMINI_KEY_MISSING',
            error:
              'No Gemini API key is configured. Open Settings > Secrets in AI Studio and set GEMINI_API_KEY.',
            retryable: false,
            modelUsed: displayLabel,
          });
        }
        return;
      }

      const geminiResult = await streamGeminiTutorReply(
        {
          question,
          grade: activeGrade,
          board: activeBoard,
          requestedModel: model,
          history,
          enableWebSearch,
          imageBase64,
          imageMimeType,
          resumeContext,
          verifiedMathReference,
          signal: streamAbort.signal,
        },
        {
          onThought: (delta) => sendEvent({ type: 'thought', delta }),
          onToken: (delta) => sendEvent({ type: 'token', delta }),
        }
      );

      if (clientClosed) return;

      if (geminiResult.ok) {
        const parsedSim = parseAiVisualizerDirective(geminiResult.text);
        sendEvent({
          type: 'done',
          cleanText: parsedSim.cleanText,
          thoughtText: geminiResult.thoughtText || '',
          visualizerSpec: parsedSim.spec,
          webSources: geminiResult.webSources || [],
          modelUsed: geminiResult.displayLabel,
          detectedGrade: activeGrade,
          detectedBoard: activeBoard,
          summonTool: intent.summonTool ?? null,
        });
      } else {
        sendEvent({
          type: 'error',
          status: geminiResult.status,
          code: geminiResult.code,
          error: geminiResult.userMessage,
          retryable: geminiResult.retryable,
          modelUsed: geminiResult.displayLabel,
        });
      }
    } catch (err) {
      if (!clientClosed) {
        console.error('Stream endpoint error:', redactPii(String(err)));
        sendEvent({
          type: 'error',
          status: 503,
          code: 'TUTOR_STREAM_ERROR',
          error: 'The live stream encountered a temporary error. Please retry.',
          retryable: true,
          modelUsed: displayLabel,
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  // POST /api/tutor/tts — Validated Gemini TTS with Web Speech fallback signal
  app.post('/api/tutor/tts', enforceAiBurstLimit, async (req, res) => {
    const validated = validateTtsRequest(req.body);
    if (!validated.ok) {
      sendApiError(res, validated.status, 'VALIDATION_ERROR', validated.error);
      return;
    }
    const result = await synthesizeTutorSpeech(validated.data.text);
    res.json(result);
  });

  // POST /api/tutor/lesson-plan — Validated structured Gemini + deterministic fallback lesson planner
  app.post('/api/tutor/lesson-plan', async (req, res) => {
    const validated = validateLessonPlanRequest(req.body);
    if (!validated.ok) {
      sendApiError(res, validated.status, 'VALIDATION_ERROR', validated.error);
      return;
    }
    const plan = await generateAdaptiveLessonPlan(validated.data);
    res.json(plan);
  });

  // POST /api/tutor/study-planner — Validated adaptive study coaching note
  app.post('/api/tutor/study-planner', async (req, res) => {
    const validated = validateStudyPlannerRequest(req.body);
    if (!validated.ok) {
      sendApiError(res, validated.status, 'VALIDATION_ERROR', validated.error);
      return;
    }
    const aiCoachNote = await generateStudyPlannerCoachNote(validated.data);
    res.json({ aiCoachNote });
  });

  // Unknown API routes return structured JSON 404 instead of falling through to SPA HTML
  app.all('/api/*', (req, res) => {
    sendApiError(res, 404, 'NOT_FOUND', `API route not found: ${req.method} ${req.path}`);
  });

  return app;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  let liveVoiceBridge: { closeAll: () => void; getActiveConnections: () => number } | null = null;

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', redactPii(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', redactPii(err.stack || err.message));
  });

  const app = createBackendApp({
    getActiveLiveConnections: () => liveVoiceBridge?.getActiveConnections() ?? 0,
  });

  const httpServer = http.createServer(app);
  liveVoiceBridge = attachGeminiLiveWebSocket(httpServer);

  const distPath = path.join(__dirname, 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const hasBuiltDist = fs.existsSync(distIndexPath);
  const isDevLifecycle =
    process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';
  const isExplicitProd =
    process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
  const serveBuiltDist =
    hasBuiltDist && (isExplicitProd || (!isDevLifecycle && Boolean(process.env.K_SERVICE)));

  if (serveBuiltDist) {
    // Keep a last-known-good in-memory copy of dist/index.html (refreshed whenever mtime changes)
    // so concurrent `vite build` runs that temporarily empty dist/ never throw ENOENT errors.
    let cachedIndexHtml: Buffer | null = null;
    let cachedIndexMtimeMs = -1;
    try {
      const stat = fs.statSync(distIndexPath);
      cachedIndexHtml = fs.readFileSync(distIndexPath);
      cachedIndexMtimeMs = stat.mtimeMs;
    } catch {
      cachedIndexHtml = null;
    }

    const readIndexHtmlSafely = (): Buffer | null => {
      try {
        const stat = fs.statSync(distIndexPath);
        if (!cachedIndexHtml || stat.mtimeMs !== cachedIndexMtimeMs) {
          cachedIndexHtml = fs.readFileSync(distIndexPath);
          cachedIndexMtimeMs = stat.mtimeMs;
        }
        return cachedIndexHtml;
      } catch {
        // File may be momentarily absent while vite build recreates dist/
        return cachedIndexHtml;
      }
    };

    app.use(createStaticCompressionMiddleware(distPath));
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    const STATIC_ASSET_EXT_RE = /\.(?:js|mjs|cjs|css|map|woff2?|ttf|eot|png|jpe?g|gif|svg|webp|ico|wasm)$/i;
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/') || STATIC_ASSET_EXT_RE.test(req.path)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const htmlBuffer = readIndexHtmlSafely();
      if (!htmlBuffer) {
        res
          .status(503)
          .setHeader('Retry-After', '2')
          .type('text/plain')
          .send('Application build is refreshing. Please retry in a moment.');
        return;
      }

      const encoding = selectCompressionEncoding(req.headers['accept-encoding']);
      if (encoding) {
        try {
          const compressed = compressBuffer(htmlBuffer, encoding);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Encoding', encoding);
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', String(compressed.length));
          res.status(200).end(compressed);
          return;
        } catch {
          // Fall back to uncompressed buffer below
        }
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', String(htmlBuffer.length));
      res.status(200).end(htmlBuffer);
    });
  } else {
    // In vite-dev mode, if a browser previously installed a production Service Worker at /sw.js,
    // serve a self-unregistering cleanup script instead of letting Vite's SPA fallback return text/html
    // (which causes browsers to keep running the stale SW with outdated chunk hashes).
    app.get('/sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).send(
        `self.addEventListener('install', () => self.skipWaiting());\n` +
          `self.addEventListener('activate', (event) => {\n` +
          `  event.waitUntil(\n` +
          `    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))\n` +
          `      .then(() => self.registration.unregister())\n` +
          `      .then(() => self.clients.matchAll({ type: 'window' }))\n` +
          `      .then((clients) => clients.forEach((c) => c.navigate(c.url)))\n` +
          `  );\n` +
          `});\n`
      );
    });

    // Missing production build chunks requested by stale tabs/SWs must return 404 (never 200 HTML)
    app.get('/assets/*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(404).type('text/plain').send('Asset not found');
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Pritesh Sir's Maths App server listening on http://0.0.0.0:${PORT} (mode=${
        serveBuiltDist ? 'static-dist' : 'vite-dev'
      })`
    );
    // Warm mathjs in the background after port is already open so first API request is instant
    setTimeout(() => {
      getMathEngine().catch(() => {});
    }, 50).unref();
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}; shutting down gracefully...`);
    liveVoiceBridge?.closeAll();
    httpServer.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const isDirectEntry = (() => {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(__filename);
  }
})();

if (isDirectEntry) {
  startServer();
}
