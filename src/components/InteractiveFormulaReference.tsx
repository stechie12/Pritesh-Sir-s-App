import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  X,
  Search,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  Star,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { CurriculumBoard, GradeLevel } from '../utils/adaptiveEngine';
import {
  getFormulaChaptersForCurriculum,
  filterFormulaChapters,
  FormulaChapter,
} from '../data/formulaCurriculum';
import { copyTextSafely } from '../utils/tutorEnhancements';
import { readVersionedStorage, writeVersionedStorage } from '../utils/storageSafety';
import { latexToPlaintext, toggleIdInList } from '../utils/practiceWorkspace';

interface InteractiveFormulaReferenceProps {
  isOpen: boolean;
  onClose: () => void;
  grade: GradeLevel;
  board: CurriculumBoard;
  onChangeGrade: (grade: GradeLevel) => void;
  onChangeBoard: (board: CurriculumBoard) => void;
  onAskTutor: (prompt: string) => void;
}

const GRADES: GradeLevel[] = ['8', '9', '10', '11', '12'];
const BOARDS: CurriculumBoard[] = ['ICSE', 'CBSE'];
const FAVORITES_STORAGE_KEY = 'psma_formula_favorites';

const KATEX_HTML_CACHE = new Map<string, string>();

function renderLatexHtml(latex: string, displayMode = true): string {
  const key = `${displayMode ? 'D' : 'I'}:${latex}`;
  const cached = KATEX_HTML_CACHE.get(key);
  if (cached !== undefined) return cached;
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      strict: false,
    });
    KATEX_HTML_CACHE.set(key, html);
    return html;
  } catch {
    return latex;
  }
}

