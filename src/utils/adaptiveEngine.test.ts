import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUpdatedRating,
  recommendNextDifficulty,
  evaluateQuadratic,
  evaluateTrigSightline,
  sanitizeStudentProfilePayload,
  computeGamificationStats,
  evaluateBadges,
  buildAcademyLeaderboard,
  buildAdaptiveStudySchedule,
  computeChapterMastery,
  getTopWeakTopics,
  filterProblemsByWeakTopics,
  ProblemItem,
  AttemptEntry,
} from './adaptiveEngine';

test('calculateUpdatedRating increases rating when solving a Challenging sum accurately', () => {
  const { newRating, delta } = calculateUpdatedRating(1350, 'Challenging', true, 30);
  assert.ok(delta > 0, 'Delta should be positive for correct answer');
  assert.equal(newRating, 1350 + delta);
});

test('calculateUpdatedRating decreases rating on incorrect answer and stays within bounds', () => {
  const { newRating, delta } = calculateUpdatedRating(1350, 'Foundation', false, 50);
  assert.ok(delta < 0, 'Delta should be negative for wrong answer');
  assert.ok(newRating >= 600 && newRating <= 2600);
});

test('recommendNextDifficulty selects appropriate tier based on rating', () => {
  assert.equal(recommendNextDifficulty(1150), 'Foundation');
  assert.equal(recommendNextDifficulty(1360), 'Standard');
  assert.equal(recommendNextDifficulty(1550), 'Challenging');
});

test('evaluateQuadratic computes discriminant, vertex, and roots accurately for x^2 - 5x + 6 = 0', () => {
  const res = evaluateQuadratic(1, -5, 6);
  assert.equal(res.discriminant, 1);
  assert.equal(res.vertexX, 2.5);
  assert.equal(res.vertexY, -0.25);
  assert.equal(res.sumOfRoots, 5);
  assert.equal(res.productOfRoots, 6);
  assert.ok(res.rootsText.includes('3.00') && res.rootsText.includes('2.00'));
});

test('evaluateTrigSightline computes horizontal distance for 45 degree depression', () => {
  const res = evaluateTrigSightline(120, 45);
  assert.equal(res.horizontalDistanceM, 120);
  assert.equal(res.tanValue, 1);
});

test('sanitizeStudentProfilePayload enforces volumetric limits and valid enums', () => {
  const sanitized = sanitizeStudentProfilePayload({
    uid: 'user_123$bad!',
    displayName: 'A'.repeat(120),
    grade: '99',
    board: 'INVALID',
    adaptiveRating: 9999,
    solvedCount: -5,
    accuracyPercent: 140,
    streakDays: 12,
    weakTopics: Array.from({ length: 15 }, (_, i) => `Topic ${i}`),
  });
  assert.equal(sanitized.uid, 'user_123bad');
  assert.equal(sanitized.displayName.length, 80);
  assert.equal(sanitized.grade, '10');
  assert.equal(sanitized.board, 'ICSE');
  assert.equal(sanitized.adaptiveRating, 2600);
  assert.equal(sanitized.solvedCount, 0);
  assert.equal(sanitized.accuracyPercent, 100);
  assert.equal(sanitized.weakTopics.length, 10);
});



test('computeGamificationStats calculates XP, level, and progress accurately', () => {
  const stats = computeGamificationStats(
    [
      {
        id: '1',
        problemId: 'p1',
        chapter: 'Ch 1 · GST',
        grade: '10',
        board: 'ICSE',
        difficulty: 'Challenging',
        isCorrect: true,
        timeSpentSec: 30,
        ratingDelta: 20,
        timestamp: '',
      },
    ],
    2,
    1,
    7
  );
  assert.ok(stats.totalXp > 600);
  assert.ok(stats.level >= 3);
  assert.ok(stats.levelProgressPercent >= 0 && stats.levelProgressPercent <= 100);
});

test('evaluateBadges unlocks Selina badges when criteria are met', () => {
  const badges = evaluateBadges(
    [
      {
        id: '1',
        problemId: 'p1',
        chapter: 'Ch 1 · GST',
        grade: '10',
        board: 'ICSE',
        difficulty: 'Challenging',
        isCorrect: true,
        timeSpentSec: 25,
        ratingDelta: 20,
        timestamp: '',
      },
    ],
    1420,
    7,
    2
  );
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  assert.ok(unlockedCount >= 4);
});

test('buildAcademyLeaderboard ranks current student among peers by XP', () => {
  const board = buildAcademyLeaderboard({
    name: 'Aarav Sharma',
    grade: '10',
    board: 'ICSE',
    xp: 1200,
    adaptiveRating: 1550,
    streakDays: 10,
    badgesCount: 6,
  });
  assert.equal(board[0].isCurrentUser, true);
  assert.equal(board[0].name, 'Aarav Sharma');
});

test('buildAdaptiveStudySchedule adapts durations and titles to student feedback', () => {
  const normalSchedule = buildAdaptiveStudySchedule({
    grade: '10',
    board: 'ICSE',
    pace: 'Balanced',
    weakTopics: ['Ch 21 · Trigonometrical Identities'],
    feedbackMode: 'normal',
  });
  const slowerSchedule = buildAdaptiveStudySchedule({
    grade: '10',
    board: 'ICSE',
    pace: 'Balanced',
    weakTopics: ['Ch 21 · Trigonometrical Identities'],
    feedbackMode: 'need_more_time',
  });
  assert.ok(slowerSchedule[0].durationMin > normalSchedule[0].durationMin);
  assert.ok(slowerSchedule[0].title.includes('Prerequisite Bridge'));
});



