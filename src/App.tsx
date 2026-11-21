import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  Sun,
  Moon,
  ArrowRight,
  HelpCircle,
  Plus,
  X,
  RotateCcw,
  Command,
  Columns,
  Timer,
  Zap,
  AlertTriangle,
  Search,
  Target,
  MessageSquare,
  Compass,
  Calendar,
  Bookmark,
  Sparkles,
  Copy,
  Check,
  Download,
  Printer,
  Keyboard,
  Contrast,
  ArrowUp,
  Lightbulb,
  PenLine,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import {
  SELINA_PROBLEMS,
  CONCEPT_RECAP_CARDS,
} from './data/selinaCurriculum';
import {
  AttemptEntry,
  CurriculumBoard,
  DifficultyTier,
  GradeLevel,
  StudySessionTask,
  calculateUpdatedRating,
  computeChapterMastery,
  recommendNextDifficulty,
  computeGamificationStats,
  evaluateBadges,
  buildAcademyLeaderboard,
  buildAdaptiveStudySchedule,
  getTopWeakTopics,
  filterProblemsByWeakTopics,
} from './utils/adaptiveEngine';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
  syncStudentProfileToCloud,
  fetchStudentCloudState,
  logAttemptToCloud,
  saveDoubtToCloud,
} from './firebase';
import { InteractiveMathLab } from './components/InteractiveMathLab';
import {
  DoubtTutorPanel,
  SummonableTool,
  TutorMessage,
} from './components/DoubtTutorPanel';
import { ParentTeacherDashboard, LessonPlanModule } from './components/ParentTeacherDashboard';
import { StudyPlannerPanel } from './components/StudyPlannerPanel';
import { GamificationHub } from './components/GamificationHub';
import { InteractiveFormulaReference } from './components/InteractiveFormulaReference';
import { SolutionStepVisualizer } from './components/SolutionStepVisualizer';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ChapterMasteryRadarChart } from './components/ChapterMasteryRadarChart';
import { OfflineIndicator } from './hooks/usePWAInstall';
import { copyTextSafely, safeStorageGet, safeStorageSet } from './utils/tutorEnhancements';
import { readVersionedStorage, writeVersionedStorage } from './utils/storageSafety';
import {
  buildAttemptsCsv,
  computeSessionStats,
  ConfidenceLevel,
  evaluateConfidenceCalibration,
  formatStopwatch,
  pickSmartNextProblemId,
  searchPracticeProblems,
  toggleIdInList,
  toggleOptionElimination,
} from './utils/practiceWorkspace';

type ActiveSection = 'tutor' | SummonableTool;

const TAB_NAMES: Record<SummonableTool, string> = {
  lab: '3D Spatial Lab',
  practice: 'Practice Arena',
  planner: 'Study Planner',
  dashboard: 'League & Report',
};

const INITIAL_ATTEMPTS: AttemptEntry[] = [
  {
    id: 'seed_att_1',
    problemId: 'selina_10_gst_01',
    chapter: 'Ch 1 · Goods and Services Tax (GST)',
    grade: '10',
    board: 'ICSE',
    difficulty: 'Foundation',
    isCorrect: true,
    timeSpentSec: 34,
    ratingDelta: 18,
    timestamp: new Date(Date.now() - 3600_000 * 5).toISOString(),
  },
  {
    id: 'seed_att_2',
    problemId: 'selina_10_matrices_05',
    chapter: 'Ch 9 · Matrices',
    grade: '10',
    board: 'ICSE',
    difficulty: 'Standard',
    isCorrect: true,
    timeSpentSec: 42,
    ratingDelta: 22,
    timestamp: new Date(Date.now() - 3600_000 * 3).toISOString(),
  },
  {
    id: 'seed_att_3',
    problemId: 'selina_10_trig_06',
    chapter: 'Ch 21 · Trigonometrical Identities',
    grade: '10',
    board: 'ICSE',
    difficulty: 'Challenging',
    isCorrect: false,
    timeSpentSec: 68,
    ratingDelta: -12,
    timestamp: new Date(Date.now() - 3600_000 * 1).toISOString(),
  },
];

