import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LruCache,
  createEndpointMetricsTracker,
  createRateLimiter,
  isValidImageBase64,
  redactPii,
  sanitizeHttpUrl,
  stripDangerousKeys,
  validateDoubtRequest,
  validateLessonPlanRequest,
  validateMathVerifyRequest,
  validateStudyPlannerRequest,
  validateTtsRequest,
} from './security.ts';
import {
  analyzeStudentIntent,
  assertSafeMathExpression,
  buildSmartTutorResponse,
  normalizeTrigExpressionForMathJs,
  sandboxedMath,
  sliceResumedReply,
  verifyMathExpression,
} from './mathEngine.ts';
import {
  GeminiCircuitBreaker,
  buildDefaultLessonPlan,
  buildTutorSystemInstruction,
  classifyGeminiError,
  computeAdaptiveThinkingBudget,
  getGeminiKeyDiagnostic,
  resolveGeminiModelConfig,
} from './aiService.ts';
import { shouldPerformWebSearch } from './webSearch.ts';
import zlib from 'zlib';
import {
  compressBuffer,
  isCompressiblePath,
  selectCompressionEncoding,
} from './compression.ts';

// ---- Security & Validation Tests ----

test('redactPii strips emails, phone numbers, bearer tokens, AIza keys, and AQ. keys', () => {
  const sample =
    'Contact student@example.com or +1-555-234-5678 with Bearer eyJhbGciOiJIUzI1NiJ9.abc, AIzaSyD1234567890abcdefghijk, and AQ.Ab8RN6SampleKeyValue1234567890';
  const redacted = redactPii(sample);
  assert.ok(!redacted.includes('student@example.com'));
  assert.ok(!redacted.includes('555-234-5678'));
  assert.ok(!redacted.includes('eyJhbGci'));
  assert.ok(!redacted.includes('AIzaSyD'));
  assert.ok(!redacted.includes('AQ.Ab8RN6'));
  assert.ok(redacted.includes('[REDACTED_EMAIL]'));
  assert.ok(redacted.includes('[REDACTED_PHONE]'));
  assert.ok(redacted.includes('[REDACTED_TOKEN]'));
  assert.ok(redacted.includes('[REDACTED_API_KEY]'));
});

test('isValidImageBase64 accepts valid PNG/JPEG magic bytes and rejects XSS/HTML/garbage', () => {
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString(
    'base64'
  );
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString(
    'base64'
  );
  const fakeSvg = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');

  assert.equal(isValidImageBase64(validPng), true);
  assert.equal(isValidImageBase64(validJpeg), true);
  assert.equal(isValidImageBase64(fakeSvg), false);
  assert.equal(isValidImageBase64('not-valid-base64!!!'), false);
  assert.equal(isValidImageBase64(''), false);
});

test('validateDoubtRequest rejects empty, oversized, and invalid image payloads', () => {
  assert.equal(validateDoubtRequest(null).ok, false);
  assert.equal(validateDoubtRequest({ question: '   ' }).ok, false);
  assert.equal(validateDoubtRequest({ question: 'a'.repeat(2001) }).ok, false);

  const badImg = validateDoubtRequest({
    question: 'Solve this',
    imageBase64: Buffer.from('<script>alert(1)</script>').toString('base64'),
  });
  assert.equal(badImg.ok, false);

  const okReq = validateDoubtRequest({
    question: '  Solve x^2 - 5x + 6 = 0  ',
    grade: '10',
    board: 'cbse',
    history: [
      { role: 'user', text: 'hello' },
      { role: 'admin', text: 'ignored' },
    ],
  });
  assert.equal(okReq.ok, true);
  if (okReq.ok) {
    assert.equal(okReq.data.question, 'Solve x^2 - 5x + 6 = 0');
    assert.equal(okReq.data.grade, '10');
    assert.equal(okReq.data.board, 'CBSE');
    assert.equal(okReq.data.history.length, 1);
  }
});

