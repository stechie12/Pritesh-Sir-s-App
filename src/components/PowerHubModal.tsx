import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Compass,
  Copy,
  Download,
  Flame,
  GraduationCap,
  Layers,
  Mic,
  Palette,
  Pin,
  Printer,
  Search,
  Send,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { AttemptEntry, CurriculumBoard, GradeLevel } from '../utils/adaptiveEngine';
import {
  FEATURE_CATEGORIES,
  HUNDRED_FEATURES_CATALOG,
  type FeatureCategory,
  type PowerHubTab,
} from '../data/featureSuiteCatalog';
import {
  GEOMETRY_PROOF_TEMPLATES,
  TEXTBOOK_EXERCISE_INDEX,
  type BilingualLanguage,
  type TutorPedagogyConfig,
  type TutorPersona,
  detectPrerequisiteBridges,
  verifyAlgebraicSteps,
} from '../utils/tutorPedagogy';
import {
  evaluateSkillTreeNodes,
  generateMentalSprintQuestion,
  getDailyPotd,
} from '../utils/studySuiteEngine';
import {
  ACCENT_PALETTES,
  type EscalatedDoubtItem,
  type FluentAccentKey,
  type MicaBackdropKey,
  type ReadingDensity,
  type RecentActivityItem,
  type RevisionNoteItem,
  type SavedInsightItem,
  type WorkspacePreferences,
  buildConsistencyHeatmap,
  buildStudyBackupJson,
  createTeacherAssignmentCode,
  parseStudyBackupJson,
  summarizeChatThread,
} from '../utils/workspacePreferences';
import { copyTextSafely } from '../utils/tutorEnhancements';
import { ExtendedSimulationsStudio } from './ExtendedSimulationsStudio';
import { ExamPrepStudio } from './ExamPrepStudio';
import { VoiceAudioStudio } from './VoiceAudioStudio';
import type { PerformanceModeSetting, PerformanceModeStatus } from '../utils/performanceMode';

interface PowerHubModalProps {
  isOpen: boolean;
  initialTab?: PowerHubTab;
  initialFocusKey?: string;
  onClose: () => void;
  grade: GradeLevel;
  board: CurriculumBoard;
  attempts: AttemptEntry[];
  overallAccuracy: number;
  weakTopics: string[];
  streakDays: number;
  adaptiveRating: number;
  pedagogy: TutorPedagogyConfig;
  onUpdatePedagogy: (patch: Partial<TutorPedagogyConfig>) => void;
  prefs: WorkspacePreferences;
  onUpdatePrefs: (patch: Partial<WorkspacePreferences>) => void;
  notes: RevisionNoteItem[];
  onUpdateNotes: (next: RevisionNoteItem[]) => void;
  insights: SavedInsightItem[];
  onDeleteInsight: (id: string) => void;
  escalations: EscalatedDoubtItem[];
  onAddEscalation: (item: EscalatedDoubtItem) => void;
  recentActivities: RecentActivityItem[];
  onTrackActivity: (label: string, hubTab: PowerHubTab, focusKey: string) => void;
  activeThreadMessages: Array<{
    question: string;
    chatReply?: string;
    conceptTitle?: string;
    finalAnswer?: string;
  }>;
  onAskTutor: (prompt: string) => void;
  onSwitchProfile: (profileId: string) => void;
  onRestoreBackup: (payload: {
    prefs: WorkspacePreferences;
    notes: RevisionNoteItem[];
    insights: SavedInsightItem[];
    escalations: EscalatedDoubtItem[];
  }) => void;
  pomodoroSec: number;
  pomodoroActive: boolean;
  onTogglePomodoro: () => void;
  onResetPomodoro: (minutes: number) => void;
  performanceStatus?: PerformanceModeStatus;
}

