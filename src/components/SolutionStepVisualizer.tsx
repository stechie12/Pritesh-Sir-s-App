import React, { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Play, Pause, RotateCcw, Compass } from 'lucide-react';
import { ProblemItem } from '../utils/adaptiveEngine';
import {
  buildSolutionGraphModel,
  getVisibleGraphSlice,
  GraphMarker,
} from '../utils/solutionGraphBuilder';

interface SolutionStepVisualizerProps {
  problem: ProblemItem;
  compact?: boolean;
}

function renderInlineLatex(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}

const EmptyDot: React.FC = () => null;

interface MarkerDotProps {
  cx?: number;
  cy?: number;
  payload?: GraphMarker;
}

const LabeledMarkerDot: React.FC<MarkerDotProps> = ({ cx, cy, payload }) => {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null;
  const pos = payload.labelPosition ?? (cy < 42 ? 'bottom' : 'top');
  let dx = 0;
  let dy = -11;
  let anchor: 'middle' | 'start' | 'end' = 'middle';

  if (pos === 'bottom') {
    dy = 17;
  } else if (pos === 'left') {
    dx = -10;
    dy = 3;
    anchor = 'end';
  } else if (pos === 'right') {
    dx = 10;
    dy = 3;
    anchor = 'start';
  }

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={5.5}
        fill={payload.color}
        stroke="#0f172a"
        strokeWidth={1.5}
      />
      <text
        x={cx + dx}
        y={cy + dy}
        textAnchor={anchor}
        strokeWidth={3}
        className="fill-slate-800 dark:fill-slate-100 stroke-white/90 dark:stroke-slate-950/85 [paint-order:stroke] text-[10px] font-mono font-semibold"
      >
        {payload.label}
      </text>
    </g>
  );
};