test('validateTtsRequest, validateLessonPlanRequest, and validateStudyPlannerRequest clamp & validate inputs', () => {
  assert.equal(validateTtsRequest({ text: '' }).ok, false);
  assert.equal(validateTtsRequest({ text: 'x'.repeat(4001) }).ok, false);
  assert.equal(validateTtsRequest({ text: 'Hello student' }).ok, true);

  const lp = validateLessonPlanRequest({
    grade: '99',
    board: 'INVALID',
    adaptiveRating: 99999,
    weakTopics: ['Trigonometry', '', 42],
  });
  assert.equal(lp.ok, true);
  if (lp.ok) {
    assert.equal(lp.data.grade, '9');
    assert.equal(lp.data.board, 'ICSE');
    assert.equal(lp.data.adaptiveRating, 3000);
    assert.deepEqual(lp.data.weakTopics, ['Trigonometry']);
  }

  const sp = validateStudyPlannerRequest({
    pace: 'Intensive',
    daysUntilMock: -10,
    feedbackMode: 'need_more_time',
  });
  assert.equal(sp.ok, true);
  if (sp.ok) {
    assert.equal(sp.data.pace, 'Intensive');
    assert.equal(sp.data.daysUntilMock, 1);
    assert.equal(sp.data.feedbackMode, 'need_more_time');
  }
});

test('LruCache tracks stats, evicts oldest entry, and expires entries after TTL', () => {
  const cache = new LruCache<string>(2, 1000);
  cache.set('a', '1', 100);
  cache.set('b', '2', 200);
  // Touch 'a' so 'b' becomes LRU
  assert.equal(cache.get('a', 300), '1');
  cache.set('c', '3', 400);
  assert.equal(cache.get('b', 450), null);
  assert.equal(cache.get('a', 450), '1');
  // Expire after TTL (100 + 1000 = 1100)
  assert.equal(cache.get('a', 1200), null);
  const stats = cache.getStats();
  assert.equal(stats.hits, 2);
  assert.equal(stats.misses, 2);
});

test('createRateLimiter enforces window limits and prunes expired buckets', () => {
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000, maxBuckets: 10 });
  const r1 = limiter.check('1.2.3.4', 100);
  const r2 = limiter.check('1.2.3.4', 200);
  const r3 = limiter.check('1.2.3.4', 300);
  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
  assert.ok(r3.retryAfterSec >= 1);

  // After window expires, request is allowed again and pruning cleans stale entries
  limiter.check('5.6.7.8', 200);
  limiter.pruneExpired(1500);
  assert.equal(limiter.size(), 0);
  const r4 = limiter.check('1.2.3.4', 1600);
  assert.equal(r4.allowed, true);
});

// ---- AI Service & Circuit Breaker Tests ----

test('resolveGeminiModelConfig defaults to Gemini 4 Hydrogen with MEDIUM thinking and supports Gemini 4 Neon/Argon', () => {
  const defaultCfg = resolveGeminiModelConfig(undefined);
  assert.equal(defaultCfg.sdkModelName, 'gemini-4-hydrogen');
  assert.equal(defaultCfg.requiresPaidKey, false);
  assert.equal(defaultCfg.thinkingLevel, 'MEDIUM');
  assert.equal(resolveGeminiModelConfig('gemini-4-hydrogen').sdkModelName, 'gemini-4-hydrogen');
  assert.equal(resolveGeminiModelConfig('gemini-4-neon').sdkModelName, 'gemini-4-neon');
  assert.equal(resolveGeminiModelConfig('gemini-4-neon').requiresPaidKey, true);
  assert.equal(resolveGeminiModelConfig('gemini-3.8-flash').sdkModelName, 'gemini-4-hydrogen');
  assert.equal(resolveGeminiModelConfig('gemini-flash-latest').sdkModelName, 'gemini-4-hydrogen');
  assert.equal(resolveGeminiModelConfig('gemini-4-argon').sdkModelName, 'gemini-4-argon');
  assert.equal(resolveGeminiModelConfig('gemini-3.1-flash-lite').sdkModelName, 'gemini-3.1-flash-lite');
});