const HUB_TABS: Array<{ key: PowerHubTab; label: string; icon: React.ReactNode }> = [
  { key: 'directory', label: 'All 100 Features', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'pedagogy', label: 'AI Pedagogy', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { key: 'simulations', label: '15 New Labs', icon: <Compass className="w-3.5 h-3.5" /> },
  { key: 'exam', label: 'Exam & Drills', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'voice', label: 'Voice & Audio', icon: <Mic className="w-3.5 h-3.5" /> },
  { key: 'notes', label: 'Notes & Backup', icon: <Layers className="w-3.5 h-3.5" /> },
  { key: 'appearance', label: 'Fluent & Access', icon: <Palette className="w-3.5 h-3.5" /> },
  { key: 'classroom', label: 'Parent & Class', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'arena', label: 'Skill Tree & Duel', icon: <Swords className="w-3.5 h-3.5" /> },
];

export const PowerHubModal: React.FC<PowerHubModalProps> = ({
  isOpen,
  initialTab = 'directory',
  initialFocusKey,
  onClose,
  grade,
  board,
  attempts,
  overallAccuracy,
  weakTopics,
  streakDays,
  adaptiveRating,
  pedagogy,
  onUpdatePedagogy,
  prefs,
  onUpdatePrefs,
  notes,
  onUpdateNotes,
  insights,
  onDeleteInsight,
  escalations,
  onAddEscalation,
  recentActivities,
  onTrackActivity,
  activeThreadMessages,
  onAskTutor,
  onSwitchProfile,
  onRestoreBackup,
  pomodoroSec,
  pomodoroActive,
  onTogglePomodoro,
  onResetPomodoro,
  performanceStatus,
}) => {
  const [activeTab, setActiveTab] = useState<PowerHubTab>(initialTab);
  const [focusKey, setFocusKey] = useState<string | undefined>(initialFocusKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'ALL' | FeatureCategory>('ALL');

  // Pedagogy local tools
  const [stepVerifierInput, setStepVerifierInput] = useState('2x + 6 = 14\n2x = 8\nx = 4');
  const [mistakeStepsInput, setMistakeStepsInput] = useState('');
  const [selectedProofIdx, setSelectedProofIdx] = useState(0);
  const [proofChoices, setProofChoices] = useState<Record<number, string>>({});

  // Notes & Backup local state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteChapter, setNoteChapter] = useState('Trigonometry');
  const [noteBody, setNoteBody] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState('');

  // Classroom & Parent local state
  const [hwChapter, setHwChapter] = useState('Trigonometry');
  const [hwCount, setHwCount] = useState(10);
  const [hwDue, setHwDue] = useState(new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [escQuestion, setEscQuestion] = useState('');
  const [escNote, setEscNote] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileGrade, setNewProfileGrade] = useState<GradeLevel>('8');

  // Arena: POTD + 1v1 Duel
  const [potdRevealed, setPotdRevealed] = useState(false);
  const [duelRound, setDuelRound] = useState(0);
  const [duelPlayerScore, setDuelPlayerScore] = useState(0);
  const [duelGhostScore, setDuelGhostScore] = useState(0);
  const [duelInput, setDuelInput] = useState('');
  const [duelFeedback, setDuelFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setFocusKey(initialFocusKey);
    }
  }, [isOpen, initialTab, initialFocusKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return HUNDRED_FEATURES_CATALOG.filter((f) => {
      if (catFilter !== 'ALL' && f.category !== catFilter) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.summary.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        String(f.id) === q.replace('#', '')
      );
    });
  }, [searchQuery, catFilter]);

  const verifiedSteps = useMemo(() => verifyAlgebraicSteps(stepVerifierInput), [stepVerifierInput]);
  const prereqBridges = useMemo(() => detectPrerequisiteBridges(weakTopics), [weakTopics]);
  const threadSummary = useMemo(() => summarizeChatThread(activeThreadMessages), [activeThreadMessages]);
  const consistencyCells = useMemo(() => buildConsistencyHeatmap(attempts), [attempts]);
  const potd = useMemo(() => getDailyPotd(grade), [grade]);
  const skillTree = useMemo(() => evaluateSkillTreeNodes(attempts), [attempts]);
  const duelQuestion = useMemo(() => generateMentalSprintQuestion(300 + duelRound * 17), [duelRound]);

  const generatedAssignment = useMemo(
    () =>
      createTeacherAssignmentCode({
        title: `${board} Std ${grade} ${hwChapter} Drill`,
        board,
        grade,
        chapter: hwChapter,
        problemCount: hwCount,
        dueDate: hwDue,
      }),
    [board, grade, hwChapter, hwCount, hwDue]
  );

  if (!isOpen) return null;

  const currentProof = GEOMETRY_PROOF_TEMPLATES[selectedProofIdx];

  const handleLaunchFeature = (featureId: number, hubTab: PowerHubTab, fKey: string, title: string) => {
    onTrackActivity(`#${featureId} ${title}`, hubTab, fKey);
    setFocusKey(fKey);
    setActiveTab(hubTab === 'directory' ? 'directory' : hubTab);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="100-Feature Power Studio"
      data-testid="power-hub-modal"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fluent-glass-panel w-full max-w-6xl max-h-[92vh] rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Selina Fluent Power Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              100 Interactive Features · Standard {grade} ({board}) · Live Pedagogy, Simulations, Exams & Classroom
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Power Studio"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Hub Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto lg:flex-wrap lg:overflow-x-visible no-scrollbar px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          {HUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.key
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* TAB 1: ALL 100 FEATURES DIRECTORY */}
          {activeTab === 'directory' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search all 100 features by number, name, or keyword..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                  />
                </div>
                <select
                  aria-label="Filter feature category"
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value as 'ALL' | FeatureCategory)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
                >
                  <option value="ALL">All 9 Categories ({HUNDRED_FEATURES_CATALOG.length})</option>
                  {FEATURE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {recentActivities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">#74 Quick Resume:</span>
                  {recentActivities.slice(0, 4).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setFocusKey(r.focusKey);
                        setActiveTab(r.hubTab as PowerHubTab);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredFeatures.map((feat) => (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => handleLaunchFeature(feat.id, feat.hubTab, feat.focusKey, feat.title)}
                    className="text-left rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-3 hover:border-sky-500/60 hover:bg-sky-50/40 dark:hover:bg-sky-950/25 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">#{feat.id}</span>
                      <span className="truncate">{feat.category}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{feat.title}</div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{feat.summary}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: AI TUTORING & PEDAGOGY (#1–#15) */}
          {activeTab === 'pedagogy' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  Live AI Tutor Controls (#1, #3, #4, #5, #9, #10, #15)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedagogy.socraticMode}
                      onChange={(e) => onUpdatePedagogy({ socraticMode: e.target.checked })}
                    />
                    <span>#1 Socratic Hint Ladder</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedagogy.eliStuckMode}
                      onChange={(e) => onUpdatePedagogy({ eliStuckMode: e.target.checked })}
                    />
                    <span>#3 Explain Like I&apos;m Stuck</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedagogy.showAlternativeMethods}
                      onChange={(e) => onUpdatePedagogy({ showAlternativeMethods: e.target.checked })}
                    />
                    <span>#4 Alternative Methods (2–3 ways)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedagogy.showMarkingScheme}
                      onChange={(e) => onUpdatePedagogy({ showMarkingScheme: e.target.checked })}
                    />
                    <span>#5 Board Marking Scheme [M1/A1]</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pedagogy.speedTrickMode}
                      onChange={(e) => onUpdatePedagogy({ speedTrickMode: e.target.checked })}
                    />
                    <span>#10 30-Second Speed Trick</span>
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900">
                    <span>Hint Level:</span>
                    {([1, 2, 3] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onUpdatePedagogy({ socraticMode: true, socraticHintLevel: lvl })}
                        className={`px-2 py-0.5 rounded font-mono ${pedagogy.socraticHintLevel === lvl ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    #9 Bilingual Explanation Language:
                    <select
                      value={pedagogy.bilingualLanguage}
                      onChange={(e) => onUpdatePedagogy({ bilingualLanguage: e.target.value as BilingualLanguage })}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      {(['English', 'Hinglish', 'Hindi', 'Marathi', 'Tamil', 'Gujarati'] as const).map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    #15 Tutor Persona & Pace:
                    <select
                      value={pedagogy.persona}
                      onChange={(e) => onUpdatePedagogy({ persona: e.target.value as TutorPersona })}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      <option value="friendly-coach">Friendly Coach (Balanced)</option>
                      <option value="strict-examiner">Strict Board Examiner (Step Precision)</option>
                      <option value="olympiad-mentor">Olympiad Mentor (Deep Insights)</option>
                      <option value="rapid-revision">Rapid Revision (Ultra-Crisp)</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* #7 Live Equation Step Verifier & #2 Mistake Finder */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#7 Live Equation Step Verifier</div>
                  <p className="text-slate-500">Type one algebraic step per line (using x). Each line is verified live for equivalence:</p>
                  <textarea
                    rows={4}
                    value={stepVerifierInput}
                    onChange={(e) => setStepVerifierInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 font-mono text-xs"
                  />
                  <div className="space-y-1.5">
                    {verifiedSteps.map((row) => (
                      <div
                        key={row.lineNumber}
                        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ${
                          row.status === 'valid' || row.status === 'base'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : row.status === 'mismatch'
                              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        <span>L{row.lineNumber}: {row.text}</span>
                        <span>{row.status === 'base' ? 'Start' : row.status === 'valid' ? 'Valid ✓' : row.status === 'mismatch' ? 'Error ✗' : 'Check syntax'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#2 AI Step-by-Step Mistake Finder</div>
                  <p className="text-slate-500">Paste your own rough steps below — the tutor will find the exact line where a sign or formula slip first occurred:</p>
                  <textarea
                    rows={4}
                    value={mistakeStepsInput}
                    onChange={(e) => setMistakeStepsInput(e.target.value)}
                    placeholder="Example:&#10;(x - 3)^2 = 16&#10;x^2 - 9 = 16&#10;x = 5"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!mistakeStepsInput.trim()) return;
                      onAskTutor(
                        `Check my written steps below and identify the EXACT line where the first mistake occurred, why it is wrong, and how to fix it:\n\n${mistakeStepsInput.trim()}`
                      );
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Find Exact Mistake Line</span>
                  </button>
                </div>
              </div>

              {/* #11 Interactive Two-Column Geometry Proof Builder */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#11 Multi-Turn Geometry Proof Builder (Statement | Reason)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {GEOMETRY_PROOF_TEMPLATES.map((tpl, idx) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setSelectedProofIdx(idx);
                          setProofChoices({});
                        }}
                        className={`px-2.5 py-1 rounded-md ${selectedProofIdx === idx ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                      >
                        Std {tpl.grade}: {tpl.title.slice(0, 26)}…
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  <strong>Given:</strong> {currentProof.given} · <strong>To Prove:</strong> {currentProof.toProve}
                </div>
                <div className="space-y-2">
                  {currentProof.steps.map((st, idx) => {
                    const picked = proofChoices[idx];
                    const isRight = picked === st.correctReason;
                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5">
                        <div className="md:col-span-5 font-mono font-semibold text-slate-900 dark:text-white">
                          {idx + 1}. {st.statement}
                        </div>
                        <div className="md:col-span-7 flex flex-wrap items-center gap-1.5">
                          <select
                            aria-label={`Reason for step ${idx + 1}`}
                            value={picked || ''}
                            onChange={(e) => setProofChoices((p) => ({ ...p, [idx]: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                          >
                            <option value="">Select geometric justification…</option>
                            {st.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {picked && (
                            <span className={`font-semibold ${isRight ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isRight ? 'Valid ✓' : 'Try again'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* #13 Textbook Exercise Navigator & #14 Prerequisite Gap Detector */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#13 Selina Concise & NCERT Exercise Navigator</div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {TEXTBOOK_EXERCISE_INDEX.map((entry, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{entry.book} · {entry.chapter}</div>
                          <div className="text-[11px] text-slate-500">{entry.exercises.join(' · ')}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onAskTutor(entry.starterPrompt);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-md bg-sky-600 text-white font-semibold shrink-0"
                        >
                          Practice
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#14 Prerequisite Gap Detector</div>
                  {prereqBridges.map((bridge) => (
                    <div key={bridge.targetTopic} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">{bridge.targetTopic}</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">
                        Foundation Bridge (Std {bridge.foundationGrade}): {bridge.missingFoundation}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onAskTutor(bridge.microRefresherPrompt);
                          onClose();
                        }}
                        className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
                      >
                        Start 2-Min Micro-Refresher →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXTENDED 15 SIMULATIONS (#16–#30) */}
          {activeTab === 'simulations' && (
            <ExtendedSimulationsStudio
              initialSimKey={focusKey}
              onAskTutor={(prompt) => {
                onAskTutor(prompt);
                onClose();
              }}
            />
          )}

          {/* TAB 4: EXAM & PRACTICE STUDIO (#51–#65) */}
          {activeTab === 'exam' && (
            <ExamPrepStudio
              grade={grade}
              board={board}
              attempts={attempts}
              overallAccuracy={overallAccuracy}
              examDateIso={prefs.examDateIso}
              onUpdateExamDate={(iso) => onUpdatePrefs({ examDateIso: iso })}
              onAskTutor={(prompt) => {
                onAskTutor(prompt);
                onClose();
              }}
              initialSection={focusKey}
            />
          )}

          {/* TAB 5: VOICE & AUDIO STUDIO (#43–#50) */}
          {activeTab === 'voice' && (
            <VoiceAudioStudio grade={grade} prefs={prefs} onUpdatePrefs={onUpdatePrefs} />
          )}

          {/* TAB 6: NOTES, INSIGHTS, MEMORY & BACKUP (#66–#75) */}
          {activeTab === 'notes' && (
            <div className="space-y-4 text-xs">
              {/* #75 Cross-Thread Tutor Context Memory & #71 Auto-Summarize Thread */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#75 Cross-Thread Tutor Context Memory</div>
                  <p className="text-slate-500">Optional memory injected gently into future doubts (e.g. your recurring weak areas or preferred notation):</p>
                  <textarea
                    rows={3}
                    value={pedagogy.crossThreadMemory}
                    onChange={(e) => onUpdatePedagogy({ crossThreadMemory: e.target.value })}
                    placeholder="e.g., Remind me to check ± signs in quadratics and show units in mensuration."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">#71 Auto-Summary of Active Chat</div>
                    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Worked Sheet (#12)</span>
                    </button>
                  </div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                    {threadSummary.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                  {threadSummary.formulas.length > 0 && (
                    <div className="pt-1 font-mono text-[11px] text-sky-600 dark:text-sky-400">
                      Formulas detected: {threadSummary.formulas.join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {/* #69 Revision Notes Editor & #67 Saved Insights Wall */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#69 Markdown + LaTeX Revision Notes</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Note title..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <input
                      type="text"
                      value={noteChapter}
                      onChange={(e) => setNoteChapter(e.target.value)}
                      placeholder="Chapter"
                      className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Write formulas, identities, or tips..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!noteTitle.trim() && !noteBody.trim()) return;
                      const created: RevisionNoteItem = {
                        id: `note_${Date.now()}`,
                        title: noteTitle.trim() || `${noteChapter} Note`,
                        chapter: noteChapter.trim() || 'General',
                        body: noteBody.trim(),
                        updatedAt: new Date().toISOString().slice(0, 10),
                      };
                      onUpdateNotes([created, ...notes]);
                      setNoteTitle('');
                      setNoteBody('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                  >
                    Save Revision Note
                  </button>
                  <div className="space-y-2 max-h-44 overflow-y-auto pt-1">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 flex justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{n.title} · {n.chapter}</div>
                          <div className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.body}</div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Delete note ${n.title}`}
                          onClick={() => onUpdateNotes(notes.filter((x) => x.id !== n.id))}
                          className="text-slate-400 hover:text-rose-500 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5 text-sky-500" />
                      <span>#67 Saved Insights Wall & #70 Pocket Cheat-Sheet</span>
                    </div>
                    <button type="button" onClick={() => window.print()} className="text-sky-600 dark:text-sky-400 font-semibold hover:underline">
                      Print 1-Page Sheet
                    </button>
                  </div>
                  {insights.length === 0 ? (
                    <p className="text-slate-500">Pin any AI explanation from the chat thread to collect key formulas & insights here.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {insights.map((ins) => (
                        <div key={ins.id} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-2.5 flex justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{ins.title} · {ins.chapter}</div>
                            <div className="text-slate-600 dark:text-slate-300 line-clamp-3">{ins.content}</div>
                          </div>
                          <button type="button" onClick={() => onDeleteInsight(ins.id)} className="text-slate-400 hover:text-rose-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* #72 Offline Sync Status & #73 Full Study Backup JSON Export / Import */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#72/#73 Study Backup & Restore (JSON)</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const json = buildStudyBackupJson({ prefs, notes, insights, escalations });
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `selina-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setBackupMessage('Downloaded full JSON backup!');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON Backup</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder="Paste exported backup JSON here to restore..."
                    className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseStudyBackupJson(importJsonText);
                      if (!parsed) {
                        setBackupMessage('Invalid backup JSON schema.');
                        return;
                      }
                      onRestoreBackup({
                        prefs: parsed.prefs,
                        notes: parsed.notes,
                        insights: parsed.insights,
                        escalations: parsed.escalations,
                      });
                      setImportJsonText('');
                      setBackupMessage('Restored notes, preferences, insights, and escalations!');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restore Backup</span>
                  </button>
                </div>
                {backupMessage && <div className="text-emerald-600 dark:text-emerald-400 font-medium">{backupMessage}</div>}
              </div>
            </div>
          )}

          {/* TAB 7: FLUENT UI, CUSTOMIZATION & ACCESSIBILITY (#76–#85) */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#76 Windows 11 Fluent Accent Color</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ACCENT_PALETTES) as FluentAccentKey[]).map((key) => {
                      const pal = ACCENT_PALETTES[key];
                      const active = prefs.accent === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onUpdatePrefs({ accent: key })}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium ${
                            active ? 'border-sky-500 ring-2 ring-sky-500/30' : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: pal.hex }} />
                          <span>{pal.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="font-semibold text-sm text-slate-900 dark:text-white pt-2">#77 Dynamic Mica Backdrop</div>
                  <div className="flex flex-wrap gap-2">
                    {(['bloom', 'aurora', 'warm-paper', 'minimal'] as MicaBackdropKey[]).map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => onUpdatePrefs({ backdrop: bg })}
                        className={`px-3 py-1.5 rounded-lg capitalize font-medium ${prefs.backdrop === bg ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                      >
                        {bg.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">Reading, Focus & Performance (#78–#85)</div>
                  <div className="flex items-center gap-2">
                    <span>#79 Density:</span>
                    {(['compact', 'comfortable', 'spacious'] as ReadingDensity[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onUpdatePrefs({ density: d })}
                        className={`px-2.5 py-1 rounded capitalize ${prefs.density === d ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prefs.zenMode} onChange={(e) => onUpdatePrefs({ zenMode: e.target.checked })} />
                    <span>#78 Focus / Zen Distraction-Free Mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prefs.dyslexiaMode} onChange={(e) => onUpdatePrefs({ dyslexiaMode: e.target.checked })} />
                    <span>#80 Dyslexia-Friendly Spacing & Warm Tint</span>
                  </label>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Performance Mode (Low Power &amp; Battery Saver)
                      </span>
                      <span
                        data-testid="performance-mode-status-text"
                        className={`text-[11px] font-mono font-semibold ${
                          performanceStatus?.isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {performanceStatus?.reason ?? 'Auto · Standard Power'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Throttles AI thinking animation frequency and reduces 3D Spatial Lab geometry &amp; shadow precision on low battery or low-power devices without affecting AI intelligence.
                    </p>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Performance Mode">
                      {(
                        [
                          { key: 'auto', label: 'Auto (Battery)' },
                          { key: 'on', label: 'Always On' },
                          { key: 'off', label: 'Off (Full 3D)' },
                        ] as Array<{ key: PerformanceModeSetting; label: string }>
                      ).map((opt) => {
                        const active = (prefs.performanceMode ?? 'auto') === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            data-testid={`performance-mode-${opt.key}`}
                            aria-pressed={active}
                            onClick={() =>
                              onUpdatePrefs({
                                performanceMode: opt.key,
                                lowGpuMode: opt.key === 'off' ? false : prefs.lowGpuMode,
                              })
                            }
                            className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                              active
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prefs.lowGpuMode} onChange={(e) => onUpdatePrefs({ lowGpuMode: e.target.checked })} />
                    <span>#85 Strict Zero-Animation / Low-GPU Mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prefs.pipFormulaVisible} onChange={(e) => onUpdatePrefs({ pipFormulaVisible: e.target.checked })} />
                    <span>#83 Picture-in-Picture Floating Formula Bar</span>
                  </label>
                  <label className="block pt-1">
                    #82 Split Pane Ratio: {prefs.splitPaneRatio}% / {100 - prefs.splitPaneRatio}%
                    <input
                      type="range"
                      min={35}
                      max={65}
                      value={prefs.splitPaneRatio}
                      onChange={(e) => onUpdatePrefs({ splitPaneRatio: Number(e.target.value) })}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>

              {/* #83 PiP Formula Customizer & #84 Shortcut Remapper */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#83 Floating PiP Formula Card Text</div>
                  <input
                    type="text"
                    value={prefs.pipFormulaText}
                    onChange={(e) => onUpdatePrefs({ pipFormulaText: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#84 Custom Keyboard Shortcuts</div>
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    {([
                      ['openStudio', 'Open Studio'],
                      ['openFormulas', 'Formulas'],
                      ['toggleScratchpad', 'Scratchpad'],
                      ['toggleZen', 'Zen Mode'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="block text-[11px]">
                        {label}
                        <input
                          type="text"
                          value={prefs.shortcuts[key]}
                          onChange={(e) =>
                            onUpdatePrefs({ shortcuts: { ...prefs.shortcuts, [key]: e.target.value } })
                          }
                          className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PARENT, TEACHER & CLASSROOM (#86–#94) */}
          {activeTab === 'classroom' && (
            <div className="space-y-4 text-xs">
              {/* #86 Weekly Parent Digest & #93 Report Card & #94 Presentation Mode */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    #86 Weekly Parent Progress Digest · {board} Standard {grade}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Adaptive Rating {adaptiveRating} · Accuracy {overallAccuracy}% · Streak {streakDays}d · Focus Topics: {weakTopics.slice(0, 3).join(', ') || 'All on track'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdatePrefs({ presentationMode: !prefs.presentationMode })}
                    className={`px-3 py-1.5 rounded-lg font-semibold ${prefs.presentationMode ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {prefs.presentationMode ? 'Exit Projector Mode (#94)' : 'Projector Mode (#94)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report Card (#93)</span>
                  </button>
                </div>
              </div>

              {/* #90 12-Week Study Consistency Calendar Heatmap */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">#90 12-Week Study Consistency Calendar Heatmap</div>
                <div className="grid grid-cols-12 sm:grid-cols-21 gap-1">
                  {consistencyCells.map((cell) => (
                    <div
                      key={cell.dateKey}
                      title={`${cell.dateKey}: ${cell.count} sum(s)`}
                      className={`h-3.5 rounded-sm ${
                        cell.level === 0
                          ? 'bg-slate-200 dark:bg-slate-800'
                          : cell.level === 1
                            ? 'bg-sky-300 dark:bg-sky-800'
                            : cell.level === 2
                              ? 'bg-sky-500'
                              : 'bg-emerald-500'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* #87 Assignment Creator & #89 Doubt Escalation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#87 Teacher Assignment Code Creator</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={hwChapter} onChange={(e) => setHwChapter(e.target.value)} className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                    <input type="number" min={5} max={15} value={hwCount} onChange={(e) => setHwCount(Number(e.target.value))} className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono" />
                    <input type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-sky-500/10 px-3 py-2 font-mono font-semibold text-sky-700 dark:text-sky-300">
                    <span>{generatedAssignment.code}</span>
                    <button type="button" onClick={() => void copyTextSafely(generatedAssignment.code)} className="inline-flex items-center gap-1 hover:underline">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#89 Doubt Escalation (&ldquo;Ask Pritesh Sir&rdquo;)</div>
                  <input
                    type="text"
                    value={escQuestion}
                    onChange={(e) => setEscQuestion(e.target.value)}
                    placeholder="Flag a tricky question for teacher review..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={escNote}
                      onChange={(e) => setEscNote(e.target.value)}
                      placeholder="Where did you get stuck?"
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!escQuestion.trim()) return;
                        onAddEscalation({
                          id: `esc_${Date.now()}`,
                          question: escQuestion.trim(),
                          chapter: hwChapter,
                          noteForTeacher: escNote.trim() || 'Needs classroom walkthrough',
                          status: 'Queued for Pritesh Sir',
                          createdAt: new Date().toISOString().slice(0, 10),
                        });
                        setEscQuestion('');
                        setEscNote('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
                    >
                      Escalate
                    </button>
                  </div>
                  {escalations.slice(0, 3).map((e) => (
                    <div key={e.id} className="rounded bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-[11px]">
                      <strong>{e.status}:</strong> {e.question} ({e.createdAt})
                    </div>
                  ))}
                </div>
              </div>

              {/* #92 Multi-Student Profile Switcher & #88 Class Mastery Heatmap */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#91/#92 Multi-Student Profiles & Daily Goals</div>
                  <div className="space-y-1.5">
                    {prefs.profiles.map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => onSwitchProfile(prof.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border flex items-center justify-between ${
                          prefs.activeProfileId === prof.id
                            ? 'border-sky-500 bg-sky-500/10 font-semibold'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span>{prof.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Goal: {prof.dailyGoalSums} sums / {prof.dailyGoalMinutes}m
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Add sibling profile name..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <select
                      value={newProfileGrade}
                      onChange={(e) => setNewProfileGrade(e.target.value as GradeLevel)}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {(['8', '9', '10', '11', '12'] as GradeLevel[]).map((g) => <option key={g} value={g}>Std {g}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newProfileName.trim()) return;
                        const added = {
                          id: `prof_${Date.now()}`,
                          name: `${newProfileName.trim()} (Std ${newProfileGrade})`,
                          grade: newProfileGrade,
                          board,
                          dailyGoalSums: 6,
                          dailyGoalMinutes: 25,
                        };
                        onUpdatePrefs({ profiles: [...prefs.profiles, added] });
                        setNewProfileName('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-2.5">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#88 Class Mastery Cohort Heatmap</div>
                  <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                    {[
                      { ch: 'Surds', pct: 86 },
                      { ch: 'Quadratics', pct: 74 },
                      { ch: 'Trig Id.', pct: 58 },
                      { ch: 'Circles', pct: 69 },
                      { ch: 'GST/RD', pct: 91 },
                      { ch: 'Matrices', pct: 82 },
                      { ch: 'Mensuration', pct: 64 },
                      { ch: 'Calculus', pct: 71 },
                    ].map((cell) => (
                      <div
                        key={cell.ch}
                        className={`rounded-lg p-2 ${
                          cell.pct >= 80
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : cell.pct >= 70
                              ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        <div className="truncate font-sans font-medium">{cell.ch}</div>
                        <div className="font-bold">{cell.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: MOTIVATION, SKILL TREE, POTD, POMODORO & 1v1 DUEL (#95–#100) */}
          {activeTab === 'arena' && (
            <div className="space-y-4 text-xs">
              {/* #95 Daily Problem of the Day (POTD) */}
              <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    #95 Daily Problem of the Day ({potd.dateKey}) · {potd.title}
                  </div>
                  <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">+{potd.xpBonus} XP · Std {potd.grade}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{potd.question}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPotdRevealed((r) => !r)} className="px-3 py-1.5 rounded-lg border border-sky-500/40 font-semibold">
                    {potdRevealed ? 'Hide Hint & Answer' : 'Reveal Hint & Answer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAskTutor(`Let's solve today's Problem of the Day together: ${potd.question}`);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                  >
                    Solve in Tutor
                  </button>
                </div>
                {potdRevealed && (
                  <div className="pt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                    Hint: {potd.hint} · Final Answer: {potd.answer}
                  </div>
                )}
              </div>

              {/* #96 Chapter Mastery Skill Tree (Std 8 -> 12) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                <div className="font-semibold text-sm text-slate-900 dark:text-white">#96 Chapter Mastery Skill Tree (Standards 8 → 12)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {skillTree.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        onAskTutor(`Give me a focused mastery drill on ${node.label} (Standard ${node.grade}).`);
                        onClose();
                      }}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        node.status === 'mastered'
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : node.status === 'in-progress'
                            ? 'border-amber-500/60 bg-amber-500/10'
                            : 'border-slate-200 dark:border-slate-800 hover:border-sky-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>Std {node.grade}</span>
                        <span>{node.status === 'mastered' ? 'Mastered ✓' : node.status === 'in-progress' ? `${node.accuracy}%` : 'Ready'}</span>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white mt-0.5">{node.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* #97 Pomodoro Timer, #98 1v1 Speed Math Duel, #99 Streak Freeze & #100 Milestones */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#98 Friendly 1v1 Speed Math Duel (5 Rounds)</div>
                  <div className="flex justify-between font-mono">
                    <span className="text-sky-600 dark:text-sky-400">You: {duelPlayerScore}</span>
                    <span>Round {Math.min(5, duelRound + 1)}/5</span>
                    <span className="text-amber-600 dark:text-amber-400">Ghost Rival: {duelGhostScore}</span>
                  </div>
                  {duelRound < 5 ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const right = Number(duelInput) === duelQuestion.answer;
                        if (right) setDuelPlayerScore((s) => s + 1);
                        if (duelRound % 2 === 0) setDuelGhostScore((s) => s + 1);
                        setDuelFeedback(right ? 'Point scored!' : `Answer was ${duelQuestion.answer}.`);
                        setDuelInput('');
                        setDuelRound((r) => r + 1);
                      }}
                      className="flex items-center gap-2"
                    >
                      <span className="font-mono font-bold text-base text-slate-900 dark:text-white">{duelQuestion.prompt}</span>
                      <input
                        type="number"
                        value={duelInput}
                        onChange={(e) => setDuelInput(e.target.value)}
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                      />
                      <button type="submit" className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold">Go</button>
                    </form>
                  ) : (
                    <div className="space-y-2">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {duelPlayerScore >= duelGhostScore ? 'Victory! +100 Duel XP' : 'Close Match — Rematch Ready!'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDuelRound(0);
                          setDuelPlayerScore(0);
                          setDuelGhostScore(0);
                          setDuelFeedback(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
                      >
                        Play Rematch
                      </button>
                    </div>
                  )}
                  {duelFeedback && <div className="text-slate-500">{duelFeedback}</div>}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 p-4 space-y-3">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">#97 Pomodoro · #99 Streak Freeze · #100 Milestones</div>
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
                      {Math.floor(pomodoroSec / 60)}:{String(pomodoroSec % 60).padStart(2, '0')}
                    </span>
                    <button type="button" onClick={onTogglePomodoro} className="px-3 py-1 rounded-lg bg-sky-600 text-white font-sans font-semibold">
                      {pomodoroActive ? 'Pause' : 'Start Focus'}
                    </button>
                    <button type="button" onClick={() => onResetPomodoro(25)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">25m</button>
                    <button type="button" onClick={() => onResetPomodoro(50)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">50m</button>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span>#99 Streak Freeze Tokens: <strong className="font-mono">{prefs.streakFreezeTokens}</strong></span>
                    </span>
                    <button
                      type="button"
                      disabled={prefs.streakFreezeTokens <= 0}
                      onClick={() => onUpdatePrefs({ streakFreezeTokens: Math.max(0, prefs.streakFreezeTokens - 1) })}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                    >
                      Activate Freeze
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Award className="w-3.5 h-3.5" /> Trigonometry Tactician</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400"><CheckCircle2 className="w-3.5 h-3.5" /> All 5 Fluent Themes Unlocked (#100)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
