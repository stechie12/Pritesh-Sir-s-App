export type DifficultyTier = 'Foundation' | 'Standard' | 'Challenging';
export type GradeLevel = '8' | '9' | '10' | '11' | '12';
export type CurriculumBoard = 'ICSE' | 'CBSE';

export interface ProblemItem {
  id: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  chapter: string;
  exerciseRef: string;
  difficulty: DifficultyTier;
  marks: number;
  question: string;
  options: string[];
  correctIndex: number;
  prerequisiteRecap: string;
  shortcutTrick: string;
  stepByStepSolution: string[];
}

export interface AttemptEntry {
  id: string;
  problemId: string;
  chapter: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  difficulty: DifficultyTier;
  isCorrect: boolean;
  timeSpentSec: number;
  ratingDelta: number;
  timestamp: string;
}

export interface ChapterMasteryItem {
  chapter: string;
  attempted: number;
  correct: number;
  accuracyPercent: number;
  masteryStatus: 'Mastered' | 'Developing' | 'Needs Review';
}

const DIFFICULTY_ANCHOR: Record<DifficultyTier, number> = {
  Foundation: 1100,
  Standard: 1350,
  Challenging: 1600,
};

/**
 * Calculates the updated adaptive ELO rating after a student attempts a math sum.
 * Bounded strictly within [600, 2600] to match Firestore security rules.
 */
export function calculateUpdatedRating(
  currentRating: number,
  difficulty: DifficultyTier,
  isCorrect: boolean,
  timeSpentSec: number
): { newRating: number; delta: number } {
  const anchor = DIFFICULTY_ANCHOR[difficulty] ?? 1350;
  const expectedScore = 1 / (1 + Math.pow(10, (anchor - currentRating) / 400));
  const kFactor = 36;
  const actualScore = isCorrect ? 1 : 0;
  const speedBonus = isCorrect && timeSpentSec > 0 && timeSpentSec <= 45 ? 4 : 0;

  const rawDelta = Math.round(kFactor * (actualScore - expectedScore) + speedBonus);
  const clampedDelta = Math.max(-100, Math.min(100, rawDelta));
  const newRating = Math.max(600, Math.min(2600, currentRating + clampedDelta));

  return {
    newRating,
    delta: newRating - currentRating,
  };
}

/**
 * Maps current student adaptive rating to the recommended difficulty tier.
 */
export function recommendNextDifficulty(rating: number): DifficultyTier {
  if (rating < 1240) return 'Foundation';
  if (rating < 1480) return 'Standard';
  return 'Challenging';
}

/**
 * Computes chapter-by-chapter mastery breakdown and identifies weak topics (bounded <= 10).
 */
export function computeChapterMastery(
  problems: ProblemItem[],
  attempts: AttemptEntry[]
): {
  chapters: ChapterMasteryItem[];
  weakTopics: string[];
  overallAccuracy: number;
} {
  const map = new Map<string, { attempted: number; correct: number }>();

  for (const p of problems) {
    if (!map.has(p.chapter)) {
      map.set(p.chapter, { attempted: 0, correct: 0 });
    }
  }

  let totalAttempted = 0;
  let totalCorrect = 0;

  for (const att of attempts) {
    totalAttempted += 1;
    if (att.isCorrect) totalCorrect += 1;
    const prev = map.get(att.chapter) ?? { attempted: 0, correct: 0 };
    map.set(att.chapter, {
      attempted: prev.attempted + 1,
      correct: prev.correct + (att.isCorrect ? 1 : 0),
    });
  }

  const chapters: ChapterMasteryItem[] = [];
  const weakTopics: string[] = [];

  for (const [chapter, stats] of map.entries()) {
    const accuracyPercent =
      stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;
    let masteryStatus: 'Mastered' | 'Developing' | 'Needs Review' = 'Developing';

    if (stats.attempted > 0 && accuracyPercent >= 80) {
      masteryStatus = 'Mastered';
    } else if (stats.attempted > 0 && accuracyPercent < 65) {
      masteryStatus = 'Needs Review';
      if (weakTopics.length < 10) {
        weakTopics.push(chapter.slice(0, 80));
      }
    }

    chapters.push({
      chapter,
      attempted: stats.attempted,
      correct: stats.correct,
      accuracyPercent,
      masteryStatus,
    });
  }

  // Sort weak topics by lowest accuracy first, then most missed attempts
  const needsReviewSorted = chapters
    .filter((ch) => ch.masteryStatus === 'Needs Review')
    .sort(
      (a, b) =>
        a.accuracyPercent - b.accuracyPercent ||
        b.attempted - b.correct - (a.attempted - a.correct)
    );

  const orderedWeakTopics = needsReviewSorted.map((ch) => ch.chapter.slice(0, 80));

  if (orderedWeakTopics.length === 0 && chapters.length > 0) {
    orderedWeakTopics.push(chapters[0].chapter.slice(0, 80));
  }

  const overallAccuracy =
    totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 85;

  return {
    chapters,
    weakTopics: orderedWeakTopics.slice(0, 10),
    overallAccuracy: Math.max(0, Math.min(100, overallAccuracy)),
  };
}

