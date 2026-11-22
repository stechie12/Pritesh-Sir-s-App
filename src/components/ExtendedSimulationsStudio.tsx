import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { safeStorageGet, safeStorageSet } from '../utils/tutorEnhancements';

export type ExtendedSimKey =
  | 'slicer'
  | 'net-unfolder'
  | 'unit-circle'
  | 'grapher'
  | 'construction'
  | 'vectors'
  | 'matrix'
  | 'probability'
  | 'ogive'
  | 'lpp'
  | 'argand'
  | 'riemann'
  | 'locus'
  | 'commercial';

interface SavedSimPreset {
  id: string;
  name: string;
  simKey: ExtendedSimKey;
  params: Record<string, number | string>;
}

const SIM_TABS: Array<{ key: ExtendedSimKey; num: number; label: string; topic: string }> = [
  { key: 'unit-circle', num: 18, label: 'Unit Circle & Waves', topic: 'Trigonometry' },
  { key: 'grapher', num: 19, label: 'Multi-Function Grapher', topic: 'Algebra & Graphs' },
  { key: 'slicer', num: 16, label: '3D Solid Slicer', topic: 'Mensuration' },
  { key: 'net-unfolder', num: 17, label: 'Net Unfolder', topic: 'Surface Area' },
  { key: 'matrix', num: 22, label: '2×2 Matrix Warp', topic: 'Matrices' },
  { key: 'probability', num: 23, label: 'Monte Carlo Odds', topic: 'Probability' },
  { key: 'riemann', num: 27, label: 'Riemann Integrals', topic: 'Calculus' },
  { key: 'lpp', num: 25, label: 'Linear Programming', topic: 'Std 12 LPP' },
  { key: 'argand', num: 26, label: 'Argand Complex Lab', topic: 'Complex Numbers' },
  { key: 'vectors', num: 21, label: '3D Vector Sandbox', topic: 'Vectors' },
  { key: 'ogive', num: 24, label: 'Histogram & Ogive', topic: 'Statistics' },
  { key: 'construction', num: 20, label: 'Compass Geometry', topic: 'Constructions' },
  { key: 'locus', num: 28, label: 'Locus & Reflection', topic: 'Std 10 ICSE' },
  { key: 'commercial', num: 29, label: 'GST, RD & Shares', topic: 'Commercial Maths' },
];

interface ExtendedSimulationsStudioProps {
  initialSimKey?: string;
  onAskTutor?: (prompt: string) => void;
}

