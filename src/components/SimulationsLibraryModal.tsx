import React, { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  X,
  Search,
  RotateCcw,
  Sparkles,
  Sliders,
  Lightbulb,
  BookOpen,
  ChevronRight,
  Compass,
  Check,
  Copy,
} from 'lucide-react';
import {
  InlineVisualizerSpec,
  SIMULATION_CATALOG,
  SIMULATION_CATEGORIES,
  SimulationCatalogEntry,
  SimulationCategory,
  filterSimulationCatalog,
  sanitizeVisualizerSpec,
} from '../utils/visualizerDetector';
import { InlineMathVisualizer } from '../utils/mathVisualizers';
import { copyTextSafely } from '../utils/tutorEnhancements';
import { latexToPlaintext } from '../utils/practiceWorkspace';
import type { GradeLevel } from '../utils/adaptiveEngine';
import {
  GRADE_9_CHAPTER_SIMULATIONS,
  GRADE_10_CHAPTER_SIMULATIONS,
  type ChapterSimulationItem,
} from '../data/chapterSimulations';
import { ChapterSimulationCanvas } from './ChapterSimulationCanvas';

type LibraryCollectionMode = 'grade9' | 'grade10' | 'core';

interface SimulationsLibraryModalProps {
  isOpen: boolean;
  initialSpec?: InlineVisualizerSpec | null;
  grade?: GradeLevel;
  onClose: () => void;
  onAskTutor: (prompt: string) => void;
}

const KATEX_CACHE = new Map<string, string>();

function renderFormulaHtml(latex: string): string {
  const cached = KATEX_CACHE.get(latex);
  if (cached !== undefined) return cached;
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      strict: false,
    });
    KATEX_CACHE.set(latex, html);
    return html;
  } catch {
    return latex;
  }
}