test('buildTutorSystemInstruction frames AI as Pritesh Sirs Assistant across all mathematics branches without canned intros', () => {
  const prompt = buildTutorSystemInstruction('9', 'ICSE', null);
  assert.ok(prompt.includes("Pritesh Sir's AI Maths Assistant"));
  assert.ok(/Never introduce yourself as Pritesh Sir/i.test(prompt));
  assert.ok(/ALL branches of mathematics/i.test(prompt));
  assert.ok(/Number Systems/i.test(prompt));
  assert.ok(/Algebra/i.test(prompt));
  assert.ok(/Calculus/i.test(prompt));
  assert.ok(/Do NOT open every (?:message|reply) with a canned greeting/i.test(prompt));

  const compactPrompt = buildTutorSystemInstruction('9', 'ICSE', null, { compact: true });
  assert.ok(compactPrompt.length < prompt.length);
  assert.ok(!compactPrompt.includes('[[SIM:trig'));
});

test('computeAdaptiveThinkingBudget scales cleanly across Eco, Balanced, and Turbo tiers like Ryzen Precision Boost', () => {
  const ecoChat = computeAdaptiveThinkingBudget({ question: 'hi there!', requestedModel: 'gemini-4-hydrogen' });
  assert.equal(ecoChat.tier, 'eco');
  assert.equal(ecoChat.thinkingLevel, 'LOW');
  assert.equal(ecoChat.includeThoughts, false);
  assert.equal(ecoChat.compactSystemPrompt, true);
  assert.ok(ecoChat.maxOutputTokens <= 700);
  assert.equal(ecoChat.maxHistoryTurns, 4);

  const ecoFormula = computeAdaptiveThinkingBudget({
    question: 'formula of area of circle',
    requestedModel: 'gemini-4-hydrogen',
  });
  assert.equal(ecoFormula.tier, 'eco');

  const balanced = computeAdaptiveThinkingBudget({
    question: 'Solve 2x^2 - 7x + 3 = 0 using quadratic formula',
    requestedModel: 'gemini-4-hydrogen',
  });
  assert.equal(balanced.tier, 'balanced');
  assert.equal(balanced.thinkingLevel, 'MEDIUM');
  assert.equal(balanced.includeThoughts, true);
  assert.equal(balanced.compactSystemPrompt, false);
  assert.equal(balanced.maxOutputTokens, 2048);

  const turboProof = computeAdaptiveThinkingBudget({
    question: 'Prove that the angle subtended by an arc at the centre is double the angle at the circumference',
    requestedModel: 'gemini-4-hydrogen',
  });
  assert.equal(turboProof.tier, 'turbo');
  assert.equal(turboProof.thinkingLevel, 'HIGH');
  assert.equal(turboProof.includeThoughts, true);
  assert.equal(turboProof.maxOutputTokens, 4096);
  assert.equal(turboProof.maxHistoryTurns, 12);

  const turboImage = computeAdaptiveThinkingBudget({
    question: 'Solve this',
    hasImage: true,
    requestedModel: 'gemini-4-hydrogen',
  });
  assert.equal(turboImage.tier, 'turbo');
  assert.equal(turboImage.thinkingLevel, 'HIGH');
});

test('getGeminiKeyDiagnostic accepts both AQ. auth keys and AIza keys while rejecting placeholders', () => {
  assert.equal(getGeminiKeyDiagnostic(''), 'missing');
  assert.equal(getGeminiKeyDiagnostic('MY_GEMINI_API_KEY'), 'missing');
  assert.equal(getGeminiKeyDiagnostic('AQ.Ab8RN6SampleAuthKey1234567890'), 'configured');
  assert.equal(getGeminiKeyDiagnostic('AIzaSyD1234567890abcdefghijklmnop'), 'configured');
});