const mockProblems: ProblemItem[] = [
  {
    id: 'p_gst',
    grade: '10',
    board: 'ICSE',
    chapter: 'Ch 1 · GST',
    exerciseRef: 'Ex 1',
    difficulty: 'Foundation',
    marks: 3,
    question: 'Q1',
    options: ['A', 'B'],
    correctIndex: 0,
    prerequisiteRecap: '',
    shortcutTrick: '',
    stepByStepSolution: ['S1'],
  },
  {
    id: 'p_trig',
    grade: '10',
    board: 'ICSE',
    chapter: 'Ch 21 · Trigonometrical Identities',
    exerciseRef: 'Ex 21',
    difficulty: 'Challenging',
    marks: 4,
    question: 'Q2',
    options: ['A', 'B'],
    correctIndex: 0,
    prerequisiteRecap: '',
    shortcutTrick: '',
    stepByStepSolution: ['S1'],
  },
  {
    id: 'p_quad',
    grade: '10',
    board: 'ICSE',
    chapter: 'Ch 5 · Quadratic Equations',
    exerciseRef: 'Ex 5',
    difficulty: 'Standard',
    marks: 4,
    question: 'Q3',
    options: ['A', 'B'],
    correctIndex: 0,
    prerequisiteRecap: '',
    shortcutTrick: '',
    stepByStepSolution: ['S1'],
  },
  {
    id: 'p_surds',
    grade: '9',
    board: 'ICSE',
    chapter: 'Ch 1 · Rational and Irrational Numbers',
    exerciseRef: 'Ex 1C',
    difficulty: 'Standard',
    marks: 4,
    question: 'Q4',
    options: ['A', 'B'],
    correctIndex: 0,
    prerequisiteRecap: '',
    shortcutTrick: '',
    stepByStepSolution: ['S1'],
  },
  {
    id: 'p_coord',
    grade: '9',
    board: 'ICSE',
    chapter: 'Ch 26 · Coordinate Geometry',
    exerciseRef: 'Ex 26',
    difficulty: 'Standard',
    marks: 4,
    question: 'Q5',
    options: ['A', 'B'],
    correctIndex: 0,
    prerequisiteRecap: '',
    shortcutTrick: '',
    stepByStepSolution: ['S1'],
  },
];

test('getTopWeakTopics ranks Needs Review chapters by lowest accuracy first and excludes Mastered chapters', () => {
  const attempts: AttemptEntry[] = [
    // Mastered (100%)
    {
      id: 'a1',
      problemId: 'p_gst',
      chapter: 'Ch 1 · GST',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Foundation',
      isCorrect: true,
      timeSpentSec: 30,
      ratingDelta: 15,
      timestamp: '',
    },
    // Needs Review (0%, 2 misses)
    {
      id: 'a2',
      problemId: 'p_trig',
      chapter: 'Ch 21 · Trigonometrical Identities',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Challenging',
      isCorrect: false,
      timeSpentSec: 60,
      ratingDelta: -12,
      timestamp: '',
    },
    {
      id: 'a3',
      problemId: 'p_trig',
      chapter: 'Ch 21 · Trigonometrical Identities',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Challenging',
      isCorrect: false,
      timeSpentSec: 55,
      ratingDelta: -10,
      timestamp: '',
    },
    // Needs Review (50%, 1 miss)
    {
      id: 'a4',
      problemId: 'p_quad',
      chapter: 'Ch 5 · Quadratic Equations',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Standard',
      isCorrect: true,
      timeSpentSec: 40,
      ratingDelta: 12,
      timestamp: '',
    },
    {
      id: 'a5',
      problemId: 'p_quad',
      chapter: 'Ch 5 · Quadratic Equations',
      grade: '10',
      board: 'ICSE',
      difficulty: 'Standard',
      isCorrect: false,
      timeSpentSec: 50,
      ratingDelta: -12,
      timestamp: '',
    },
  ];

  const mastery = computeChapterMastery(mockProblems, attempts);
  const top3 = getTopWeakTopics(mastery.chapters, 3, {
    problems: mockProblems,
    preferredGrade: '9',
  });

  assert.equal(top3.length, 3);
  assert.equal(top3[0].chapter, 'Ch 21 · Trigonometrical Identities');
  assert.equal(top3[1].chapter, 'Ch 5 · Quadratic Equations');
  // Third slot filled by preferred Grade 9 unattempted chapter, NOT Mastered Ch 1 · GST
  assert.equal(top3[2].chapter, 'Ch 1 · Rational and Irrational Numbers');
  assert.equal(top3.some((c) => c.chapter === 'Ch 1 · GST'), false);
});

test('filterProblemsByWeakTopics returns only problems matching top 3 weak topics in priority order', () => {
  const top3Names = [
    'Ch 21 · Trigonometrical Identities',
    'Ch 5 · Quadratic Equations',
    'Ch 26 · Coordinate Geometry',
  ];
  const filtered = filterProblemsByWeakTopics(mockProblems, top3Names);
  assert.equal(filtered.length, 3);
  assert.deepEqual(
    filtered.map((p) => p.chapter),
    top3Names
  );
  assert.equal(filtered.some((p) => p.chapter === 'Ch 1 · GST'), false);
});


