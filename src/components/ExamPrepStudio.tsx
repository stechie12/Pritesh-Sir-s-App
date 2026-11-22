import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import type { AttemptEntry, CurriculumBoard, GradeLevel } from '../utils/adaptiveEngine';
import {
  CBSE_ASSERTION_REASON_BANK,
  INITIAL_SM2_FLASHCARDS,
  PAST_10YR_BOARD_BANK,
  REVERSE_MATCH_BANK,
  type MistakeRootCause,
  type MistakeVaultEntry,
  type Sm2Card,
  computeChapterPacing,
  computeExamReadiness,
  decodeQuizCode,
  encodeQuizCode,
  generateMentalSprintQuestion,
  reviewSm2Card,
} from '../utils/studySuiteEngine';
import { copyTextSafely, safeStorageGet, safeStorageSet } from '../utils/tutorEnhancements';

type ExamSubTab =
  | 'flashcards'
  | 'mental-sprint'
  | 'mock-paper'
  | 'past-papers'
  | 'mistake-vault'
  | 'assertion-reason'
  | 'rubric-grader'
  | 'reverse-match'
  | 'pacing'
  | 'quiz-share';

interface ExamPrepStudioProps {
  grade: GradeLevel;
  board: CurriculumBoard;
  attempts: AttemptEntry[];
  overallAccuracy: number;
  examDateIso: string;
  onUpdateExamDate: (iso: string) => void;
  onAskTutor: (prompt: string) => void;
  initialSection?: string;
}

const EXAM_SUBTABS: Array<{ key: ExamSubTab; label: string }> = [
  { key: 'flashcards', label: '#55 SM-2 Flashcards' },
  { key: 'mental-sprint', label: '#56 60s Sprint' },
  { key: 'mock-paper', label: '#51/#53/#65 Mock & Boss' },
  { key: 'past-papers', label: '#52 Past 10-Yr Bank' },
  { key: 'mistake-vault', label: '#54 Mistake Vault' },
  { key: 'assertion-reason', label: '#57 Assertion-Reason' },
  { key: 'rubric-grader', label: '#60/#62 Diagnostic & Rubric' },
  { key: 'reverse-match', label: '#64 Formula Match' },
  { key: 'pacing', label: '#58/#59/#63 Pacing & Readiness' },
  { key: 'quiz-share', label: '#61 Quiz Code Share' },
];