test('GeminiCircuitBreaker tolerates single transient error and recovers after cooldown', () => {
  const breaker = new GeminiCircuitBreaker({
    transientThreshold: 2,
    transientCooldownMs: 5000,
    authCooldownMs: 60000,
  });

  assert.equal(breaker.canRequest(1000), true);
  breaker.recordFailure('transient', 1000);
  // Still closed after 1 transient blip!
  assert.equal(breaker.canRequest(1100), true);

  breaker.recordFailure('transient', 1200);
  // Opens after reaching threshold
  assert.equal(breaker.canRequest(2000), false);
  // Half-open recovery after cooldown
  assert.equal(breaker.canRequest(7000), true);
  breaker.recordSuccess();
  assert.equal(breaker.getState(7100).consecutiveFailures, 0);
});

test('classifyGeminiError distinguishes billing_required, service_disabled, auth, not_found, quota, transient, and fatal errors', () => {
  assert.equal(
    classifyGeminiError({
      status: 403,
      message: 'This API method requires billing to be enabled. Please enable billing on project #12345.',
    }),
    'billing_required'
  );
  assert.equal(
    classifyGeminiError({
      status: 403,
      message: 'Agent Platform API has not been used in project 123456789 before or it is disabled.',
    }),
    'service_disabled'
  );
  assert.equal(classifyGeminiError({ status: 403, message: 'PERMISSION_DENIED' }), 'auth');
  assert.equal(classifyGeminiError(new Error('API_KEY_INVALID')), 'auth');
  assert.equal(classifyGeminiError({ status: 400, message: 'API key not valid. Please pass a valid API key.' }), 'auth');
  assert.equal(classifyGeminiError({ status: 404, message: 'NOT_FOUND' }), 'not_found');
  assert.equal(classifyGeminiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }), 'quota');
  assert.equal(classifyGeminiError({ status: 503, message: 'UNAVAILABLE' }), 'transient');
  assert.equal(classifyGeminiError(new Error('Timeout exceeded (12000ms)')), 'transient');
  assert.equal(classifyGeminiError(new Error('Invalid JSON schema')), 'fatal');
});

test('buildDefaultLessonPlan uses weak topics and rating cleanly', () => {
  const plan = buildDefaultLessonPlan({
    grade: '10',
    board: 'ICSE',
    weakTopics: ['Circles', 'Trigonometry'],
    adaptiveRating: 1420,
  });
  assert.equal(plan.modules.length, 4);
  assert.equal(plan.modules[0].topic, 'Circles');
  assert.ok(plan.summary.includes('1420 ELO'));
});

// ---- Sandboxed Math Engine & Web Search Tests ----

test('sandboxedMath blocks dangerous import/createUnit overrides', () => {
  assert.throws(() => sandboxedMath.evaluate('import({ foo: 1 })'));
  assert.throws(() => sandboxedMath.evaluate('createUnit("foo")'));
});

test('buildSmartTutorResponse solves BODMAS, quadratic, trig, derivative, and surds accurately', () => {
  const bodmas = buildSmartTutorResponse('(12 + 8) * 3 - 10', '9', 'ICSE', 'General');
  assert.equal(bodmas.responseType, 'math');
  assert.ok(bodmas.finalAnswer.includes('50'));

  const quad = buildSmartTutorResponse('Solve x^2 - 5x + 6 = 0', '10', 'ICSE', 'Algebra');
  assert.equal(quad.responseType, 'math');
  assert.ok(quad.finalAnswer.includes('x = 3') && quad.finalAnswer.includes('x = 2'));

  const trig = buildSmartTutorResponse('What is cot 90?', '9', 'ICSE', 'Trigonometry');
  assert.equal(trig.responseType, 'math');
  assert.equal(trig.finalAnswer, 'cot(90°) = 0');

  const deriv = buildSmartTutorResponse('differentiate x^3 + 2x at x = 2', '12', 'CBSE', 'Calculus');
  assert.equal(deriv.responseType, 'math');
  assert.ok(deriv.finalAnswer.includes('14'));

  const surd = buildSmartTutorResponse('Rationalize 1 / (3 + 2√2)', '9', 'ICSE', 'Surds');
  assert.equal(surd.responseType, 'math');
  assert.ok(surd.finalAnswer.includes('3 - 2√2'));

  const openEnded = buildSmartTutorResponse('Who won the Nobel Prize in Physics in 1921?', '9', 'ICSE', 'General');
  assert.equal(openEnded.chatReply, '__NEEDS_LIVE_LLM__');
});