export const SimulationsLibraryModal: React.FC<SimulationsLibraryModalProps> = React.memo(
  ({ isOpen, initialSpec, grade = '10', onClose, onAskTutor }) => {
    const [collectionMode, setCollectionMode] = useState<LibraryCollectionMode>(() =>
      initialSpec ? 'core' : grade === '9' ? 'grade9' : 'grade10'
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<'All' | SimulationCategory>('All');
    const [selectedId, setSelectedId] = useState<InlineVisualizerSpec['kind']>(
      initialSpec?.kind ?? SIMULATION_CATALOG[0].id
    );
    const [activeSpec, setActiveSpec] = useState<InlineVisualizerSpec>(
      sanitizeVisualizerSpec(initialSpec) ?? SIMULATION_CATALOG[0].defaultSpec
    );
    const [selectedChapterId, setSelectedChapterId] = useState<string>(
      grade === '9' ? GRADE_9_CHAPTER_SIMULATIONS[0].id : GRADE_10_CHAPTER_SIMULATIONS[0].id
    );
    const [chapterParamsMap, setChapterParamsMap] = useState<
      Record<string, Record<string, number>>
    >({});
    const [resetTick, setResetTick] = useState(0);
    const [copiedFormulaIdx, setCopiedFormulaIdx] = useState<number | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    // Sync whenever modal opens
    useEffect(() => {
      if (!isOpen) return;
      const validSpec = sanitizeVisualizerSpec(initialSpec);
      if (validSpec) {
        setCollectionMode('core');
        setSelectedCategory('All');
        setSearchQuery('');
        setSelectedId(validSpec.kind);
        setActiveSpec(validSpec);
        setResetTick((t) => t + 1);
      } else {
        const targetMode: LibraryCollectionMode = grade === '9' ? 'grade9' : 'grade10';
        setCollectionMode(targetMode);
        setSelectedChapterId(
          targetMode === 'grade9'
            ? GRADE_9_CHAPTER_SIMULATIONS[0].id
            : GRADE_10_CHAPTER_SIMULATIONS[0].id
        );
      }
    }, [isOpen, initialSpec, grade]);

    const visibleCoreEntries = useMemo(
      () => filterSimulationCatalog(searchQuery, selectedCategory),
      [searchQuery, selectedCategory]
    );

    const activeCoreEntry: SimulationCatalogEntry = useMemo(() => {
      return (
        SIMULATION_CATALOG.find((e) => e.id === selectedId) ??
        visibleCoreEntries[0] ??
        SIMULATION_CATALOG[0]
      );
    }, [selectedId, visibleCoreEntries]);

    const currentGradeChapters = useMemo<ChapterSimulationItem[]>(() => {
      const list =
        collectionMode === 'grade9' ? GRADE_9_CHAPTER_SIMULATIONS : GRADE_10_CHAPTER_SIMULATIONS;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return list;
      return list.filter(
        (item) =>
          item.chapterTitle.toLowerCase().includes(q) ||
          item.simTitle.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          `ch ${item.chapterNumber}`.includes(q) ||
          `chapter ${item.chapterNumber}`.includes(q)
      );
    }, [collectionMode, searchQuery]);

    const activeChapterSim: ChapterSimulationItem = useMemo(() => {
      const fullList =
        collectionMode === 'grade9' ? GRADE_9_CHAPTER_SIMULATIONS : GRADE_10_CHAPTER_SIMULATIONS;
      return (
        fullList.find((c) => c.id === selectedChapterId) ??
        currentGradeChapters[0] ??
        fullList[0]
      );
    }, [collectionMode, selectedChapterId, currentGradeChapters]);

    const activeChapterParams = useMemo(() => {
      return chapterParamsMap[activeChapterSim.id] ?? activeChapterSim.defaultParams;
    }, [chapterParamsMap, activeChapterSim]);

    // Ensure keyboard shortcuts work cleanly inside the modal
    useEffect(() => {
      if (!isOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
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
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSwitchCollection = (mode: LibraryCollectionMode) => {
      setCollectionMode(mode);
      setSearchQuery('');
      setCopiedFormulaIdx(null);
      if (mode === 'grade9') {
        setSelectedChapterId(GRADE_9_CHAPTER_SIMULATIONS[0].id);
      } else if (mode === 'grade10') {
        setSelectedChapterId(GRADE_10_CHAPTER_SIMULATIONS[0].id);
      }
    };

    const handleSelectCoreEntry = (entry: SimulationCatalogEntry) => {
      setSelectedId(entry.id);
      setActiveSpec(entry.defaultSpec);
      setResetTick((t) => t + 1);
      setCopiedFormulaIdx(null);
    };

    const handleApplyCorePreset = (spec: InlineVisualizerSpec) => {
      setActiveSpec(spec);
      setResetTick((t) => t + 1);
    };

    const handleResetCore = () => {
      setActiveSpec(activeCoreEntry.defaultSpec);
      setResetTick((t) => t + 1);
    };

    const handleChangeChapterParam = (key: string, value: number) => {
      setChapterParamsMap((prev) => ({
        ...prev,
        [activeChapterSim.id]: {
          ...(prev[activeChapterSim.id] ?? activeChapterSim.defaultParams),
          [key]: value,
        },
      }));
    };

    const handleApplyChapterPreset = (presetParams: Record<string, number>) => {
      setChapterParamsMap((prev) => ({
        ...prev,
        [activeChapterSim.id]: { ...presetParams },
      }));
    };

    const handleResetChapter = () => {
      setChapterParamsMap((prev) => ({
        ...prev,
        [activeChapterSim.id]: { ...activeChapterSim.defaultParams },
      }));
    };

    const handleCopyFormula = async (idx: number, latex: string) => {
      const ok = await copyTextSafely(latexToPlaintext(latex));
      if (ok) {
        setCopiedFormulaIdx(idx);
        window.setTimeout(() => {
          setCopiedFormulaIdx((prev) => (prev === idx ? null : prev));
        }, 1600);
      }
    };

    const specKey = `${activeCoreEntry.id}-${JSON.stringify(activeSpec)}-${resetTick}`;
    const isChapterMode = collectionMode !== 'core';
    const totalSimCount =
      GRADE_9_CHAPTER_SIMULATIONS.length +
      GRADE_10_CHAPTER_SIMULATIONS.length +
      SIMULATION_CATALOG.length;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sim-library-title"
        data-testid="simulations-library-modal"
        className="fixed inset-0 z-50 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-6xl h-[92vh] sm:h-[88vh] max-h-[860px] rounded-2xl border fluent-glass-panel flex flex-col overflow-hidden min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Modal Header + Collection Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 border-b border-slate-200/70 dark:border-white/10 bg-white/45 dark:bg-white/[0.03] shrink-0">
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="sim-library-title"
                    className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white truncate font-display"
                  >
                    Interactive Math Simulations Library
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {totalSimCount} Live Labs · 1 Interactive Simulation per Chapter (Std 9 &amp; 10)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Simulations Library"
                className="sm:hidden inline-flex items-center justify-center p-2 rounded-xl fluent-control text-slate-700 dark:text-slate-200 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <div
                role="tablist"
                aria-label="Simulation grade collections"
                className="inline-flex w-full sm:w-auto items-center justify-between sm:justify-start gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900/90 border border-slate-300/60 dark:border-slate-800 p-1"
              >
                {(
                  [
                    {
                      key: 'grade9',
                      shortLabel: `Std 9 (${GRADE_9_CHAPTER_SIMULATIONS.length})`,
                      label: `Grade 9 Chapters (${GRADE_9_CHAPTER_SIMULATIONS.length})`,
                      testId: 'sim-mode-grade9',
                    },
                    {
                      key: 'grade10',
                      shortLabel: `Std 10 (${GRADE_10_CHAPTER_SIMULATIONS.length})`,
                      label: `Grade 10 Chapters (${GRADE_10_CHAPTER_SIMULATIONS.length})`,
                      testId: 'sim-mode-grade10',
                    },
                    {
                      key: 'core',
                      shortLabel: `Core (${SIMULATION_CATALOG.length})`,
                      label: `Core Labs (${SIMULATION_CATALOG.length})`,
                      testId: 'sim-mode-core',
                    },
                  ] as const
                ).map((tab) => {
                  const active = collectionMode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      data-testid={tab.testId}
                      onClick={() => handleSwitchCollection(tab.key)}
                      className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap text-center transition-colors ${
                        active
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="sm:hidden">{tab.shortLabel}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="close-simulations-library-btn"
                onClick={onClose}
                aria-label="Close Simulations Library"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl fluent-control text-xs font-medium text-slate-700 dark:text-slate-200 shrink-0"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Main 2-Zone Body */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Rail (Desktop) / Compact Top Picker (Mobile) */}
            <aside
              aria-label="Simulations catalog"
              className="w-full lg:w-80 xl:w-88 border-b lg:border-b-0 lg:border-r border-slate-200/70 dark:border-white/10 bg-white/35 dark:bg-white/[0.02] flex flex-col shrink-0"
            >
              <div className="p-2.5 sm:p-4 space-y-2 border-b border-slate-200/80 dark:border-slate-800/80 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isChapterMode
                        ? `Search Std ${collectionMode === 'grade9' ? '9' : '10'} chapters (e.g. GST, Ch 5, Circles)...`
                        : 'Search core labs (e.g. parabola, cone, sin)...'
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-testid="sim-library-search"
                    aria-label="Search interactive math simulations"
                    className="w-full pl-8 pr-8 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear simulation search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter Tabs (only for Core Labs) */}
                {!isChapterMode && (
                  <div
                    role="tablist"
                    aria-label="Simulation categories"
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5"
                  >
                    {SIMULATION_CATEGORIES.map((category) => {
                      const isActive = selectedCategory === category;
                      const shortLabel =
                        category === 'Geometry & Trig'
                          ? 'Geometry'
                          : category === 'Algebra & Calculus'
                            ? 'Algebra'
                            : category === 'Commercial & Solids'
                              ? 'Solids & CI'
                              : 'All (8)';
                      return (
                        <button
                          key={category}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          data-testid={`sim-cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                            isActive
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                          }`}
                        >
                          {shortLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile Horizontal Strip (< lg) & Desktop Vertical List (lg+) */}
              <div
                data-testid="sim-library-list"
                className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto no-scrollbar p-2 sm:p-3 lg:flex-1"
              >
                {isChapterMode ? (
                  currentGradeChapters.length === 0 ? (
                    <div className="w-full py-4 lg:py-8 px-3 text-center space-y-1.5">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        No chapters match &ldquo;{searchQuery}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        Show all Grade {collectionMode === 'grade9' ? '9' : '10'} chapters
                      </button>
                    </div>
                  ) : (
                    currentGradeChapters.map((ch) => {
                      const isSelected = ch.id === activeChapterSim.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          data-testid={`chapter-sim-item-${ch.id}`}
                          onClick={() => {
                            setSelectedChapterId(ch.id);
                            setCopiedFormulaIdx(null);
                          }}
                          aria-pressed={isSelected}
                          className={`shrink-0 lg:shrink lg:w-full text-left px-3 py-2 lg:py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'border-sky-500/60 bg-sky-500/15 text-slate-900 dark:text-white'
                              : 'border-slate-200/70 dark:border-slate-800/80 lg:border-transparent bg-white/80 dark:bg-slate-950/60 lg:bg-transparent hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900/70 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-semibold whitespace-nowrap lg:whitespace-normal lg:truncate">
                              <span className="font-mono text-sky-600 dark:text-sky-400 mr-1.5">
                                Ch {ch.chapterNumber}
                              </span>
                              <span>{ch.chapterTitle}</span>
                            </div>
                            <div className="hidden lg:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {ch.simTitle}
                            </div>
                          </div>
                          <ChevronRight
                            className={`hidden lg:block w-3.5 h-3.5 shrink-0 transition-colors ${
                              isSelected ? 'text-sky-500' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })
                  )
                ) : visibleCoreEntries.length === 0 ? (
                  <div className="w-full py-4 lg:py-8 px-3 text-center space-y-1.5">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      No simulations match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                      }}
                      className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      Show all {SIMULATION_CATALOG.length} simulations
                    </button>
                  </div>
                ) : (
                  visibleCoreEntries.map((entry) => {
                    const isSelected = entry.id === activeCoreEntry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        data-testid={`sim-item-${entry.id}`}
                        onClick={() => handleSelectCoreEntry(entry)}
                        aria-pressed={isSelected}
                        className={`shrink-0 lg:shrink lg:w-full text-left px-3 py-2 lg:py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-sky-500/60 bg-sky-500/15 text-slate-900 dark:text-white'
                            : 'border-slate-200/70 dark:border-slate-800/80 lg:border-transparent bg-white/80 dark:bg-slate-950/60 lg:bg-transparent hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900/70 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="text-xs font-semibold whitespace-nowrap lg:whitespace-normal lg:truncate">
                            <span className="lg:hidden">{entry.shortTitle}</span>
                            <span className="hidden lg:inline">{entry.title}</span>
                          </div>
                          <div className="hidden lg:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {entry.category} · {entry.grades}
                          </div>
                        </div>
                        <ChevronRight
                          className={`hidden lg:block w-3.5 h-3.5 shrink-0 transition-colors ${
                            isSelected ? 'text-sky-500' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Interactive Stage */}
            <section
              aria-label="Active simulation workspace"
              className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white/30 dark:bg-transparent"
            >
              {isChapterMode ? (
                <>
                  {/* Grade 9 / 10 Chapter Stage Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200/70 dark:border-white/10 pb-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>Standard {activeChapterSim.grade}</span>
                        <span aria-hidden="true">·</span>
                        <span>Chapter {activeChapterSim.chapterNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeChapterSim.boardTag}</span>
                      </div>
                      <h3
                        data-testid="sim-stage-title"
                        className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white font-display"
                      >
                        {activeChapterSim.chapterTitle}: {activeChapterSim.simTitle}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                        {activeChapterSim.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="sim-reset-btn"
                        onClick={handleResetChapter}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl fluent-control text-xs font-medium text-slate-700 dark:text-slate-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                      <button
                        type="button"
                        data-testid="sim-ask-tutor-btn"
                        onClick={() => {
                          onClose();
                          onAskTutor(activeChapterSim.askPrompt);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl fluent-primary-btn text-white text-xs font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ask Pritesh Sir</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Chapter Simulation Canvas */}
                  <div data-testid="sim-live-stage" className="min-w-0">
                    <ChapterSimulationCanvas
                      sim={activeChapterSim}
                      params={activeChapterParams}
                      onChangeParam={handleChangeChapterParam}
                      onApplyPreset={handleApplyChapterPreset}
                      onReset={handleResetChapter}
                    />
                  </div>

                  {/* Key Formulas + Exam Tip Footer Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="rounded-2xl fluent-glass-subtle p-4 space-y-2.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                        <span>Key Board Formulas</span>
                      </div>
                      <div className="space-y-2">
                        {activeChapterSim.keyFormulas.map((latex, idx) => (
                          <div
                            key={idx}
                            className="group flex items-center justify-between gap-2 rounded-xl bg-white/75 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10 px-3 py-2 min-w-0"
                          >
                            <div
                              className="flex-1 min-w-0 overflow-x-auto no-scrollbar text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 [&_.katex-display]:my-0 [&_.katex-display]:text-left"
                              dangerouslySetInnerHTML={{ __html: renderFormulaHtml(latex) }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyFormula(idx, latex)}
                              aria-label={`Copy formula ${idx + 1}`}
                              title="Copy formula"
                              className="p-1.5 rounded-md text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                              {copiedFormulaIdx === idx ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Pritesh Sir&apos;s Exam Tip</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {activeChapterSim.examTip}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-amber-500/20 pt-2.5">
                        One dedicated interactive lab per chapter across Grade 9 (16 chapters) &amp; Grade 10 (18 chapters).
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Core Labs Stage Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200/70 dark:border-white/10 pb-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Compass className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>{activeCoreEntry.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeCoreEntry.grades}</span>
                      </div>
                      <h3
                        data-testid="sim-stage-title"
                        className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-white font-display"
                      >
                        {activeCoreEntry.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                        {activeCoreEntry.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="sim-reset-btn"
                        onClick={handleResetCore}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl fluent-control text-xs font-medium text-slate-700 dark:text-slate-100"
                        title="Reset sliders to default values"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </button>
                      <button
                        type="button"
                        data-testid="sim-ask-tutor-btn"
                        onClick={() => {
                          onClose();
                          onAskTutor(activeCoreEntry.askPrompt);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl fluent-primary-btn text-white text-xs font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ask Pritesh Sir</span>
                      </button>
                    </div>
                  </div>

                  {/* Exam Presets Strip */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Quick Exam Presets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeCoreEntry.presets.map((preset, idx) => {
                        const isCurrentPreset =
                          JSON.stringify(preset.spec) === JSON.stringify(activeSpec);
                        return (
                          <button
                            key={idx}
                            type="button"
                            data-testid={`sim-preset-${idx}`}
                            onClick={() => handleApplyCorePreset(preset.spec)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isCurrentPreset
                                ? 'border-sky-500/60 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live Interactive Visualizer Stage */}
                  <div data-testid="sim-live-stage" className="min-w-0">
                    <InlineMathVisualizer key={specKey} spec={activeSpec} />
                  </div>

                  {/* Key Formulas + Exam Tip Footer Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="rounded-2xl fluent-glass-subtle p-4 space-y-2.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                        <span>Key Board Formulas</span>
                      </div>
                      <div className="space-y-2">
                        {activeCoreEntry.keyFormulas.map((latex, idx) => (
                          <div
                            key={idx}
                            className="group flex items-center justify-between gap-2 rounded-xl bg-white/75 dark:bg-slate-950/60 border border-slate-200/70 dark:border-white/10 px-3 py-2 min-w-0"
                          >
                            <div
                              className="flex-1 min-w-0 overflow-x-auto no-scrollbar text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 [&_.katex-display]:my-0 [&_.katex-display]:text-left"
                              dangerouslySetInnerHTML={{ __html: renderFormulaHtml(latex) }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCopyFormula(idx, latex)}
                              aria-label={`Copy formula ${idx + 1}`}
                              title="Copy formula"
                              className="p-1.5 rounded-md text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                            >
                              {copiedFormulaIdx === idx ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex flex-col justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Pritesh Sir&apos;s Exam Tip</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {activeCoreEntry.examTip}
                        </p>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-amber-500/20 pt-2.5">
                        Tip: Ask Pritesh Sir to &ldquo;visualize&rdquo; any problem in chat and the AI will summon the right simulation automatically.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }
);