export const InteractiveFormulaReference: React.FC<InteractiveFormulaReferenceProps> = React.memo(({
  isOpen,
  onClose,
  grade,
  board,
  onChangeGrade,
  onChangeBoard,
  onAskTutor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readVersionedStorage<string[]>(FAVORITES_STORAGE_KEY, 1, [])
  );
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [quizRecallMode, setQuizRecallMode] = useState(false);
  const [revealedFormulaIds, setRevealedFormulaIds] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    writeVersionedStorage(FAVORITES_STORAGE_KEY, 1, favoriteIds);
  }, [favoriteIds]);

  const curriculumChapters = useMemo(
    () => getFormulaChaptersForCurriculum(board, grade),
    [board, grade]
  );

  const visibleChapters = useMemo(() => {
    const searched = filterFormulaChapters(curriculumChapters, searchQuery);
    if (!showSavedOnly) return searched;
    return searched
      .map((ch) => {
        const favs = ch.formulas.filter((f) => favoriteIds.includes(f.id));
        if (favs.length === 0) return null;
        return { ...ch, formulas: favs };
      })
      .filter((ch): ch is FormulaChapter => ch !== null);
  }, [curriculumChapters, searchQuery, showSavedOnly, favoriteIds]);

  // Keep selected chapter valid when board/grade/search/saved changes
  const activeChapter: FormulaChapter | null = useMemo(() => {
    if (visibleChapters.length === 0) return null;
    const found = visibleChapters.find((ch) => ch.id === selectedChapterId);
    return found ?? visibleChapters[0];
  }, [visibleChapters, selectedChapterId]);

  useEffect(() => {
    if (activeChapter && activeChapter.id !== selectedChapterId) {
      setSelectedChapterId(activeChapter.id);
    }
  }, [activeChapter, selectedChapterId]);

  // Reset per-card reveals whenever recall mode toggles
  useEffect(() => {
    setRevealedFormulaIds({});
  }, [quizRecallMode]);

  // Keyboard ergonomics inside drawer: Esc closes, / focuses search
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyTextSafely(text);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    }
  };

  const handleToggleFavorite = (formulaId: string) => {
    setFavoriteIds((prev) => toggleIdInList(prev, formulaId));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
    >
      {/* Backdrop scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55"
      />

      {/* Right Slide-in Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Interactive Formula Reference"
        data-testid="interactive-formula-reference"
        className={`fixed inset-y-0 right-0 w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transform transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Top Drawer Header */}
        <header className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5 sm:space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white font-display">
                  Interactive Formula Reference
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Standard {grade} · {board} Curriculum · {curriculumChapters.length} chapter sheets
                {favoriteIds.length > 0 ? ` · ${favoriteIds.length} saved` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close formula reference"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Curriculum Controls + Search Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Board Switcher */}
            <div
              role="group"
              aria-label="Curriculum board"
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5"
            >
              {BOARDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  data-testid={`formula-board-${b}`}
                  onClick={() => onChangeBoard(b)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    board === b
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Grade Selector */}
            <div
              role="group"
              aria-label="Grade standard"
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5"
            >
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  data-testid={`formula-grade-${g}`}
                  onClick={() => onChangeGrade(g)}
                  className={`px-2 py-1 rounded-md text-xs font-mono tabular-nums transition-colors ${
                    grade === g
                      ? 'bg-slate-900 dark:bg-sky-500/20 text-white dark:text-sky-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Std {g}
                </button>
              ))}
            </div>

            {/* Saved Filter & Flashcard Recall Quiz Mode */}
            <button
              type="button"
              data-testid="formula-saved-filter"
              aria-pressed={showSavedOnly}
              onClick={() => setShowSavedOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showSavedOnly
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-current' : ''}`} />
              <span>Saved ({favoriteIds.length})</span>
            </button>

            <button
              type="button"
              data-testid="formula-quiz-mode-btn"
              aria-pressed={quizRecallMode}
              onClick={() => setQuizRecallMode((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                quizRecallMode
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
              title="Blur equations so you can test active recall before clicking to reveal"
            >
              {quizRecallMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{quizRecallMode ? 'Quiz Recall: On' : 'Quiz Me'}</span>
            </button>

            {/* Search Filter */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chapter or formula (press / to focus)..."
                aria-label="Search formulas"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </header>

        {/* Mobile Chapter Switcher Strip (< md): saves vertical screen space on phones */}
        <div
          aria-label="Formula chapters mobile switcher"
          className="md:hidden shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 px-4 py-2.5 overflow-x-auto no-scrollbar"
        >
          <div className="flex items-center gap-2 w-max">
            {visibleChapters.length === 0 ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                No matching chapters
              </span>
            ) : (
              visibleChapters.map((ch) => {
                const isSelected = activeChapter?.id === ch.id;
                const shortTitle = ch.title.split('(')[0].trim();
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-75 mr-1.5">
                      {ch.chapterNumber}
                    </span>
                    <span>{shortTitle}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Two-Pane Body (Tablet & Desktop): Chapter Topic List + Dynamic LaTeX Formula Sheet */}
        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12">
          {/* Left Rail: Chapter Topics (Tablet & Desktop only) */}
          <nav
            aria-label="Formula chapters"
            className="hidden md:block md:col-span-4 border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-slate-50/70 dark:bg-slate-900/40 divide-y divide-slate-200/70 dark:divide-slate-800/70"
          >
            {visibleChapters.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p>
                  {showSavedOnly
                    ? 'No saved formulas yet. Star any formula card to build your revision sheet.'
                    : `No matching formula chapters for "${searchQuery}".`}
                </p>
                {showSavedOnly && (
                  <button
                    type="button"
                    onClick={() => setShowSavedOnly(false)}
                    className="text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  >
                    Show all chapters
                  </button>
                )}
              </div>
            ) : (
              visibleChapters.map((ch) => {
                const isSelected = activeChapter?.id === ch.id;
                const isExactGrade = ch.grades.includes(grade);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    data-testid={`formula-chapter-${ch.id}`}
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {ch.chapterNumber}
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span>{isExactGrade ? `Std ${grade} Core` : `Std ${ch.grades.join('/')}`}</span>
                      </div>
                      <div className="text-xs font-semibold leading-snug">
                        {ch.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ch.formulas.length} {ch.formulas.length === 1 ? 'formula' : 'formulas'}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 mt-1 shrink-0 transition-opacity ${
                        isSelected ? 'opacity-100 text-sky-500' : 'opacity-30'
                      }`}
                    />
                  </button>
                );
              })
            )}
          </nav>

          {/* Right Pane: Dynamic KaTeX Formula Sheet */}
          <div className="flex-1 md:col-span-8 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5 bg-white dark:bg-slate-950 safe-area-bottom">
            {activeChapter ? (
              <>
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
                    {activeChapter.chapterNumber} · {board} Standard {grade}
                  </div>
                  <h3
                    data-testid="active-formula-chapter-title"
                    className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight"
                  >
                    {activeChapter.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeChapter.summary}
                  </p>
                </div>

                <div className="space-y-4">
                  {activeChapter.formulas.map((item) => {
                    const isCopiedLatex = copiedKey === `latex:${item.id}`;
                    const isCopiedPlain = copiedKey === `plain:${item.id}`;
                    const isFavorited = favoriteIds.includes(item.id);
                    const isHiddenInQuiz = quizRecallMode && !revealedFormulaIds[item.id];
                    return (
                      <article
                        key={item.id}
                        data-testid={`formula-card-${item.id}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 sm:p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(item.id)}
                              aria-label={isFavorited ? 'Remove from saved formulas' : 'Save formula'}
                              aria-pressed={isFavorited}
                              className={`mt-0.5 p-1 rounded-md transition-colors shrink-0 ${
                                isFavorited
                                  ? 'text-amber-500 hover:bg-amber-500/10'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-current' : ''}`} />
                            </button>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug pt-0.5">
                              {item.title}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopy(`plain:${item.id}`, latexToPlaintext(item.latex))}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-sky-500/50 transition-colors whitespace-nowrap"
                              title="Copy formula as plain text"
                            >
                              {isCopiedPlain ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Text</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3 h-3" />
                                  <span>Text</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopy(`latex:${item.id}`, item.latex)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-sky-500/50 transition-colors whitespace-nowrap"
                              title="Copy raw LaTeX source"
                            >
                              {isCopiedLatex ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">LaTeX</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>LaTeX</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onAskTutor(item.askTutorPrompt);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-[11px] font-medium text-white transition-colors whitespace-nowrap"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Ask Tutor</span>
                            </button>
                          </div>
                        </div>

                        {/* KaTeX Display Equation (supports Flashcard Recall Blur Mode) */}
                        <div className="relative rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 overflow-x-auto text-slate-900 dark:text-slate-100">
                          <div
                            className={`transition-all duration-200 ${
                              isHiddenInQuiz ? 'blur-md select-none opacity-40' : ''
                            }`}
                            dangerouslySetInnerHTML={{
                              __html: renderLatexHtml(item.latex, true),
                            }}
                          />
                          {isHiddenInQuiz && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedFormulaIds((prev) => ({ ...prev, [item.id]: true }))
                              }
                              className="absolute inset-0 flex items-center justify-center bg-slate-950/15 dark:bg-slate-950/35 text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-950/25 transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs">
                                <Eye className="w-3.5 h-3.5 text-sky-500" />
                                <span>Tap to Reveal Formula</span>
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Variable Legend + Board Exam Tip */}
                        <div className="space-y-1.5 text-xs">
                          <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 mr-1.5">
                              Symbols:
                            </span>
                            <span className="font-mono text-[11px]">{item.variables}</span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            <span className="font-semibold text-amber-700 dark:text-amber-400 mr-1.5">
                              {board} Exam Note:
                            </span>
                            <span>{item.boardNote}</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-12">
                <p>
                  {showSavedOnly
                    ? 'You have no saved formulas matching this filter yet.'
                    : 'Select a chapter on the left to inspect its LaTeX formula sheet.'}
                </p>
                {showSavedOnly && (
                  <button
                    type="button"
                    onClick={() => setShowSavedOnly(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium"
                  >
                    Browse All Formulas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
});