/**
 * Selects the student's top N (default 3) weak topics from mastery analytics:
 * 1. Attempted chapters marked 'Needs Review' (< 65% accuracy), lowest accuracy first
 * 2. Attempted chapters marked 'Developing' (65%–79% accuracy), lowest accuracy first
 * 3. Unattempted chapters (preferring the student's active grade first) to fill remaining slots
 * Already 'Mastered' chapters (>= 80% accuracy) are excluded unless no unmastered chapters exist.
 */
export function getTopWeakTopics(
  chapters: ChapterMasteryItem[],
  limit = 3,
  options?: {
    problems?: ProblemItem[];
    preferredGrade?: GradeLevel;
  }
): ChapterMasteryItem[] {
  if (chapters.length === 0 || limit <= 0) return [];

  const preferredChapters = new Set<string>();
  if (options?.problems && options?.preferredGrade) {
    for (const p of options.problems) {
      if (p.grade === options.preferredGrade) {
        preferredChapters.add(p.chapter);
      }
    }
  }

  const needsReview = chapters
    .filter((ch) => ch.attempted > 0 && ch.masteryStatus === 'Needs Review')
    .sort(
      (a, b) =>
        a.accuracyPercent - b.accuracyPercent ||
        b.attempted - b.correct - (a.attempted - a.correct)
    );

  const developingAttempted = chapters
    .filter((ch) => ch.attempted > 0 && ch.masteryStatus === 'Developing')
    .sort(
      (a, b) =>
        a.accuracyPercent - b.accuracyPercent ||
        b.attempted - b.correct - (a.attempted - a.correct)
    );

  const unattempted = chapters
    .filter((ch) => ch.attempted === 0)
    .sort((a, b) => {
      const aPref = preferredChapters.has(a.chapter) ? 0 : 1;
      const bPref = preferredChapters.has(b.chapter) ? 0 : 1;
      return aPref - bPref;
    });

  const combined = [...needsReview, ...developingAttempted, ...unattempted];
  if (combined.length > 0) {
    return combined.slice(0, limit);
  }

  // Fallback only if every single chapter is already Mastered: pick lowest-accuracy mastered chapters
  return [...chapters]
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent)
    .slice(0, limit);
}

/**
 * Filters the problem bank to include only problems belonging to the specified weak topics,
 * preserving weak-topic priority order (weakest topic's problems first).
 */
export function filterProblemsByWeakTopics(
  problems: ProblemItem[],
  weakTopicNames: string[]
): ProblemItem[] {
  if (weakTopicNames.length === 0) return [];

  const normalizedRank = new Map<string, number>();
  weakTopicNames.forEach((name, idx) => {
    const key = name.trim().toLowerCase();
    if (!normalizedRank.has(key)) {
      normalizedRank.set(key, idx);
    }
  });

  return problems
    .filter((p) => normalizedRank.has(p.chapter.trim().toLowerCase()))
    .sort((a, b) => {
      const rankA = normalizedRank.get(a.chapter.trim().toLowerCase()) ?? 999;
      const rankB = normalizedRank.get(b.chapter.trim().toLowerCase()) ?? 999;
      return rankA - rankB;
    });
}

