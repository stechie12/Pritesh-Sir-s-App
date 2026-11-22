import React, { useId, useState } from 'react';
import { InteractiveTrigVisualizer } from './tutorEnhancements';
import type { InlineVisualizerSpec } from './visualizerDetector';

/**
 * 1. Interactive Quadratic Parabola & Discriminant Explorer (with live a, b, c sliders)
 */
export const InteractiveQuadraticExplorer: React.FC<{
  initialA?: number;
  initialB?: number;
  initialC?: number;
}> = React.memo(({ initialA = 1, initialB = -4, initialC = 3 }) => {
  const uid = useId();
  const [a, setA] = useState(initialA === 0 ? 1 : initialA);
  const [b, setB] = useState(initialB);
  const [c, setC] = useState(initialC);

  const safeA = a === 0 ? 0.5 : a;
  const width = 300;
  const height = 170;
  const cx = width / 2;
  const cy = height / 2 + 16;
  const scaleX = 20;
  const scaleY = 11;

  const points: string[] = [];
  for (let px = 0; px <= width; px += 3) {
    const x = (px - cx) / scaleX;
    const y = safeA * x * x + b * x + c;
    const py = cy - y * scaleY;
    if (py >= -40 && py <= height + 40) {
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  const vertexX = -b / (2 * safeA);
  const vertexY = safeA * vertexX * vertexX + b * vertexX + c;
  const disc = b * b - 4 * safeA * c;
  const roots: number[] =
    disc > 1e-6
      ? [(-b - Math.sqrt(disc)) / (2 * safeA), (-b + Math.sqrt(disc)) / (2 * safeA)]
      : Math.abs(disc) <= 1e-6
      ? [vertexX]
      : [];

  return (
    <div
      dir="ltr"
      data-testid="viz-quadratic"
      className="my-3 rounded-2xl border border-emerald-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Interactive Parabola &amp; Discriminant Lab: y = {safeA}x² {b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}x{' '}
          {c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`}
        </span>
        <span className="font-mono text-[11px] text-emerald-500">
          Δ = {disc.toFixed(1)} ({disc > 0 ? '2 Real Roots' : disc === 0 ? '1 Equal Root' : 'Complex Roots'})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-none"
          role="img"
          aria-label="Interactive quadratic parabola graph"
        >
          <line x1={0} y1={cy} x2={width} y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={cx} y1={0} x2={cx} y2={height} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          {/* Axis of symmetry */}
          <line
            x1={cx + vertexX * scaleX}
            y1={0}
            x2={cx + vertexX * scaleX}
            y2={height}
            stroke="#38bdf8"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.6"
          />
          {points.length > 1 && (
            <polyline fill="none" stroke="#10b981" strokeWidth="2.4" points={points.join(' ')} />
          )}
          {/* Real roots */}
          {roots.map((rx, idx) => (
            <circle key={idx} cx={cx + rx * scaleX} cy={cy} r="4" fill="#f59e0b" />
          ))}
          {/* Vertex */}
          <circle cx={cx + vertexX * scaleX} cy={cy - vertexY * scaleY} r="4.5" fill="#38bdf8" />
        </svg>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-sky-500">Vertex (h, k):</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              ({vertexX.toFixed(2)}, {vertexY.toFixed(2)})
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-amber-500">Roots (x-intercepts):</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {roots.length === 2
                ? `${roots[0].toFixed(2)}, ${roots[1].toFixed(2)}`
                : roots.length === 1
                ? `${roots[0].toFixed(2)} (double)`
                : 'No real roots'}
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            <label htmlFor={`${uid}-a`} className="flex justify-between text-[11px] text-slate-500">
              <span>a = {safeA}</span>
              <input
                id={`${uid}-a`}
                type="range"
                min={-3}
                max={3}
                step={0.5}
                value={safeA}
                onChange={(e) => setA(Number(e.target.value) || 0.5)}
                className="w-32 accent-emerald-500"
              />
            </label>
            <label htmlFor={`${uid}-b`} className="flex justify-between text-[11px] text-slate-500">
              <span>b = {b}</span>
              <input
                id={`${uid}-b`}
                type="range"
                min={-8}
                max={8}
                step={1}
                value={b}
                onChange={(e) => setB(Number(e.target.value))}
                className="w-32 accent-emerald-500"
              />
            </label>
            <label htmlFor={`${uid}-c`} className="flex justify-between text-[11px] text-slate-500">
              <span>c = {c}</span>
              <input
                id={`${uid}-c`}
                type="range"
                min={-8}
                max={8}
                step={1}
                value={c}
                onChange={(e) => setC(Number(e.target.value))}
                className="w-32 accent-emerald-500"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * 2. Interactive Coordinate Geometry Simulator (Distance, Midpoint, Slope, Line Equation)
 */
export const InteractiveCoordinateVisualizer: React.FC<{
  initialX1?: number;
  initialY1?: number;
  initialX2?: number;
  initialY2?: number;
}> = React.memo(({ initialX1 = -2, initialY1 = -1, initialX2 = 4, initialY2 = 3 }) => {
  const uid = useId();
  const [x1, setX1] = useState(initialX1);
  const [y1, setY1] = useState(initialY1);
  const [x2, setX2] = useState(initialX2);
  const [y2, setY2] = useState(initialY2);

  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const step = 15; // 1 unit = 15px (-6 to +6)

  const toPxX = (x: number) => cx + x * step;
  const toPxY = (y: number) => cy - y * step;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const isVertical = dx === 0;
  const slope = isVertical ? null : dy / dx;
  const intercept = slope !== null ? y1 - slope * x1 : null;

  return (
    <div
      dir="ltr"
      data-testid="viz-coordinate"
      className="my-3 rounded-2xl border border-indigo-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Coordinate Geometry Lab: A({x1}, {y1}) → B({x2}, {y2})
        </span>
        <span className="font-mono text-[11px] text-indigo-400">
          d = √{distSq} ≈ {dist.toFixed(2)} units
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-48 h-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-none"
            role="img"
            aria-label="Cartesian coordinate plane showing line segment AB, slope triangle, and midpoint"
          >
            {/* Grid */}
            {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((g) => (
              <g key={g}>
                <line x1={toPxX(g)} y1={10} x2={toPxX(g)} y2={size - 10} stroke="#475569" strokeOpacity="0.18" strokeWidth="1" />
                <line x1={10} y1={toPxY(g)} x2={size - 10} y2={toPxY(g)} stroke="#475569" strokeOpacity="0.18" strokeWidth="1" />
              </g>
            ))}
            {/* Axes */}
            <line x1={10} y1={cy} x2={size - 10} y2={cy} stroke="#64748b" strokeWidth="1.2" />
            <line x1={cx} y1={10} x2={cx} y2={size - 10} stroke="#64748b" strokeWidth="1.2" />
            {/* Right triangle rise/run */}
            <line x1={toPxX(x1)} y1={toPxY(y1)} x2={toPxX(x2)} y2={toPxY(y1)} stroke="#10b981" strokeWidth="1.8" strokeDasharray="3 3" />
            <line x1={toPxX(x2)} y1={toPxY(y1)} x2={toPxX(x2)} y2={toPxY(y2)} stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3 3" />
            {/* Segment AB */}
            <line x1={toPxX(x1)} y1={toPxY(y1)} x2={toPxX(x2)} y2={toPxY(y2)} stroke="#6366f1" strokeWidth="2.6" />
            {/* Midpoint */}
            <circle cx={toPxX(midX)} cy={toPxY(midY)} r="4" fill="#ec4899" />
            {/* Points A & B */}
            <circle cx={toPxX(x1)} cy={toPxY(y1)} r="4.5" fill="#38bdf8" />
            <circle cx={toPxX(x2)} cy={toPxY(y2)} r="4.5" fill="#818cf8" />
            <text x={toPxX(x1) + 5} y={toPxY(y1) - 5} fontSize="9" fill="#38bdf8" fontFamily="monospace">A</text>
            <text x={toPxX(x2) + 5} y={toPxY(y2) - 5} fontSize="9" fill="#818cf8" fontFamily="monospace">B</text>
            <text x={toPxX(midX) + 5} y={toPxY(midY) + 10} fontSize="9" fill="#ec4899" fontFamily="monospace">M</text>
          </svg>
        </div>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-slate-500">Δx, Δy:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              Δx = {dx}, Δy = {dy}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-pink-400">Midpoint M:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              ({midX.toFixed(1)}, {midY.toFixed(1)})
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-amber-500">Slope m:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {slope === null ? 'Undefined (vertical)' : slope.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-indigo-400">Line Eq:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {slope === null
                ? `x = ${x1}`
                : `y = ${slope.toFixed(2)}x ${intercept! >= 0 ? `+ ${intercept!.toFixed(2)}` : `- ${Math.abs(intercept!).toFixed(2)}`}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <label htmlFor={`${uid}-x1`} className="text-slate-500">
              x₁={x1}
              <input id={`${uid}-x1`} type="range" min={-5} max={5} value={x1} onChange={(e) => setX1(Number(e.target.value))} className="w-full accent-sky-500" />
            </label>
            <label htmlFor={`${uid}-y1`} className="text-slate-500">
              y₁={y1}
              <input id={`${uid}-y1`} type="range" min={-5} max={5} value={y1} onChange={(e) => setY1(Number(e.target.value))} className="w-full accent-sky-500" />
            </label>
            <label htmlFor={`${uid}-x2`} className="text-slate-500">
              x₂={x2}
              <input id={`${uid}-x2`} type="range" min={-5} max={5} value={x2} onChange={(e) => setX2(Number(e.target.value))} className="w-full accent-indigo-500" />
            </label>
            <label htmlFor={`${uid}-y2`} className="text-slate-500">
              y₂={y2}
              <input id={`${uid}-y2`} type="range" min={-5} max={5} value={y2} onChange={(e) => setY2(Number(e.target.value))} className="w-full accent-indigo-500" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * 3. Interactive Circle Theorems & Chord Bisector Simulator
 */
export const InteractiveCircleTheoremVisualizer: React.FC<{
  initialAngleDeg?: number;
  initialRadius?: number;
}> = React.memo(({ initialAngleDeg = 100, initialRadius = 5 }) => {
  const uid = useId();
  const [centralAngle, setCentralAngle] = useState(initialAngleDeg);
  const [radius, setRadius] = useState(initialRadius);

  const cx = 95;
  const cy = 95;
  const rPx = 68;
  const halfRad = ((centralAngle / 2) * Math.PI) / 180;

  // Chord endpoints A and B placed symmetrically at bottom of circle
  const ax = cx - rPx * Math.sin(halfRad);
  const ay = cy + rPx * Math.cos(halfRad);
  const bx = cx + rPx * Math.sin(halfRad);
  const by = cy + rPx * Math.cos(halfRad);

  // Point P on major arc (top)
  const px = cx + rPx * Math.sin(0.25);
  const py = cy - rPx * Math.cos(0.25);

  const inscribedAngle = centralAngle / 2;
  const chordLen = 2 * radius * Math.sin(halfRad);
  const perpDist = radius * Math.cos(halfRad);
  const arcLen = radius * ((centralAngle * Math.PI) / 180);

  return (
    <div
      dir="ltr"
      data-testid="viz-circle"
      className="my-3 rounded-2xl border border-cyan-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Circle Theorem Simulator (∠AOB = {centralAngle}° → ∠APB = {inscribedAngle.toFixed(1)}°)
        </span>
        <div className="flex gap-1">
          {[60, 90, 120, 180].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCentralAngle(preset)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
                centralAngle === preset
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {preset === 180 ? '180° (Semi)' : `${preset}°`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="flex justify-center">
          <svg
            viewBox="0 0 190 190"
            className="w-44 h-44 select-none"
            role="img"
            aria-label="Interactive circle showing central angle, inscribed angle, and chord bisector"
          >
            <circle cx={cx} cy={cy} r={rPx} fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeOpacity="0.65" />
            {/* Inscribed angle lines PA, PB */}
            <line x1={px} y1={py} x2={ax} y2={ay} stroke="#a855f7" strokeWidth="2" />
            <line x1={px} y1={py} x2={bx} y2={by} stroke="#a855f7" strokeWidth="2" />
            {/* Central angle radii OA, OB */}
            <line x1={cx} y1={cy} x2={ax} y2={ay} stroke="#38bdf8" strokeWidth="2" />
            <line x1={cx} y1={cy} x2={bx} y2={by} stroke="#38bdf8" strokeWidth="2" />
            {/* Chord AB */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#10b981" strokeWidth="2.5" />
            {/* Perpendicular from center O to chord midpoint */}
            <line x1={cx} y1={cy} x2={cx} y2={ay} stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3 3" />
            <circle cx={cx} cy={cy} r="3.5" fill="#38bdf8" />
            <circle cx={px} cy={py} r="4" fill="#a855f7" />
            <circle cx={ax} cy={ay} r="3.5" fill="#10b981" />
            <circle cx={bx} cy={by} r="3.5" fill="#10b981" />
            <text x={cx + 6} y={cy - 4} fontSize="9" fill="#38bdf8" fontFamily="monospace">O ({centralAngle}°)</text>
            <text x={px + 6} y={py - 4} fontSize="9" fill="#a855f7" fontFamily="monospace">P ({inscribedAngle}°)</text>
          </svg>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-purple-400">Inscribed ∠APB (½∠AOB):</span>
            <span className="text-slate-900 dark:text-white font-semibold">{inscribedAngle.toFixed(1)}°</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-emerald-500">Chord Length AB:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{chordLen.toFixed(2)} cm</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-amber-500">Center-to-Chord (d):</span>
            <span className="text-slate-900 dark:text-white font-semibold">{perpDist.toFixed(2)} cm</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-cyan-400">Arc Length / Area:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {arcLen.toFixed(2)} / {(Math.PI * radius * radius).toFixed(1)}
            </span>
          </div>
          <label htmlFor={`${uid}-ang`} className="block text-[11px] text-slate-500">
            Central Angle ({centralAngle}°):
            <input id={`${uid}-ang`} type="range" min={20} max={180} value={centralAngle} onChange={(e) => setCentralAngle(Number(e.target.value))} className="w-full accent-cyan-500" />
          </label>
          <label htmlFor={`${uid}-rad`} className="block text-[11px] text-slate-500">
            Radius r = {radius} cm:
            <input id={`${uid}-rad`} type="range" min={2} max={15} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-emerald-500" />
          </label>
        </div>
      </div>
    </div>
  );
});

/**
 * 4. Interactive Compound vs. Simple Interest Growth Simulator
 */
export const InteractiveCompoundInterestVisualizer: React.FC<{
  initialPrincipal?: number;
  initialRate?: number;
  initialYears?: number;
}> = React.memo(({ initialPrincipal = 10000, initialRate = 10, initialYears = 5 }) => {
  const uid = useId();
  const [principal, setPrincipal] = useState(initialPrincipal);
  const [rate, setRate] = useState(initialRate);
  const [years, setYears] = useState(initialYears);
  const [freq, setFreq] = useState<1 | 2 | 4>(1);

  const ciAmount = principal * Math.pow(1 + rate / (100 * freq), freq * years);
  const siAmount = principal * (1 + (rate * years) / 100);
  const ciInterest = ciAmount - principal;
  const siInterest = siAmount - principal;
  const extraGain = ciAmount - siAmount;

  const width = 280;
  const height = 140;
  const pad = 18;
  const maxVal = Math.max(ciAmount, principal * 1.2);

  const ciPts: string[] = [];
  const siPts: string[] = [];
  for (let t = 0; t <= years; t++) {
    const x = pad + (t / Math.max(1, years)) * (width - pad * 2);
    const yCI = height - pad - ((principal * Math.pow(1 + rate / (100 * freq), freq * t) - principal) / Math.max(1, maxVal - principal)) * (height - pad * 2);
    const ySI = height - pad - ((principal * (1 + (rate * t) / 100) - principal) / Math.max(1, maxVal - principal)) * (height - pad * 2);
    ciPts.push(`${x.toFixed(1)},${yCI.toFixed(1)}`);
    siPts.push(`${x.toFixed(1)},${ySI.toFixed(1)}`);
  }

  return (
    <div
      dir="ltr"
      data-testid="viz-compound-interest"
      className="my-3 rounded-2xl border border-amber-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Compound vs. Simple Interest Simulator
        </span>
        <div className="flex gap-1">
          {([
            { label: 'Yearly', val: 1 as const },
            { label: 'Half-Yr', val: 2 as const },
            { label: 'Quarterly', val: 4 as const },
          ]).map((opt) => (
            <button
              key={opt.val}
              type="button"
              onClick={() => setFreq(opt.val)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
                freq === opt.val
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-none"
          role="img"
          aria-label="Compound interest curve compared with simple interest line"
        >
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#64748b" strokeWidth="1" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#64748b" strokeWidth="1" />
          <polyline fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" points={siPts.join(' ')} />
          <polyline fill="none" stroke="#f59e0b" strokeWidth="2.6" points={ciPts.join(' ')} />
          <text x={pad + 6} y={pad + 10} fontSize="9" fill="#f59e0b" fontFamily="monospace">● CI: ₹{Math.round(ciAmount).toLocaleString()}</text>
          <text x={pad + 6} y={pad + 22} fontSize="9" fill="#94a3b8" fontFamily="monospace">--- SI: ₹{Math.round(siAmount).toLocaleString()}</text>
        </svg>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-amber-500">Compound Interest:</span>
            <span className="text-slate-900 dark:text-white font-semibold">₹{ciInterest.toFixed(0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-slate-500">Simple Interest:</span>
            <span className="text-slate-900 dark:text-white font-semibold">₹{siInterest.toFixed(0)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-emerald-500">Compounding Bonus:</span>
            <span className="text-emerald-500 font-semibold">+₹{extraGain.toFixed(0)}</span>
          </div>
          <label htmlFor={`${uid}-p`} className="block text-[11px] text-slate-500">
            Principal P = ₹{principal.toLocaleString()}
            <input id={`${uid}-p`} type="range" min={1000} max={50000} step={1000} value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} className="w-full accent-amber-500" />
          </label>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <label htmlFor={`${uid}-r`} className="text-slate-500">
              Rate {rate}%
              <input id={`${uid}-r`} type="range" min={2} max={20} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-amber-500" />
            </label>
            <label htmlFor={`${uid}-t`} className="text-slate-500">
              Time {years} yrs
              <input id={`${uid}-t`} type="range" min={1} max={15} value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full accent-amber-500" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * 5. Interactive Calculus Derivative, Tangent Line & Definite Integral Simulator
 */
export const InteractiveCalculusVisualizer: React.FC<{
  initialPreset?: 'x2' | 'x3' | 'sin';
  initialX?: number;
}> = React.memo(({ initialPreset = 'x2', initialX = 1 }) => {
  const uid = useId();
  const [preset, setPreset] = useState<'x2' | 'x3' | 'sin'>(initialPreset);
  const [x0, setX0] = useState(initialX);

  const fnMap = {
    x2: {
      label: 'f(x) = x²',
      derivLabel: "f'(x) = 2x",
      f: (x: number) => x * x,
      df: (x: number) => 2 * x,
      areaFrom0: (x: number) => (x * x * x) / 3,
      scaleY: 12,
    },
    x3: {
      label: 'f(x) = 0.4x³ − 1.2x',
      derivLabel: "f'(x) = 1.2x² − 1.2",
      f: (x: number) => 0.4 * x * x * x - 1.2 * x,
      df: (x: number) => 1.2 * x * x - 1.2,
      areaFrom0: (x: number) => 0.1 * Math.pow(x, 4) - 0.6 * x * x,
      scaleY: 16,
    },
    sin: {
      label: 'f(x) = 2·sin(x)',
      derivLabel: "f'(x) = 2·cos(x)",
      f: (x: number) => 2 * Math.sin(x),
      df: (x: number) => 2 * Math.cos(x),
      areaFrom0: (x: number) => 2 * (1 - Math.cos(x)),
      scaleY: 22,
    },
  };

  const active = fnMap[preset];
  const width = 280;
  const height = 160;
  const cx = width / 2;
  const cy = height / 2 + 12;
  const scaleX = 36;

  const y0 = active.f(x0);
  const slope = active.df(x0);
  const area = active.areaFrom0(x0);

  const curvePts: string[] = [];
  for (let px = 0; px <= width; px += 3) {
    const x = (px - cx) / scaleX;
    const py = cy - active.f(x) * active.scaleY;
    if (py >= -30 && py <= height + 30) {
      curvePts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  // Tangent line segment from x0 - 1.2 to x0 + 1.2
  const tx1 = x0 - 1.2;
  const ty1 = y0 + slope * (tx1 - x0);
  const tx2 = x0 + 1.2;
  const ty2 = y0 + slope * (tx2 - x0);

  // Shaded area polygon from 0 to x0
  const areaPoly: string[] = [`${cx},${cy}`];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const x = (x0 * i) / steps;
    areaPoly.push(`${(cx + x * scaleX).toFixed(1)},${(cy - active.f(x) * active.scaleY).toFixed(1)}`);
  }
  areaPoly.push(`${(cx + x0 * scaleX).toFixed(1)},${cy}`);

  return (
    <div
      dir="ltr"
      data-testid="viz-calculus"
      className="my-3 rounded-2xl border border-violet-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Calculus Tangent &amp; Area Lab ({active.label})
        </span>
        <div className="flex gap-1">
          {(['x2', 'x3', 'sin'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
                preset === k
                  ? 'bg-violet-500 text-white font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {k === 'x2' ? 'x²' : k === 'x3' ? 'Cubic' : 'sin(x)'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-none"
          role="img"
          aria-label="Calculus curve with live tangent line and shaded integral area"
        >
          <line x1={0} y1={cy} x2={width} y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={cx} y1={0} x2={cx} y2={height} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
          <polygon points={areaPoly.join(' ')} fill="#8b5cf6" fillOpacity="0.2" />
          <polyline fill="none" stroke="#8b5cf6" strokeWidth="2.4" points={curvePts.join(' ')} />
          <line
            x1={cx + tx1 * scaleX}
            y1={cy - ty1 * active.scaleY}
            x2={cx + tx2 * scaleX}
            y2={cy - ty2 * active.scaleY}
            stroke="#f43f5e"
            strokeWidth="2.2"
          />
          <circle cx={cx + x0 * scaleX} cy={cy - y0 * active.scaleY} r="4.5" fill="#f43f5e" />
        </svg>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-slate-500">Point (x₀, f(x₀)):</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              ({x0.toFixed(1)}, {y0.toFixed(2)})
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-rose-500">Tangent Slope {active.derivLabel}:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{slope.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-violet-400">Shaded ∫₀ˣ f(t)dt:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{area.toFixed(2)}</span>
          </div>
          <label htmlFor={`${uid}-x0`} className="block text-[11px] text-slate-500 pt-1">
            Scrub x₀ ({x0.toFixed(1)}):
            <input id={`${uid}-x0`} type="range" min={-3} max={3} step={0.1} value={x0} onChange={(e) => setX0(Number(e.target.value))} className="w-full accent-violet-500" />
          </label>
        </div>
      </div>
    </div>
  );
});

/**
 * 6. Interactive AP / GP Sequence & Series Bar-Chart Visualizer
 */
export const InteractiveProgressionVisualizer: React.FC<{
  initialMode?: 'AP' | 'GP';
  initialA?: number;
  initialStep?: number;
  initialN?: number;
}> = React.memo(({ initialMode = 'AP', initialA = 3, initialStep = 4, initialN = 8 }) => {
  const uid = useId();
  const [mode, setMode] = useState<'AP' | 'GP'>(initialMode);
  const [a, setA] = useState(initialA);
  const [stepVal, setStepVal] = useState(initialStep);
  const [n, setN] = useState(initialN);

  const terms: number[] = [];
  for (let i = 0; i < n; i++) {
    terms.push(mode === 'AP' ? a + i * stepVal : a * Math.pow(stepVal, i));
  }
  const tn = terms[terms.length - 1] ?? a;
  const sn = terms.reduce((acc, v) => acc + v, 0);
  const maxAbs = Math.max(1, ...terms.map((v) => Math.abs(v)));

  return (
    <div
      dir="ltr"
      data-testid="viz-progression"
      className="my-3 rounded-2xl border border-teal-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          {mode === 'AP' ? 'Arithmetic Progression (AP)' : 'Geometric Progression (GP)'} Visualizer
        </span>
        <div className="flex gap-1">
          {(['AP', 'GP'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setStepVal(m === 'GP' ? 2 : 4);
                setN(m === 'GP' ? 6 : 8);
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
                mode === m
                  ? 'bg-teal-500 text-slate-950 font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <svg
          viewBox="0 0 260 120"
          className="w-full h-32 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-none"
          role="img"
          aria-label="Sequence bar chart showing progression terms"
        >
          {terms.map((val, idx) => {
            const barW = Math.max(10, Math.floor(220 / terms.length) - 4);
            const x = 20 + idx * (220 / terms.length);
            const h = Math.max(4, (Math.abs(val) / maxAbs) * 82);
            const y = 100 - h;
            return (
              <g key={idx}>
                <rect x={x} y={y} width={barW} height={h} rx="3" fill={val >= 0 ? '#14b8a6' : '#f43f5e'} fillOpacity="0.85" />
                <text x={x + barW / 2} y={114} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">
                  T{idx + 1}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-teal-500">nth Term (T_{n}):</span>
            <span className="text-slate-900 dark:text-white font-semibold">{Number(tn.toFixed(2))}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-sky-500">Sum (S_{n}):</span>
            <span className="text-slate-900 dark:text-white font-semibold">{Number(sn.toFixed(2))}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
            <label htmlFor={`${uid}-a`} className="text-slate-500">
              a={a}
              <input id={`${uid}-a`} type="range" min={1} max={12} value={a} onChange={(e) => setA(Number(e.target.value))} className="w-full accent-teal-500" />
            </label>
            <label htmlFor={`${uid}-s`} className="text-slate-500">
              {mode === 'AP' ? `d=${stepVal}` : `r=${stepVal}`}
              <input
                id={`${uid}-s`}
                type="range"
                min={mode === 'AP' ? -6 : 0.5}
                max={mode === 'AP' ? 10 : 3}
                step={mode === 'AP' ? 1 : 0.5}
                value={stepVal}
                onChange={(e) => setStepVal(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
            </label>
            <label htmlFor={`${uid}-n`} className="text-slate-500">
              n={n}
              <input id={`${uid}-n`} type="range" min={3} max={10} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-teal-500" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * 7. Interactive 3D Mensuration Solid Cross-Section & Volume/CSA/TSA Simulator
 */
export const InteractiveMensurationVisualizer: React.FC<{
  initialShape?: 'cylinder' | 'cone' | 'sphere';
  initialRadius?: number;
  initialHeight?: number;
}> = React.memo(({ initialShape = 'cone', initialRadius = 5, initialHeight = 10 }) => {
  const uid = useId();
  const [shape, setShape] = useState<'cylinder' | 'cone' | 'sphere'>(initialShape);
  const [r, setR] = useState(initialRadius);
  const [h, setH] = useState(initialHeight);

  const l = Math.sqrt(r * r + h * h);
  const volume =
    shape === 'cylinder'
      ? Math.PI * r * r * h
      : shape === 'cone'
      ? (Math.PI * r * r * h) / 3
      : (4 / 3) * Math.PI * r * r * r;
  const csa =
    shape === 'cylinder'
      ? 2 * Math.PI * r * h
      : shape === 'cone'
      ? Math.PI * r * l
      : 4 * Math.PI * r * r;
  const tsa =
    shape === 'cylinder'
      ? 2 * Math.PI * r * (h + r)
      : shape === 'cone'
      ? Math.PI * r * (l + r)
      : 4 * Math.PI * r * r;

  const rxPx = Math.min(58, 18 + r * 3.2);
  const hPx = Math.min(100, 32 + h * 4);
  const cyBase = 135;
  const cyTop = cyBase - hPx;

  return (
    <div
      dir="ltr"
      data-testid="viz-mensuration"
      className="my-3 rounded-2xl border border-orange-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          Mensuration Solid Lab ({shape.charAt(0).toUpperCase() + shape.slice(1)})
        </span>
        <div className="flex gap-1">
          {(['cylinder', 'cone', 'sphere'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono capitalize ${
                shape === s
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="flex justify-center">
          <svg
            viewBox="0 0 180 165"
            className="w-44 h-40 select-none"
            role="img"
            aria-label={`Interactive ${shape} mensuration diagram`}
          >
            {shape === 'cylinder' && (
              <g>
                <ellipse cx={90} cy={cyBase} rx={rxPx} ry={13} fill="#f97316" fillOpacity="0.18" stroke="#f97316" strokeWidth="1.8" />
                <line x1={90 - rxPx} y1={cyTop} x2={90 - rxPx} y2={cyBase} stroke="#f97316" strokeWidth="1.8" />
                <line x1={90 + rxPx} y1={cyTop} x2={90 + rxPx} y2={cyBase} stroke="#f97316" strokeWidth="1.8" />
                <ellipse cx={90} cy={cyTop} rx={rxPx} ry={13} fill="#f97316" fillOpacity="0.28" stroke="#f97316" strokeWidth="1.8" />
                <line x1={90} y1={cyTop} x2={90} y2={cyBase} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1={90} y1={cyBase} x2={90 + rxPx} y2={cyBase} stroke="#10b981" strokeWidth="2" />
              </g>
            )}
            {shape === 'cone' && (
              <g>
                <ellipse cx={90} cy={cyBase} rx={rxPx} ry={13} fill="#f97316" fillOpacity="0.2" stroke="#f97316" strokeWidth="1.8" />
                <line x1={90} y1={cyTop} x2={90 - rxPx} y2={cyBase} stroke="#f97316" strokeWidth="2" />
                <line x1={90} y1={cyTop} x2={90 + rxPx} y2={cyBase} stroke="#f97316" strokeWidth="2" />
                <line x1={90} y1={cyTop} x2={90} y2={cyBase} stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="3 3" />
                <line x1={90} y1={cyBase} x2={90 + rxPx} y2={cyBase} stroke="#10b981" strokeWidth="2" />
              </g>
            )}
            {shape === 'sphere' && (
              <g>
                <circle cx={90} cy={84} r={rxPx} fill="#f97316" fillOpacity="0.18" stroke="#f97316" strokeWidth="2" />
                <ellipse cx={90} cy={84} rx={rxPx} ry={Math.max(10, rxPx * 0.28)} fill="none" stroke="#f97316" strokeWidth="1.2" strokeDasharray="3 3" />
                <line x1={90} y1={84} x2={90 + rxPx} y2={84} stroke="#10b981" strokeWidth="2.2" />
                <circle cx={90} cy={84} r="3" fill="#38bdf8" />
              </g>
            )}
          </svg>
        </div>

        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-orange-500">Volume:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{volume.toFixed(1)} cm³</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-sky-500">CSA:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{csa.toFixed(1)} cm²</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="text-emerald-500">TSA:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{tsa.toFixed(1)} cm²</span>
          </div>
          {shape === 'cone' && (
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
              <span className="text-amber-500">Slant Height l:</span>
              <span className="text-slate-900 dark:text-white font-semibold">{l.toFixed(2)} cm</span>
            </div>
          )}
          <label htmlFor={`${uid}-r`} className="block text-[11px] text-slate-500">
            Radius r = {r} cm
            <input id={`${uid}-r`} type="range" min={1} max={12} value={r} onChange={(e) => setR(Number(e.target.value))} className="w-full accent-emerald-500" />
          </label>
          {shape !== 'sphere' && (
            <label htmlFor={`${uid}-h`} className="block text-[11px] text-slate-500">
              Height h = {h} cm
              <input id={`${uid}-h`} type="range" min={2} max={16} value={h} onChange={(e) => setH(Number(e.target.value))} className="w-full accent-sky-500" />
            </label>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Dispatcher component that mounts the matching interactive simulation inline inside any tutor reply.
 */
export const InlineMathVisualizer: React.FC<{ spec: InlineVisualizerSpec | null }> = React.memo(
  ({ spec }) => {
    if (!spec) return null;
    switch (spec.kind) {
      case 'trig':
        return <InteractiveTrigVisualizer initialAngleDeg={spec.initialAngleDeg} />;
      case 'quadratic':
        return (
          <InteractiveQuadraticExplorer
            initialA={spec.a}
            initialB={spec.b}
            initialC={spec.c}
          />
        );
      case 'coordinate':
        return (
          <InteractiveCoordinateVisualizer
            initialX1={spec.x1}
            initialY1={spec.y1}
            initialX2={spec.x2}
            initialY2={spec.y2}
          />
        );
      case 'circle':
        return (
          <InteractiveCircleTheoremVisualizer
            initialAngleDeg={spec.initialAngleDeg}
            initialRadius={spec.radius}
          />
        );
      case 'compound_interest':
        return (
          <InteractiveCompoundInterestVisualizer
            initialPrincipal={spec.principal}
            initialRate={spec.rate}
            initialYears={spec.years}
          />
        );
      case 'calculus':
        return (
          <InteractiveCalculusVisualizer
            initialPreset={spec.preset}
            initialX={spec.initialX}
          />
        );
      case 'progression':
        return (
          <InteractiveProgressionVisualizer
            initialMode={spec.mode}
            initialA={spec.a}
            initialStep={spec.step}
            initialN={spec.n}
          />
        );
      case 'mensuration':
        return (
          <InteractiveMensurationVisualizer
            initialShape={spec.shape}
            initialRadius={spec.radius}
            initialHeight={spec.height}
          />
        );
      default:
        return null;
    }
  }
);