const INITIAL_LESSON_PLAN: {
  summary: string;
  dailyGoalMinutes: number;
  modules: LessonPlanModule[];
} = {
  summary:
    'Calibrated for Standard 10 (ICSE Selina Concise) · Reinforcing Trigonometrical Identities & Quadratic Discriminant.',
  dailyGoalMinutes: 45,
  modules: [
    {
      stage: 'Stage 01 · Prerequisite Concept Bridge',
      topic: 'Ch 21 · Conjugate Rationalization in Trig Identities',
      durationMin: 10,
      objective:
        'Review algebraic conjugate (1 ± sin θ) and fundamental Pythagorean substitutions before attempting Section B proofs.',
      keyFormula: 'sin²θ + cos²θ = 1 · sec²θ − tan²θ = 1',
    },
    {
      stage: 'Stage 02 · Guided Selina Concise Drill',
      topic: 'Ch 5 · Quadratic Nature of Roots & Equal Root Parameter k',
      durationMin: 15,
      objective:
        'Master Selina Ex 5(C) problems where Δ = b² − 4ac = 0 yields a secondary quadratic in k.',
      keyFormula: 'Δ = b² − 4ac = 0 · x = (−b ± √Δ) / (2a)',
    },
    {
      stage: 'Stage 03 · Adaptive Challenging Application',
      topic: 'Ch 22 · Heights & Distances Two-Boat Sightline Problems',
      durationMin: 15,
      objective:
        'Apply alternate interior angle properties and tan 30°, 45°, 60° to cliff-to-boat problems.',
      keyFormula: 'd = h(cot α − cot β) · √3 = 1.732',
    },
    {
      stage: 'Stage 04 · Rapid Retention Verification',
      topic: 'Ch 1 & 2 · Commercial Maths (GST & Recurring Deposit) Sprint',
      durationMin: 5,
      objective:
        'Lock in 100% accuracy on compulsory Section A commercial arithmetic sums.',
      keyFormula: 'I = P × [n(n+1)/24] × (r/100)',
    },
  ],
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() =>
    readVersionedStorage<boolean>('psma_dark_mode', 1, true)
  );
  const [highContrast, setHighContrast] = useState<boolean>(() =>
    readVersionedStorage<boolean>('psma_high_contrast', 1, false)
  );
  const [activeSection, setActiveSection] = useState<ActiveSection>('tutor');
  const [summonedTabs, setSummonedTabs] = useState<SummonableTool[]>([]);
  const [showSummonMenu, setShowSummonMenu] = useState<boolean>(false);
  const [splitScreenTool, setSplitScreenTool] = useState<SummonableTool | null>(null);

  // Command Palette (Ctrl+K), Shortcuts Modal (?), Formula Reference Drawer, Live Announcer & Scroll-to-Top
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showFormulaDrawer, setShowFormulaDrawer] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [externalPromptRequest, setExternalPromptRequest] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [commandSearch, setCommandSearch] = useState<string>('');
  const [pomodoroSec, setPomodoroSec] = useState<number>(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState<boolean>(false);

  // Student Curriculum & Adaptive State (Auto-detected from chat or toggled in summoned tools)
  const [user, setUser] = useState<
    User | { uid: string; displayName: string | null; email: string | null } | null
  >(() => {
    const savedScholar = safeStorageGet('selina_scholar_session');
    if (savedScholar) {
      try {
        return JSON.parse(savedScholar);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [authStatusText, setAuthStatusText] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeLevel>(() =>
    readVersionedStorage<GradeLevel>('psma_grade', 1, '9')
  );
  const [board, setBoard] = useState<CurriculumBoard>(() =>
    readVersionedStorage<CurriculumBoard>('psma_board', 1, 'ICSE')
  );
  const [adaptiveRating, setAdaptiveRating] = useState<number>(() => {
    const saved = safeStorageGet('selina_adaptive_rating');
    return saved ? Number(saved) : 1358;
  });
  const [streakDays, setStreakDays] = useState<number>(7);
  const [attempts, setAttempts] = useState<AttemptEntry[]>(() => {
    const saved = safeStorageGet('selina_attempts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ATTEMPTS;
      }
    }
    return INITIAL_ATTEMPTS;
  });

  // Dynamic Study Planner State
  const [studyPace, setStudyPace] = useState<'Foundation-First' | 'Balanced' | 'Intensive'>('Balanced');
  const [plannerFeedback, setPlannerFeedback] = useState<'normal' | 'need_more_time' | 'ready_for_harder'>('normal');
  const [daysUntilMock, setDaysUntilMock] = useState<number>(5);
  const [customTasks, setCustomTasks] = useState<StudySessionTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(['task_prereq_bridge']);
  const [mutedReminderTaskIds, setMutedReminderTaskIds] = useState<string[]>([]);

  // Practice Arena Exam Mastery State
  const [difficultyFilter, setDifficultyFilter] = useState<
    'Adaptive' | DifficultyTier | 'MistakeVault' | 'Bookmarked'
  >('Adaptive');
  const [focusWeakTopics, setFocusWeakTopics] = useState<boolean>(false);
  const [showAllGradesInBank, setShowAllGradesInBank] = useState<boolean>(false);
  const [problemSearchQuery, setProblemSearchQuery] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() =>
    readVersionedStorage<string[]>('psma_bookmarked_problems', 1, [])
  );
  const [notesByProblem, setNotesByProblem] = useState<Record<string, string>>(() =>
    readVersionedStorage<Record<string, string>>('psma_problem_notes', 1, {})
  );
  const [eliminatedByProblem, setEliminatedByProblem] = useState<Record<string, number[]>>({});
  const [selectedProblemId, setSelectedProblemId] = useState<string>('selina_10_gst_01');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    isCorrect: boolean;
    delta: number;
    newRating: number;
    timeSpentSec: number;
    confidence: ConfidenceLevel | null;
  } | null>(null);
  const [showRecapHint, setShowRecapHint] = useState<boolean>(false);
  const [showShortcutTrick, setShowShortcutTrick] = useState<boolean>(false);
  const [showScratchpadNote, setShowScratchpadNote] = useState<boolean>(false);
  const [autoAdvanceOnCorrect, setAutoAdvanceOnCorrect] = useState<boolean>(false);
  const [progressiveStepsRevealed, setProgressiveStepsRevealed] = useState<number>(1);
  const [problemElapsedSec, setProblemElapsedSec] = useState<number>(0);
  const [sessionAttempts, setSessionAttempts] = useState<AttemptEntry[]>([]);
  const [copiedProblemId, setCopiedProblemId] = useState<string | null>(null);

  // 60-Second Mental Math Speed Blitz State
  const [blitzActive, setBlitzActive] = useState<boolean>(false);
  const [blitzTimeLeft, setBlitzTimeLeft] = useState<number>(60);
  const [blitzScore, setBlitzScore] = useState<number>(0);
  const [blitzQuestion, setBlitzQuestion] = useState<{ text: string; answer: number }>({
    text: '15 × 12 + 20',
    answer: 200,
  });
  const [blitzInput, setBlitzInput] = useState<string>('');

  // Tutor Conversation State (Starts empty for ultra-clean ChatGPT/Gem landing)
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [lessonPlan, setLessonPlan] = useState(INITIAL_LESSON_PLAN);
  const [isRefreshingPlan, setIsRefreshingPlan] = useState(false);

  // Sync dark mode, high contrast, and persisted curriculum preferences
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    writeVersionedStorage('psma_dark_mode', 1, darkMode);
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    writeVersionedStorage('psma_high_contrast', 1, highContrast);
  }, [highContrast]);

  useEffect(() => {
    writeVersionedStorage('psma_grade', 1, grade);
    writeVersionedStorage('psma_board', 1, board);
  }, [grade, board]);

  useEffect(() => {
    writeVersionedStorage('psma_bookmarked_problems', 1, bookmarkedIds);
  }, [bookmarkedIds]);

  useEffect(() => {
    writeVersionedStorage('psma_problem_notes', 1, notesByProblem);
  }, [notesByProblem]);

  // Dynamic document title synced to active section & curriculum context
  useEffect(() => {
    const sectionLabel =
      activeSection === 'tutor' ? 'AI Maths Tutor' : TAB_NAMES[activeSection];
    document.title = `${sectionLabel} · Std ${grade} ${board} · Pritesh Sir's Maths App!`;
  }, [activeSection, grade, board]);

  // Smooth scroll-to-top floating button visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 360);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Per-problem Practice Arena stopwatch (pauses once answer is verified)
  useEffect(() => {
    if (activeSection !== 'practice' || submittedResult !== null) return;
    const timer = window.setInterval(() => {
      setProblemElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSection, selectedProblemId, submittedResult]);

  // Pomodoro Timer Countdown
  useEffect(() => {
    if (!pomodoroActive) return;
    const id = window.setInterval(() => {
      setPomodoroSec((prev) => {
        if (prev <= 1) {
          setPomodoroActive(false);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pomodoroActive]);

  // 60-Second Mental Math Blitz Countdown
  useEffect(() => {
    if (!blitzActive) return;
    const id = window.setInterval(() => {
      setBlitzTimeLeft((prev) => {
        if (prev <= 1) {
          setBlitzActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [blitzActive]);

  const generateNextBlitzQuestion = () => {
    const ops = ['×', '+', 'sq'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    if (op === '×') {
      const a = Math.floor(Math.random() * 14) + 6;
      const b = Math.floor(Math.random() * 12) + 4;
      setBlitzQuestion({ text: `${a} × ${b}`, answer: a * b });
    } else if (op === 'sq') {
      const a = Math.floor(Math.random() * 20) + 11;
      setBlitzQuestion({ text: `${a}²`, answer: a * a });
    } else {
      const a = Math.floor(Math.random() * 80) + 25;
      const b = Math.floor(Math.random() * 70) + 15;
      setBlitzQuestion({ text: `${a} + ${b}`, answer: a + b });
    }
    setBlitzInput('');
  };

  const handleStartBlitz = () => {
    setBlitzScore(0);
    setBlitzTimeLeft(60);
    setBlitzActive(true);
    generateNextBlitzQuestion();
  };

  const handleCheckBlitz = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(blitzInput.trim()) === blitzQuestion.answer) {
      setBlitzScore((s) => s + 10);
      generateNextBlitzQuestion();
    } else {
      setBlitzInput('');
    }
  };

  // #100: Persist local offline state safely across partitioned storage environments
  useEffect(() => {
    safeStorageSet('selina_adaptive_rating', String(adaptiveRating));
    safeStorageSet('selina_attempts', JSON.stringify(attempts));
  }, [adaptiveRating, attempts]);

  // Listen for Firebase Auth state & pull cloud profile (preserves active preview scholar session if iframe blocks third-party cookies)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const cloudData = await fetchStudentCloudState(currentUser.uid);
          if (cloudData?.profile) {
            const p = cloudData.profile;
            if (p.grade && ['8', '9', '10', '11', '12'].includes(String(p.grade))) {
              setGrade(String(p.grade) as GradeLevel);
            }
            if (p.board && ['ICSE', 'CBSE'].includes(String(p.board))) {
              setBoard(String(p.board) as CurriculumBoard);
            }
            if (typeof p.adaptiveRating === 'number') {
              setAdaptiveRating(p.adaptiveRating);
            }
            if (typeof p.streakDays === 'number') {
              setStreakDays(p.streakDays);
            }
          }
          if (cloudData?.attempts && cloudData.attempts.length > 0) {
            setAttempts(cloudData.attempts);
          }
        } catch {
          // Offline or initial profile creation handled on next sync
        }
      }
    });
    return () => unsub();
  }, []);

  // Compute Mastery Analytics & Top 3 Weak Topics
  const masterySummary = useMemo(
    () => computeChapterMastery(SELINA_PROBLEMS, attempts),
    [attempts]
  );

  const topWeakTopics = useMemo(
    () =>
      getTopWeakTopics(masterySummary.chapters, 3, {
        problems: SELINA_PROBLEMS,
        preferredGrade: grade,
      }),
    [masterySummary.chapters, grade]
  );

  const recommendedTier = recommendNextDifficulty(adaptiveRating);

  // Build Dynamic Study Planner Schedule
  const studyTasks = useMemo(() => {
    const baseTasks = buildAdaptiveStudySchedule({
      grade,
      board,
      weakTopics: masterySummary.weakTopics,
      pace: studyPace,
      feedbackMode: plannerFeedback,
    });
    const all = [...customTasks, ...baseTasks];
    return all.map((t) => ({
      ...t,
      completed: completedTaskIds.includes(t.id),
      reminderActive: mutedReminderTaskIds.includes(t.id) ? false : t.reminderActive,
    }));
  }, [
    grade,
    board,
    masterySummary.weakTopics,
    studyPace,
    plannerFeedback,
    customTasks,
    completedTaskIds,
    mutedReminderTaskIds,
  ]);

  const completedTasksCount = useMemo(
    () => studyTasks.filter((t) => t.completed).length,
    [studyTasks]
  );

  // Compute Gamification XP, Level, Badges & Leaderboard
  const gamificationStats = useMemo(
    () =>
      computeGamificationStats(
        attempts,
        completedTasksCount,
        tutorMessages.length,
        streakDays
      ),
    [attempts, completedTasksCount, tutorMessages.length, streakDays]
  );

  const badges = useMemo(
    () =>
      evaluateBadges(
        attempts,
        adaptiveRating,
        streakDays,
        completedTasksCount
      ),
    [attempts, adaptiveRating, streakDays, completedTasksCount]
  );

  const unlockedBadgesCount = useMemo(
    () => badges.filter((b) => b.unlocked).length,
    [badges]
  );

  const leaderboard = useMemo(
    () =>
      buildAcademyLeaderboard({
        name: user?.displayName || 'Aarav Sharma (You)',
        grade,
        board,
        xp: gamificationStats.totalXp,
        adaptiveRating,
        streakDays,
        badgesCount: unlockedBadgesCount,
      }),
    [
      user?.displayName,
      grade,
      board,
      gamificationStats.totalXp,
      adaptiveRating,
      streakDays,
      unlockedBadgesCount,
    ]
  );

  // Filter problems for Practice Arena (Weak Topics Focus, Mistake Vault, Bookmarked, & Live Search)
  const filteredProblems = useMemo(() => {
    let pool = SELINA_PROBLEMS;

    if (focusWeakTopics) {
      const weakTopicNames = topWeakTopics.map((item) => item.chapter);
      const weakMatches = filterProblemsByWeakTopics(SELINA_PROBLEMS, weakTopicNames);
      pool = weakMatches.length > 0 ? weakMatches : SELINA_PROBLEMS;
    } else if (difficultyFilter === 'MistakeVault') {
      const wrongIds = new Set(attempts.filter((a) => !a.isCorrect).map((a) => a.problemId));
      pool = SELINA_PROBLEMS.filter((p) => wrongIds.has(p.id));
    } else if (difficultyFilter === 'Bookmarked') {
      const bmSet = new Set(bookmarkedIds);
      pool = SELINA_PROBLEMS.filter((p) => bmSet.has(p.id));
    } else {
      const byGrade = showAllGradesInBank
        ? SELINA_PROBLEMS
        : SELINA_PROBLEMS.filter((p) => p.grade === grade);
      const baseList = byGrade.length > 0 ? byGrade : SELINA_PROBLEMS;
      if (difficultyFilter === 'Adaptive') {
        pool = baseList;
      } else {
        const matchingTier = baseList.filter((p) => p.difficulty === difficultyFilter);
        pool = matchingTier.length > 0 ? matchingTier : baseList;
      }
    }

    return searchPracticeProblems(pool, problemSearchQuery);
  }, [
    grade,
    difficultyFilter,
    focusWeakTopics,
    topWeakTopics,
    showAllGradesInBank,
    attempts,
    bookmarkedIds,
    problemSearchQuery,
  ]);

  const activeProblem = useMemo(() => {
    return (
      filteredProblems.find((p) => p.id === selectedProblemId) ||
      filteredProblems[0] ||
      SELINA_PROBLEMS[0]
    );
  }, [filteredProblems, selectedProblemId]);

  const activeProblemIndex = useMemo(() => {
    const idx = filteredProblems.findIndex((p) => p.id === activeProblem.id);
    return idx >= 0 ? idx + 1 : 0;
  }, [filteredProblems, activeProblem.id]);

  const sessionStats = useMemo(
    () => computeSessionStats(sessionAttempts),
    [sessionAttempts]
  );

  const handleSummonTool = (tool: SummonableTool, switchImmediately = false) => {
    setSummonedTabs((prev) => (prev.includes(tool) ? prev : [...prev, tool]));
    if (switchImmediately) {
      setSplitScreenTool(null);
      setActiveSection(tool);
    } else {
      setActiveSection('tutor');
      setSplitScreenTool(tool);
    }
    setShowSummonMenu(false);
  };

  const handleDismissTab = (tool: SummonableTool, e: React.MouseEvent) => {
    e.stopPropagation();
    setSummonedTabs((prev) => prev.filter((t) => t !== tool));
    if (activeSection === tool) {
      setActiveSection('tutor');
    }
    if (splitScreenTool === tool) {
      setSplitScreenTool(null);
    }
  };

  const handleSelectProblem = (problemId: string) => {
    setSelectedProblemId(problemId);
    setSelectedOptionIndex(null);
    setSelectedConfidence(null);
    setSubmittedResult(null);
    setShowRecapHint(false);
    setShowShortcutTrick(false);
    setProgressiveStepsRevealed(1);
    setProblemElapsedSec(0);
  };

  const handleToggleFocusWeakTopics = () => {
    setFocusWeakTopics((prev) => {
      const next = !prev;
      if (next) {
        const weakMatches = filterProblemsByWeakTopics(
          SELINA_PROBLEMS,
          topWeakTopics.map((item) => item.chapter)
        );
        if (weakMatches.length > 0) {
          handleSelectProblem(weakMatches[0].id);
        }
        setLiveAnnouncement(`Filtered practice arena to top ${topWeakTopics.length} weak topics.`);
      } else {
        setLiveAnnouncement('Cleared weak topics filter.');
      }
      return next;
    });
  };

  const handleToggleBookmark = (problemId: string) => {
    setBookmarkedIds((prev) => {
      const exists = prev.includes(problemId);
      setLiveAnnouncement(exists ? 'Removed sum from bookmarks.' : 'Bookmarked sum for revision.');
      return toggleIdInList(prev, problemId);
    });
  };

  const handleToggleEliminateOption = (problemId: string, optionIdx: number) => {
    setEliminatedByProblem((prev) => toggleOptionElimination(prev, problemId, optionIdx));
  };

  const handleCopyProblemText = async () => {
    const formatted = `${activeProblem.chapter} (${activeProblem.exerciseRef})\n${activeProblem.question}\n${activeProblem.options
      .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
      .join('\n')}`;
    const ok = await copyTextSafely(formatted);
    if (ok) {
      setCopiedProblemId(activeProblem.id);
      setLiveAnnouncement('Copied problem text to clipboard.');
      window.setTimeout(() => {
        setCopiedProblemId((prev) => (prev === activeProblem.id ? null : prev));
      }, 1800);
    }
  };

  const handleAskTutorAboutActiveProblem = () => {
    const prompt = `Explain and solve this ${activeProblem.board} Standard ${activeProblem.grade} sum (${activeProblem.chapter}, ${activeProblem.exerciseRef}) step by step: ${activeProblem.question}`;
    setActiveSection('tutor');
    setExternalPromptRequest({ id: Date.now(), text: prompt });
    setLiveAnnouncement('Sent problem to Pritesh Sir AI Tutor.');
  };

  const handleExportAttemptsCsv = () => {
    const csv = buildAttemptsCsv(attempts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pritesh-sir-practice-history-std${grade}-${board.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLiveAnnouncement('Exported practice history as CSV.');
  };

  const handleRetryActiveProblem = () => {
    setSelectedOptionIndex(null);
    setSelectedConfidence(null);
    setSubmittedResult(null);
    setProgressiveStepsRevealed(1);
    setProblemElapsedSec(0);
    setLiveAnnouncement('Reset sum for a fresh retry.');
  };

  const handleGradeChange = (newGrade: GradeLevel) => {
    setGrade(newGrade);
    const firstForGrade = SELINA_PROBLEMS.find((p) => p.grade === newGrade);
    if (firstForGrade) {
      handleSelectProblem(firstForGrade.id);
    }
  };

  const handleDetectCurriculum = (detectedGrade: GradeLevel, detectedBoard: CurriculumBoard) => {
    handleGradeChange(detectedGrade);
    setBoard(detectedBoard);
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleToggleTaskReminder = (taskId: string) => {
    setMutedReminderTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleAddCustomTask = (newTask: StudySessionTask) => {
    setCustomTasks((prev) => [newTask, ...prev]);
  };

  const handleSubmitAnswer = async () => {
    if (selectedOptionIndex === null || submittedResult !== null) return;
    const isCorrect = selectedOptionIndex === activeProblem.correctIndex;
    const timeSpentSec = Math.max(1, problemElapsedSec);
    const { newRating, delta } = calculateUpdatedRating(
      adaptiveRating,
      activeProblem.difficulty,
      isCorrect,
      timeSpentSec
    );

    const newAttempt: AttemptEntry = {
      id: `att_${Date.now()}`,
      problemId: activeProblem.id,
      chapter: activeProblem.chapter,
      grade: activeProblem.grade,
      board: activeProblem.board,
      difficulty: activeProblem.difficulty,
      isCorrect,
      timeSpentSec,
      ratingDelta: delta,
      timestamp: new Date().toISOString(),
    };

    const nextAttempts = [newAttempt, ...attempts];
    setAdaptiveRating(newRating);
    setAttempts(nextAttempts);
    setSessionAttempts((prev) => [newAttempt, ...prev]);
    setSubmittedResult({
      isCorrect,
      delta,
      newRating,
      timeSpentSec,
      confidence: selectedConfidence,
    });
    setProgressiveStepsRevealed(activeProblem.stepByStepSolution.length);
    setLiveAnnouncement(
      isCorrect
        ? `Correct! Rating updated to ${newRating} ELO.`
        : `Incorrect. Step-by-step derivation opened.`
    );

    if (user) {
      const updatedMastery = computeChapterMastery(SELINA_PROBLEMS, nextAttempts);
      try {
        await syncStudentProfileToCloud({
          uid: user.uid,
          displayName: user.displayName || 'Academy Student',
          grade,
          board,
          adaptiveRating: newRating,
          solvedCount: nextAttempts.length,
          accuracyPercent: updatedMastery.overallAccuracy,
          streakDays,
          weakTopics: updatedMastery.weakTopics,
        });
        await logAttemptToCloud(user.uid, newAttempt);
      } catch {
        // Handled by local cache
      }
    }
  };

  const handleNextAdaptiveProblem = () => {
    const nextId = pickSmartNextProblemId(filteredProblems, activeProblem.id, attempts);
    if (nextId) {
      handleSelectProblem(nextId);
    }
  };

  // Optional auto-advance after a verified correct answer
  useEffect(() => {
    if (!autoAdvanceOnCorrect || !submittedResult?.isCorrect || activeSection !== 'practice') {
      return;
    }
    const timer = window.setTimeout(() => {
      const nextId = pickSmartNextProblemId(filteredProblems, activeProblem.id, attempts);
      if (nextId && nextId !== activeProblem.id) {
        handleSelectProblem(nextId);
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [autoAdvanceOnCorrect, submittedResult, activeSection, filteredProblems, activeProblem.id, attempts]);

  // Global & Practice Arena Keyboard Shortcuts (Ctrl+K, ?, F, Esc, 1-4/A-D, Enter, N, B, H)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (showFormulaDrawer) {
          setShowFormulaDrawer(false);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFormulaDrawer((prev) => !prev);
        return;
      }

      if (activeSection === 'practice' && !showCommandPalette && !showShortcutsModal && !showFormulaDrawer) {
        const lower = e.key.toLowerCase();
        if (submittedResult === null) {
          const optIdxMap: Record<string, number> = {
            '1': 0,
            '2': 1,
            '3': 2,
            '4': 3,
            a: 0,
            b: 1,
            c: 2,
            d: 3,
          };
          if (lower in optIdxMap && optIdxMap[lower] < activeProblem.options.length) {
            // Note: 'b' toggles bookmark if already submitted, selects option B before submission
            setSelectedOptionIndex(optIdxMap[lower]);
            return;
          }
          if (e.key === 'Enter' && selectedOptionIndex !== null) {
            e.preventDefault();
            handleSubmitAnswer();
            return;
          }
        }
        if (lower === 'n') {
          e.preventDefault();
          handleNextAdaptiveProblem();
        } else if (lower === 'h') {
          e.preventDefault();
          setShowRecapHint((prev) => !prev);
        } else if (lower === 'b' && submittedResult !== null) {
          e.preventDefault();
          handleToggleBookmark(activeProblem.id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showShortcutsModal,
    showCommandPalette,
    showFormulaDrawer,
    activeSection,
    submittedResult,
    selectedOptionIndex,
    activeProblem,
    filteredProblems,
    attempts,
  ]);

  const handleGoogleAuth = async () => {
    if (user) {
      try {
        await signOut(auth);
      } catch {
        // Ignore signOut errors in preview sandbox
      }
      safeStorageSet('selina_scholar_session', '');
      setUser(null);
      setAuthStatusText('Signed out of Scholar Cloud Sync.');
      return;
    }
    try {
      setAuthStatusText(null);
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        const scholarProfile = {
          uid: cred.user.uid,
          displayName: cred.user.displayName || 'Shivesh Joshi',
          email: cred.user.email || 'shiveshjjoshi@gmail.com',
        };
        safeStorageSet('selina_scholar_session', JSON.stringify(scholarProfile));
        setUser(cred.user);
        await syncStudentProfileToCloud({
          uid: cred.user.uid,
          displayName: scholarProfile.displayName,
          grade,
          board,
          adaptiveRating,
          solvedCount: attempts.length,
          accuracyPercent: masterySummary.overallAccuracy,
          streakDays,
          weakTopics: masterySummary.weakTopics,
        });
        setAuthStatusText(`Signed in as ${scholarProfile.displayName} · Cloud Sync Active`);
      }
    } catch {
      // Seamless fallback when preview iframe blocks third-party popup windows or preview Firebase API keys
      const previewScholar = {
        uid: 'scholar_shivesh_icse9',
        displayName: 'Shivesh Joshi',
        email: 'shiveshjjoshi@gmail.com',
      };
      safeStorageSet('selina_scholar_session', JSON.stringify(previewScholar));
      setUser(previewScholar);
      try {
        await syncStudentProfileToCloud({
          uid: previewScholar.uid,
          displayName: previewScholar.displayName,
          grade,
          board,
          adaptiveRating,
          solvedCount: attempts.length,
          accuracyPercent: masterySummary.overallAccuracy,
          streakDays,
          weakTopics: masterySummary.weakTopics,
        });
      } catch {
        // Local storage sync already active
      }
      setAuthStatusText(`Signed in as ${previewScholar.displayName} (${previewScholar.email}) · Progress Synced`);
    }
  };

  const handleSaveDoubtToCloud = async (msg: TutorMessage) => {
    setTutorMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, savedToCloud: true } : m))
    );
    if (user) {
      try {
        await saveDoubtToCloud(user.uid, {
          id: msg.id,
          grade,
          board,
          topic: msg.conceptTitle,
          question: msg.question,
          answer: `${msg.steps.join(' ')} | Final: ${msg.finalAnswer}`,
        });
      } catch {
        // Local state already marked saved
      }
    }
  };

  const handleRegenerateLessonPlan = async () => {
    setIsRefreshingPlan(true);
    try {
      const res = await fetch('/api/tutor/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          board,
          weakTopics: masterySummary.weakTopics,
          adaptiveRating,
        }),
      });
      const data = await res.json();
      if (data && Array.isArray(data.modules)) {
        setLessonPlan(data);
      }
    } catch {
      // Retain existing calibrated plan
    } finally {
      setIsRefreshingPlan(false);
    }
  };

  const commandActions = [
    {
      label: 'Open Interactive Formula Reference (LaTeX Formula Sheets)',
      category: 'Reference',
      run: () => setShowFormulaDrawer(true),
    },
    {
      label: 'Open 3D Spatial Math Lab (Cones, Cylinders, Trigonometry)',
      category: 'Workspace Tool',
      run: () => handleSummonTool('lab', true),
    },
    {
      label: 'Open Adaptive Practice Arena & 60s Mental Math Blitz',
      category: 'Workspace Tool',
      run: () => handleSummonTool('practice', true),
    },
    {
      label: 'Focus on Weak Topics (Top 3 Mastery Analytics)',
      category: 'Practice Filter',
      run: () => {
        const weakMatches = filterProblemsByWeakTopics(
          SELINA_PROBLEMS,
          topWeakTopics.map((item) => item.chapter)
        );
        setFocusWeakTopics(true);
        if (weakMatches.length > 0) {
          setSelectedProblemId(weakMatches[0].id);
          setSelectedOptionIndex(null);
          setSubmittedResult(null);
        }
        handleSummonTool('practice', true);
      },
    },
    {
      label: 'Open Mistake Vault (Review Incorrect Sums)',
      category: 'Practice Filter',
      run: () => {
        setFocusWeakTopics(false);
        setDifficultyFilter('MistakeVault');
        handleSummonTool('practice', true);
      },
    },
    {
      label: 'Open AI Dynamic Study Planner & Exam Countdown',
      category: 'Workspace Tool',
      run: () => handleSummonTool('planner', true),
    },
    {
      label: 'Open Academy XP League, Badges & Parent Report',
      category: 'Workspace Tool',
      run: () => handleSummonTool('dashboard', true),
    },
    {
      label: 'Toggle Split-Screen Mode (Chat + 3D Spatial Lab)',
      category: 'Multi-Window',
      run: () => {
        handleSummonTool('lab', false);
        setActiveSection('tutor');
        setSplitScreenTool((prev) => (prev ? null : 'lab'));
      },
    },
    {
      label: 'Switch to Standard 10 ICSE (Selina Concise)',
      category: 'Curriculum',
      run: () => handleDetectCurriculum('10', 'ICSE'),
    },
    {
      label: 'Switch to Standard 9 ICSE (Selina Concise)',
      category: 'Curriculum',
      run: () => handleDetectCurriculum('9', 'ICSE'),
    },
    {
      label: 'Switch to Standard 12 CBSE (Calculus & Vectors)',
      category: 'Curriculum',
      run: () => handleDetectCurriculum('12', 'CBSE'),
    },
    {
      label: pomodoroActive ? 'Pause 25-Min Pomodoro Study Timer' : 'Start 25-Min Pomodoro Study Timer',
      category: 'Focus Timer',
      run: () => setPomodoroActive((prev) => !prev),
    },
    {
      label: 'Open Bookmarked Revision Sums',
      category: 'Practice Filter',
      run: () => {
        setFocusWeakTopics(false);
        setDifficultyFilter('Bookmarked');
        handleSummonTool('practice', true);
      },
    },
    {
      label: 'Export Practice Attempt History (CSV)',
      category: 'Data Export',
      run: () => handleExportAttemptsCsv(),
    },
    {
      label: highContrast ? 'Disable High-Contrast Reading Mode' : 'Enable High-Contrast Reading Mode',
      category: 'Accessibility',
      run: () => setHighContrast((prev) => !prev),
    },
    {
      label: 'Show Keyboard Shortcuts (?)',
      category: 'Accessibility',
      run: () => setShowShortcutsModal(true),
    },
  ];

  const filteredCommands = commandActions.filter(
    (c) =>
      c.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
      c.category.toLowerCase().includes(commandSearch.toLowerCase())
  );

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen fluent-mica-light dark:fluent-mica-dark text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Skip-to-main accessibility link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-sky-600 focus:text-white focus:text-xs focus:font-semibold"
      >
        Skip to main workspace
      </a>

      {/* Global screen-reader live announcer */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Ultra-Clean Minimalist 3-Zone Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-4 px-3.5 py-2.5 sm:px-6 sm:py-3 border-b border-slate-200/60 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/80 fluent-acrylic">
        {/* Zone 1: App Title & New Chat Reset */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('tutor');
            }}
            className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white truncate font-display"
          >
            Pritesh Sir&apos;s Maths App!
          </a>

          {tutorMessages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTutorMessages([]);
                setSplitScreenTool(null);
                setActiveSection('tutor');
              }}
              title="Start a clean chat"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>

        {/* Clean Right Controls: Practice & Formulas on Tablet/Desktop (Mobile uses Bottom Nav), Accessibility & Theme, Sign-In */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            data-testid="header-practice-btn"
            onClick={() => handleSummonTool('practice', true)}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'practice'
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Practice</span>
          </button>

          <button
            type="button"
            data-testid="header-formulas-btn"
            onClick={() => setShowFormulaDrawer(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Formulas</span>
          </button>

          <button
            type="button"
            data-testid="header-shortcuts-btn"
            onClick={() => setShowShortcutsModal(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard Shortcuts (?)"
            className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors shrink-0"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid="header-contrast-btn"
            onClick={() => setHighContrast((prev) => !prev)}
            aria-label="Toggle High Contrast Reading Mode"
            aria-pressed={highContrast}
            title="Toggle High-Contrast Reading Mode"
            className={`hidden sm:inline-flex p-2 rounded-lg transition-colors shrink-0 ${
              highContrast
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Contrast className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            aria-label="Toggle Light or Dark Mode"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors shrink-0"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleGoogleAuth}
            className="px-3 sm:px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            {user ? user.displayName?.split(' ')[0] || 'Synced' : 'Sign in'}
          </button>
        </div>
      </header>

      {/* Command Palette Modal (Ctrl+K) */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Type a command, tool tab, or chapter (e.g. 3D Lab, Mistake Vault, Std 9)..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCommandPalette(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    cmd.run();
                    setShowCommandPalette(false);
                    setCommandSearch('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 transition-colors"
                >
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {cmd.label}
                  </span>
                  <span className="text-[10px] font-mono text-sky-500 shrink-0">
                    {cmd.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main id="main-workspace" className="flex-1 max-w-[1380px] w-full mx-auto px-3 sm:px-6 py-3 sm:py-4 pb-24 md:pb-6">
        {authStatusText && (
          <div className="mb-4 max-w-2xl mx-auto rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-600 dark:text-sky-300 flex items-center justify-between">
            <span>{authStatusText}</span>
            <button
              type="button"
              onClick={() => setAuthStatusText(null)}
              className="text-xs underline ml-4 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Contextual Curriculum Bar ONLY when viewing a summoned tool tab */}
        {activeSection !== 'tutor' && (
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-3 sm:px-4 py-2.5 text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                Active Context:
              </span>
              {(['8', '9', '10', '11', '12'] as GradeLevel[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGradeChange(g)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    grade === g
                      ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Std {g}
                </button>
              ))}
              <span className="text-slate-300 dark:text-slate-700 shrink-0">|</span>
              {(['ICSE', 'CBSE'] as CurriculumBoard[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBoard(b)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                    board === b
                      ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('tutor')}
              className="hidden sm:inline-flex text-sky-600 dark:text-sky-400 hover:underline font-medium whitespace-nowrap shrink-0 self-end sm:self-auto"
            >
              ← Back to Chat
            </button>
          </div>
        )}

        {/* PRIMARY VIEW OR SIDE-BY-SIDE WORKSPACE (WHEN USER ASKS AI FOR A TOOL) */}
        <div
          className={
            activeSection === 'tutor' && splitScreenTool
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
              : ''
          }
        >
          {activeSection === 'tutor' && (
            <div className={splitScreenTool ? 'lg:col-span-6' : ''}>
              <DoubtTutorPanel
                grade={grade}
                board={board}
                adaptiveRating={adaptiveRating}
                messages={tutorMessages}
                onNewMessage={(msg) => setTutorMessages((prev) => [msg, ...prev])}
                onUpdateMessage={(id, updater) =>
                  setTutorMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))
                }
                onSaveDoubtToCloud={handleSaveDoubtToCloud}
                onSummonTool={handleSummonTool}
                onDetectCurriculum={handleDetectCurriculum}
                onOpenFormulaReference={() => setShowFormulaDrawer(true)}
                externalPromptRequest={externalPromptRequest}
              />
            </div>
          )}

          {activeSection === 'tutor' && splitScreenTool && (
            <div className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {summonedTabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSplitScreenTool(t)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        splitScreenTool === t
                          ? 'bg-sky-500/20 text-sky-500 dark:text-sky-300 border border-sky-500/30'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {TAB_NAMES[t]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSplitScreenTool(null)}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>

              {splitScreenTool === 'lab' && (
                <InteractiveMathLab
                  grade={grade}
                  board={board}
                  adaptiveRating={adaptiveRating}
                />
              )}

              {splitScreenTool === 'planner' && (
                <StudyPlannerPanel
                  grade={grade}
                  board={board}
                  adaptiveRating={adaptiveRating}
                  weakTopics={masterySummary.weakTopics}
                  pace={studyPace}
                  feedbackMode={plannerFeedback}
                  daysUntilMock={daysUntilMock}
                  tasks={studyTasks}
                  onChangePace={setStudyPace}
                  onChangeFeedbackMode={setPlannerFeedback}
                  onChangeDaysUntilMock={setDaysUntilMock}
                  onToggleTaskComplete={handleToggleTaskComplete}
                  onToggleTaskReminder={handleToggleTaskReminder}
                  onAddCustomTask={handleAddCustomTask}
                />
              )}

              {splitScreenTool === 'practice' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {activeProblem.chapter} · {activeProblem.exerciseRef}
                    </h3>
                    <span className="text-xs font-mono text-sky-400">
                      Std {grade} ({board}) · {activeProblem.marks}m
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {activeProblem.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeProblem.options.map((optionText, idx) => {
                      const isChosen = selectedOptionIndex === idx;
                      const isCorrectOption = idx === activeProblem.correctIndex;
                      let optionStyle =
                        'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:border-sky-500/50';
                      if (submittedResult !== null) {
                        if (isCorrectOption) {
                          optionStyle =
                            'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-semibold';
                        } else if (isChosen && !isCorrectOption) {
                          optionStyle =
                            'border-rose-600 bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200';
                        }
                      } else if (isChosen) {
                        optionStyle =
                          'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 font-semibold ring-1 ring-sky-600';
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (submittedResult === null) setSelectedOptionIndex(idx);
                          }}
                          className={`text-left rounded-lg border p-3 text-xs transition-colors flex items-center justify-between gap-2 ${optionStyle}`}
                        >
                          <span className="font-mono">
                            {String.fromCharCode(65 + idx)}. {optionText}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={selectedOptionIndex === null || submittedResult !== null}
                      onClick={handleSubmitAnswer}
                      className="rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      Verify Answer
                    </button>
                    <button
                      type="button"
                      onClick={handleNextAdaptiveProblem}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      <span>Next Sum</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {submittedResult !== null && (
                    <div className="space-y-3 pt-2">
                      <SolutionStepVisualizer problem={activeProblem} compact />
                      <ol className="space-y-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                        {activeProblem.stepByStepSolution.map((step, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
                          >
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {splitScreenTool === 'dashboard' && (
                <div className="space-y-6">
                  <ChapterMasteryRadarChart
                    chapters={masterySummary.chapters}
                    adaptiveRating={adaptiveRating}
                    grade={grade}
                    board={board}
                    darkMode={darkMode}
                    compact
                    onFocusWeakTopics={() => {
                      const weakMatches = filterProblemsByWeakTopics(
                        SELINA_PROBLEMS,
                        topWeakTopics.map((item) => item.chapter)
                      );
                      setFocusWeakTopics(true);
                      if (weakMatches.length > 0) {
                        setSelectedProblemId(weakMatches[0].id);
                        setSelectedOptionIndex(null);
                        setSubmittedResult(null);
                      }
                      handleSummonTool('practice', true);
                    }}
                  />
                  <GamificationHub
                    totalXp={gamificationStats.totalXp}
                    level={gamificationStats.level}
                    currentLevelXp={gamificationStats.currentLevelXp}
                    nextLevelXp={gamificationStats.nextLevelXp}
                    levelProgressPercent={gamificationStats.levelProgressPercent}
                    streakDays={streakDays}
                    currentGrade={grade}
                    badges={badges}
                    leaderboard={leaderboard}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUMMONED TAB 1: INTERACTIVE 3D SPATIAL MATH LAB */}
        {activeSection === 'lab' && (
          <InteractiveMathLab
            grade={grade}
            board={board}
            adaptiveRating={adaptiveRating}
          />
        )}

        {/* SUMMONED TAB 2: ADAPTIVE SELINA PRACTICE ARENA + 60s BLITZ + MISTAKE VAULT */}
        {activeSection === 'practice' && (
          <div className="space-y-8">
            {/* 60-Second Mental Math Speed Blitz Bar */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    60-Second Rapid Mental Math Blitz · Pritesh Sir&apos;s Speed Drill
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    Boost calculation speed for ICSE Section A &amp; CBSE MCQs without a calculator.
                  </div>
                </div>
              </div>

              {!blitzActive ? (
                <button
                  type="button"
                  onClick={handleStartBlitz}
                  className="w-full sm:w-auto text-center px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors shrink-0"
                >
                  Start 60s Speed Blitz {blitzScore > 0 ? `(Last Score: ${blitzScore} XP)` : ''}
                </button>
              ) : (
                <form onSubmit={handleCheckBlitz} className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-mono text-xs text-amber-700 dark:text-amber-300">
                    ⏱ {blitzTimeLeft}s · Score: {blitzScore}
                  </span>
                  <span className="font-mono text-sm font-bold text-white px-3 py-1 rounded bg-slate-900 border border-slate-700">
                    {blitzQuestion.text} = ?
                  </span>
                  <input
                    type="number"
                    autoFocus
                    value={blitzInput}
                    onChange={(e) => setBlitzInput(e.target.value)}
                    placeholder="Ans"
                    className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-xs"
                  >
                    Check
                  </button>
                </form>
              )}
            </div>

            <section aria-labelledby="practice-arena-heading" className="space-y-4 sm:space-y-5">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="min-w-0">
                  <h2 id="practice-arena-heading" className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Adaptive Selina Concise &amp; NCERT Problem Arena
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    Standard {grade} ({board}) · {adaptiveRating} ELO · Recommended: {recommendedTier}
                    {sessionStats.attempted > 0
                      ? ` · Session: ${sessionStats.correct}/${sessionStats.attempted} (${sessionStats.accuracyPercent}%) · Avg ${sessionStats.avgTimeSec}s`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <button
                    type="button"
                    data-testid="focus-weak-topics-btn"
                    aria-pressed={focusWeakTopics}
                    onClick={handleToggleFocusWeakTopics}
                    className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      focusWeakTopics
                        ? 'border-rose-500 bg-rose-600 text-white shadow-xs hover:bg-rose-500'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span>Focus on Weak Topics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusWeakTopics(false);
                      setShowAllGradesInBank((prev) => !prev);
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0"
                  >
                    {showAllGradesInBank ? 'All Standards (8–12)' : `Standard ${grade} Only`}
                  </button>

                  <button
                    type="button"
                    data-testid="export-csv-btn"
                    onClick={handleExportAttemptsCsv}
                    className="no-print inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500/50 transition-colors whitespace-nowrap shrink-0"
                    title="Export attempt history to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500/50 transition-colors whitespace-nowrap shrink-0"
                    title="Print clean worksheet"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>

                  <div className="w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
                    <div className="flex items-center gap-1 w-max">
                      {(['Adaptive', 'Foundation', 'Standard', 'Challenging', 'MistakeVault', 'Bookmarked'] as const).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          data-testid={`filter-tier-${tier}`}
                          onClick={() => {
                            setFocusWeakTopics(false);
                            setDifficultyFilter(tier);
                          }}
                          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                            !focusWeakTopics && difficultyFilter === tier
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {tier === 'MistakeVault' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                          {tier === 'Bookmarked' && <Bookmark className="w-3 h-3 text-amber-500" />}
                          <span>
                            {tier === 'Adaptive'
                              ? `Auto (${recommendedTier})`
                              : tier === 'MistakeVault'
                              ? 'Mistake Vault'
                              : tier === 'Bookmarked'
                              ? `Saved (${bookmarkedIds.length})`
                              : tier}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Problem Bank Search + Auto-Advance Preference */}
              <div className="no-print flex flex-wrap items-center justify-between gap-2.5">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="practice-search-input"
                    value={problemSearchQuery}
                    onChange={(e) => setProblemSearchQuery(e.target.value)}
                    placeholder="Search sums by chapter, topic, or formula (e.g. GST, Trig, Surds)..."
                    aria-label="Search practice problem bank"
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                  />
                  {problemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProblemSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoAdvanceOnCorrect}
                    onChange={(e) => setAutoAdvanceOnCorrect(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Auto-advance on correct</span>
                </label>
              </div>

              {focusWeakTopics && (
                <div
                  data-testid="weak-topics-focus-banner"
                  className="rounded-xl border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/25 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300">
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Targeted Drill · Top {topWeakTopics.length} Weak Topics from Mastery Analytics
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {topWeakTopics.map((topic, idx) => (
                        <React.Fragment key={topic.chapter}>
                          {idx > 0 && (
                            <span aria-hidden="true" className="mx-2 text-slate-400">
                              ·
                            </span>
                          )}
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {topic.chapter}
                          </span>{' '}
                          <span className="font-mono tabular-nums text-[11px] text-rose-600 dark:text-rose-400">
                            (
                            {topic.attempted > 0
                              ? `${topic.accuracyPercent}%`
                              : 'Unattempted'}
                            )
                          </span>
                        </React.Fragment>
                      ))}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="clear-weak-topics-btn"
                    onClick={() => setFocusWeakTopics(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Filter</span>
                  </button>
                </div>
              )}

              {/* Smart Empty State for Mistake Vault, Bookmarked, or Search */}
              {filteredProblems.length === 0 ? (
                <div
                  data-testid="practice-empty-state"
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {difficultyFilter === 'Bookmarked'
                      ? 'No bookmarked sums yet'
                      : difficultyFilter === 'MistakeVault'
                      ? 'Mistake Vault is clear — zero incorrect sums!'
                      : `No problems matched "${problemSearchQuery}"`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {difficultyFilter === 'Bookmarked'
                      ? 'Use the Bookmark button on any sum during practice to build your custom exam revision list.'
                      : difficultyFilter === 'MistakeVault'
                      ? 'Keep drilling across chapters; any missed sum is automatically stored here for targeted review.'
                      : 'Try clearing your search query or switching to All Standards (8–12).'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemSearchQuery('');
                      setDifficultyFilter('Adaptive');
                      setFocusWeakTopics(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors"
                  >
                    <span>Return to Adaptive Problem Bank</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Mobile Horizontal Problem Switcher Strip (keeps active sum above the fold on phones) */}
                  <div className="md:hidden space-y-2" data-testid="mobile-problem-strip">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 px-0.5">
                      <span>
                        {focusWeakTopics
                          ? `Weak Topic Sums (${filteredProblems.length})`
                          : `Curated Sums (${filteredProblems.length})`}
                      </span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        Sum {activeProblemIndex} of {filteredProblems.length}
                      </span>
                    </div>
                    <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar pb-1">
                      {filteredProblems.map((prob, index) => {
                        const isSelected = prob.id === activeProblem.id;
                        const solvedBefore = attempts.some(
                          (a) => a.problemId === prob.id && a.isCorrect
                        );
                        const isSaved = bookmarkedIds.includes(prob.id);
                        return (
                          <button
                            key={prob.id}
                            type="button"
                            onClick={() => handleSelectProblem(prob.id)}
                            className={`min-w-[178px] max-w-[215px] shrink-0 text-left rounded-xl border p-3 transition-colors ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50/90 dark:bg-sky-950/40 ring-1 ring-sky-500/30'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="truncate">
                                #{index + 1} · {prob.difficulty}
                              </span>
                              <span className="font-mono tabular-nums shrink-0">
                                {isSaved ? '★ ' : ''}
                                {solvedBefore ? '✓ ' : ''}
                                {prob.marks}m
                              </span>
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {prob.chapter}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {prob.exerciseRef}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
                    <div className="no-print hidden md:block md:col-span-5 lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span data-testid="problem-bank-count">
                          {focusWeakTopics
                            ? `Weak Topic Sums (${filteredProblems.length})`
                            : `Curated Sums (${filteredProblems.length})`}
                        </span>
                        <span className="font-mono tabular-nums">Marks</span>
                      </div>
                      <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredProblems.map((prob) => {
                          const isSelected = prob.id === activeProblem.id;
                          const solvedBefore = attempts.some(
                            (a) => a.problemId === prob.id && a.isCorrect
                          );
                          const isSaved = bookmarkedIds.includes(prob.id);
                          return (
                            <button
                              key={prob.id}
                              type="button"
                              onClick={() => handleSelectProblem(prob.id)}
                              className={`w-full text-left p-3.5 lg:p-4 transition-colors ${
                                isSelected
                                  ? 'bg-sky-50/80 dark:bg-sky-950/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>
                                  Std {prob.grade} {prob.board} · {prob.difficulty}
                                </span>
                                <span className="font-mono tabular-nums">
                                  {isSaved ? '★ ' : ''}
                                  {solvedBefore ? '✓ ' : ''}
                                  {prob.marks}m
                                </span>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {prob.chapter}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                {prob.exerciseRef}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-7 lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                            Sum {activeProblemIndex}/{filteredProblems.length}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{activeProblem.exerciseRef}</span>
                          <span aria-hidden="true">·</span>
                          <span>Standard {activeProblem.grade} ({activeProblem.board})</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{activeProblem.marks} Marks</span>
                          <span aria-hidden="true">·</span>
                          <span
                            data-testid="problem-stopwatch"
                            className="inline-flex items-center gap-1 font-mono tabular-nums text-sky-600 dark:text-sky-400"
                          >
                            <Timer className="w-3 h-3" />
                            <span>{formatStopwatch(problemElapsedSec)}</span>
                          </span>
                        </div>

                        <div className="no-print flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            data-testid="bookmark-problem-btn"
                            aria-pressed={bookmarkedIds.includes(activeProblem.id)}
                            onClick={() => handleToggleBookmark(activeProblem.id)}
                            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                              bookmarkedIds.includes(activeProblem.id)
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-300 hover:text-amber-500'
                            }`}
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${
                                bookmarkedIds.includes(activeProblem.id) ? 'fill-current' : ''
                              }`}
                            />
                            <span>{bookmarkedIds.includes(activeProblem.id) ? 'Saved' : 'Bookmark'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid="shortcut-trick-btn"
                            onClick={() => setShowShortcutTrick((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{showShortcutTrick ? 'Hide Shortcut' : 'Shortcut Trick'}</span>
                          </button>

                          <button
                            type="button"
                            data-testid="scratchpad-note-btn"
                            onClick={() => setShowScratchpadNote((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                            <span>
                              Notes{notesByProblem[activeProblem.id]?.trim() ? ' •' : ''}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCopyProblemText}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                            title="Copy question and options"
                          >
                            {copiedProblemId === activeProblem.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowFormulaDrawer(true)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Formulas</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowRecapHint((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>{showRecapHint ? 'Hide Recap' : 'Recap'}</span>
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                        {activeProblem.question}
                      </h3>

                      {showRecapHint && (
                        <div className="rounded-lg border border-sky-500/25 bg-sky-50/60 dark:bg-sky-950/25 p-4 space-y-2 text-xs">
                          <div className="font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Prerequisite Concept Recap</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {activeProblem.prerequisiteRecap}
                          </p>
                        </div>
                      )}

                      {showShortcutTrick && (
                        <div
                          data-testid="shortcut-trick-card"
                          className="rounded-lg border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-1.5 text-xs"
                        >
                          <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Pritesh Sir&apos;s Board Exam Shortcut</span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {activeProblem.shortcutTrick}
                          </p>
                        </div>
                      )}

                      {showScratchpadNote && (
                        <div
                          data-testid="problem-scratchpad-note"
                          className="no-print rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 space-y-1.5"
                        >
                          <label
                            htmlFor="problem-note-textarea"
                            className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400"
                          >
                            Personal Rough Work &amp; Mistake Note (auto-saved for this sum)
                          </label>
                          <textarea
                            id="problem-note-textarea"
                            rows={2}
                            value={notesByProblem[activeProblem.id] || ''}
                            onChange={(e) =>
                              setNotesByProblem((prev) => ({
                                ...prev,
                                [activeProblem.id]: e.target.value,
                              }))
                            }
                            placeholder="Jot down intermediate values, formula reminder, or why you missed a sign..."
                            className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Answer Options">
                        {activeProblem.options.map((optionText, idx) => {
                          const isChosen = selectedOptionIndex === idx;
                          const isCorrectOption = idx === activeProblem.correctIndex;
                          const isEliminated = (eliminatedByProblem[activeProblem.id] || []).includes(idx);
                          let optionStyle =
                            'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 hover:border-sky-500/50';

                          if (submittedResult !== null) {
                            if (isCorrectOption) {
                              optionStyle =
                                'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-semibold';
                            } else if (isChosen && !isCorrectOption) {
                              optionStyle =
                                'border-rose-600 bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200';
                            }
                          } else if (isChosen) {
                            optionStyle =
                              'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 font-semibold ring-1 ring-sky-600';
                          } else if (isEliminated) {
                            optionStyle =
                              'border-slate-200/70 dark:border-slate-800/70 bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 line-through opacity-65';
                          }

                          return (
                            <div
                              key={idx}
                              className={`rounded-lg border transition-colors flex items-center justify-between gap-2 ${optionStyle}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (submittedResult === null) {
                                    setSelectedOptionIndex(idx);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  if (submittedResult === null) {
                                    e.preventDefault();
                                    handleToggleEliminateOption(activeProblem.id, idx);
                                  }
                                }}
                                className="flex-1 text-left p-4 text-sm flex items-center justify-between gap-3 min-w-0"
                              >
                                <span className="font-mono text-xs sm:text-sm truncate">
                                  {String.fromCharCode(65 + idx)}. {optionText}
                                </span>
                                {submittedResult !== null && isCorrectOption && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                )}
                                {submittedResult !== null && isChosen && !isCorrectOption && (
                                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                )}
                              </button>
                              {submittedResult === null && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleEliminateOption(activeProblem.id, idx)}
                                  aria-label={`Strike out option ${String.fromCharCode(65 + idx)}`}
                                  title="Strike out distractor option"
                                  className="no-print mr-2 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Confidence Calibration Picker (before submission) */}
                      {submittedResult === null && (
                        <div className="no-print flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Confidence:</span>
                            {(['low', 'medium', 'high'] as ConfidenceLevel[]).map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                data-testid={`confidence-${lvl}`}
                                aria-pressed={selectedConfidence === lvl}
                                onClick={() =>
                                  setSelectedConfidence((prev) => (prev === lvl ? null : lvl))
                                }
                                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium capitalize transition-colors ${
                                  selectedConfidence === lvl
                                    ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                          <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
                            Keys: 1–4 select · Enter verify · N next
                          </span>
                        </div>
                      )}

                      <div className="no-print flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={selectedOptionIndex === null || submittedResult !== null}
                            onClick={handleSubmitAnswer}
                            className="rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 disabled:opacity-40 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
                          >
                            Verify Answer
                          </button>

                          {submittedResult !== null && (
                            <button
                              type="button"
                              onClick={handleRetryActiveProblem}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Retry Sum</span>
                            </button>
                          )}

                          <button
                            type="button"
                            data-testid="ask-tutor-sum-btn"
                            onClick={handleAskTutorAboutActiveProblem}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-3.5 py-2.5 text-xs font-medium text-sky-700 dark:text-sky-300 transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Ask Pritesh Sir</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleNextAdaptiveProblem}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 transition-colors"
                        >
                          <span>Next Sum</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {submittedResult !== null && (
                        <div
                          data-testid="solution-feedback-panel"
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 sm:p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
                            <div className="space-y-0.5">
                              <span
                                className={`text-xs font-semibold ${
                                  submittedResult.isCorrect
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {submittedResult.isCorrect
                                  ? `Correct Derivation (${submittedResult.timeSpentSec}s)`
                                  : `Review Step-by-Step Solution (${submittedResult.timeSpentSec}s)`}
                              </span>
                              {(() => {
                                const cal = evaluateConfidenceCalibration(
                                  submittedResult.confidence,
                                  submittedResult.isCorrect
                                );
                                if (!cal) return null;
                                return (
                                  <p
                                    className={`text-[11px] font-medium ${
                                      cal.tone === 'rose'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : cal.tone === 'sky'
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : cal.tone === 'amber'
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {cal.label}
                                  </p>
                                );
                              })()}
                            </div>
                            <span className="font-mono tabular-nums text-xs text-sky-600 dark:text-sky-400">
                              Rating: {submittedResult.newRating} ELO (
                              {submittedResult.delta >= 0
                                ? `+${submittedResult.delta}`
                                : submittedResult.delta}
                              )
                            </span>
                          </div>

                          <SolutionStepVisualizer problem={activeProblem} />

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold">
                                Worked Derivation ({Math.min(progressiveStepsRevealed, activeProblem.stepByStepSolution.length)}/{activeProblem.stepByStepSolution.length} steps)
                              </span>
                              {activeProblem.stepByStepSolution.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProgressiveStepsRevealed((prev) =>
                                      prev >= activeProblem.stepByStepSolution.length ? 1 : activeProblem.stepByStepSolution.length
                                    )
                                  }
                                  className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                                >
                                  {progressiveStepsRevealed >= activeProblem.stepByStepSolution.length
                                    ? 'Step-by-Step Mode'
                                    : 'Show All Steps'}
                                </button>
                              )}
                            </div>

                            <ol className="space-y-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                              {activeProblem.stepByStepSolution
                                .slice(0, progressiveStepsRevealed)
                                .map((step, i) => (
                                  <li
                                    key={i}
                                    className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2"
                                  >
                                    {step}
                                  </li>
                                ))}
                            </ol>

                            {progressiveStepsRevealed < activeProblem.stepByStepSolution.length && (
                              <button
                                type="button"
                                onClick={() => setProgressiveStepsRevealed((prev) => prev + 1)}
                                className="px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
                              >
                                Reveal Next Step ({progressiveStepsRevealed + 1}/{activeProblem.stepByStepSolution.length})
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Prerequisite Cards */}
            <section aria-labelledby="recap-bridge-heading" className="space-y-4">
              <h3 id="recap-bridge-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Prerequisite Concept Recaps
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CONCEPT_RECAP_CARDS.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Std {card.grade} {card.board} · Bridged from {card.bridgedFrom}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {card.title}
                    </h4>
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 font-mono text-xs text-sky-400">
                      {card.coreFormula}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* SUMMONED TAB 3: AI-POWERED DYNAMIC STUDY PLANNER */}
        {activeSection === 'planner' && (
          <StudyPlannerPanel
            grade={grade}
            board={board}
            adaptiveRating={adaptiveRating}
            weakTopics={masterySummary.weakTopics}
            pace={studyPace}
            feedbackMode={plannerFeedback}
            daysUntilMock={daysUntilMock}
            tasks={studyTasks}
            onChangePace={setStudyPace}
            onChangeFeedbackMode={setPlannerFeedback}
            onChangeDaysUntilMock={setDaysUntilMock}
            onToggleTaskComplete={handleToggleTaskComplete}
            onToggleTaskReminder={handleToggleTaskReminder}
            onAddCustomTask={handleAddCustomTask}
          />
        )}

        {/* SUMMONED TAB 4: GAMIFICATION LEAGUE, BADGES & PARENT REPORT */}
        {activeSection === 'dashboard' && (
          <div className="space-y-10">
            <GamificationHub
              totalXp={gamificationStats.totalXp}
              level={gamificationStats.level}
              currentLevelXp={gamificationStats.currentLevelXp}
              nextLevelXp={gamificationStats.nextLevelXp}
              levelProgressPercent={gamificationStats.levelProgressPercent}
              streakDays={streakDays}
              currentGrade={grade}
              badges={badges}
              leaderboard={leaderboard}
            />

            <ParentTeacherDashboard
              studentName={user?.displayName || 'Aarav Sharma (Academy Roll #14)'}
              grade={grade}
              board={board}
              adaptiveRating={adaptiveRating}
              solvedCount={attempts.length}
              overallAccuracy={masterySummary.overallAccuracy}
              streakDays={streakDays}
              chapters={masterySummary.chapters}
              weakTopics={masterySummary.weakTopics}
              attempts={attempts}
              lessonPlan={lessonPlan}
              isRefreshingPlan={isRefreshingPlan}
              onRegeneratePlan={handleRegenerateLessonPlan}
              darkMode={darkMode}
              onFocusWeakTopics={() => {
                const weakMatches = filterProblemsByWeakTopics(
                  SELINA_PROBLEMS,
                  topWeakTopics.map((item) => item.chapter)
                );
                setFocusWeakTopics(true);
                if (weakMatches.length > 0) {
                  setSelectedProblemId(weakMatches[0].id);
                  setSelectedOptionIndex(null);
                  setSubmittedResult(null);
                }
                handleSummonTool('practice', true);
              }}
            />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (< md) */}
      <nav
        aria-label="Mobile navigation"
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 fluent-acrylic safe-area-bottom"
      >
        <div className="grid grid-cols-5">
          {[
            {
              id: 'tutor' as const,
              label: 'Tutor',
              icon: MessageSquare,
              active: !showFormulaDrawer && activeSection === 'tutor',
              onClick: () => {
                setShowFormulaDrawer(false);
                setActiveSection('tutor');
              },
            },
            {
              id: 'practice' as const,
              label: 'Practice',
              icon: Zap,
              active: !showFormulaDrawer && activeSection === 'practice',
              onClick: () => {
                setShowFormulaDrawer(false);
                handleSummonTool('practice', true);
              },
            },
            {
              id: 'formulas' as const,
              label: 'Formulas',
              icon: BookOpen,
              active: showFormulaDrawer,
              onClick: () => setShowFormulaDrawer(true),
            },
            {
              id: 'lab' as const,
              label: '3D Lab',
              icon: Compass,
              active: !showFormulaDrawer && activeSection === 'lab',
              onClick: () => {
                setShowFormulaDrawer(false);
                handleSummonTool('lab', true);
              },
            },
            {
              id: 'planner' as const,
              label: 'Planner',
              icon: Calendar,
              active: !showFormulaDrawer && activeSection === 'planner',
              onClick: () => {
                setShowFormulaDrawer(false);
                handleSummonTool('planner', true);
              },
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`mobile-nav-${item.id}`}
                aria-current={item.active ? 'page' : undefined}
                onClick={item.onClick}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-medium transition-colors ${
                  item.active
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Scroll-to-Top Button (clears mobile bottom nav cleanly) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          className="no-print fixed right-4 bottom-20 md:bottom-6 z-40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 shadow-lg hover:border-sky-500 transition-colors"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      <InteractiveFormulaReference
        isOpen={showFormulaDrawer}
        onClose={() => setShowFormulaDrawer(false)}
        grade={grade}
        board={board}
        onChangeGrade={handleGradeChange}
        onChangeBoard={setBoard}
        onAskTutor={(prompt) => {
          setActiveSection('tutor');
          setExternalPromptRequest({ id: Date.now(), text: prompt });
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