/**
 * Pure quadratic equation analyzer for Selina Concise Ch 5 Interactive Visualizer.
 */
export function evaluateQuadratic(a: number, b: number, c: number) {
  const safeA = a === 0 ? 1 : a;
  const discriminant = b * b - 4 * safeA * c;
  const vertexX = -b / (2 * safeA);
  const vertexY = safeA * vertexX * vertexX + b * vertexX + c;

  let natureOfRoots = 'Real and Distinct Roots (Δ > 0)';
  let rootsText = '';

  if (discriminant > 0) {
    const r1 = (-b + Math.sqrt(discriminant)) / (2 * safeA);
    const r2 = (-b - Math.sqrt(discriminant)) / (2 * safeA);
    natureOfRoots = 'Real and Distinct Roots (Δ > 0)';
    rootsText = `x₁ = ${r1.toFixed(2)}, x₂ = ${r2.toFixed(2)}`;
  } else if (discriminant === 0) {
    const r = -b / (2 * safeA);
    natureOfRoots = 'Real and Equal Roots (Δ = 0)';
    rootsText = `x₁ = x₂ = ${r.toFixed(2)}`;
  } else {
    const realPart = (-b / (2 * safeA)).toFixed(2);
    const imagPart = (Math.sqrt(Math.abs(discriminant)) / (2 * Math.abs(safeA))).toFixed(2);
    natureOfRoots = 'Imaginary / Complex Conjugate Roots (Δ < 0)';
    rootsText = `x = ${realPart} ± ${imagPart}i`;
  }

  return {
    discriminant: Number(discriminant.toFixed(2)),
    vertexX: Number(vertexX.toFixed(2)),
    vertexY: Number(vertexY.toFixed(2)),
    natureOfRoots,
    rootsText,
    sumOfRoots: Number((-b / safeA).toFixed(2)),
    productOfRoots: Number((c / safeA).toFixed(2)),
  };
}

/**
 * Pure Heights & Distances calculator for Selina Concise Ch 22 Interactive Simulator.
 */
export function evaluateTrigSightline(cliffHeightM: number, depressionDeg: number) {
  const clampedAngle = Math.max(10, Math.min(80, depressionDeg));
  const rad = (clampedAngle * Math.PI) / 180;
  const horizontalDistanceM = cliffHeightM / Math.tan(rad);
  const sightlineHypotenuseM = cliffHeightM / Math.sin(rad);

  return {
    cliffHeightM,
    depressionDeg: clampedAngle,
    horizontalDistanceM: Number(horizontalDistanceM.toFixed(1)),
    sightlineHypotenuseM: Number(sightlineHypotenuseM.toFixed(1)),
    tanValue: Number(Math.tan(rad).toFixed(3)),
  };
}

/**
 * Sanitizes student profile fields to guarantee strict compliance with firebase-blueprint.json & firestore.rules.
 */
export function sanitizeStudentProfilePayload(input: {
  uid: string;
  displayName: string;
  grade: string;
  board: string;
  adaptiveRating: number;
  solvedCount: number;
  accuracyPercent: number;
  streakDays: number;
  weakTopics: string[];
}) {
  const safeUid = input.uid.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128) || 'student_1';
  const safeName = (input.displayName || 'Academy Student').trim().slice(0, 80) || 'Academy Student';
  const safeGrade: GradeLevel = (['8', '9', '10', '11', '12'].includes(input.grade)
    ? input.grade
    : '10') as GradeLevel;
  const safeBoard: CurriculumBoard = (['ICSE', 'CBSE'].includes(input.board)
    ? input.board
    : 'ICSE') as CurriculumBoard;

  return {
    uid: safeUid,
    displayName: safeName,
    grade: safeGrade,
    board: safeBoard,
    adaptiveRating: Math.max(600, Math.min(2600, Math.round(input.adaptiveRating || 1350))),
    solvedCount: Math.max(0, Math.min(100000, Math.round(input.solvedCount || 0))),
    accuracyPercent: Math.max(0, Math.min(100, Math.round(input.accuracyPercent || 0))),
    streakDays: Math.max(0, Math.min(3650, Math.round(input.streakDays || 1))),
    weakTopics: (input.weakTopics || [])
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .slice(0, 10)
      .map((t) => t.trim().slice(0, 80)),
  };
}

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  criteriaText: string;
  unlocked: boolean;
  progressPercent: number;
  xpReward: number;
}

