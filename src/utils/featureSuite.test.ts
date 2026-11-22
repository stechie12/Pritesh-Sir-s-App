import test from 'node:test';
import assert from 'node:assert/strict';
import { HUNDRED_FEATURES_CATALOG, FEATURE_CATEGORIES } from '../data/featureSuiteCatalog.ts';
import {
  DEFAULT_PEDAGOGY_CONFIG,
  buildPedagogyPromptPrefix,
  detectCommonMathTraps,
  detectPrerequisiteBridges,
  generateTwinProblem,
  verifyAlgebraicSteps,
} from './tutorPedagogy.ts';
import {
  INITIAL_SM2_FLASHCARDS,
  computeChapterPacing,
  computeExamReadiness,
  decodeQuizCode,
  encodeQuizCode,
  evaluateSkillTreeNodes,
  generateMentalSprintQuestion,
  getDailyPotd,
  reviewSm2Card,
} from './studySuiteEngine.ts';
import {
  DEFAULT_WORKSPACE_PREFS,
  buildConsistencyHeatmap,
  buildStudyBackupJson,
  createTeacherAssignmentCode,
  parseStudyBackupJson,
  summarizeChatThread,
} from './workspacePreferences.ts';

test('HUNDRED_FEATURES_CATALOG contains exactly 100 unique numbered features 1..100 across 9 categories', () => {
  assert.equal(HUNDRED_FEATURES_CATALOG.length, 100);
  assert.equal(FEATURE_CATEGORIES.length, 9);
  const ids = new Set(HUNDRED_FEATURES_CATALOG.map((f) => f.id));
  assert.equal(ids.size, 100);
  for (let i = 1; i <= 100; i++) {
    assert.equal(ids.has(i), true, `Missing feature #${i}`);
  }
});

test('buildPedagogyPromptPrefix composes Socratic, Marking Scheme, Bilingual, Persona, and Memory directives', () => {
  const prefix = buildPedagogyPromptPrefix(
    {
      ...DEFAULT_PEDAGOGY_CONFIG,
      socraticMode: true,
      socraticHintLevel: 2,
      showMarkingScheme: true,
      bilingualLanguage: 'Hinglish',
      persona: 'strict-examiner',
      crossThreadMemory: 'Often drops minus sign on expansion',
    },
    'ICSE',
    '10'
  );
  assert.match(prefix, /Socratic Hint Ladder Level 2\/3/);
  assert.match(prefix, /\[M1\]/);
  assert.match(prefix, /Hinglish/);
  assert.match(prefix, /Strict ICSE Board Examiner/);
  assert.match(prefix, /minus sign/);
});

test('detectCommonMathTraps surfaces relevant warnings for quadratic, trig, and mensuration questions', () => {
  const quadTraps = detectCommonMathTraps('Solve quadratic x^2 - 5x + 6 = 0');
  assert.ok(quadTraps.some((t) => t.id === 'plus-minus'));

  const mensTraps = detectCommonMathTraps('Find volume of cylinder with diameter 14 cm');
  assert.ok(mensTraps.some((t) => t.id === 'radius-diameter'));

  const twin = generateTwinProblem('Rationalize 1 / (3 + √2)', '9');
  assert.match(twin, /Rationalize/i);
});

test('verifyAlgebraicSteps validates equivalent steps and flags algebraic mistakes', () => {
  const rows = verifyAlgebraicSteps('2x + 6 = 14\n2x = 8\nx = 4\nx = 5');
  assert.equal(rows.length, 4);
  assert.equal(rows[0].status, 'base');
  assert.equal(rows[1].status, 'valid');
  assert.equal(rows[2].status, 'valid');
  assert.equal(rows[3].status, 'mismatch');
});

