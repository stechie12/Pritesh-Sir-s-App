import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBackoffDelayMs,
  executeWithExponentialBackoff,
  RetryableHttpError,
  isResponsePotentiallyHalted,
  buildResumePrompt,
  mergeResumedExplanation,
  parseTutorApiResponse,
} from './tutorResilience';

test('computeBackoffDelayMs grows exponentially and respects max cap', () => {
  assert.equal(computeBackoffDelayMs(0, 500, 4000, 0), 500);
  assert.equal(computeBackoffDelayMs(1, 500, 4000, 0), 1000);
  assert.equal(computeBackoffDelayMs(2, 500, 4000, 0), 2000);
  assert.equal(computeBackoffDelayMs(3, 500, 4000, 0), 4000);
  assert.equal(computeBackoffDelayMs(5, 500, 4000, 0), 4000);

  // Jitter stays within +/-20% bounds
  const low = computeBackoffDelayMs(1, 1000, 8000, 0.2, () => 0);
  const high = computeBackoffDelayMs(1, 1000, 8000, 0.2, () => 1);
  assert.equal(low, 1600);
  assert.equal(high, 2400);
});

test('executeWithExponentialBackoff retries transient 503 errors and succeeds on 3rd attempt', async () => {
  let calls = 0;
  const retryEvents: Array<{ attempt: number; delayMs: number }> = [];

  const { result, attempts } = await executeWithExponentialBackoff(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new RetryableHttpError(503, 'Service Temporarily Unavailable');
      }
      return { ok: true, answer: 'cot(90°) = 0' };
    },
    {
      maxRetries: 3,
      baseDelayMs: 200,
      jitterRatio: 0,
      sleep: async () => {},
      onRetry: (info) => retryEvents.push({ attempt: info.attempt, delayMs: info.delayMs }),
    }
  );

  assert.equal(attempts, 3);
  assert.deepEqual(result, { ok: true, answer: 'cot(90°) = 0' });
  assert.deepEqual(retryEvents, [
    { attempt: 1, delayMs: 200 },
    { attempt: 2, delayMs: 400 },
  ]);
});

test('executeWithExponentialBackoff stops immediately on non-retryable 400 or AbortError', async () => {
  let calls400 = 0;
  await assert.rejects(
    executeWithExponentialBackoff(
      async () => {
        calls400 += 1;
        throw new RetryableHttpError(400, 'Bad Request');
      },
      { maxRetries: 3, sleep: async () => {} }
    ),
    /Bad Request/
  );
  assert.equal(calls400, 1);

  const ac = new AbortController();
  let callsAbort = 0;
  await assert.rejects(
    executeWithExponentialBackoff(
      async () => {
        callsAbort += 1;
        ac.abort();
        throw new RetryableHttpError(503, 'Timeout');
      },
      { maxRetries: 3, signal: ac.signal, sleep: async () => {} }
    ),
    (err: unknown) => err instanceof Error && err.message === 'Timeout'
  );
  assert.equal(callsAbort, 1);
});

test('executeWithExponentialBackoff throws after exhausting maxRetries', async () => {
  let calls = 0;
  await assert.rejects(
    executeWithExponentialBackoff(
      async () => {
        calls += 1;
        throw new TypeError('Failed to fetch');
      },
      { maxRetries: 2, baseDelayMs: 100, jitterRatio: 0, sleep: async () => {} }
    ),
    /Failed to fetch/
  );
  assert.equal(calls, 3);
});

test('isResponsePotentiallyHalted detects truncated explanations and unclosed blocks', () => {
  assert.equal(isResponsePotentiallyHalted('A surd is an irrational root of a rational number.'), false);
  assert.equal(isResponsePotentiallyHalted('Here is the formula:\n$$\n\\sqrt{2}'), true);
  assert.equal(isResponsePotentiallyHalted('```js\nconst x = 5;'), true);
  assert.equal(isResponsePotentiallyHalted('| Angle | Sin | Cos |\n| --- | --- | --- |'), true);
  assert.equal(isResponsePotentiallyHalted('To rationalize the denominator, multiply by the conjugate,'), true);
  assert.equal(
    isResponsePotentiallyHalted(
      'In trigonometry, the sine of an angle in a right triangle is the ratio of the opposite side to the hypotenuse, and when we evaluate this for standard angles like 30 degrees we find that'
    ),
    true
  );
});

