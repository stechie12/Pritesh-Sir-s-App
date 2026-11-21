import React, { useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Compass, Target } from 'lucide-react';
import type { ChapterMasteryItem, CurriculumBoard, GradeLevel } from '../utils/adaptiveEngine';
import {
  buildMasteryRadarData,
  summarizeRadarAlignment,
  type MasteryRadarPoint,
} from '../utils/masteryRadar';

interface ChapterMasteryRadarChartProps {
  chapters: ChapterMasteryItem[];
  adaptiveRating: number;
  grade: GradeLevel;
  board: CurriculumBoard;
  darkMode?: boolean;
  compact?: boolean;
  onFocusWeakTopics?: () => void;
}

interface RadarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MasteryRadarPoint }>;
  adaptiveRating: number;
}

const MasteryRadarTooltip: React.FC<RadarTooltipProps> = ({
  active,
  payload,
  adaptiveRating,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const deltaPrefix = point.delta > 0 ? '+' : '';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3.5 py-2.5 shadow-lg text-xs max-w-[260px]">
      <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
        {point.fullChapter}
      </div>
      <div className="mt-2 space-y-1.5 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sky-600 dark:text-sky-400">Chapter Mastery</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {point.unattempted ? 'Not Attempted' : `${point.chapterMastery}% (${point.correct}/${point.attempted})`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-amber-600 dark:text-amber-400">Adaptive Rating ({adaptiveRating} ELO)</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {point.adaptiveBenchmark}%
          </span>
        </div>
        {!point.unattempted && (
          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Alignment</span>
            <span
              className={
                point.delta >= 0
                  ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'font-semibold text-amber-600 dark:text-amber-400'
              }
            >
              {deltaPrefix}
              {point.delta}% vs. ELO
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ChapterMasteryRadarChart: React.FC<ChapterMasteryRadarChartProps> = ({
  chapters,
  adaptiveRating,
  grade,
  board,
  darkMode = true,
  compact = false,
  onFocusWeakTopics,
}) => {
  const [scope, setScope] = useState<'all' | 'attempted'>('all');
  const [showRatingOverlay, setShowRatingOverlay] = useState(true);

  const attemptedCountTotal = useMemo(
    () => chapters.filter((c) => c.attempted > 0).length,
    [chapters]
  );

  const canFilterAttemptedOnly = attemptedCountTotal >= 3;

  const radarPoints = useMemo(
    () =>
      buildMasteryRadarData(chapters, adaptiveRating, {
        maxAxes: compact ? 6 : 8,
        attemptedOnly: scope === 'attempted' && canFilterAttemptedOnly,
      }),
    [chapters, adaptiveRating, compact, scope, canFilterAttemptedOnly]
  );

  const summary = useMemo(
    () => summarizeRadarAlignment(radarPoints, adaptiveRating),
    [radarPoints, adaptiveRating]
  );

  const gridStroke = darkMode ? '#1e293b' : '#e2e8f0';
  const tickColor = darkMode ? '#cbd5e1' : '#334155';
  const radiusTickColor = darkMode ? '#64748b' : '#64748b';

  return (
    <div
      data-testid="mastery-radar-section"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
    >
      {/* Header & Interactive Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Chapter Mastery vs. Adaptive Rating Radar
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Standard {grade} ({board}) · Mapping chapter accuracy against your{' '}
            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
              {adaptiveRating} ELO
            </span>{' '}
            target ({summary.benchmarkScore}% · {summary.tierLabel})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Radar chapter scope"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              data-testid="radar-scope-all"
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Chapters
            </button>
            <button
              type="button"
              data-testid="radar-scope-attempted"
              disabled={!canFilterAttemptedOnly}
              onClick={() => setScope('attempted')}
              title={
                canFilterAttemptedOnly
                  ? 'Show only chapters with recorded attempts'
                  : 'Attempt at least 3 chapters to isolate practiced topics on the radar'
              }
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
                scope === 'attempted' && canFilterAttemptedOnly
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Attempted ({attemptedCountTotal})
            </button>
          </div>

          <button
            type="button"
            data-testid="radar-toggle-elo-overlay"
            aria-pressed={showRatingOverlay}
            onClick={() => setShowRatingOverlay((prev) => !prev)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showRatingOverlay
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {showRatingOverlay ? 'ELO Ring: On' : 'ELO Ring: Off'}
          </button>
        </div>
      </div>

      {/* Two-Zone Responsive Split: Radar Canvas + Alignment Deck */}
      <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-12'} gap-5 items-center`}>
        {/* Primary Radar Stage */}
        <div className={compact ? 'w-full' : 'lg:col-span-7 w-full'}>
          <div
            data-testid="mastery-radar-chart"
            className="w-full h-[285px] sm:h-[340px]"
            aria-label={`Radar chart comparing chapter mastery percentages against adaptive rating benchmark of ${summary.benchmarkScore}% (${adaptiveRating} ELO)`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius={compact ? '58%' : '62%'}
                margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
                data={radarPoints}
              >
                <PolarGrid stroke={gridStroke} />
                <PolarAngleAxis
                  dataKey="axisLabel"
                  tick={{ fill: tickColor, fontSize: 10.5, fontWeight: 500 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{ fill: radiusTickColor, fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                />
                {showRatingOverlay && (
                  <Radar
                    name={`Adaptive Rating (${adaptiveRating} ELO)`}
                    dataKey="adaptiveBenchmark"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    fill="#f59e0b"
                    fillOpacity={0.11}
                    isAnimationActive={false}
                  />
                )}
                <Radar
                  name="Chapter Mastery (%)"
                  dataKey="chapterMastery"
                  stroke="#0ea5e9"
                  strokeWidth={2.25}
                  fill="#0ea5e9"
                  fillOpacity={0.3}
                  dot={{ r: 3.5, fill: '#0ea5e9', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />
                <Tooltip content={<MasteryRadarTooltip adaptiveRating={adaptiveRating} />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Inline Series Legend (Zero Pills) */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block w-3.5 h-0.5 bg-sky-500 rounded-full"
              />
              <span>Chapter Mastery (%)</span>
            </span>
            {showRatingOverlay && (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block w-3.5 border-t-2 border-dashed border-amber-500"
                />
                <span className="font-mono tabular-nums">
                  Adaptive Target ({adaptiveRating} ELO · {summary.benchmarkScore}%)
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Right Diagnostic Alignment Deck */}
        <div className={`${compact ? '' : 'lg:col-span-5'} space-y-4`}>
          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                At / Above ELO Target
              </span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {summary.aboveBenchmarkCount}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  / {summary.attemptedChaptersCount} ch.
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Below ELO Target
              </span>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {summary.belowBenchmarkCount}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  / {summary.attemptedChaptersCount} ch.
                </span>
              </div>
            </div>
          </div>

          {/* Chapter-by-Chapter Alignment Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Chapter Alignment vs. {adaptiveRating} ELO</span>
              <span className="font-mono tabular-nums">Mastery / Delta</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {radarPoints.slice(0, compact ? 4 : 6).map((pt) => {
                const isAhead = !pt.unattempted && pt.delta >= 0;
                return (
                  <div
                    key={pt.fullChapter}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {pt.unattempted ? (
                        <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : isAhead ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span
                        title={pt.fullChapter}
                        className="truncate text-slate-800 dark:text-slate-200 font-medium"
                      >
                        {pt.axisLabel}
                      </span>
                    </div>

                    <div className="font-mono tabular-nums shrink-0 flex items-center gap-2">
                      {pt.unattempted ? (
                        <span className="text-slate-400 dark:text-slate-500">Unattempted</span>
                      ) : (
                        <>
                          <span className="text-slate-900 dark:text-slate-100 font-semibold">
                            {pt.chapterMastery}%
                          </span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span
                            className={
                              isAhead
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {pt.delta > 0 ? `+${pt.delta}%` : `${pt.delta}%`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {onFocusWeakTopics && (
            <div className="pt-1">
              <button
                type="button"
                data-testid="radar-drill-weak-btn"
                onClick={onFocusWeakTopics}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-4 py-2 text-xs font-medium text-sky-700 dark:text-sky-300 transition-colors"
              >
                <Target className="w-3.5 h-3.5" />
                <span>Practice Weakest Radar Chapters</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