export const ExamPrepStudio: React.FC<ExamPrepStudioProps> = ({
  grade,
  board,
  attempts,
  overallAccuracy,
  examDateIso,
  onUpdateExamDate,
  onAskTutor,
  initialSection,
}) => {
  const mapInitial = (s?: string): ExamSubTab => {
    if (!s) return 'flashcards';
    if (s === 'paper-generator' || s === 'boss-challenge') return 'mock-paper';
    if (s === 'diagnostic') return 'rubric-grader';
    if (s === 'countdown') return 'pacing';
    if (EXAM_SUBTABS.some((t) => t.key === s)) return s as ExamSubTab;
    return 'flashcards';
  };

  const [tab, setTab] = useState<ExamSubTab>(() => mapInitial(initialSection));

  // #55 SM-2 Flashcards
  const [cards, setCards] = useState<Sm2Card[]>(() => {
    try {
      const saved = safeStorageGet('psma_sm2_cards_v1');
      return saved ? (JSON.parse(saved) as Sm2Card[]) : INITIAL_SM2_FLASHCARDS;
    } catch {
      return INITIAL_SM2_FLASHCARDS;
    }
  });
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // #56 60-Second Mental Math Sprint
  const [sprintRunning, setSprintRunning] = useState(false);
  const [sprintSec, setSprintSec] = useState(60);
  const [sprintScore, setSprintScore] = useState(0);
  const [sprintSeed, setSprintSeed] = useState(1);
  const [sprintInput, setSprintInput] = useState('');
  const [sprintFeedback, setSprintFeedback] = useState<string | null>(null);

  // #51 Mock Paper & #53 Printable Generator
  const [mockRunning, setMockRunning] = useState(false);
  const [mockSecLeft, setMockSecLeft] = useState(150 * 60);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [bossActive, setBossActive] = useState(false);

  // #52 Past 10 Years Filter
  const [pyqBoardFilter, setPyqBoardFilter] = useState<'ALL' | CurriculumBoard>('ALL');
  const [revealedPyqIds, setRevealedPyqIds] = useState<string[]>([]);

  // #54 Mistake Vault
  const [mistakes, setMistakes] = useState<MistakeVaultEntry[]>(() => {
    try {
      const saved = safeStorageGet('psma_mistake_vault_v1');
      if (saved) return JSON.parse(saved) as MistakeVaultEntry[];
    } catch {
      // ignore
    }
    return [
      {
        id: 'mv_seed_1',
        question: 'Forgot ± when taking square root of (x − 3)² = 16',
        chapter: 'Quadratic Equations',
        cause: 'Careless',
        note: 'Always write x − 3 = ±4 before solving both branches.',
        resolved: false,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ];
  });
  const [newMistakeQ, setNewMistakeQ] = useState('');
  const [newMistakeChapter, setNewMistakeChapter] = useState('Trigonometry');
  const [newMistakeCause, setNewMistakeCause] = useState<MistakeRootCause>('Concept');

  // #57 Assertion-Reason
  const [arAnswers, setArAnswers] = useState<Record<string, string>>({});

  // #62 Rubric Self-Grader
  const [rubricChecks, setRubricChecks] = useState<boolean[]>([true, true, false, false]);
  const [diagDone, setDiagDone] = useState(false);
  const [diagAnswers, setDiagAnswers] = useState<Record<number, string>>({});

  // #64 Formula Reverse Match
  const [rmIdx, setRmIdx] = useState(0);
  const [rmChoice, setRmChoice] = useState<string | null>(null);

  // #61 Custom Quiz Code
  const [quizChapter, setQuizChapter] = useState('TRIG');
  const [quizCount, setQuizCount] = useState(8);
  const [importCode, setImportCode] = useState('');
  const [importedQuizMsg, setImportedQuizMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialSection) setTab(mapInitial(initialSection));
  }, [initialSection]);

  useEffect(() => {
    if (!sprintRunning) return;
    if (sprintSec <= 0) {
      setSprintRunning(false);
      return;
    }
    const id = window.setInterval(() => setSprintSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [sprintRunning, sprintSec]);

  useEffect(() => {
    if (!mockRunning) return;
    const id = window.setInterval(() => setMockSecLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [mockRunning]);

  const currentCard = cards[cardIdx % cards.length];
  const currentSprint = useMemo(() => generateMentalSprintQuestion(sprintSeed), [sprintSeed]);
  const pacingRows = useMemo(() => computeChapterPacing(attempts), [attempts]);
  const readiness = useMemo(
    () => computeExamReadiness({ examDateIso, overallAccuracy, solvedCount: attempts.length }),
    [examDateIso, overallAccuracy, attempts.length]
  );

  const generatedQuizCode = useMemo(
    () => encodeQuizCode({ board, grade, chapter: quizChapter, count: quizCount, seed: 2026 }),
    [board, grade, quizChapter, quizCount]
  );

  const handleRateCard = (q: 1 | 3 | 4 | 5) => {
    const updated = cards.map((c, idx) => (idx === cardIdx % cards.length ? reviewSm2Card(c, q) : c));
    setCards(updated);
    safeStorageSet('psma_sm2_cards_v1', JSON.stringify(updated));
    setFlipped(false);
    setCardIdx((i) => (i + 1) % updated.length);
  };

  const handleSprintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintRunning) return;
    const num = Number(sprintInput.trim());
    if (Number.isFinite(num) && Math.abs(num - currentSprint.answer) < 1e-6) {
      setSprintScore((s) => s + 1);
      setSprintFeedback('Correct! +1');
    } else {
      setSprintFeedback(`Expected ${currentSprint.answer}`);
    }
    setSprintInput('');
    setSprintSeed((s) => s + 7);
  };

  const addMistakeEntry = () => {
    if (!newMistakeQ.trim()) return;
    const entry: MistakeVaultEntry = {
      id: `mv_${Date.now()}`,
      question: newMistakeQ.trim(),
      chapter: newMistakeChapter,
      cause: newMistakeCause,
      note: 'Review before next weekly quiz.',
      resolved: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const next = [entry, ...mistakes];
    setMistakes(next);
    safeStorageSet('psma_mistake_vault_v1', JSON.stringify(next));
    setNewMistakeQ('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {EXAM_SUBTABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* #55 SM-2 Spaced Repetition Flashcards */}
      {tab === 'flashcards' && currentCard && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Card {(cardIdx % cards.length) + 1} of {cards.length} · {currentCard.chapter} · Std {currentCard.grade}</span>
            <span className="font-mono">Interval: {currentCard.intervalDays}d · Ease: {currentCard.easeFactor}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[150px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 p-6 text-center flex flex-col items-center justify-center gap-2 hover:border-sky-500/60 transition-colors"
          >
            <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              {flipped ? 'Answer / Identity (Click to flip)' : 'Prompt (Click to reveal answer)'}
            </div>
            <div className="text-base font-semibold text-slate-900 dark:text-white max-w-xl">
              {flipped ? currentCard.back : currentCard.front}
            </div>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {([
              [1, 'Again (1d)', 'bg-rose-600'],
              [3, 'Hard', 'bg-amber-600'],
              [4, 'Good', 'bg-sky-600'],
              [5, 'Easy', 'bg-emerald-600'],
            ] as const).map(([q, label, cls]) => (
              <button key={q} type="button" onClick={() => handleRateCard(q)} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white ${cls} hover:opacity-90`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* #56 60-Second Mental Math Sprint */}
      {tab === 'mental-sprint' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="font-semibold text-sky-600 dark:text-sky-400">Time: {sprintSec}s</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Score: {sprintScore}</span>
              <span className="text-slate-500">{currentSprint.category}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSprintSec(60);
                setSprintScore(0);
                setSprintSeed((s) => s + 13);
                setSprintRunning(true);
                setSprintFeedback(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{sprintRunning ? 'Restart 60s Sprint' : 'Start 60s Sprint'}</span>
            </button>
          </div>
          <div className="text-center py-4 space-y-3">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {sprintRunning ? currentSprint.prompt : sprintSec === 0 ? `Sprint Complete — ${sprintScore} solved!` : 'Press Start to begin 60s Mental Math Sprint'}
            </div>
            {sprintRunning && (
              <form onSubmit={handleSprintSubmit} className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                <input
                  type="number"
                  value={sprintInput}
                  onChange={(e) => setSprintInput(e.target.value)}
                  placeholder="Answer"
                  autoFocus
                  className="w-32 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-center"
                />
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                  Check
                </button>
              </form>
            )}
            {sprintFeedback && <div className="text-xs font-medium text-sky-600 dark:text-sky-400">{sprintFeedback}</div>}
          </div>
        </div>
      )}

      {/* #51 Full-Length Mock Paper + #53 Printable Generator + #65 Weekly Boss */}
      {tab === 'mock-paper' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-4 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {board} Standard {grade} Full Board Mock Paper (80 Marks)
              </div>
              <div className="text-slate-500">Section A (40M Compulsory) · Section B (40M Choice)</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                {Math.floor(mockSecLeft / 60)}:{String(mockSecLeft % 60).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => setMockRunning((r) => !r)} className="px-2.5 py-1.5 rounded-lg bg-sky-600 text-white font-semibold">
                {mockRunning ? 'Pause Exam' : 'Start Timed Exam'}
              </button>
              <button type="button" onClick={() => setShowAnswerKey((k) => !k)} className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium">
                {showAnswerKey ? 'Hide Answer Key' : 'Show Answer Key'}
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium">
                <Printer className="w-3.5 h-3.5" />
                <span>Print Paper (#53)</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="font-semibold text-slate-800 dark:text-slate-200">Section A — Compulsory Short & Structured Questions</div>
            {PAST_10YR_BOARD_BANK.slice(0, 4).map((q, idx) => (
              <div key={q.id} className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Q{idx + 1}. ({q.marks} Marks · {q.chapter})</span>
                  <button type="button" onClick={() => onAskTutor(`Solve with ${board} marking scheme: ${q.question}`)} className="text-sky-600 dark:text-sky-400 hover:underline">
                    Solve with AI
                  </button>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{q.question}</p>
                {showAnswerKey && (
                  <div className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] pt-1">
                    Key: {q.answer} · {q.markingScheme.join(' → ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* #65 Weekly Chapter Boss Challenge */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                <span>#65 Weekly Chapter Boss Challenge (Multi-Concept Hybrid)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                5 tough sums blending Trigonometry + Quadratic Equations + Mensuration for +250 XP.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBossActive(true);
                onAskTutor(
                  `Launch my Weekly Chapter Boss Challenge for ${board} Standard ${grade}: give me Question 1 of 5 combining Trigonometry and Quadratic Equations, wait for my answer before revealing the solution.`
                );
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              {bossActive ? 'Boss Launched in Chat' : 'Start Boss Challenge'}
            </button>
          </div>
        </div>
      )}

      {/* #52 Previous 10 Years' Board Question Bank */}
      {tab === 'past-papers' && (
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-2">
            {(['ALL', 'ICSE', 'CBSE'] as const).map((b) => (
              <button key={b} type="button" onClick={() => setPyqBoardFilter(b)} className={`px-2.5 py-1 rounded-lg font-medium ${pyqBoardFilter === b ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {b}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {PAST_10YR_BOARD_BANK.filter((q) => pyqBoardFilter === 'ALL' || q.board === pyqBoardFilter).map((q) => {
              const revealed = revealedPyqIds.includes(q.id);
              return (
                <div key={q.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                    <span>{q.board} {q.year} · Std {q.grade} · {q.chapter} · {q.marks} Marks · {q.difficulty}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedPyqIds((prev) =>
                            prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id]
                          )
                        }
                        className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
                      >
                        {revealed ? 'Hide Scheme' : 'Marking Scheme'}
                      </button>
                      <button type="button" onClick={() => onAskTutor(q.question)} className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                        Open in Tutor
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 font-medium">{q.question}</p>
                  {revealed && (
                    <ul className="list-disc pl-5 text-[11px] font-mono text-emerald-700 dark:text-emerald-300 space-y-0.5">
                      {q.markingScheme.map((step, i) => <li key={i}>{step}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* #54 Error Notebook (Mistake Vault) */}
      {tab === 'mistake-vault' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <input
              type="text"
              value={newMistakeQ}
              onChange={(e) => setNewMistakeQ(e.target.value)}
              placeholder="Log a mistake or tricky sum to revisit..."
              className="md:col-span-6 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <input
              type="text"
              value={newMistakeChapter}
              onChange={(e) => setNewMistakeChapter(e.target.value)}
              placeholder="Chapter"
              className="md:col-span-2 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <select
              value={newMistakeCause}
              onChange={(e) => setNewMistakeCause(e.target.value as MistakeRootCause)}
              className="md:col-span-2 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="Careless">Careless</option>
              <option value="Concept">Concept</option>
              <option value="Formula">Formula</option>
              <option value="Time">Time</option>
            </select>
            <button type="button" onClick={addMistakeEntry} className="md:col-span-2 px-3 py-2 rounded-lg bg-sky-600 text-white font-semibold">
              Add Mistake
            </button>
          </div>
          <div className="space-y-2">
            {mistakes.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className={`font-medium ${m.resolved ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {m.question}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {m.chapter} · Root cause: {m.cause} · Logged {m.createdAt}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = mistakes.map((x) => (x.id === m.id ? { ...x, resolved: !x.resolved } : x));
                      setMistakes(next);
                      safeStorageSet('psma_mistake_vault_v1', JSON.stringify(next));
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
                  >
                    {m.resolved ? 'Reopen' : 'Mark Fixed'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskTutor(`Help me fix this recurring mistake (${m.cause}): ${m.question}`)}
                    className="px-2.5 py-1 rounded bg-sky-600 text-white"
                  >
                    Drill Fix
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #57 CBSE Assertion-Reason & Case-Study Drill */}
      {tab === 'assertion-reason' && (
        <div className="space-y-3 text-xs">
          <div className="text-slate-500">A: Both true & R explains A · B: Both true, R doesn’t explain A · C: A true, R false · D: A false, R true</div>
          {CBSE_ASSERTION_REASON_BANK.map((item) => {
            const picked = arAnswers[item.id];
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">{item.chapter}</div>
                <div><strong>Assertion (A):</strong> {item.assertion}</div>
                <div><strong>Reason (R):</strong> {item.reason}</div>
                <div className="flex gap-2 pt-1">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setArAnswers((p) => ({ ...p, [item.id]: opt }))}
                      className={`px-3 py-1 rounded-lg font-semibold ${
                        picked === opt
                          ? opt === item.correctOption
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      Option {opt}
                    </button>
                  ))}
                </div>
                {picked && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    {picked === item.correctOption ? 'Correct! ' : `Correct option is ${item.correctOption}. `}
                    {item.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* #60 Diagnostic Placement & #62 Show-Your-Work Rubric Self-Grader */}
      {tab === 'rubric-grader' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">#62 Show-Your-Work Rubric Self-Grader (4 Marks)</div>
            <p className="text-slate-500">Check off each board step you got right on paper for honest partial credit:</p>
            {[
              'M1: Stated correct governing formula / theorem clearly before substitution',
              'M1: Substituted given values with matching units (e.g. radius vs diameter)',
              'M1: Completed intermediate algebraic simplification without sign slips',
              'A1: Boxed final numerical answer rounded to required significant figures + units',
            ].map((step, i) => (
              <label key={i} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rubricChecks[i]}
                  onChange={() => setRubricChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                  className="mt-0.5"
                />
                <span>{step}</span>
              </label>
            ))}
            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              Estimated Board Score: {rubricChecks.filter(Boolean).length} / 4 Marks
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">#60 Quick Adaptive Diagnostic Check</div>
            {[
              { q: 'Discriminant of x² − 4x + 4 = 0 is:', opts: ['0', '8', '16'], ans: '0' },
              { q: 'sin 30° + cos 60° equals:', opts: ['1', '√3', '1/2'], ans: '1' },
              { q: 'Slope of y = 3x − 7 is:', opts: ['3', '-7', '1/3'], ans: '3' },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="font-medium">{idx + 1}. {item.q}</div>
                <div className="flex gap-1.5">
                  {item.opts.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setDiagAnswers((p) => ({ ...p, [idx]: o }))}
                      className={`px-2.5 py-1 rounded ${diagAnswers[idx] === o ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setDiagDone(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
              Compute Placement Level
            </button>
            {diagDone && (
              <div className="font-mono text-sky-600 dark:text-sky-400">
                Diagnostic Score: {[diagAnswers[0] === '0', diagAnswers[1] === '1', diagAnswers[2] === '3'].filter(Boolean).length}/3 · Recommended Tier:{' '}
                {[diagAnswers[0] === '0', diagAnswers[1] === '1', diagAnswers[2] === '3'].filter(Boolean).length >= 3 ? 'Challenging' : 'Standard'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* #64 Formula-to-Problem Reverse Match */}
      {tab === 'reverse-match' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3 text-xs">
          <div className="font-semibold text-sm text-slate-900 dark:text-white">
            #64 Formula-to-Problem Reverse Match ({rmIdx + 1}/{REVERSE_MATCH_BANK.length})
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-200">{REVERSE_MATCH_BANK[rmIdx].wordProblem}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {REVERSE_MATCH_BANK[rmIdx].options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRmChoice(opt)}
                className={`p-3 rounded-lg border text-left font-mono ${
                  rmChoice === opt
                    ? opt === REVERSE_MATCH_BANK[rmIdx].correctFormula
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : 'border-slate-200 dark:border-slate-700 hover:border-sky-500/50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setRmChoice(null);
              setRmIdx((i) => (i + 1) % REVERSE_MATCH_BANK.length);
            }}
            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
          >
            Next Word Problem
          </button>
        </div>
      )}

      {/* #58 Pacing Telemetry, #59 Blind-Spot Detector & #63 Exam Countdown Readiness */}
      {tab === 'pacing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">#63 Exam Countdown Readiness Gauge</div>
            <label className="block">
              Target Exam Date:
              <input
                type="date"
                value={examDateIso}
                onChange={(e) => onUpdateExamDate(e.target.value)}
                className="ml-2 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </label>
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                <div className="text-[10px] text-slate-500">Days Left</div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-400">{readiness.daysRemaining}</div>
              </div>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                <div className="text-[10px] text-slate-500">Readiness</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{readiness.readinessPercent}%</div>
              </div>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                <div className="text-[10px] text-slate-500">Daily Target</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{readiness.dailyTargetSums} sums</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-2.5">
            <div className="font-semibold text-sm text-slate-900 dark:text-white">#58/#59 Pacing Telemetry & Blind Spots</div>
            {pacingRows.map((row) => (
              <div key={row.chapter} className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="truncate font-medium">{row.chapter}</div>
                <div className="font-mono whitespace-nowrap text-[11px]">
                  {row.avgSec}s/sum · {row.accuracy}% ·{' '}
                  <span className={row.avgSec <= row.budgetSec ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {row.paceLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* #61 Custom Quiz Code Sharing */}
      {tab === 'quiz-share' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-3 text-xs">
          <div className="font-semibold text-sm text-slate-900 dark:text-white">#61 Shareable Custom Quiz Code</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={quizChapter}
              onChange={(e) => setQuizChapter(e.target.value)}
              placeholder="Chapter tag (e.g. TRIG)"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 w-40"
            />
            <input
              type="number"
              min={3}
              max={20}
              value={quizCount}
              onChange={(e) => setQuizCount(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 w-20 font-mono"
            />
            <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 px-3 py-1.5 rounded-lg bg-sky-500/10">
              {generatedQuizCode}
            </span>
            <button
              type="button"
              onClick={() => {
                void copyTextSafely(generatedQuizCode);
                setImportedQuizMsg('Quiz code copied to clipboard!');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <input
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Paste friend's code (e.g. PSMA-I10-TRIG-8Q-3026)"
              className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const decoded = decodeQuizCode(importCode);
                if (!decoded) {
                  setImportedQuizMsg('Invalid code format. Expected PSMA-I10-TRIG-8Q-3026.');
                } else {
                  setImportedQuizMsg(
                    `Loaded ${decoded.board} Std ${decoded.grade} · ${decoded.chapter} (${decoded.count} questions, seed ${decoded.seed})!`
                  );
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
            >
              Load Quiz Code
            </button>
          </div>
          {importedQuizMsg && <div className="text-sky-600 dark:text-sky-400 font-medium">{importedQuizMsg}</div>}
        </div>
      )}
    </div>
  );
};
