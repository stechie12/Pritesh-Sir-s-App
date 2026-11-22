import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractThoughtHeadline,
  parseSseChunkBuffer,
  stripPartialSimDirective,
} from './streamTutor';

test('parseSseChunkBuffer parses complete SSE frames and preserves partial remainders across chunks', () => {
  const first = parseSseChunkBuffer(
    '',
    'data: {"type":"meta","modelUsed":"gemini-4-hydrogen"}\n\ndata: {"type":"thought","del'
  );
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].type, 'meta');
  assert.ok(first.remainder.includes('"type":"thought"'));

  const second = parseSseChunkBuffer(
    first.remainder,
    'ta":"Checking roots"}\n\ndata: {"type":"token","delta":"Hello"}\n\n'
  );
  assert.equal(second.events.length, 2);
  assert.deepEqual(second.events[0], { type: 'thought', delta: 'Checking roots' });
  assert.deepEqual(second.events[1], { type: 'token', delta: 'Hello' });
  assert.equal(second.remainder, '');
});

test('stripPartialSimDirective masks completed and in-progress [[SIM:... tags cleanly during streaming', () => {
  assert.equal(
    stripPartialSimDirective('Here is the parabola.\n\n[[SIM:quadratic a=1 b=-4 c=3]]'),
    'Here is the parabola.'
  );
  assert.equal(
    stripPartialSimDirective('Here is the parabola.\n\n[[SIM:quadrat'),
    'Here is the parabola.'
  );
  assert.equal(stripPartialSimDirective('Here is the parabola. [['), 'Here is the parabola.');
  assert.equal(
    stripPartialSimDirective('Array access [0] stays intact'),
    'Array access [0] stays intact'
  );
});

test('extractThoughtHeadline extracts latest bold reasoning step or clean fallback line', () => {
  assert.equal(extractThoughtHeadline(''), 'Thinking');
  assert.equal(
    extractThoughtHeadline(
      '**Understanding the prompt**\nThe student wants to factor x^2 - 5x + 6.\n\n**Verifying roots**\nRoots are 2 and 3.'
    ),
    'Verifying roots'
  );
  assert.equal(
    extractThoughtHeadline('First check the discriminant b^2 - 4ac for real roots.'),
    'First check the discriminant b^2 - 4ac for real roots.'
  );
});