test('reviewSm2Card advances interval and ease factor cleanly', () => {
  const card = INITIAL_SM2_FLASHCARDS[0];
  const r1 = reviewSm2Card(card, 5, 1_700_000_000_000);
  assert.equal(r1.repetitions, 1);
  assert.equal(r1.intervalDays, 1);
  const r2 = reviewSm2Card(r1, 5, 1_700_000_000_000);
  assert.equal(r2.repetitions, 2);
  assert.equal(r2.intervalDays, 6);
  const lapsed = reviewSm2Card(r2, 1, 1_700_000_000_000);
  assert.equal(lapsed.repetitions, 0);
  assert.equal(lapsed.intervalDays, 1);
});

test('quiz code round-trip, mental sprint, readiness, POTD, skill tree, and pacing work deterministically', () => {
  const code = encodeQuizCode({ board: 'ICSE', grade: '10', chapter: 'TRIG', count: 8, seed: 421 });
  const decoded = decodeQuizCode(code);
  assert.deepEqual(decoded, { board: 'ICSE', grade: '10', chapter: 'TRIG', count: 8, seed: 1421 });

  const q = generateMentalSprintQuestion(12);
  assert.equal(typeof q.answer, 'number');
  assert.ok(q.prompt.includes('?'));

  const readiness = computeExamReadiness({
    examDateIso: '2026-12-20',
    overallAccuracy: 80,
    solvedCount: 30,
    nowMs: Date.parse('2026-11-20'),
  });
  assert.equal(readiness.daysRemaining, 30);
  assert.ok(readiness.readinessPercent >= 50 && readiness.readinessPercent <= 100);

  const potd = getDailyPotd('9', new Date('2026-11-21T00:00:00Z'));
  assert.equal(potd.grade, '9');
  assert.equal(potd.dateKey, '2026-11-21');

  const bridges = detectPrerequisiteBridges(['Trigonometrical Identities']);
  assert.ok(bridges.length >= 1);

  const tree = evaluateSkillTreeNodes([
    {
      id: 'a1',
      problemId: 'p1',
      chapter: 'Ch 21 · Trigonometrical Identities',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Standard',
      isCorrect: true,
      timeSpentSec: 35,
      ratingDelta: 15,
      timestamp: '2026-11-21T00:00:00Z',
    },
  ]);
  const trigNode = tree.find((n) => n.id === 'n_trig');
  assert.equal(trigNode?.status, 'mastered');

  const pacing = computeChapterPacing([
    {
      id: 'a1',
      problemId: 'p1',
      chapter: 'Ch 5 · Quadratic Equations',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Standard',
      isCorrect: true,
      timeSpentSec: 72,
      ratingDelta: 10,
      timestamp: '2026-11-21T00:00:00Z',
    },
  ]);
  assert.equal(pacing[0].paceLabel, 'Slow — Practice Speed');
});

test('backup JSON round-trip, chat summarizer, teacher assignment code, and 12-week heatmap work cleanly', () => {
  const json = buildStudyBackupJson({
    prefs: DEFAULT_WORKSPACE_PREFS,
    notes: [{ id: 'n1', title: 'Trig', chapter: 'Trig', body: 'sin²θ + cos²θ = 1', updatedAt: '2026-11-21' }],
    insights: [],
    escalations: [],
  });
  const parsed = parseStudyBackupJson(json);
  assert.ok(parsed);
  assert.equal(parsed?.notes.length, 1);
  assert.equal(parseStudyBackupJson('not json'), null);

  const summary = summarizeChatThread([
    { question: 'Solve x^2 - 4 = 0', chatReply: 'Factor as (x-2)(x+2)=0 so x = 2 or x = -2', finalAnswer: 'x = ±2' },
  ]);
  assert.equal(summary.bullets.length, 1);

  const hw = createTeacherAssignmentCode({
    title: 'Weekend Trig Sheet',
    board: 'ICSE',
    grade: '10',
    chapter: 'Trigonometry',
    problemCount: 10,
    dueDate: '2026-11-28',
  });
  assert.match(hw.code, /^HW-I10-TRIGON-10P-1128$/);

  const heatmap = buildConsistencyHeatmap([{ timestamp: '2026-11-21T10:00:00Z' }], new Date('2026-11-21T12:00:00Z'));
  assert.equal(heatmap.length, 84);
  assert.equal(heatmap[83].count, 1);
});
