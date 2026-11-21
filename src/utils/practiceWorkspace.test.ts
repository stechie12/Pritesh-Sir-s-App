import test from 'node:test';
import assert from 'node:assert/strict';
import type { AttemptEntry, ProblemItem } from './adaptiveEngine.ts';
import {
  buildAttemptsCsv,
  buildTutorMarkdownExport,
  computeSessionStats,
  escapeCsvCell,
  evaluateConfidenceCalibration,
  formatStopwatch,
  latexToPlaintext,
  normalizeLatexDelimiters,
  pickSmartNextProblemId,
  searchPracticeProblems,
  toggleIdInList,
  toggleOptionElimination,
} from './practiceWorkspace.ts';
import {
  clearAppStorageCache,
  readVersionedStorage,
  removeVersionedStorage,
  writeVersionedStorage,
} from './storageSafety.ts';

const SAMPLE_PROBLEMS: ProblemItem[] = [
  {
    id: 'p1',
    grade: '9',
    board: 'ICSE',
    chapter: 'Rational & Irrational Numbers',
    exerciseRef: 'Ex 1(C) Q4',
    difficulty: 'Standard',
    marks: 3,
    question: 'Rationalize the denominator of 1 / (3 + 2√2).',
    options: ['3 - 2√2', '3 + 2√2', '1', '2√2 - 3'],
    correctIndex: 0,
    prerequisiteRecap: 'Conjugate surd identity.',
    stepByStepSolution: ['Multiply by conjugate 3 - 2√2'],
    shortcutTrick: 'Difference of squares is 9 - 8 = 1.',
  },
  {
    id: 'p2',
    grade: '10',
    board: 'ICSE',
    chapter: 'Trigonometry',
    exerciseRef: 'Ex 21(A) Q8',
    difficulty: 'Challenging',
    marks: 4,
    question: 'Evaluate sin^2(30) + cos^2(30).',
    options: ['0', '1/2', '1', '2'],
    correctIndex: 2,
    prerequisiteRecap: 'Pythagorean trig identity.',
    stepByStepSolution: ['Pythagorean identity equals 1'],
    shortcutTrick: 'sin²θ + cos²θ is always 1.',
  },
  {
    id: 'p3',
    grade: '10',
    board: 'CBSE',
    chapter: 'Coordinate Geometry',
    exerciseRef: 'Ex 7.1 Q2',
    difficulty: 'Foundation',
    marks: 2,
    question: 'Find distance between (0, 0) and (3, 4).',
    options: ['3', '4', '5', '7'],
    correctIndex: 2,
    prerequisiteRecap: 'Distance formula.',
    stepByStepSolution: ['√(3² + 4²) = 5'],
    shortcutTrick: '3-4-5 right triangle triple.',
  },
];

const SAMPLE_ATTEMPTS: AttemptEntry[] = [
  {
    id: 'att-1',
    problemId: 'p1',
    chapter: 'Rational & Irrational Numbers',
    grade: '9',
    board: 'ICSE',
    difficulty: 'Standard',
    isCorrect: true,
    timeSpentSec: 32,
    ratingDelta: 14,
    timestamp: '2026-11-19T10:00:00.000Z',
  },
  {
    id: 'att-2',
    problemId: 'p2',
    chapter: 'Trigonometry',
    grade: '10',
    board: 'ICSE',
    difficulty: 'Challenging',
    isCorrect: false,
    timeSpentSec: 48,
    ratingDelta: -10,
    timestamp: '2026-11-19T10:05:00.000Z',
  },
];

test('toggleIdInList adds and removes IDs immutably', () => {
  const initial = ['a', 'b'];
  const added = toggleIdInList(initial, 'c');
  assert.deepEqual(added, ['a', 'b', 'c']);
  assert.deepEqual(initial, ['a', 'b']);

  const removed = toggleIdInList(added, 'b');
  assert.deepEqual(removed, ['a', 'c']);
});

test('toggleOptionElimination maintains sorted per-problem eliminated indices', () => {
  let state: Record<string, number[]> = {};
  state = toggleOptionElimination(state, 'p1', 3);
  state = toggleOptionElimination(state, 'p1', 1);
  assert.deepEqual(state.p1, [1, 3]);

  state = toggleOptionElimination(state, 'p1', 1);
  assert.deepEqual(state.p1, [3]);
});

test('evaluateConfidenceCalibration flags overconfidence traps and underconfidence wins', () => {
  assert.equal(evaluateConfidenceCalibration(null, true), null);

  const over = evaluateConfidenceCalibration('high', false);
  assert.equal(over?.overconfident, true);
  assert.equal(over?.tone, 'rose');

  const under = evaluateConfidenceCalibration('low', true);
  assert.equal(under?.underconfident, true);
  assert.equal(under?.tone, 'sky');

  const calibrated = evaluateConfidenceCalibration('high', true);
  assert.equal(calibrated?.overconfident, false);
  assert.equal(calibrated?.tone, 'emerald');
});

test('searchPracticeProblems matches multi-token queries across chapter, ref, board, and question', () => {
  assert.equal(searchPracticeProblems(SAMPLE_PROBLEMS, '').length, 3);
  assert.equal(searchPracticeProblems(SAMPLE_PROBLEMS, 'cbse distance').length, 1);
  assert.equal(searchPracticeProblems(SAMPLE_PROBLEMS, 'cbse distance')[0].id, 'p3');
  assert.equal(searchPracticeProblems(SAMPLE_PROBLEMS, 'Ex 21(A)').length, 1);
  assert.equal(searchPracticeProblems(SAMPLE_PROBLEMS, 'nonexistent-topic').length, 0);
});