export interface LeaderboardStudent {
  id: string;
  name: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  xp: number;
  adaptiveRating: number;
  streakDays: number;
  badgesCount: number;
  isCurrentUser?: boolean;
}

export interface StudySessionTask {
  id: string;
  dayLabel: string;
  timeSlot: string;
  title: string;
  chapter: string;
  type: 'Concept Recap' | 'Selina Drill' | '3D Simulation' | 'Mock Test';
  durationMin: number;
  deadlineLabel: string;
  reminderActive: boolean;
  completed: boolean;
  xpValue: number;
}

/**
 * Computes total XP, current level, and level progress from student activity.
 */
export function computeGamificationStats(
  attempts: AttemptEntry[],
  completedTasksCount: number,
  savedDoubtsCount: number,
  streakDays: number
): {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  levelProgressPercent: number;
} {
  let attemptXp = 0;
  for (const att of attempts) {
    if (att.isCorrect) {
      const tierBonus =
        att.difficulty === 'Challenging' ? 35 : att.difficulty === 'Standard' ? 20 : 10;
      const speedBonus = att.timeSpentSec <= 40 ? 15 : 5;
      attemptXp += 50 + tierBonus + speedBonus;
    } else {
      attemptXp += 15; // Participation & review effort XP
    }
  }

  const plannerXp = completedTasksCount * 45;
  const doubtXp = savedDoubtsCount * 25;
  const streakXp = streakDays * 20;
  const totalXp = 420 + attemptXp + plannerXp + doubtXp + streakXp;

  const xpPerLevel = 250;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const currentLevelXp = totalXp % xpPerLevel;
  const levelProgressPercent = Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100));

  return {
    totalXp,
    level,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    levelProgressPercent,
  };
}

/**
 * Evaluates milestone badges based on real student attempts, ELO rating, and study habits.
 */