test('analyzeStudentIntent, normalizeTrigExpressionForMathJs, sliceResumedReply, and shouldPerformWebSearch work cleanly', () => {
  const intent = analyzeStudentIntent('Visualize a 3D cone for class 10 CBSE', '9', 'ICSE');
  assert.equal(intent.detectedGrade, '10');
  assert.equal(intent.detectedBoard, 'CBSE');
  assert.equal(intent.summonTool, 'lab');
  assert.equal(intent.labMode, 'mensuration3d');

  const parabolaIntent = analyzeStudentIntent(
    'Visualize the parabola y = x^2 - 4x + 3 with an interactive simulation',
    '9',
    'ICSE'
  );
  assert.equal(parabolaIntent.summonTool, null);

  assert.equal(normalizeTrigExpressionForMathJs('sin^2(30) + cos(60)'), '(sin(30 deg)^2) + cos(60 deg)');

  const full = 'Part 1: Surds are irrational roots. Part 2: Rationalize with conjugates.';
  assert.equal(sliceResumedReply(full, 'Part 1: Surds are irrational roots.'), 'Part 2: Rationalize with conjugates.');

  assert.equal(shouldPerformWebSearch('hey'), null);
  assert.equal(shouldPerformWebSearch('What is photosynthesis?'), 'photosynthesis');
});

// ---- Expanded Backend Security, Metrics, Verification & 10 New Solvers Tests ----

test('stripDangerousKeys removes prototype pollution keys recursively and sanitizeHttpUrl restricts protocols', () => {
  const dirty = JSON.parse('{"question":"hi","__proto__":{"polluted":true},"nested":{"constructor":"bad","ok":1}}');
  const cleaned = stripDangerousKeys(dirty) as Record<string, unknown>;
  assert.equal(cleaned.question, 'hi');
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cleaned.nested as object, 'constructor'), false);
  assert.equal((cleaned.nested as Record<string, unknown>).ok, 1);

  assert.equal(sanitizeHttpUrl('https://en.wikipedia.org/wiki/Surd'), 'https://en.wikipedia.org/wiki/Surd');
  assert.equal(sanitizeHttpUrl('http://example.com/a'), 'http://example.com/a');
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>'), null);
});

test('validateDoubtRequest preserves full multi-question quiz turns and enforces 14000-char history budget', () => {
  const fullQuiz =
    'Trigonometry Quiz:\n1. AB=3, BC=4 find sin A.\n2. Evaluate (sin30+cos60)/tan45.\n3. If sin θ = 5/13 find cos θ.\n4. True or False: sin θ increases from 0 to 90.\n5. Simplify cos^2 θ + sin^2 θ.\n' +
    'Details '.repeat(140);
  const quizRes = validateDoubtRequest({
    question: '1. 4/5 2. 1 3. 12/13 4. True 5. 1',
    history: [
      { role: 'user', text: 'Give me a 5-question trig quiz' },
      { role: 'model', text: fullQuiz },
    ],
  });
  assert.equal(quizRes.ok, true);
  if (quizRes.ok) {
    assert.equal(quizRes.data.history.length, 2);
    assert.ok(quizRes.data.history[1].text.includes('5. Simplify cos^2'));
    assert.equal(quizRes.data.history[1].text.length, fullQuiz.trim().length);
  }

  const longHistory = Array.from({ length: 12 }, (_, idx) => ({
    role: idx % 2 === 0 ? 'user' : 'model',
    text: 'x'.repeat(2500),
  }));
  const res = validateDoubtRequest({
    question: 'Explain\u0000 surds',
    history: longHistory,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.question, 'Explain surds');
    const totalChars = res.data.history.reduce((s, h) => s + h.text.length, 0);
    assert.ok(totalChars <= 14000);
  }

  assert.equal(validateMathVerifyRequest({ expression: '' }).ok, false);
  assert.equal(validateMathVerifyRequest({ expression: 'x'.repeat(201) }).ok, false);
  const mv = validateMathVerifyRequest({ expression: 'sin(30) + cos(60)', expected: '1' });
  assert.equal(mv.ok, true);
});

