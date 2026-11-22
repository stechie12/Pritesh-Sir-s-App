import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avoidMidLatexCommandSplit,
  buildThinkingStageLabel,
  computeNextRevealedLength,
} from './typewriterBuffer';

test('computeNextRevealedLength advances smoothly without overshooting', () => {
  const text = 'Let us solve the quadratic equation step by step.';
  let revealed = 0;
  let steps = 0;

  while (revealed < text.length && steps < 200) {
    const next = computeNextRevealedLength({
      currentLength: revealed,
      targetText: text,
      deltaMs: 16.6,
    });
    assert.ok(next > revealed, 'Should strictly advance on 60fps frame when backlog remains');
    assert.ok(next <= text.length, 'Should never overshoot target length');
    revealed = next;
    steps++;
  }

  assert.equal(revealed, text.length);
  assert.ok(steps >= 4, `Expected multi-frame progressive typing, got ${steps} frames`);
});

test('computeNextRevealedLength accelerates when large SSE bursts buffer ahead', () => {
  const shortText = 'Hello world! This is short.';
  const longBurst = 'Step 1: Factor the expression carefully. '.repeat(20);

  const shortStep = computeNextRevealedLength({
    currentLength: 0,
    targetText: shortText,
    deltaMs: 16.6,
  });
  const longStep = computeNextRevealedLength({
    currentLength: 0,
    targetText: longBurst,
    deltaMs: 16.6,
  });

  assert.ok(
    longStep > shortStep,
    `Expected larger per-frame catch-up on big burst (${longStep}) than short text (${shortStep})`
  );
});

test('computeNextRevealedLength snaps immediately when reducedMotion is enabled', () => {
  const text = 'Immediate reveal for prefers-reduced-motion users.';
  const next = computeNextRevealedLength({
    currentLength: 0,
    targetText: text,
    deltaMs: 16,
    reducedMotion: true,
  });
  assert.equal(next, text.length);
});

test('computeNextRevealedLength finishes briskly once stream is complete', () => {
  const text = 'Final algebraic conclusion and exam tip for ICSE board students.';
  const streamingAdvance = computeNextRevealedLength({
    currentLength: 10,
    targetText: text,
    deltaMs: 20,
    isStreamComplete: false,
  });
  const completeAdvance = computeNextRevealedLength({
    currentLength: 10,
    targetText: text,
    deltaMs: 20,
    isStreamComplete: true,
  });
  assert.ok(completeAdvance > streamingAdvance);
});

test('avoidMidLatexCommandSplit skips cleanly past partial LaTeX command names', () => {
  const sample = 'Compute \\frac{1}{2} + \\sqrt{9}';
  // Index landing inside "\frac" (between 'r' and 'a')
  const midFracIdx = sample.indexOf('\\frac') + 3;
  const adjusted = avoidMidLatexCommandSplit(sample, midFracIdx);
  assert.equal(sample.slice(0, adjusted), 'Compute \\frac');

  // Plain prose should not be altered
  const plain = 'Factoring quadratics cleanly';
  assert.equal(avoidMidLatexCommandSplit(plain, 5), 5);
});

test('buildThinkingStageLabel prefers real Gemini thought headlines and falls back gracefully', () => {
  assert.equal(buildThinkingStageLabel(0, ''), 'Analyzing your question');
  assert.equal(buildThinkingStageLabel(2600, ''), 'Mapping syllabus concepts');
  assert.equal(buildThinkingStageLabel(5200, ''), 'Reasoning step by step');
  assert.equal(buildThinkingStageLabel(9000, ''), 'Checking algebraic accuracy');

  const realThought = '**Factoring the quadratic**\nWe look for two numbers whose sum is -5.';
  assert.equal(buildThinkingStageLabel(400, realThought), 'Factoring the quadratic');
});