export function evaluateBadges(
  attempts: AttemptEntry[],
  adaptiveRating: number,
  streakDays: number,
  completedTasksCount: number
): GamificationBadge[] {
  const correctAttempts = attempts.filter((a) => a.isCorrect);
  const challengingCorrect = correctAttempts.filter((a) => a.difficulty === 'Challenging').length;
  const commercialCorrect = correctAttempts.filter(
    (a) => a.chapter.includes('GST') || a.chapter.includes('Banking') || a.chapter.includes('Interest')
  ).length;
  const trigOrGeomCorrect = correctAttempts.filter(
    (a) => a.chapter.includes('Trig') || a.chapter.includes('Heights') || a.chapter.includes('Circle') || a.chapter.includes('Cylinder')
  ).length;

  return [
    {
      id: 'badge_selina_starter',
      title: 'Selina Centurion',
      description: 'Solve 3 or more graded Selina Concise / NCERT sums accurately.',
      criteriaText: `${Math.min(3, correctAttempts.length)} / 3 Correct Sums`,
      unlocked: correctAttempts.length >= 3,
      progressPercent: Math.min(100, Math.round((correctAttempts.length / 3) * 100)),
      xpReward: 100,
    },
    {
      id: 'badge_commercial_ace',
      title: 'Commercial Maths & GST Ace',
      description: 'Master intra-state GST, Recurring Deposit, or Compound Interest derivations.',
      criteriaText: `${Math.min(2, commercialCorrect)} / 2 Commercial Sums`,
      unlocked: commercialCorrect >= 1,
      progressPercent: Math.min(100, commercialCorrect >= 1 ? 100 : 50),
      xpReward: 120,
    },
    {
      id: 'badge_hots_challenger',
      title: 'Board HOTS Challenger',
      description: 'Solve a Challenging-tier board problem or reach 1400+ Adaptive ELO.',
      criteriaText: adaptiveRating >= 1400 ? `${adaptiveRating} ELO Reached` : `${challengingCorrect} / 1 HOTS Sum`,
      unlocked: challengingCorrect >= 1 || adaptiveRating >= 1400,
      progressPercent: Math.min(
        100,
        challengingCorrect >= 1 ? 100 : Math.round((adaptiveRating / 1400) * 100)
      ),
      xpReward: 150,
    },
    {
      id: 'badge_spatial_architect',
      title: '3D Geometry & Sightline Architect',
      description: 'Master Trigonometry, Heights & Distances, or 3D Mensuration solids.',
      criteriaText: `${Math.min(1, trigOrGeomCorrect)} / 1 Spatial/Trig Sum`,
      unlocked: trigOrGeomCorrect >= 1,
      progressPercent: trigOrGeomCorrect >= 1 ? 100 : 60,
      xpReward: 130,
    },
    {
      id: 'badge_streak_scholar',
      title: '7-Day Discipline Streak',
      description: 'Maintain a 7-day consecutive daily mathematics practice streak.',
      criteriaText: `${Math.min(7, streakDays)} / 7 Streak Days`,
      unlocked: streakDays >= 7,
      progressPercent: Math.min(100, Math.round((streakDays / 7) * 100)),
      xpReward: 150,
    },
    {
      id: 'badge_planner_finisher',
      title: 'Dynamic Planner Finisher',
      description: 'Complete 2 scheduled AI Study Planner sessions before their deadline.',
      criteriaText: `${Math.min(2, completedTasksCount)} / 2 Sessions Done`,
      unlocked: completedTasksCount >= 2,
      progressPercent: Math.min(100, Math.round((completedTasksCount / 2) * 100)),
      xpReward: 110,
    },
  ];
}

/**
 * Builds and sorts the Academy Leaderboard with the current student dynamically ranked.
 */
export function buildAcademyLeaderboard(currentStudent: {
  name: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  xp: number;
  adaptiveRating: number;
  streakDays: number;
  badgesCount: number;
}): LeaderboardStudent[] {
  const peers: LeaderboardStudent[] = [
    {
      id: 'peer_1',
      name: 'Ananya Chatterjee',
      grade: '10',
      board: 'ICSE',
      xp: 980,
      adaptiveRating: 1510,
      streakDays: 14,
      badgesCount: 5,
    },
    {
      id: 'peer_2',
      name: 'Rohan Deshmukh',
      grade: '10',
      board: 'ICSE',
      xp: 845,
      adaptiveRating: 1425,
      streakDays: 9,
      badgesCount: 4,
    },
    {
      id: 'peer_3',
      name: 'Kabir Verma',
      grade: '9',
      board: 'ICSE',
      xp: 760,
      adaptiveRating: 1380,
      streakDays: 6,
      badgesCount: 3,
    },
    {
      id: 'peer_4',
      name: 'Meera Krishnan',
      grade: '12',
      board: 'CBSE',
      xp: 920,
      adaptiveRating: 1490,
      streakDays: 11,
      badgesCount: 5,
    },
    {
      id: 'peer_5',
      name: 'Vivaan Nair',
      grade: '8',
      board: 'ICSE',
      xp: 690,
      adaptiveRating: 1295,
      streakDays: 5,
      badgesCount: 3,
    },
    {
      id: 'peer_6',
      name: 'Diya Sengupta',
      grade: '11',
      board: 'CBSE',
      xp: 790,
      adaptiveRating: 1395,
      streakDays: 8,
      badgesCount: 4,
    },
  ];

  const userEntry: LeaderboardStudent = {
    id: 'current_student',
    name: currentStudent.name,
    grade: currentStudent.grade,
    board: currentStudent.board,
    xp: currentStudent.xp,
    adaptiveRating: currentStudent.adaptiveRating,
    streakDays: currentStudent.streakDays,
    badgesCount: currentStudent.badgesCount,
    isCurrentUser: true,
  };

  return [...peers, userEntry].sort((a, b) => b.xp - a.xp || b.adaptiveRating - a.adaptiveRating);
}

