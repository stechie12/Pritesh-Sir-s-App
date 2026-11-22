import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Circle,
  Code2,
  Eraser,
  Grid3X3,
  PenTool,
  Play,
  Sparkles,
  Trash2,
  Triangle,
  Undo2,
  X,
} from 'lucide-react';

interface NormalizedPoint {
  nx: number;
  ny: number;
  pressure: number;
}

interface ScratchStroke {
  tool: 'pen' | 'eraser';
  color: string;
  baseWidth: number;
  points: NormalizedPoint[];
}

type PaperStyle = 'grid' | 'graph' | 'dots' | 'iso' | 'blank';

export interface MathScratchpadProps {
  onSolveSketch: (base64Png: string) => void;
  onSolveWithPrompt?: (base64Png: string, prompt: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const INK_SWATCHES = [
  { label: 'Sky Blue', color: '#0284c7', darkColor: '#38bdf8' },
  { label: 'Emerald', color: '#059669', darkColor: '#34d399' },
  { label: 'Amber', color: '#d97706', darkColor: '#fbbf24' },
  { label: 'Rose', color: '#e11d48', darkColor: '#fb7185' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Med', value: 3.5 },
  { label: 'Bold', value: 6 },
];

const PAPER_STYLES: Array<{ id: PaperStyle; label: string }> = [
  { id: 'grid', label: 'Grid' },
  { id: 'graph', label: 'Graph' },
  { id: 'dots', label: 'Dots' },
  { id: 'iso', label: 'Iso' },
  { id: 'blank', label: 'Blank' },
];

export const MathScratchpad: React.FC<MathScratchpadProps> = ({
  onSolveSketch,
  onSolveWithPrompt,
  onClose,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pagesRef = useRef<ScratchStroke[][]>([[], [], []]);
  const activeStrokeRef = useRef<ScratchStroke | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const resizeRafRef = useRef<number | null>(null);
  const replayTimerRef = useRef<number | null>(null);

  const [activePage, setActivePage] = useState<number>(0);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('grid');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [inkColor, setInkColor] = useState<string>('#38bdf8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [strokeCount, setStrokeCount] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const replayLimitRef = useRef<number | null>(null);

  const isDarkTheme = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const drawPaper = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean) => {
      ctx.fillStyle = dark ? '#020617' : '#ffffff';
      ctx.fillRect(0, 0, w, h);

      if (paperStyle === 'blank') return;

      if (paperStyle === 'dots') {
        ctx.fillStyle = dark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.3)';
        const step = 22;
        for (let x = step; x < w; x += step) {
          for (let y = step; y < h; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        return;
      }

      if (paperStyle === 'iso') {
        ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.24)';
        ctx.lineWidth = 1;
        const step = 28;
        ctx.beginPath();
        for (let x = -h; x < w + h; x += step) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + h * 0.577, h);
          ctx.moveTo(x, 0);
          ctx.lineTo(x - h * 0.577, h);
        }
        ctx.stroke();
        return;
      }

      // Grid & Graph
      ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      const step = paperStyle === 'graph' ? 20 : 24;
      ctx.beginPath();
      for (let x = step; x < w; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = step; y < h; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();

      if (paperStyle === 'graph') {
        // Bold Cartesian axes through center
        ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.42)' : 'rgba(2, 132, 199, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(h / 2) + 0.5);
        ctx.lineTo(w, Math.round(h / 2) + 0.5);
        ctx.moveTo(Math.round(w / 2) + 0.5, 0);
        ctx.lineTo(Math.round(w / 2) + 0.5, h);
        ctx.stroke();
      }
    },
    [paperStyle]
  );

  const renderStroke = (
    ctx: CanvasRenderingContext2D,
    stroke: ScratchStroke,
    w: number,
    h: number,
    dark: boolean
  ) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.tool === 'eraser' ? (dark ? '#020617' : '#ffffff') : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.baseWidth * 4 : stroke.baseWidth;

    const first = stroke.points[0];
    const x0 = first.nx * w;
    const y0 = first.ny * h;

    if (stroke.points.length === 1) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < stroke.points.length; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const midX = ((prev.nx + curr.nx) / 2) * w;
      const midY = ((prev.ny + curr.ny) / 2) * h;
      ctx.quadraticCurveTo(prev.nx * w, prev.ny * h, midX, midY);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.nx * w, last.ny * h);
    ctx.stroke();
    ctx.restore();
  };

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(240, Math.floor(rect.width));
    const cssHeight = Math.max(160, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const targetW = Math.round(cssWidth * dpr);
    const targetH = Math.round(cssHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = isDarkTheme();
    drawPaper(ctx, cssWidth, cssHeight, dark);

    const currentStrokes = pagesRef.current[activePage] || [];
    const limit = replayLimitRef.current === null ? currentStrokes.length : replayLimitRef.current;
    for (let i = 0; i < Math.min(limit, currentStrokes.length); i++) {
      renderStroke(ctx, currentStrokes[i], cssWidth, cssHeight, dark);
    }
    if (activeStrokeRef.current) {
      renderStroke(ctx, activeStrokeRef.current, cssWidth, cssHeight, dark);
    }
  }, [activePage, drawPaper]);

  useEffect(() => {
    redrawAll();
    const container = containerRef.current;
    if (!container) return;

    const scheduleRedraw = () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        redrawAll();
      });
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleRedraw);
      ro.observe(container);
    }
    window.addEventListener('resize', scheduleRedraw, { passive: true });
    const mo = new MutationObserver(scheduleRedraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      if (resizeRafRef.current !== null) cancelAnimationFrame(resizeRafRef.current);
      if (replayTimerRef.current !== null) window.clearInterval(replayTimerRef.current);
      ro?.disconnect();
      window.removeEventListener('resize', scheduleRedraw);
      mo.disconnect();
    };
  }, [redrawAll]);

  const switchPage = (idx: number) => {
    if (replayTimerRef.current !== null) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
      replayLimitRef.current = null;
      setIsReplaying(false);
    }
    setActivePage(idx);
    setStrokeCount((pagesRef.current[idx] || []).length);
  };

  const toNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): NormalizedPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { nx: 0, ny: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    return {
      nx,
      ny,
      pressure: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events
    }

    const pt = toNormalizedPoint(e);
    const width =
      e.pointerType === 'pen' ? Math.max(1.5, strokeWidth * (0.6 + pt.pressure)) : strokeWidth;

    activeStrokeRef.current = {
      tool,
      color: inkColor,
      baseWidth: width,
      points: [pt],
    };
    isDrawingRef.current = true;
    redrawAll();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    e.preventDefault();
    const pt = toNormalizedPoint(e);
    const pts = activeStrokeRef.current.points;
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(pt.nx - prev.nx, pt.ny - prev.ny) < 0.0015) return;
    pts.push(pt);
    redrawAll();
  };

  const finishStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (e) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    }
    if (activeStrokeRef.current && activeStrokeRef.current.points.length > 0) {
      pagesRef.current[activePage] = [...pagesRef.current[activePage], activeStrokeRef.current];
      setStrokeCount(pagesRef.current[activePage].length);
    }
    activeStrokeRef.current = null;
    redrawAll();
  };

  // #33 Shape Auto-Snap & #42 Quick Diagram Templates
  const stampTemplate = (kind: 'triangle' | 'circle' | 'parabola') => {
    const newStrokes: ScratchStroke[] = [];
    if (kind === 'triangle') {
      newStrokes.push({
        tool: 'pen',
        color: inkColor,
        baseWidth: 2.8,
        points: [
          { nx: 0.22, ny: 0.78, pressure: 0.5 },
          { nx: 0.76, ny: 0.78, pressure: 0.5 },
          { nx: 0.22, ny: 0.22, pressure: 0.5 },
          { nx: 0.22, ny: 0.78, pressure: 0.5 },
        ],
      });
    } else if (kind === 'circle') {
      const pts: NormalizedPoint[] = [];
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        pts.push({
          nx: 0.5 + Math.cos(t) * 0.22,
          ny: 0.5 + Math.sin(t) * 0.34,
          pressure: 0.5,
        });
      }
      newStrokes.push({ tool: 'pen', color: inkColor, baseWidth: 2.8, points: pts });
    } else if (kind === 'parabola') {
      const pts: NormalizedPoint[] = [];
      for (let i = -20; i <= 20; i++) {
        const u = i / 20;
        pts.push({
          nx: 0.5 + u * 0.32,
          ny: 0.78 - u * u * 0.58,
          pressure: 0.5,
        });
      }
      newStrokes.push({ tool: 'pen', color: inkColor, baseWidth: 2.8, points: pts });
    }
    pagesRef.current[activePage] = [...pagesRef.current[activePage], ...newStrokes];
    setStrokeCount(pagesRef.current[activePage].length);
    redrawAll();
  };

  // #36 Stroke Replay Playback
  const handleReplay = () => {
    const total = pagesRef.current[activePage].length;
    if (total === 0) return;
    if (replayTimerRef.current !== null) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setIsReplaying(true);
    let step = 0;
    replayLimitRef.current = 0;
    redrawAll();
    replayTimerRef.current = window.setInterval(() => {
      step += 1;
      replayLimitRef.current = step;
      redrawAll();
      if (step >= total) {
        if (replayTimerRef.current !== null) {
          window.clearInterval(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        replayLimitRef.current = null;
        setIsReplaying(false);
      }
    }, 340);
  };

  const handleUndo = () => {
    if (pagesRef.current[activePage].length === 0) return;
    pagesRef.current[activePage] = pagesRef.current[activePage].slice(0, -1);
    setStrokeCount(pagesRef.current[activePage].length);
    redrawAll();
  };

  const handleClear = () => {
    pagesRef.current[activePage] = [];
    activeStrokeRef.current = null;
    isDrawingRef.current = false;
    setStrokeCount(0);
    redrawAll();
  };

  const exportBase64 = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    try {
      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    } catch {
      return '';
    }
  };

  const handleSolve = () => {
    onSolveSketch(exportBase64());
  };

  const handleToLatex = () => {
    const b64 = exportBase64();
    const prompt =
      'Transcribe every handwritten math equation/expression in this sketch into clean LaTeX ($...$ and $$...$$), list the raw LaTeX source in a code block, and briefly verify the math.';
    if (onSolveWithPrompt) {
      onSolveWithPrompt(b64, prompt);
    } else {
      onSolveSketch(b64);
    }
  };

  const handleCheckRoughWork = () => {
    const b64 = exportBase64();
    const prompt =
      'Check my handwritten rough work step by step. Identify the exact step where any sign, algebraic, or arithmetic mistake first occurs, praise what is right, and show the corrected steps.';
    if (onSolveWithPrompt) {
      onSolveWithPrompt(b64, prompt);
    } else {
      onSolveSketch(b64);
    }
  };

  return (
    <div
      data-testid="math-scratchpad-panel"
      className="mb-2.5 rounded-2xl fluent-glass-card p-3 space-y-2"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <PenTool className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
              Rough-Work Scratchpad
            </span>
            <span className="text-xs text-slate-400" aria-hidden="true">·</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
              {strokeCount} {strokeCount === 1 ? 'stroke' : 'strokes'}
            </span>
            {/* #32 Multi-page switcher */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950 p-0.5 ml-1">
              {[0, 1, 2].map((pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => switchPage(pIdx)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    activePage === pIdx
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  P{pIdx + 1}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close scratchpad"
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Pen / Eraser */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => setTool('pen')}
                aria-label="Pen tool"
                aria-pressed={tool === 'pen'}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  tool === 'pen'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Pen
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                aria-label="Eraser tool"
                aria-pressed={tool === 'eraser'}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  tool === 'eraser'
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eraser className="w-3 h-3" />
                <span>Erase</span>
              </button>
            </div>

            {/* Ink swatches */}
            <div className="flex items-center gap-1 px-1">
              {INK_SWATCHES.map((swatch) => {
                const active = tool === 'pen' && inkColor === swatch.darkColor;
                return (
                  <button
                    key={swatch.label}
                    type="button"
                    aria-label={`Ink color ${swatch.label}`}
                    onClick={() => {
                      setTool('pen');
                      setInkColor(swatch.darkColor);
                    }}
                    className={`w-4 h-4 rounded-full border-2 transition-transform ${
                      active
                        ? 'border-slate-900 dark:border-white scale-110'
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch.darkColor }}
                    title={swatch.label}
                  />
                );
              })}
            </div>

            {/* Stroke width */}
            <div className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w.label}
                  type="button"
                  onClick={() => setStrokeWidth(w.value)}
                  aria-label={`${w.label} stroke width`}
                  aria-pressed={strokeWidth === w.value}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    strokeWidth === w.value
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* #32 Paper Background */}
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-1.5 py-0.5">
              <Grid3X3 className="w-3 h-3 text-slate-400" />
              <select
                aria-label="Paper background"
                value={paperStyle}
                onChange={(e) => setPaperStyle(e.target.value as PaperStyle)}
                className="bg-transparent text-[10px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                {PAPER_STYLES.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.label}
                  </option>
                ))}
              </select>
            </div>

            {/* #33/#42 Quick Shape Stamps */}
            <div className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => stampTemplate('triangle')}
                title="Stamp Right Triangle"
                aria-label="Stamp Right Triangle"
                className="p-1 rounded-md text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                <Triangle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stampTemplate('circle')}
                title="Stamp Circle"
                aria-label="Stamp Circle"
                className="p-1 rounded-md text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stampTemplate('parabola')}
                title="Stamp Parabola"
                aria-label="Stamp Parabola"
                className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
              >
                ∪
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleReplay}
              disabled={strokeCount === 0 || isReplaying}
              title="Replay strokes"
              aria-label="Replay strokes"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <Play className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleUndo}
              disabled={strokeCount === 0}
              aria-label="Undo last stroke"
              title="Undo last stroke"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <Undo2 className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={strokeCount === 0}
              aria-label="Clear scratchpad"
              title="Clear scratchpad"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleToLatex}
              disabled={strokeCount === 0 || isLoading}
              title="Convert handwriting to LaTeX (#31)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-700 dark:text-slate-200 disabled:opacity-40 whitespace-nowrap"
            >
              <Code2 className="w-3 h-3" />
              <span>LaTeX</span>
            </button>

            <button
              type="button"
              onClick={handleCheckRoughWork}
              disabled={strokeCount === 0 || isLoading}
              title="Check my rough work for mistakes (#35)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-700 dark:text-slate-200 disabled:opacity-40 whitespace-nowrap"
            >
              <CheckSquare className="w-3 h-3" />
              <span>Check</span>
            </button>

            <button
              type="button"
              onClick={handleSolve}
              disabled={strokeCount === 0 || isLoading}
              data-testid="solve-scratchpad-btn"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold fluent-primary-btn disabled:opacity-40 text-white whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              <span>Solve Sketch</span>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
      >
        <canvas
          ref={canvasRef}
          data-testid="math-scratchpad-canvas"
          data-stroke-count={strokeCount}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="block w-full h-full cursor-crosshair touch-none select-none"
        />
        {strokeCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Draw equations, stamp triangles/circles, or switch pages (P1–P3)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