test('pickSmartNextProblemId prioritizes unsolved sums before cyclic fallback', () => {
  // p1 is solved, p2 is attempted incorrectly (unsolved), p3 is untouched
  assert.equal(pickSmartNextProblemId(SAMPLE_PROBLEMS, 'p1', SAMPLE_ATTEMPTS), 'p2');
  assert.equal(pickSmartNextProblemId(SAMPLE_PROBLEMS, 'p2', SAMPLE_ATTEMPTS), 'p3');

  // If all solved, advances sequentially
  const allSolved: AttemptEntry[] = SAMPLE_PROBLEMS.map((p, idx) => ({
    id: `solved-${idx}`,
    problemId: p.id,
    chapter: p.chapter,
    grade: p.grade,
    board: p.board,
    difficulty: p.difficulty,
    isCorrect: true,
    timeSpentSec: 20,
    ratingDelta: 10,
    timestamp: '2026-11-19T10:10:00.000Z',
  }));
  assert.equal(pickSmartNextProblemId(SAMPLE_PROBLEMS, 'p3', allSolved), 'p1');
  assert.equal(pickSmartNextProblemId([], 'p1', allSolved), null);
});

test('computeSessionStats calculates accuracy and average solve time cleanly', () => {
  assert.deepEqual(computeSessionStats([]), {
    attempted: 0,
    correct: 0,
    accuracyPercent: 0,
    avgTimeSec: 0,
  });
  const stats = computeSessionStats(SAMPLE_ATTEMPTS);
  assert.deepEqual(stats, {
    attempted: 2,
    correct: 1,
    accuracyPercent: 50,
    avgTimeSec: 40,
  });
});

test('escapeCsvCell neutralizes spreadsheet formula injection and buildAttemptsCsv formats rows', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(escapeCsvCell('+cmd|"/C calc"!A0'), "\"'+cmd|\"\"/C calc\"\"!A0\"");
  assert.equal(escapeCsvCell('@HYPERLINK("http://evil")'), "\"'@HYPERLINK(\"\"http://evil\"\")\"");
  assert.equal(escapeCsvCell('Normal, Text'), '"Normal, Text"');

  const csv = buildAttemptsCsv(SAMPLE_ATTEMPTS);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('Timestamp,Problem ID,Chapter'));
  assert.ok(lines[1].includes('Correct,32,14'));
  assert.ok(lines[2].includes("Incorrect,48,'-10"));
});

test('latexToPlaintext and normalizeLatexDelimiters convert mathematical notation cleanly', () => {
  const plain = latexToPlaintext('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  assert.equal(plain, '(-b ± √(b^2 - 4ac))/(2a)');

  const norm = normalizeLatexDelimiters('Solve \\(x^2 = 9\\) and \\[a^2 + b^2 = c^2\\]');
  assert.equal(norm, 'Solve $x^2 = 9$ and $$a^2 + b^2 = c^2$$');
});

test('buildTutorMarkdownExport outputs chronological Markdown notes and formatStopwatch pads mm:ss', () => {
  const md = buildTutorMarkdownExport(
    [
      {
        question: 'Second question',
        responseType: 'chat',
        chatReply: 'Second reply',
        conceptTitle: 'Chat',
        prerequisiteRecap: '',
        steps: [],
        finalAnswer: '',
        examTip: '',
        timestamp: '10:05',
      },
      {
        question: 'First question',
        responseType: 'math',
        conceptTitle: 'Pythagoras',
        prerequisiteRecap: 'a² + b² = c²',
        steps: ['Step 1: 3² + 4² = 25', 'Step 2: √25 = 5'],
        finalAnswer: '5',
        examTip: 'Memorize triples',
        timestamp: '10:00',
      },
    ],
    '10',
    'ICSE'
  );
  assert.ok(md.includes('Standard 10 (ICSE)'));
  assert.ok(md.indexOf('## Q1: First question') < md.indexOf('## Q2: Second question'));
  assert.ok(md.includes('**Final Answer:** 5'));

  assert.equal(formatStopwatch(0), '00:00');
  assert.equal(formatStopwatch(65), '01:05');
  assert.equal(formatStopwatch(-5), '00:00');
});

test('storageSafety reads/writes versioned envelopes, ignores stale versions, and clears prefixed cache', () => {
  writeVersionedStorage('psma_test_prefs', 1, { dark: true, count: 3 });
  assert.deepEqual(
    readVersionedStorage('psma_test_prefs', 1, { dark: false, count: 0 }),
    { dark: true, count: 3 }
  );
  // Version mismatch returns fallback safely
  assert.deepEqual(
    readVersionedStorage('psma_test_prefs', 2, { dark: false, count: 0 }),
    { dark: false, count: 0 }
  );

  writeVersionedStorage('selina_bookmarks', 1, ['p1']);
  writeVersionedStorage('other_key', 1, 'keep');

  const removed = clearAppStorageCache(['selina_', 'psma_']);
  assert.ok(removed >= 2);
  assert.deepEqual(readVersionedStorage('psma_test_prefs', 1, null), null);
  assert.equal(readVersionedStorage('other_key', 1, 'missing'), 'keep');

  removeVersionedStorage('other_key');
  assert.equal(readVersionedStorage('other_key', 1, 'missing'), 'missing');
});