/**
 * Generates an adaptive study schedule tailored to student pace, weak topics, and feedback.
 */
export function buildAdaptiveStudySchedule(params: {
  grade: GradeLevel;
  board: CurriculumBoard;
  pace: 'Foundation-First' | 'Balanced' | 'Intensive';
  weakTopics: string[];
  feedbackMode: 'normal' | 'need_more_time' | 'ready_for_harder';
}): StudySessionTask[] {
  const { grade, board, pace, weakTopics, feedbackMode } = params;
  const primaryWeak = weakTopics[0] || 'Ch 21 · Trigonometrical Identities';
  const secondaryWeak = weakTopics[1] || 'Ch 5 · Quadratic Equations';

  const paceMultiplier = pace === 'Intensive' ? 1.25 : pace === 'Foundation-First' ? 0.85 : 1.0;
  const feedbackDelta = feedbackMode === 'need_more_time' ? 10 : feedbackMode === 'ready_for_harder' ? -5 : 0;

  const calcDuration = (base: number) =>
    Math.max(15, Math.round(base * paceMultiplier + feedbackDelta));

  return [
    {
      id: 'task_session_1',
      dayLabel: 'Today · Evening Slot',
      timeSlot: '05:30 PM – 06:00 PM',
      title:
        feedbackMode === 'need_more_time'
          ? `Guided Prerequisite Bridge: ${primaryWeak}`
          : `Core ${board} Class ${grade} Mastery: ${primaryWeak}`,
      chapter: primaryWeak,
      type: 'Concept Recap',
      durationMin: calcDuration(25),
      deadlineLabel: 'Due Today · 08:00 PM',
      reminderActive: true,
      completed: true,
      xpValue: 45,
    },
    {
      id: 'task_session_2',
      dayLabel: 'Today · Night Practice',
      timeSlot: '07:15 PM – 07:50 PM',
      title:
        feedbackMode === 'ready_for_harder'
          ? `Challenging HOTS Board Sums: ${secondaryWeak}`
          : `Selina Concise Timed Exercise: ${secondaryWeak}`,
      chapter: secondaryWeak,
      type: 'Selina Drill',
      durationMin: calcDuration(35),
      deadlineLabel: 'Due Tonight · 09:30 PM',
      reminderActive: true,
      completed: false,
      xpValue: 60,
    },
    {
      id: 'task_session_3',
      dayLabel: 'Tomorrow · Afternoon Lab',
      timeSlot: '04:30 PM – 05:00 PM',
      title: `Interactive 3D Spatial Visualization & Parameter Exploration (Class ${grade})`,
      chapter: 'Ch 20 & 22 · 3D Mensuration & Sightlines',
      type: '3D Simulation',
      durationMin: calcDuration(25),
      deadlineLabel: 'Due Tomorrow · 06:00 PM',
      reminderActive: true,
      completed: false,
      xpValue: 50,
    },
    {
      id: 'task_session_4',
      dayLabel: 'Weekend · Board Mock Assessment',
      timeSlot: '10:00 AM – 11:00 AM',
      title: `${board} Standard ${grade} Cumulative Section A + B Timed Mock Test`,
      chapter: 'Full Syllabus Adaptive Checkpoint',
      type: 'Mock Test',
      durationMin: calcDuration(50),
      deadlineLabel: 'Upcoming Mock · In 3 Days',
      reminderActive: true,
      completed: false,
      xpValue: 100,
    },
  ];
}

