import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import {
  contextSummarizerMiddleware,
  stripVisualizerSpecsAndNoise,
  summarizeConversationContext,
  type HistoryTurn,
} from './contextSummarizer.ts';

test('stripVisualizerSpecsAndNoise removes [[SIM:...]], truncated sim tags, and raw visualizer JSON blocks', () => {
  const dirty = [
    'Here is the parabola solution: x = 2, 3.',
    '[[SIM:{"kind":"quadratic","a":1,"b":-5,"c":6}]]',
    '```json\n{"kind":"trig","angle":30}\n```',
    '{"kind":"circle","radius":10}',
    '[[SIM:{"kind":"mensuration","partial":true',
  ].join('\n\n');

  const { cleaned, removedVisualizerTags } = stripVisualizerSpecsAndNoise(dirty);
  assert.equal(removedVisualizerTags, 4);
  assert.ok(cleaned.includes('x = 2, 3.'));
  assert.ok(!cleaned.includes('[[SIM'));
  assert.ok(!cleaned.includes('"kind"'));
});

test('summarizeConversationContext preserves small histories cleanly while stripping stale visualizer specs', () => {
  const history: HistoryTurn[] = [
    { role: 'user', text: 'Solve x^2 - 5x + 6 = 0' },
    {
      role: 'model',
      text: 'Roots are x = 2 and x = 3.\n[[SIM:{"kind":"quadratic","a":1,"b":-5,"c":6}]]',
    },
  ];
  const res = summarizeConversationContext({
    question: 'Now find the vertex',
    history,
  });

  assert.equal(res.removedVisualizerTags, 1);
  assert.equal(res.summarizedTurnCount, 0);
  assert.equal(res.history.length, 2);
  assert.ok(!res.history[1].text.includes('[[SIM'));
  assert.ok(res.savedChars > 20);
});

test('summarizeConversationContext compacts large multi-turn histories into a coherent digest + recent turns', () => {
  const longHistory: HistoryTurn[] = [];
  for (let i = 1; i <= 6; i++) {
    longHistory.push({
      role: 'user',
      text: `Question ${i}: Explain GST and Quadratic equations with discriminant b^2 - 4ac = 0 for example ${i}.`,
    });
    longHistory.push({
      role: 'model',
      text:
        `Detailed explanation ${i}: For quadratic ax^2 + bx + c = 0, Delta = b^2 - 4ac. ` +
        'Step by step algebra calculation '.repeat(18) +
        `Final answer x = ${i}.\n[[SIM:{"kind":"quadratic","a":1,"b":-${i},"c":2}]]`,
    });
  }

  const res = summarizeConversationContext({
    question: 'Can you summarize what we solved and give me a new mensuration sum?',
    history: longHistory,
  });

  assert.equal(res.wasSummarized, true);
  assert.equal(res.removedVisualizerTags, 6);
  assert.equal(res.summarizedTurnCount, 8); // 12 turns - 4 recent kept verbatim
  assert.equal(res.history.length, 6); // 2 digest turns + 4 recent turns
  assert.ok(res.history[0].text.includes('[Context Summary of 8 earlier turns'));
  assert.ok(res.history[0].text.toLowerCase().includes('gst'));
  assert.ok(res.summarizedChars < res.originalChars * 0.65);
  assert.ok(res.history[res.history.length - 1].text.includes('Final answer x = 6.'));
});

test('summarizeConversationContext keeps 6 recent turns when student submits a quiz grading follow-up', () => {
  const history: HistoryTurn[] = [];
  for (let i = 1; i <= 10; i++) {
    history.push({ role: i % 2 === 1 ? 'user' : 'model', text: `Turn ${i}: quadratic sum ${i} `.repeat(12) });
  }

  const res = summarizeConversationContext({
    question: '1. A, 2. B, 3. C — check my answers',
    history,
  });

  assert.equal(res.summarizedTurnCount, 4); // 10 - 6 kept recent for quiz grading
  assert.equal(res.history.length, 8); // 2 digest + 6 recent
});

test('contextSummarizerMiddleware mutates req.body.history and emits summary headers without blocking', () => {
  const headers: Record<string, string> = {};
  const req = {
    body: {
      question: 'Next question please',
      history: [
        { role: 'user', text: 'Solve trig sin^2 + cos^2 = 1' },
        { role: 'model', text: 'Identity verified! [[SIM:{"kind":"trig","angle":45}]]' },
      ],
    },
  } as unknown as Request;

  const res = {
    locals: {},
    headersSent: false,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
  } as unknown as Response;

  let nextCalled = false;
  contextSummarizerMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Context-Summarized'], '1');
  assert.ok(Number(headers['X-Context-Saved-Chars']) > 10);
  assert.ok(!req.body.history[1].text.includes('[[SIM'));
});