export const SolutionStepVisualizer: React.FC<SolutionStepVisualizerProps> = ({
  problem,
  compact = false,
}) => {
  const model = useMemo(() => buildSolutionGraphModel(problem), [problem]);
  const totalSteps = Math.max(1, model.stepAnnotations.length);

  // Start at the final step so the complete verified geometric/coordinate proof is immediately legible,
  // while letting students step through Step 1 -> Step N or replay construction.
  const [activeStepIndex, setActiveStepIndex] = useState<number>(totalSteps - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Reset step state when switching to a different problem
  useEffect(() => {
    setActiveStepIndex(Math.max(0, model.stepAnnotations.length - 1));
    setIsPlaying(false);
  }, [problem.id, model.stepAnnotations.length]);

  // Step-by-step construction playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1150);
    return () => window.clearInterval(timer);
  }, [isPlaying, totalSteps]);

  const visibleSlice = useMemo(
    () => getVisibleGraphSlice(model, activeStepIndex),
    [model, activeStepIndex]
  );

  const showOriginX = model.xDomain[0] <= 0 && model.xDomain[1] >= 0;
  const showOriginY = model.yDomain[0] <= 0 && model.yDomain[1] >= 0;
  const activeAnnotation =
    model.stepAnnotations[activeStepIndex] ?? model.stepAnnotations[0] ?? '';
  const activeLatex = model.stepFormulaLatex[activeStepIndex] ?? '';

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setActiveStepIndex(0);
    setIsPlaying(true);
  };

  return (
    <div
      data-testid="solution-step-visualizer"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3.5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-600 dark:text-sky-400">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>{model.categoryLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              Step {activeStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {model.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {model.subtitle}
          </p>
        </div>

        {/* Play / Reset Step Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="graph-play-steps-btn"
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-medium transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlaying ? 'Pause' : 'Animate Steps'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setActiveStepIndex(totalSteps - 1);
            }}
            title="Show complete proof graph"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>All</span>
          </button>
        </div>
      </div>

      {/* Step Selector Bar */}
      <div
        role="tablist"
        aria-label="Solution visualization steps"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap"
      >
        {model.stepAnnotations.map((_, idx) => {
          const isCurrent = idx === activeStepIndex;
          const isRevealed = idx <= activeStepIndex;
          return (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              data-testid={`graph-step-btn-${idx + 1}`}
              onClick={() => {
                setIsPlaying(false);
                setActiveStepIndex(idx);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors border whitespace-nowrap shrink-0 ${
                isCurrent
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                  : isRevealed
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                  : 'border-slate-200/70 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Step {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Recharts 2D Coordinate / Geometric Proof Plot */}
      <div
        className="w-full rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/80 px-2 pt-3 pb-1"
        data-testid="solution-recharts-container"
      >
        <div
          className={
            model.preserveSquareAspect ? 'w-full max-w-[320px] sm:max-w-[380px] mx-auto' : 'w-full'
          }
        >
          <ResponsiveContainer
            width="100%"
            height={model.preserveSquareAspect ? (compact ? 290 : 340) : compact ? 220 : 270}
          >
            <ScatterChart margin={{ top: 20, right: 26, bottom: 20, left: 6 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.22)"
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={model.xDomain}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#64748b"
              label={{
                value: model.xLabel,
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
                fill: '#94a3b8',
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={model.yDomain}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#64748b"
              width={44}
              label={{
                value: model.yLabel,
                angle: -90,
                position: 'insideLeft',
                offset: 12,
                fontSize: 11,
                fill: '#94a3b8',
              }}
            />
            {showOriginX && (
              <ReferenceLine x={0} stroke="rgba(148, 163, 184, 0.55)" strokeWidth={1.2} />
            )}
            {showOriginY && (
              <ReferenceLine y={0} stroke="rgba(148, 163, 184, 0.55)" strokeWidth={1.2} />
            )}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const pt = payload[0]?.payload as { x?: number; y?: number; label?: string } | undefined;
                if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return null;
                return (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-mono shadow-md">
                    {pt.label && (
                      <div className="font-semibold text-sky-600 dark:text-sky-400">
                        {pt.label}
                      </div>
                    )}
                    <div className="text-slate-700 dark:text-slate-200 tabular-nums">
                      ({pt.x}, {pt.y})
                    </div>
                  </div>
                );
              }}
            />

            {/* Geometric Segments & Curves */}
            {visibleSlice.segments.map((seg) => (
              <Scatter
                key={seg.id}
                name={seg.label}
                data={seg.points}
                fill={seg.color}
                line={{
                  stroke: seg.color,
                  strokeWidth: 2.5,
                  strokeDasharray: seg.dashed ? '6 4' : undefined,
                }}
                lineType="joint"
                shape={<EmptyDot />}
                isAnimationActive={false}
              />
            ))}

            {/* Key Geometric Vertices & Proof Markers */}
            {visibleSlice.markers.length > 0 && (
              <Scatter
                name="Key Points"
                data={visibleSlice.markers}
                shape={<LabeledMarkerDot />}
                isAnimationActive={false}
              />
            )}
          </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segment Legend (plain inline key, zero pill clutter) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
        {visibleSlice.segments.map((seg) => (
          <span key={seg.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: seg.color,
                borderTop: seg.dashed ? `2px dashed ${seg.color}` : undefined,
              }}
            />
            <span>{seg.label}</span>
          </span>
        ))}
      </div>

      {/* Active Step Geometric Proof Note + Live KaTeX Equation + Numeric Readouts */}
      <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            data-testid="graph-active-annotation"
            className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed flex-1 min-w-[200px]"
          >
            <span className="font-semibold text-sky-600 dark:text-sky-400 mr-1.5">
              Step {activeStepIndex + 1}:
            </span>
            {activeAnnotation}
          </p>

          {activeLatex && (
            <div
              className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 overflow-x-auto max-w-full"
              dangerouslySetInnerHTML={{ __html: renderInlineLatex(activeLatex) }}
            />
          )}
        </div>

        {visibleSlice.metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
            {visibleSlice.metrics.map((m) => (
              <div key={m.label} className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {m.label}
                </div>
                <div className="text-xs font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