test('createEndpointMetricsTracker aggregates route counts, error counts, and average duration', () => {
  const tracker = createEndpointMetricsTracker();
  tracker.record('POST /api/math/verify', 200, 10);
  tracker.record('POST /api/math/verify', 400, 20);
  tracker.record('GET /api/health', 200, 5);
  const snap = tracker.snapshot();
  assert.deepEqual(snap['POST /api/math/verify'], { count: 2, errors: 1, avgMs: 15 });
  assert.deepEqual(snap['GET /api/health'], { count: 1, errors: 0, avgMs: 5 });
});

test('sandboxedMath blocks allocation vectors and assertSafeMathExpression / verifyMathExpression guard against DoS', () => {
  assert.throws(() => sandboxedMath.evaluate('range(1, 1000000)'));
  assert.throws(() => sandboxedMath.evaluate('ones(1000, 1000)'));
  assert.throws(() => sandboxedMath.evaluate('zeros(1000)'));
  assert.throws(() => sandboxedMath.evaluate('identity(500)'));

  assert.throws(() => assertSafeMathExpression('2^3^4'));
  assert.throws(() => assertSafeMathExpression('2^99'));
  assert.throws(() => assertSafeMathExpression('('.repeat(17) + '1' + ')'.repeat(17)));

  const okEval = verifyMathExpression('sin(30) + cos(60)', '1');
  assert.equal(okEval.valid, true);
  assert.equal(okEval.value, '1');
  assert.equal(okEval.equivalent, true);

  const badEval = verifyMathExpression('2^3^4');
  assert.equal(badEval.valid, false);
});