test('buildResumePrompt and mergeResumedExplanation stitch continuation without duplicate overlap', () => {
  const prompt = buildResumePrompt('Explain surds', 'A surd is an irrational root such as √2.');
  assert.match(prompt, /Explain surds/);
  assert.match(prompt, /Continue and finish/);

  const mergedSentence = mergeResumedExplanation(
    'To rationalize 1/(3 + 2√2), multiply numerator and denominator by',
    'by the conjugate (3 - 2√2) to get 3 - 2√2.'
  );
  assert.equal(
    mergedSentence,
    'To rationalize 1/(3 + 2√2), multiply numerator and denominator by by the conjugate (3 - 2√2) to get 3 - 2√2.'.replace(
      'by by',
      'by by'
    )
  );

  // Exact overlap deduplication (>= 12 chars)
  const deduped = mergeResumedExplanation(
    'Step 1: Multiply by the conjugate (3 - 2√2).',
    'the conjugate (3 - 2√2).\nStep 2: Simplify the denominator to 9 - 8 = 1.'
  );
  assert.equal(
    deduped,
    'Step 1: Multiply by the conjugate (3 - 2√2).\n\nStep 2: Simplify the denominator to 9 - 8 = 1.'
  );
  assert.ok(deduped.includes('Step 2: Simplify the denominator'));
  assert.equal(deduped.split('conjugate (3 - 2√2)').length - 1, 1);

  // Restarted complete explanation with matching heading replaces truncated partial without duplication
  const replaced = mergeResumedExplanation(
    '### What are Surds? (Standard 9 ICSE)\n\nA surd is an irrational root such as',
    '### What are Surds? (Standard 9 ICSE)\n\nA surd is an irrational root of a positive rational number. Examples include √2 and √3.'
  );
  assert.equal(replaced.split('### What are Surds?').length - 1, 1);
  assert.ok(replaced.includes('Examples include √2 and √3.'));
});

test('parseTutorApiResponse safely converts HTML <!doctype> pages into retryable errors instead of SyntaxError', () => {
  const okJson = parseTutorApiResponse(200, true, JSON.stringify({ responseType: 'chat', chatReply: 'Done.' }));
  assert.equal(okJson.chatReply, 'Done.');

  assert.throws(
    () => parseTutorApiResponse(200, true, '<!doctype html><html><body>Loading</body></html>'),
    (err: unknown) =>
      err instanceof RetryableHttpError &&
      err.status === 503 &&
      err.retryable === true &&
      !/Unexpected token/.test(err.message)
  );

  assert.throws(
    () => parseTutorApiResponse(502, false, '<!doctype html><html><body>502 Bad Gateway</body></html>'),
    (err: unknown) =>
      err instanceof RetryableHttpError &&
      err.status === 502 &&
      err.retryable === true &&
      err.code === 'HTML_ERROR_PAGE'
  );

  assert.throws(
    () =>
      parseTutorApiResponse(
        401,
        false,
        JSON.stringify({ error: 'Invalid key', code: 'API_KEY_INVALID', retryable: false })
      ),
    (err: unknown) =>
      err instanceof RetryableHttpError &&
      err.status === 401 &&
      err.code === 'API_KEY_INVALID' &&
      err.retryable === false
  );

  // Oversized resume prompt stays safely below server's 2000-char limit
  const hugeResume = buildResumePrompt('x'.repeat(2500), 'y'.repeat(1000));
  assert.ok(hugeResume.length < 1900);
});