export const ExtendedSimulationsStudio: React.FC<ExtendedSimulationsStudioProps> = ({
  initialSimKey,
  onAskTutor,
}) => {
  const resolvedInit = SIM_TABS.find((t) => t.key === initialSimKey)?.key || 'unit-circle';
  const [activeSim, setActiveSim] = useState<ExtendedSimKey>(resolvedInit);

  // #18 Unit Circle
  const [angleDeg, setAngleDeg] = useState<number>(45);
  const [trigPlaying, setTrigPlaying] = useState<boolean>(false);

  // #19 Grapher: f(x) = a*x^2 + b*x + c, g(x) = m*x + k
  const [ga, setGa] = useState<number>(0.5);
  const [gb, setGb] = useState<number>(-1);
  const [gc, setGc] = useState<number>(-2);
  const [gm, setGm] = useState<number>(0.8);
  const [gk, setGk] = useState<number>(1);

  // #16 Slicer
  const [sliceSolid, setSliceSolid] = useState<'cone' | 'cylinder' | 'sphere' | 'frustum'>('cone');
  const [sliceHeight, setSliceHeight] = useState<number>(50);
  const [sliceTilt, setSliceTilt] = useState<number>(15);

  // #17 Net Unfolder
  const [netSolid, setNetSolid] = useState<'cube' | 'cylinder' | 'cone' | 'pyramid'>('cylinder');
  const [unfoldPct, setUnfoldPct] = useState<number>(65);
  const [netRadius, setNetRadius] = useState<number>(4);
  const [netHeight, setNetHeight] = useState<number>(7);

  // #22 Matrix 2x2
  const [mA, setMA] = useState<number>(1.2);
  const [mB, setMB] = useState<number>(0.4);
  const [mC, setMC] = useState<number>(0);
  const [mD, setMD] = useState<number>(1);

  // #23 Probability Monte Carlo
  const [probMode, setProbMode] = useState<'dice' | 'coin' | 'card'>('dice');
  const [probTrials, setProbTrials] = useState<number>(200);
  const [probCounts, setProbCounts] = useState<Record<string, number>>({
    '2': 5, '3': 12, '4': 18, '5': 21, '6': 29, '7': 36, '8': 28, '9': 20, '10': 14, '11': 11, '12': 6,
  });

  // #27 Riemann Sum
  const [riemannFn, setRiemannFn] = useState<'x2' | 'sin' | 'linear'>('x2');
  const [riemannN, setRiemannN] = useState<number>(8);
  const [riemannRule, setRiemannRule] = useState<'left' | 'right' | 'midpoint' | 'trapezoid'>('midpoint');

  // #25 LPP
  const [lppC1, setLppC1] = useState<number>(4);
  const [lppC2, setLppC2] = useState<number>(3);
  const [lppCap, setLppCap] = useState<number>(10);

  // #26 Argand Complex
  const [compA, setCompA] = useState<number>(2);
  const [compB, setCompB] = useState<number>(1.5);
  const [compPow, setCompPow] = useState<number>(2);

  // #21 3D Vectors
  const [va, setVa] = useState<[number, number, number]>([3, 2, 1]);
  const [vb, setVb] = useState<[number, number, number]>([1, 4, 2]);

  // #24 Ogive
  const [ogiveFreqs, setOgiveFreqs] = useState<number[]>([6, 14, 22, 18, 10]);

  // #20 Compass Construction
  const [constructType, setConstructType] = useState<'perp-bisector' | 'angle-bisector' | 'tangent'>('perp-bisector');
  const [constructStep, setConstructStep] = useState<number>(4);

  // #28 Locus & Reflection
  const [reflectAxis, setReflectAxis] = useState<'x' | 'y' | 'origin' | 'yx'>('y');

  // #29 Commercial Maths (GST, RD, Shares)
  const [commTab, setCommTab] = useState<'gst' | 'rd' | 'shares'>('rd');
  const [commAmount, setCommAmount] = useState<number>(1500);
  const [commRate, setCommRate] = useState<number>(10);
  const [commMonths, setCommMonths] = useState<number>(24);
  const [commMarketPrice, setCommMarketPrice] = useState<number>(125);

  // #30 Saved Presets
  const [presets, setPresets] = useState<SavedSimPreset[]>(() => {
    try {
      const raw = safeStorageGet('psma_sim_presets_v1');
      return raw ? (JSON.parse(raw) as SavedSimPreset[]) : [];
    } catch {
      return [];
    }
  });
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (initialSimKey && SIM_TABS.some((t) => t.key === initialSimKey)) {
      setActiveSim(initialSimKey as ExtendedSimKey);
    }
  }, [initialSimKey]);

  useEffect(() => {
    if (!trigPlaying) return;
    const id = window.setInterval(() => {
      setAngleDeg((prev) => (prev + 4) % 360);
    }, 60);
    return () => window.clearInterval(id);
  }, [trigPlaying]);

  const runMonteCarlo = (trials: number, mode: 'dice' | 'coin' | 'card') => {
    const counts: Record<string, number> = {};
    if (mode === 'dice') {
      for (let s = 2; s <= 12; s++) counts[String(s)] = 0;
      for (let i = 0; i < trials; i++) {
        const sum = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        counts[String(sum)] += 1;
      }
    } else if (mode === 'coin') {
      counts['Heads'] = 0;
      counts['Tails'] = 0;
      for (let i = 0; i < trials; i++) {
        counts[Math.random() < 0.5 ? 'Heads' : 'Tails'] += 1;
      }
    } else {
      counts['Hearts'] = 0;
      counts['Diamonds'] = 0;
      counts['Clubs'] = 0;
      counts['Spades'] = 0;
      const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
      for (let i = 0; i < trials; i++) {
        counts[suits[Math.floor(Math.random() * 4)]] += 1;
      }
    }
    setProbCounts(counts);
  };

  const saveCurrentPreset = () => {
    const meta = SIM_TABS.find((t) => t.key === activeSim);
    const next: SavedSimPreset = {
      id: `pre_${Date.now()}`,
      name: `${meta?.label || activeSim} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      simKey: activeSim,
      params: { angleDeg, ga, gb, gc, mA, mB, mC, mD, riemannN, compA, compB, unfoldPct },
    };
    const updated = [next, ...presets].slice(0, 12);
    setPresets(updated);
    safeStorageSet('psma_sim_presets_v1', JSON.stringify(updated));
    setPresetFeedback(`Saved preset "${next.name}".`);
    window.setTimeout(() => setPresetFeedback(null), 2400);
  };

  const loadPreset = (preset: SavedSimPreset) => {
    setActiveSim(preset.simKey);
    if (typeof preset.params.angleDeg === 'number') setAngleDeg(preset.params.angleDeg);
    if (typeof preset.params.ga === 'number') setGa(preset.params.ga);
    if (typeof preset.params.gb === 'number') setGb(preset.params.gb);
    if (typeof preset.params.gc === 'number') setGc(preset.params.gc);
    if (typeof preset.params.mA === 'number') setMA(preset.params.mA);
    if (typeof preset.params.mB === 'number') setMB(preset.params.mB);
    if (typeof preset.params.mC === 'number') setMC(preset.params.mC);
    if (typeof preset.params.mD === 'number') setMD(preset.params.mD);
    if (typeof preset.params.riemannN === 'number') setRiemannN(preset.params.riemannN);
    if (typeof preset.params.compA === 'number') setCompA(preset.params.compA);
    if (typeof preset.params.compB === 'number') setCompB(preset.params.compB);
    if (typeof preset.params.unfoldPct === 'number') setUnfoldPct(preset.params.unfoldPct);
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    safeStorageSet('psma_sim_presets_v1', JSON.stringify(updated));
  };

  // Computations for active labs
  const rad = (angleDeg * Math.PI) / 180;
  const sinV = Math.sin(rad);
  const cosV = Math.cos(rad);
  const tanV = Math.abs(cosV) < 1e-4 ? Infinity : sinV / cosV;

  const riemannStats = useMemo(() => {
    const f = (x: number) =>
      riemannFn === 'x2' ? x * x : riemannFn === 'sin' ? Math.sin(x) + 1 : 0.7 * x + 0.5;
    const a = 0;
    const b = 3;
    const dx = (b - a) / riemannN;
    let approx = 0;
    const rects: Array<{ x: number; h: number }> = [];
    for (let i = 0; i < riemannN; i++) {
      const xL = a + i * dx;
      const xR = xL + dx;
      const h =
        riemannRule === 'left'
          ? f(xL)
          : riemannRule === 'right'
            ? f(xR)
            : riemannRule === 'midpoint'
              ? f((xL + xR) / 2)
              : (f(xL) + f(xR)) / 2;
      approx += h * dx;
      rects.push({ x: xL, h });
    }
    const exact =
      riemannFn === 'x2'
        ? 9
        : riemannFn === 'sin'
          ? -Math.cos(3) + Math.cos(0) + 3
          : 0.35 * 9 + 1.5;
    return { approx, exact, dx, rects, f };
  }, [riemannFn, riemannN, riemannRule]);

  const lppVertices = useMemo(() => {
    // Constraints: x >= 0, y >= 0, x + y <= lppCap, 2x + y <= lppCap + 4
    const c = lppCap;
    const pts: Array<{ x: number; y: number }> = [
      { x: 0, y: 0 },
      { x: Math.min(c, (c + 4) / 2), y: 0 },
      { x: 4, y: Math.max(0, c - 4) },
      { x: 0, y: c },
    ].filter((p) => p.x >= 0 && p.y >= 0 && p.x + p.y <= c + 0.01 && 2 * p.x + p.y <= c + 4.01);
    const scored = pts.map((p) => ({ ...p, z: lppC1 * p.x + lppC2 * p.y }));
    const best = scored.reduce((a, b) => (b.z > a.z ? b : a), scored[0] || { x: 0, y: 0, z: 0 });
    return { scored, best };
  }, [lppC1, lppC2, lppCap]);

  const dotProduct = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  const crossVec: [number, number, number] = [
    va[1] * vb[2] - va[2] * vb[1],
    va[2] * vb[0] - va[0] * vb[2],
    va[0] * vb[1] - va[1] * vb[0],
  ];
  const magA = Math.hypot(va[0], va[1], va[2]) || 1;
  const magB = Math.hypot(vb[0], vb[1], vb[2]) || 1;
  const crossMag = Math.hypot(crossVec[0], crossVec[1], crossVec[2]);
  const vecAngleDeg = (Math.acos(Math.max(-1, Math.min(1, dotProduct / (magA * magB)))) * 180) / Math.PI;

  const detM = mA * mD - mB * mC;

  return (
    <div className="space-y-4">
      {/* Horizontal Lab Picker */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SIM_TABS.map((sim) => {
          const active = activeSim === sim.key;
          return (
            <button
              key={sim.key}
              type="button"
              onClick={() => setActiveSim(sim.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
              }`}
            >
              #{sim.num} {sim.label}
            </button>
          );
        })}
      </div>

      {/* Active Simulation Stage */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {SIM_TABS.find((t) => t.key === activeSim)?.label}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {SIM_TABS.find((t) => t.key === activeSim)?.topic} · Interactive Live Lab
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveCurrentPreset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Preset (#30)</span>
            </button>
            {onAskTutor && (
              <button
                type="button"
                onClick={() =>
                  onAskTutor(
                    `Explain the key ICSE/CBSE board formulas and a worked example for ${SIM_TABS.find((t) => t.key === activeSim)?.label || 'this simulation'}.`
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white"
              >
                Ask Tutor About Lab
              </button>
            )}
          </div>
        </div>
        {presetFeedback && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{presetFeedback}</div>
        )}

        {/* #18 Unit Circle & Trig Wave Synchronizer */}
        {activeSim === 'unit-circle' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-8 rounded-xl bg-slate-950 p-3 overflow-x-auto">
              <svg viewBox="0 0 560 220" className="w-full min-w-[320px] h-52">
                {/* Unit Circle */}
                <line x1="20" y1="110" x2="200" y2="110" stroke="#334155" strokeWidth="1" />
                <line x1="110" y1="20" x2="110" y2="200" stroke="#334155" strokeWidth="1" />
                <circle cx="110" cy="110" r="75" fill="none" stroke="#475569" strokeWidth="1.5" />
                <line
                  x1="110"
                  y1="110"
                  x2={110 + 75 * cosV}
                  y2={110 - 75 * sinV}
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />
                <line
                  x1={110 + 75 * cosV}
                  y1="110"
                  x2={110 + 75 * cosV}
                  y2={110 - 75 * sinV}
                  stroke="#34d399"
                  strokeWidth="2.5"
                />
                <line
                  x1="110"
                  y1="110"
                  x2={110 + 75 * cosV}
                  y2="110"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />
                <circle cx={110 + 75 * cosV} cy={110 - 75 * sinV} r="5" fill="#38bdf8" />
                {/* Synchronized Sine & Cosine Waves */}
                <line x1="230" y1="110" x2="540" y2="110" stroke="#334155" strokeWidth="1" />
                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  points={Array.from({ length: 73 }, (_, i) => {
                    const d = i * 5;
                    const x = 230 + (d / 360) * 300;
                    const y = 110 - Math.sin((d * Math.PI) / 180) * 75;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                  points={Array.from({ length: 73 }, (_, i) => {
                    const d = i * 5;
                    const x = 230 + (d / 360) * 300;
                    const y = 110 - Math.cos((d * Math.PI) / 180) * 75;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  }).join(' ')}
                />
                <circle cx={230 + (angleDeg / 360) * 300} cy={110 - sinV * 75} r="5" fill="#34d399" />
                <circle cx={230 + (angleDeg / 360) * 300} cy={110 - cosV * 75} r="4.5" fill="#f59e0b" />
                <text x="235" y="24" fill="#34d399" fontSize="11">sin θ</text>
                <text x="280" y="24" fill="#f59e0b" fontSize="11">cos θ (dashed)</text>
              </svg>
            </div>
            <div className="lg:col-span-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700 dark:text-slate-200">Angle θ: {angleDeg}°</label>
                <button
                  type="button"
                  onClick={() => setTrigPlaying((p) => !p)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-600 text-white font-medium"
                >
                  {trigPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{trigPlaying ? 'Pause' : 'Animate'}</span>
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={angleDeg}
                onChange={(e) => setAngleDeg(Number(e.target.value))}
                className="w-full"
              />
              <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-center">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">sin θ</div>
                  <div className="font-semibold">{sinV.toFixed(3)}</div>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-[10px] text-amber-600 dark:text-amber-400">cos θ</div>
                  <div className="font-semibold">{cosV.toFixed(3)}</div>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <div className="text-[10px] text-sky-600 dark:text-sky-400">tan θ</div>
                  <div className="font-semibold">{Number.isFinite(tanV) ? tanV.toFixed(2) : '∞'}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Identity check: sin²θ + cos²θ = {(sinV * sinV + cosV * cosV).toFixed(4)}
              </div>
            </div>
          </div>
        )}

        {/* #19 Multi-Function Interactive Grapher */}
        {activeSim === 'grapher' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 420 240" className="w-full h-56">
                <line x1="20" y1="120" x2="400" y2="120" stroke="#475569" strokeWidth="1" />
                <line x1="210" y1="10" x2="210" y2="230" stroke="#475569" strokeWidth="1" />
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.4"
                  points={Array.from({ length: 121 }, (_, i) => {
                    const x = -6 + (i / 120) * 12;
                    const y = ga * x * x + gb * x + gc;
                    const sx = 210 + x * 30;
                    const sy = 120 - y * 18;
                    return `${sx.toFixed(1)},${Math.max(5, Math.min(235, sy)).toFixed(1)}`;
                  }).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#f472b6"
                  strokeWidth="2"
                  points={Array.from({ length: 61 }, (_, i) => {
                    const x = -6 + (i / 60) * 12;
                    const y = gm * x + gk;
                    const sx = 210 + x * 30;
                    const sy = 120 - y * 18;
                    return `${sx.toFixed(1)},${Math.max(5, Math.min(235, sy)).toFixed(1)}`;
                  }).join(' ')}
                />
              </svg>
            </div>
            <div className="lg:col-span-4 space-y-2 text-xs">
              <div className="font-mono text-sky-600 dark:text-sky-400">
                f(x) = {ga}x² {gb >= 0 ? '+' : '−'} {Math.abs(gb)}x {gc >= 0 ? '+' : '−'} {Math.abs(gc)}
              </div>
              <label className="block">a = {ga} <input type="range" min={-2} max={2} step={0.25} value={ga} onChange={(e) => setGa(Number(e.target.value))} className="w-full" /></label>
              <label className="block">b = {gb} <input type="range" min={-5} max={5} step={0.5} value={gb} onChange={(e) => setGb(Number(e.target.value))} className="w-full" /></label>
              <label className="block">c = {gc} <input type="range" min={-5} max={5} step={0.5} value={gc} onChange={(e) => setGc(Number(e.target.value))} className="w-full" /></label>
              <div className="font-mono text-pink-600 dark:text-pink-400 pt-1">
                g(x) = {gm}x {gk >= 0 ? '+' : '−'} {Math.abs(gk)}
              </div>
              <label className="block">slope m = {gm} <input type="range" min={-3} max={3} step={0.2} value={gm} onChange={(e) => setGm(Number(e.target.value))} className="w-full" /></label>
              <label className="block">intercept k = {gk} <input type="range" min={-4} max={4} step={0.5} value={gk} onChange={(e) => setGk(Number(e.target.value))} className="w-full" /></label>
              {(() => {
                const disc = (gb - gm) ** 2 - 4 * ga * (gc - gk);
                if (Math.abs(ga) < 0.01) return <div className="text-[11px] text-slate-500">Linear mode</div>;
                if (disc < 0) return <div className="text-[11px] text-amber-500">No real intersection (Δ = {disc.toFixed(2)})</div>;
                const x1 = (-(gb - gm) + Math.sqrt(disc)) / (2 * ga);
                const x2 = (-(gb - gm) - Math.sqrt(disc)) / (2 * ga);
                return (
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    Intersections: x₁ = {x1.toFixed(2)}, x₂ = {x2.toFixed(2)}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* #16 3D Solid Cross-Section Slicer */}
        {activeSim === 'slicer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 380 210" className="w-full h-48">
                {sliceSolid === 'cone' && (
                  <>
                    <polygon points="190,25 100,185 280,185" fill="rgba(56,189,248,0.16)" stroke="#38bdf8" strokeWidth="2" />
                    <ellipse cx="190" cy="185" rx="90" ry="18" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
                  </>
                )}
                {sliceSolid === 'cylinder' && (
                  <>
                    <rect x="115" y="35" width="150" height="145" fill="rgba(56,189,248,0.16)" stroke="#38bdf8" strokeWidth="2" />
                    <ellipse cx="190" cy="35" rx="75" ry="16" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="1.6" />
                    <ellipse cx="190" cy="180" rx="75" ry="16" fill="none" stroke="#38bdf8" strokeWidth="1.6" />
                  </>
                )}
                {sliceSolid === 'sphere' && (
                  <circle cx="190" cy="105" r="78" fill="rgba(56,189,248,0.16)" stroke="#38bdf8" strokeWidth="2" />
                )}
                {sliceSolid === 'frustum' && (
                  <>
                    <polygon points="145,40 235,40 280,180 100,180" fill="rgba(56,189,248,0.16)" stroke="#38bdf8" strokeWidth="2" />
                    <ellipse cx="190" cy="40" rx="45" ry="11" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" strokeWidth="1.5" />
                    <ellipse cx="190" cy="180" rx="90" ry="18" fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                  </>
                )}
                {/* Slicing Plane */}
                {(() => {
                  const yPos = 180 - (sliceHeight / 100) * 145;
                  const dy = Math.tan((sliceTilt * Math.PI) / 180) * 65;
                  const cutRadius =
                    sliceSolid === 'cone'
                      ? Math.max(8, 90 * (1 - sliceHeight / 100))
                      : sliceSolid === 'sphere'
                        ? Math.sqrt(Math.max(0, 78 * 78 - (yPos - 105) ** 2))
                        : sliceSolid === 'frustum'
                          ? 90 - 45 * (sliceHeight / 100)
                          : 75;
                  return (
                    <>
                      <line x1="65" y1={yPos - dy} x2="315" y2={yPos + dy} stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="6 3" />
                      <ellipse cx="190" cy={yPos} rx={Math.max(4, cutRadius)} ry={Math.max(4, cutRadius * 0.24)} fill="rgba(245,158,11,0.35)" stroke="#fbbf24" strokeWidth="2" />
                    </>
                  );
                })()}
              </svg>
            </div>
            <div className="lg:col-span-5 space-y-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {(['cone', 'cylinder', 'sphere', 'frustum'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSliceSolid(s)}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium ${sliceSolid === s ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="block">Cut Height: {sliceHeight}% <input type="range" min={5} max={95} value={sliceHeight} onChange={(e) => setSliceHeight(Number(e.target.value))} className="w-full" /></label>
              <label className="block">Plane Tilt: {sliceTilt}° <input type="range" min={0} max={50} value={sliceTilt} onChange={(e) => setSliceTilt(Number(e.target.value))} className="w-full" /></label>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px]">
                Cross-section shape:{' '}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {sliceTilt === 0 ? 'Circle' : sliceSolid === 'cone' && sliceTilt >= 38 ? 'Parabola / Hyperbola' : 'Ellipse'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* #17 Interactive Net Unfolder */}
        {activeSim === 'net-unfolder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 380 200" className="w-full h-48">
                {(() => {
                  const spread = unfoldPct / 100;
                  const rectW = 80 + spread * 140;
                  const rectX = 190 - rectW / 2;
                  return (
                    <>
                      <rect x={rectX} y="65" width={rectW} height="72" rx="4" fill="rgba(56,189,248,0.22)" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx="190" cy={65 - 24 * spread} r={22} fill="rgba(52,211,153,0.25)" stroke="#34d399" strokeWidth="1.8" />
                      <circle cx="190" cy={137 + 24 * spread} r={22} fill="rgba(52,211,153,0.25)" stroke="#34d399" strokeWidth="1.8" />
                      <text x="190" y="105" textAnchor="middle" fill="#e2e8f0" fontSize="11">
                        {netSolid.toUpperCase()} · Unfold {unfoldPct}%
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>
            <div className="lg:col-span-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {(['cube', 'cylinder', 'cone', 'pyramid'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setNetSolid(s)} className={`px-2.5 py-1 rounded-md capitalize font-medium ${netSolid === s ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{s}</button>
                ))}
              </div>
              <label className="block">Unfold: {unfoldPct}% <input type="range" min={0} max={100} value={unfoldPct} onChange={(e) => setUnfoldPct(Number(e.target.value))} className="w-full" /></label>
              <label className="block">Radius / Base r = {netRadius} cm <input type="range" min={2} max={12} value={netRadius} onChange={(e) => setNetRadius(Number(e.target.value))} className="w-full" /></label>
              <label className="block">Height h = {netHeight} cm <input type="range" min={2} max={15} value={netHeight} onChange={(e) => setNetHeight(Number(e.target.value))} className="w-full" /></label>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px] space-y-1">
                {netSolid === 'cylinder' && (
                  <>
                    <div>CSA = 2πrh = {(2 * Math.PI * netRadius * netHeight).toFixed(1)} cm²</div>
                    <div>TSA = 2πr(r + h) = {(2 * Math.PI * netRadius * (netRadius + netHeight)).toFixed(1)} cm²</div>
                  </>
                )}
                {netSolid === 'cone' && (
                  <>
                    <div>Slant l = √(r²+h²) = {Math.hypot(netRadius, netHeight).toFixed(2)} cm</div>
                    <div>TSA = πr(r + l) = {(Math.PI * netRadius * (netRadius + Math.hypot(netRadius, netHeight))).toFixed(1)} cm²</div>
                  </>
                )}
                {netSolid === 'cube' && (
                  <>
                    <div>LSA = 4a² = {4 * netRadius * netRadius} cm²</div>
                    <div>TSA = 6a² = {6 * netRadius * netRadius} cm²</div>
                  </>
                )}
                {netSolid === 'pyramid' && (
                  <>
                    <div>Base Area = a² = {netRadius * netRadius} cm²</div>
                    <div>TSA = a² + 2a√((a/2)²+h²) = {(netRadius * netRadius + 2 * netRadius * Math.hypot(netRadius / 2, netHeight)).toFixed(1)} cm²</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* #22 Matrix 2x2 Transformation Visualizer */}
        {activeSim === 'matrix' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 360 220" className="w-full h-52">
                <line x1="20" y1="110" x2="340" y2="110" stroke="#334155" strokeWidth="1" />
                <line x1="180" y1="10" x2="180" y2="210" stroke="#334155" strokeWidth="1" />
                {/* Original Unit Square */}
                <polygon points="180,110 230,110 230,60 180,60" fill="rgba(148,163,184,0.18)" stroke="#94a3b8" strokeDasharray="4 3" />
                {/* Transformed Unit Square */}
                {(() => {
                  const pt = (x: number, y: number) => {
                    const tx = mA * x + mB * y;
                    const ty = mC * x + mD * y;
                    return `${(180 + tx * 50).toFixed(1)},${(110 - ty * 50).toFixed(1)}`;
                  };
                  return (
                    <polygon
                      points={`${pt(0, 0)} ${pt(1, 0)} ${pt(1, 1)} ${pt(0, 1)}`}
                      fill="rgba(56,189,248,0.28)"
                      stroke="#38bdf8"
                      strokeWidth="2.2"
                    />
                  );
                })()}
              </svg>
            </div>
            <div className="lg:col-span-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { setMA(0); setMB(-1); setMC(1); setMD(0); }} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Rotate 90°</button>
                <button type="button" onClick={() => { setMA(-1); setMB(0); setMC(0); setMD(1); }} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Reflect Y</button>
                <button type="button" onClick={() => { setMA(1); setMB(0.8); setMC(0); setMD(1); }} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Shear</button>
                <button type="button" onClick={() => { setMA(1.5); setMB(0); setMC(0); setMD(1.5); }} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Scale 1.5×</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>a = {mA} <input type="range" min={-2} max={2} step={0.1} value={mA} onChange={(e) => setMA(Number(e.target.value))} className="w-full" /></label>
                <label>b = {mB} <input type="range" min={-2} max={2} step={0.1} value={mB} onChange={(e) => setMB(Number(e.target.value))} className="w-full" /></label>
                <label>c = {mC} <input type="range" min={-2} max={2} step={0.1} value={mC} onChange={(e) => setMC(Number(e.target.value))} className="w-full" /></label>
                <label>d = {mD} <input type="range" min={-2} max={2} step={0.1} value={mD} onChange={(e) => setMD(Number(e.target.value))} className="w-full" /></label>
              </div>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px]">
                det(M) = ad − bc = <span className="font-semibold text-sky-600 dark:text-sky-400">{detM.toFixed(2)}</span> (Area scale: {Math.abs(detM).toFixed(2)}×)
              </div>
            </div>
          </div>
        )}

        {/* #23 Probability Monte Carlo Simulator */}
        {activeSim === 'probability' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {(['dice', 'coin', 'card'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setProbMode(mode);
                    runMonteCarlo(probTrials, mode);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg capitalize font-medium ${probMode === mode ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  {mode === 'dice' ? 'Two Dice Sum' : mode === 'coin' ? 'Coin Toss' : 'Card Suits'}
                </button>
              ))}
              {[50, 500, 2000, 10000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setProbTrials(n);
                    runMonteCarlo(n, probMode);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono"
                >
                  Run {n.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(probCounts).map(([label, count]) => {
                const total = Object.values(probCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = (count / total) * 100;
                return (
                  <div key={label} className="rounded-lg bg-slate-100 dark:bg-slate-800/80 p-2 space-y-1">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="font-semibold">{label}</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, pct * 2.2)}%` }} />
                    </div>
                    <div className="text-[10px] text-slate-500">{count} hits</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* #27 Riemann Sum & Definite Integral */}
        {activeSim === 'riemann' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 360 200" className="w-full h-48">
                <line x1="30" y1="175" x2="340" y2="175" stroke="#475569" strokeWidth="1.2" />
                <line x1="30" y1="15" x2="30" y2="175" stroke="#475569" strokeWidth="1.2" />
                {riemannStats.rects.map((r, i) => {
                  const x = 30 + (r.x / 3) * 290;
                  const w = (riemannStats.dx / 3) * 290;
                  const hPx = Math.min(155, Math.max(0, (r.h / 9.5) * 155));
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={175 - hPx}
                      width={Math.max(2, w - 1)}
                      height={hPx}
                      fill="rgba(56,189,248,0.28)"
                      stroke="#38bdf8"
                      strokeWidth="1"
                    />
                  );
                })}
                <polyline
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2.2"
                  points={Array.from({ length: 61 }, (_, i) => {
                    const xVal = (i / 60) * 3;
                    const yVal = riemannStats.f(xVal);
                    return `${(30 + (xVal / 3) * 290).toFixed(1)},${(175 - (yVal / 9.5) * 155).toFixed(1)}`;
                  }).join(' ')}
                />
              </svg>
            </div>
            <div className="lg:col-span-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {(['x2', 'sin', 'linear'] as const).map((fn) => (
                  <button key={fn} type="button" onClick={() => setRiemannFn(fn)} className={`px-2 py-1 rounded ${riemannFn === fn ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {fn === 'x2' ? 'f(x)=x²' : fn === 'sin' ? 'f(x)=sin(x)+1' : 'f(x)=0.7x+0.5'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['left', 'right', 'midpoint', 'trapezoid'] as const).map((rule) => (
                  <button key={rule} type="button" onClick={() => setRiemannRule(rule)} className={`px-2 py-1 rounded capitalize ${riemannRule === rule ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{rule}</button>
                ))}
              </div>
              <label className="block">Subintervals n = {riemannN} <input type="range" min={2} max={40} value={riemannN} onChange={(e) => setRiemannN(Number(e.target.value))} className="w-full" /></label>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px] space-y-1">
                <div>Approx ∫₀³ f(x)dx = <span className="font-semibold text-sky-500">{riemannStats.approx.toFixed(4)}</span></div>
                <div>Exact ∫₀³ f(x)dx = <span className="font-semibold text-emerald-500">{riemannStats.exact.toFixed(4)}</span></div>
                <div>Error = {Math.abs(riemannStats.approx - riemannStats.exact).toFixed(4)}</div>
              </div>
            </div>
          </div>
        )}

        {/* #25 Linear Programming Feasible Region */}
        {activeSim === 'lpp' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 320 200" className="w-full h-48">
                <line x1="30" y1="175" x2="300" y2="175" stroke="#475569" />
                <line x1="30" y1="15" x2="30" y2="175" stroke="#475569" />
                <polygon
                  points={lppVertices.scored
                    .map((p) => `${(30 + p.x * 18).toFixed(1)},${(175 - p.y * 13).toFixed(1)}`)
                    .join(' ')}
                  fill="rgba(52,211,153,0.28)"
                  stroke="#34d399"
                  strokeWidth="2"
                />
                {lppVertices.scored.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={30 + p.x * 18}
                    cy={175 - p.y * 13}
                    r={p.x === lppVertices.best.x && p.y === lppVertices.best.y ? 6 : 4}
                    fill={p.x === lppVertices.best.x && p.y === lppVertices.best.y ? '#fbbf24' : '#38bdf8'}
                  />
                ))}
              </svg>
            </div>
            <div className="lg:col-span-5 space-y-2.5">
              <div className="font-mono text-sky-600 dark:text-sky-400">Maximize Z = {lppC1}x + {lppC2}y</div>
              <label className="block">c₁ = {lppC1} <input type="range" min={1} max={10} value={lppC1} onChange={(e) => setLppC1(Number(e.target.value))} className="w-full" /></label>
              <label className="block">c₂ = {lppC2} <input type="range" min={1} max={10} value={lppC2} onChange={(e) => setLppC2(Number(e.target.value))} className="w-full" /></label>
              <label className="block">x + y ≤ {lppCap} <input type="range" min={6} max={12} value={lppCap} onChange={(e) => setLppCap(Number(e.target.value))} className="w-full" /></label>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px]">
                Optimal Corner: ({lppVertices.best.x.toFixed(1)}, {lppVertices.best.y.toFixed(1)}) →{' '}
                <span className="font-semibold text-amber-500">Zmax = {lppVertices.best.z.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {/* #26 Complex Number Argand Plane */}
        {activeSim === 'argand' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              {(() => {
                const mod = Math.hypot(compA, compB);
                const arg = Math.atan2(compB, compA);
                const znR = Math.pow(mod, compPow);
                const znRe = znR * Math.cos(arg * compPow);
                const znIm = znR * Math.sin(arg * compPow);
                const clampX = (v: number) => Math.max(15, Math.min(345, 180 + v * 28));
                const clampY = (v: number) => Math.max(15, Math.min(185, 100 - v * 28));
                return (
                  <svg viewBox="0 0 360 200" className="w-full h-48">
                    <line x1="20" y1="100" x2="340" y2="100" stroke="#334155" />
                    <line x1="180" y1="10" x2="180" y2="190" stroke="#334155" />
                    <line x1="180" y1="100" x2={clampX(compA)} y2={clampY(compB)} stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx={clampX(compA)} cy={clampY(compB)} r="5" fill="#38bdf8" />
                    <line x1="180" y1="100" x2={clampX(compA)} y2={clampY(-compB)} stroke="#a78bfa" strokeDasharray="4 3" strokeWidth="1.6" />
                    <line x1="180" y1="100" x2={clampX(znRe)} y2={clampY(znIm)} stroke="#fbbf24" strokeWidth="2" />
                    <circle cx={clampX(znRe)} cy={clampY(znIm)} r="4.5" fill="#fbbf24" />
                    <text x="20" y="22" fill="#38bdf8" fontSize="11">z = {compA} + {compB}i</text>
                    <text x="150" y="22" fill="#fbbf24" fontSize="11">z^{compPow} = {znRe.toFixed(1)} + {znIm.toFixed(1)}i</text>
                  </svg>
                );
              })()}
            </div>
            <div className="lg:col-span-5 space-y-2.5">
              <label className="block">Real Re(z) = {compA} <input type="range" min={-3} max={3} step={0.5} value={compA} onChange={(e) => setCompA(Number(e.target.value))} className="w-full" /></label>
              <label className="block">Imag Im(z) = {compB} <input type="range" min={-3} max={3} step={0.5} value={compB} onChange={(e) => setCompB(Number(e.target.value))} className="w-full" /></label>
              <label className="block">De Moivre Power n = {compPow} <input type="range" min={1} max={4} step={1} value={compPow} onChange={(e) => setCompPow(Number(e.target.value))} className="w-full" /></label>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px] space-y-1">
                <div>|z| = {Math.hypot(compA, compB).toFixed(3)}</div>
                <div>arg(z) = {((Math.atan2(compB, compA) * 180) / Math.PI).toFixed(1)}°</div>
                <div>Conjugate z̄ = {compA} {compB >= 0 ? '−' : '+'} {Math.abs(compB)}i</div>
              </div>
            </div>
          </div>
        )}

        {/* #21 3D Vector Sandbox */}
        {activeSim === 'vectors' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            <div className="lg:col-span-6 space-y-2">
              <div className="font-mono font-semibold text-sky-600 dark:text-sky-400">a⃗ = ({va[0]}, {va[1]}, {va[2]})</div>
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <label key={axis} className="block">
                  a_{axis} = {va[idx]}
                  <input type="range" min={-5} max={5} value={va[idx]} onChange={(e) => { const n = [...va] as [number, number, number]; n[idx] = Number(e.target.value); setVa(n); }} className="w-full" />
                </label>
              ))}
              <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 pt-2">b⃗ = ({vb[0]}, {vb[1]}, {vb[2]})</div>
              {(['x', 'y', 'z'] as const).map((axis, idx) => (
                <label key={axis} className="block">
                  b_{axis} = {vb[idx]}
                  <input type="range" min={-5} max={5} value={vb[idx]} onChange={(e) => { const n = [...vb] as [number, number, number]; n[idx] = Number(e.target.value); setVb(n); }} className="w-full" />
                </label>
              ))}
            </div>
            <div className="lg:col-span-6 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-4 font-mono space-y-2">
              <div>a⃗ · b⃗ (Dot Product) = <span className="font-semibold text-sky-600 dark:text-sky-400">{dotProduct}</span></div>
              <div>a⃗ × b⃗ (Cross Product) = ({crossVec[0]}, {crossVec[1]}, {crossVec[2]})</div>
              <div>|a⃗ × b⃗| (Parallelogram Area) = {crossMag.toFixed(2)}</div>
              <div>Angle θ between a⃗ and b⃗ = <span className="font-semibold text-emerald-600 dark:text-emerald-400">{vecAngleDeg.toFixed(1)}°</span></div>
              <div>Scalar Projection of a⃗ on b⃗ = {(dotProduct / magB).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* #24 Statistics Histogram & Ogive */}
        {activeSim === 'ogive' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              {(() => {
                const cum: number[] = [];
                let sum = 0;
                for (const f of ogiveFreqs) {
                  sum += f;
                  cum.push(sum);
                }
                const total = sum || 1;
                return (
                  <svg viewBox="0 0 360 190" className="w-full h-44">
                    <line x1="30" y1="165" x2="340" y2="165" stroke="#475569" />
                    <line x1="30" y1="15" x2="30" y2="165" stroke="#475569" />
                    {ogiveFreqs.map((f, idx) => {
                      const h = (f / total) * 140;
                      return (
                        <rect
                          key={idx}
                          x={40 + idx * 55}
                          y={165 - h}
                          width={46}
                          height={h}
                          fill="rgba(56,189,248,0.28)"
                          stroke="#38bdf8"
                        />
                      );
                    })}
                    <polyline
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2.4"
                      points={`30,165 ${cum.map((c, idx) => `${86 + idx * 55},${(165 - (c / total) * 140).toFixed(1)}`).join(' ')}`}
                    />
                  </svg>
                );
              })()}
            </div>
            <div className="lg:col-span-5 space-y-2">
              {ogiveFreqs.map((f, idx) => (
                <label key={idx} className="block">
                  Class {idx * 10}–{(idx + 1) * 10}: freq = {f}
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={f}
                    onChange={(e) => {
                      const next = [...ogiveFreqs];
                      next[idx] = Number(e.target.value);
                      setOgiveFreqs(next);
                    }}
                    className="w-full"
                  />
                </label>
              ))}
              <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                Total N = {ogiveFreqs.reduce((a, b) => a + b, 0)} · Median rank N/2 = {(ogiveFreqs.reduce((a, b) => a + b, 0) / 2).toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* #20 Compass Construction */}
        {activeSim === 'construction' && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {(['perp-bisector', 'angle-bisector', 'tangent'] as const).map((c) => (
                <button key={c} type="button" onClick={() => setConstructType(c)} className={`px-2.5 py-1 rounded capitalize ${constructType === c ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {c.replace('-', ' ')}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2">
                Step {constructStep}/4
                <input type="range" min={1} max={4} value={constructStep} onChange={(e) => setConstructStep(Number(e.target.value))} />
              </label>
            </div>
            <div className="rounded-xl bg-slate-950 p-3">
              <svg viewBox="0 0 380 180" className="w-full h-44">
                <line x1="70" y1="90" x2="310" y2="90" stroke="#e2e8f0" strokeWidth="2" />
                <circle cx="70" cy="90" r="4" fill="#38bdf8" />
                <circle cx="310" cy="90" r="4" fill="#38bdf8" />
                {constructStep >= 2 && <circle cx="70" cy="90" r="145" fill="none" stroke="#38bdf8" strokeDasharray="4 4" opacity="0.65" />}
                {constructStep >= 3 && <circle cx="310" cy="90" r="145" fill="none" stroke="#34d399" strokeDasharray="4 4" opacity="0.65" />}
                {constructStep >= 4 && <line x1="190" y1="15" x2="190" y2="165" stroke="#fbbf24" strokeWidth="2.4" />}
                <text x="15" y="24" fill="#cbd5e1" fontSize="11">
                  {constructStep === 1 && 'Step 1: Draw base segment AB with straightedge.'}
                  {constructStep === 2 && 'Step 2: Set compass radius > ½AB and strike arc from A.'}
                  {constructStep === 3 && 'Step 3: Keep same radius and strike intersecting arc from B.'}
                  {constructStep === 4 && 'Step 4: Join arc intersections P & Q to obtain exact geometric locus.'}
                </text>
              </svg>
            </div>
          </div>
        )}

        {/* #28 Locus & Reflection Sandbox */}
        {activeSim === 'locus' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
            <div className="lg:col-span-7 rounded-xl bg-slate-950 p-3">
              {(() => {
                const orig = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 2, y: 3 }];
                const refl = orig.map((p) =>
                  reflectAxis === 'x'
                    ? { x: p.x, y: -p.y }
                    : reflectAxis === 'y'
                      ? { x: -p.x, y: p.y }
                      : reflectAxis === 'origin'
                        ? { x: -p.x, y: -p.y }
                        : { x: p.y, y: p.x }
                );
                const toSvg = (pts: Array<{ x: number; y: number }>) =>
                  pts.map((p) => `${180 + p.x * 24},${100 - p.y * 22}`).join(' ');
                return (
                  <svg viewBox="0 0 360 200" className="w-full h-44">
                    <line x1="20" y1="100" x2="340" y2="100" stroke="#475569" />
                    <line x1="180" y1="10" x2="180" y2="190" stroke="#475569" />
                    <polygon points={toSvg(orig)} fill="rgba(56,189,248,0.28)" stroke="#38bdf8" strokeWidth="2" />
                    <polygon points={toSvg(refl)} fill="rgba(52,211,153,0.28)" stroke="#34d399" strokeWidth="2" />
                  </svg>
                );
              })()}
            </div>
            <div className="lg:col-span-5 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {([
                  ['x', 'Reflect in x-axis'],
                  ['y', 'Reflect in y-axis'],
                  ['origin', 'Reflect in Origin'],
                  ['yx', 'Reflect in y = x'],
                ] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => setReflectAxis(k)} className={`px-2.5 py-1 rounded ${reflectAxis === k ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{lbl}</button>
                ))}
              </div>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-[11px]">
                Rule: (x, y) →{' '}
                {reflectAxis === 'x' ? '(x, −y)' : reflectAxis === 'y' ? '(−x, y)' : reflectAxis === 'origin' ? '(−x, −y)' : '(y, x)'}
              </div>
            </div>
          </div>
        )}

        {/* #29 GST, Banking RD & Shares Simulator */}
        {activeSim === 'commercial' && (
          <div className="space-y-3 text-xs">
            <div className="flex gap-1.5">
              {([
                ['rd', 'Recurring Deposit (RD)'],
                ['gst', 'GST Invoice Chain'],
                ['shares', 'Shares & Dividends'],
              ] as const).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setCommTab(k)} className={`px-2.5 py-1.5 rounded-lg font-medium ${commTab === k ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{lbl}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block">
                  {commTab === 'rd' ? `Monthly Deposit P = ₹${commAmount}` : commTab === 'gst' ? `Base Price = ₹${commAmount}` : `Shares Held = ${Math.round(commAmount / 10)}`}
                  <input type="range" min={500} max={10000} step={100} value={commAmount} onChange={(e) => setCommAmount(Number(e.target.value))} className="w-full" />
                </label>
                <label className="block">
                  Rate = {commRate}%
                  <input type="range" min={5} max={28} step={1} value={commRate} onChange={(e) => setCommRate(Number(e.target.value))} className="w-full" />
                </label>
                {commTab === 'rd' && (
                  <label className="block">
                    Duration n = {commMonths} months
                    <input type="range" min={6} max={60} step={6} value={commMonths} onChange={(e) => setCommMonths(Number(e.target.value))} className="w-full" />
                  </label>
                )}
                {commTab === 'shares' && (
                  <label className="block">
                    Market Value (MV) = ₹{commMarketPrice} (NV = ₹100)
                    <input type="range" min={80} max={200} step={5} value={commMarketPrice} onChange={(e) => setCommMarketPrice(Number(e.target.value))} className="w-full" />
                  </label>
                )}
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-3.5 font-mono text-[11px] space-y-1.5">
                {commTab === 'rd' && (() => {
                  const interest = commAmount * ((commMonths * (commMonths + 1)) / 24) * (commRate / 100);
                  const maturity = commAmount * commMonths + interest;
                  return (
                    <>
                      <div>Total Deposited = ₹{(commAmount * commMonths).toLocaleString()}</div>
                      <div>Interest I = ₹{interest.toFixed(2)}</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Maturity Value = ₹{maturity.toFixed(2)}</div>
                    </>
                  );
                })()}
                {commTab === 'gst' && (() => {
                  const totalGst = (commAmount * commRate) / 100;
                  return (
                    <>
                      <div>CGST ({commRate / 2}%) = ₹{(totalGst / 2).toFixed(2)}</div>
                      <div>SGST ({commRate / 2}%) = ₹{(totalGst / 2).toFixed(2)}</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Final Bill = ₹{(commAmount + totalGst).toFixed(2)}</div>
                    </>
                  );
                })()}
                {commTab === 'shares' && (() => {
                  const shares = Math.round(commAmount / 10);
                  const investment = shares * commMarketPrice;
                  const annualIncome = shares * 100 * (commRate / 100);
                  const yieldPct = (annualIncome / investment) * 100;
                  return (
                    <>
                      <div>Investment = ₹{investment.toLocaleString()}</div>
                      <div>Annual Dividend = ₹{annualIncome.toFixed(2)}</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Return % = {yieldPct.toFixed(2)}%</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* #30 Saved Presets Shelf */}
      {presets.length > 0 && (
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Saved Simulation Presets (#30)</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs">
                <button type="button" onClick={() => loadPreset(p)} className="hover:text-sky-500 font-medium">
                  {p.name}
                </button>
                <button type="button" aria-label={`Delete ${p.name}`} onClick={() => deletePreset(p.id)} className="text-slate-400 hover:text-rose-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