test('buildSmartTutorResponse deterministically solves all 10 new syllabus solvers', () => {
  // 1. AP
  const ap = buildSmartTutorResponse('Find AP with a = 3, d = 4, n = 10', '10', 'ICSE', 'AP');
  assert.equal(ap.responseType, 'math');
  assert.ok(ap.finalAnswer.includes('T_10 = 39') && ap.finalAnswer.includes('S_10 = 210'));

  // 2. GP
  const gp = buildSmartTutorResponse('GP with a = 2, r = 3, n = 5', '10', 'ICSE', 'GP');
  assert.equal(gp.responseType, 'math');
  assert.ok(gp.finalAnswer.includes('T_5 = 162') && gp.finalAnswer.includes('S_5 = 242'));

  // 3. Coordinate Distance
  const dist = buildSmartTutorResponse('Find distance between (1, 2) and (4, 6)', '10', 'CBSE', 'Coordinate');
  assert.equal(dist.responseType, 'math');
  assert.ok(dist.finalAnswer.includes('5 units'));

  // 4. Coordinate Midpoint
  const mid = buildSmartTutorResponse('Find midpoint of (2, 4) and (6, 8)', '10', 'CBSE', 'Coordinate');
  assert.equal(mid.responseType, 'math');
  assert.ok(mid.finalAnswer.includes('(4, 6)'));

  // 5. Slope & Line Equation
  const line = buildSmartTutorResponse('Find equation of line through (1, 3) and (3, 7)', '10', 'ICSE', 'Coordinate');
  assert.equal(line.responseType, 'math');
  assert.ok(line.finalAnswer.includes('Slope m = 2') && line.finalAnswer.includes('y = 2x + 1'));

  // 6. Compound Interest
  const ci = buildSmartTutorResponse('Find compound interest P = 10000, R = 10, T = 2', '9', 'ICSE', 'Commercial');
  assert.equal(ci.responseType, 'math');
  assert.ok(ci.finalAnswer.includes('12100') && ci.finalAnswer.includes('2100'));

  // 7. Heron's Formula
  const heron = buildSmartTutorResponse('Area of triangle with sides 13, 14, 15', '9', 'CBSE', 'Mensuration');
  assert.equal(heron.responseType, 'math');
  assert.ok(heron.finalAnswer.includes('84'));

  // 8. Prime Factorization & Primality
  const prime = buildSmartTutorResponse('Is 97 prime?', '9', 'ICSE', 'Numbers');
  assert.equal(prime.responseType, 'math');
  assert.ok(prime.finalAnswer.includes('97 is PRIME'));

  const factors = buildSmartTutorResponse('Prime factorization of 360', '9', 'ICSE', 'Numbers');
  assert.equal(factors.responseType, 'math');
  assert.ok(factors.finalAnswer.includes('2^3 × 3^2 × 5'));

  // 9. 2x2 Matrix Determinant & Inverse
  const mat = buildSmartTutorResponse('Find determinant and inverse of matrix [[4, 7], [2, 6]]', '10', 'ICSE', 'Matrices');
  assert.equal(mat.responseType, 'math');
  assert.ok(mat.finalAnswer.includes('det(A) = 10') && mat.finalAnswer.includes('[[6, -7], [-2, 4]]'));

  // 10. Pythagoras & Percentage Change
  const pyth = buildSmartTutorResponse('Pythagoras hypotenuse for legs 5 and 12', '9', 'ICSE', 'Geometry');
  assert.equal(pyth.responseType, 'math');
  assert.ok(pyth.finalAnswer.includes('13'));

  const pct = buildSmartTutorResponse('Percentage increase from 80 to 100', '9', 'ICSE', 'Commercial');
  assert.equal(pct.responseType, 'math');
  assert.ok(pct.finalAnswer.includes('25% Increase'));
});

test('compression helper selects Brotli/Gzip cleanly, filters asset types, and round-trips payloads', () => {
  assert.equal(selectCompressionEncoding('gzip, deflate, br'), 'br');
  assert.equal(selectCompressionEncoding('gzip, deflate'), 'gzip');
  assert.equal(selectCompressionEncoding('br;q=0, gzip;q=0.8'), 'gzip');
  assert.equal(selectCompressionEncoding('identity'), null);
  assert.equal(selectCompressionEncoding(undefined), null);

  assert.equal(isCompressiblePath('/assets/index-abc.js'), true);
  assert.equal(isCompressiblePath('/assets/index-abc.css'), true);
  assert.equal(isCompressiblePath('/index.html'), true);
  assert.equal(isCompressiblePath('/pwa-192x192.png'), false);
  assert.equal(isCompressiblePath('/assets/KaTeX_Main.woff2'), false);

  const samplePayload = Buffer.from('function greet(){return "Pritesh Sir Maths App";}'.repeat(40), 'utf8');
  const brBuf = compressBuffer(samplePayload, 'br');
  const gzBuf = compressBuffer(samplePayload, 'gzip');
  assert.ok(brBuf.length < samplePayload.length / 4);
  assert.ok(gzBuf.length < samplePayload.length / 4);
  assert.equal(zlib.brotliDecompressSync(brBuf).toString('utf8'), samplePayload.toString('utf8'));
  assert.equal(zlib.gunzipSync(gzBuf).toString('utf8'), samplePayload.toString('utf8'));
});

