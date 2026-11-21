import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpokenMathTranscript,
  describeSpeechError,
  createVoiceDictationController,
  SpeechRecognitionLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionErrorEventLike,
} from './voiceMathDictation';

test('normalizeSpokenMathTranscript converts spoken algebra, roots, and trigonometry accurately', () => {
  assert.equal(
    normalizeSpokenMathTranscript('solve x squared minus 5x plus 6 equals zero'),
    'solve x^2 - 5x + 6 = 0'
  );
  assert.equal(
    normalizeSpokenMathTranscript('what is cotangent 90 degrees'),
    'what is cot 90°'
  );
  assert.equal(
    normalizeSpokenMathTranscript('sine 30 degrees plus cosine 60 degrees'),
    'sin 30° + cos 60°'
  );
  assert.equal(
    normalizeSpokenMathTranscript('square root of 18 plus square root of 2'),
    'sqrt(18) + sqrt(2)'
  );
  assert.equal(
    normalizeSpokenMathTranscript('x cubed divided by 2'),
    'x^3 / 2'
  );
  assert.equal(
    normalizeSpokenMathTranscript('explain surds'),
    'explain surds'
  );
});

test('describeSpeechError returns actionable messages for browser error codes', () => {
  assert.match(describeSpeechError('not-allowed'), /permission/i);
  assert.match(describeSpeechError('no-speech'), /No speech detected/i);
  assert.match(describeSpeechError('audio-capture'), /No microphone/i);
});

test('createVoiceDictationController handles start, interim/final results, math conversion, and hands-free auto-submit', async () => {
  const instances: SpeechRecognitionLike[] = [];
  let stopCalled = false;

  class MockSpeechRecognition implements SpeechRecognitionLike {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: (() => void) | null = null;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
    onend: (() => void) | null = null;
    start() {
      instances.push(this);
      this.onstart?.();
    }
    stop() {
      stopCalled = true;
      this.onend?.();
    }
  }

  const listeningStates: boolean[] = [];
  const interimUpdates: string[] = [];
  const finalUpdates: string[] = [];
  const autoSubmitted: string[] = [];

  const controller = createVoiceDictationController({
    lang: 'en-IN',
    mathMode: true,
    autoSubmitDelayMs: 40,
    recognitionCtor: MockSpeechRecognition,
    onListeningChange: (v) => listeningStates.push(v),
    onInterimChange: (t) => interimUpdates.push(t),
    onFinalTranscript: (t) => finalUpdates.push(t),
    onAutoSubmit: (t) => autoSubmitted.push(t),
  });

  assert.equal(controller.isSupported(), true);
  assert.equal(controller.start(), true);
  assert.equal(controller.isActive(), true);
  const activeInstance = instances[0];
  assert.ok(activeInstance);
  assert.equal(activeInstance.continuous, true);
  assert.equal(activeInstance.interimResults, true);

  // Emit interim speech
  activeInstance.onresult?.({
    resultIndex: 0,
    results: {
      length: 1,
      0: { isFinal: false, 0: { transcript: 'what is cotangent 90' } },
    },
  });
  assert.equal(interimUpdates.at(-1), 'what is cot 90');

  // Emit final speech
  activeInstance.onresult?.({
    resultIndex: 0,
    results: {
      length: 1,
      0: { isFinal: true, 0: { transcript: 'what is cotangent 90 degrees' } },
    },
  });
  assert.equal(finalUpdates.at(-1), 'what is cot 90°');

  // Wait for hands-free auto-submit timer
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(autoSubmitted, ['what is cot 90°']);
  assert.equal(stopCalled, true);
  assert.equal(controller.isActive(), false);
  assert.equal(listeningStates[0], true);
  assert.equal(listeningStates.at(-1), false);
});
