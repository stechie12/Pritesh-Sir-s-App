import React, { useMemo } from 'react';
import {
  computeChapterSimMetrics,
  type ChapterSimulationItem,
} from '../data/chapterSimulations';

interface ChapterSimulationCanvasProps {
  sim: ChapterSimulationItem;
  params: Record<string, number>;
  onChangeParam: (key: string, value: number) => void;
  onApplyPreset: (presetParams: Record<string, number>) => void;
  onReset: () => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const ChapterSimulationCanvas: React.FC<ChapterSimulationCanvasProps> = ({
  sim,
  params,
  onChangeParam,
  onApplyPreset,
  onReset,
}) => {
  const metrics = useMemo(
    () => computeChapterSimMetrics(sim.simKind, params),
    [sim.simKind, params]
  );

  const renderVisualSvg = () => {
    const W = 440;
    const H = 220;

    switch (sim.simKind) {
      case 'g9_rational_surds': {
        const a = params.a ?? 3;
        const b = params.b ?? 2;
        const sqrtB = Math.sqrt(b);
        const maxAxis = Math.max(5, Math.ceil(a + sqrtB) + 1);
        const mapX = (v: number) => 36 + (v / maxAxis) * (W - 72);
        const yBase = 165;
        const rootX = mapX(sqrtB);
        const legX = mapX(Math.sqrt(Math.max(1, b - 1)));
        const hPx = (1 / maxAxis) * (W - 72);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={30} y1={yBase} x2={W - 24} y2={yBase} stroke="#64748b" strokeWidth={1.6} />
            {Array.from({ length: maxAxis + 1 }, (_, i) => (
              <g key={i}>
                <line x1={mapX(i)} y1={yBase - 5} x2={mapX(i)} y2={yBase + 5} stroke="#94a3b8" strokeWidth={1.2} />
                <text x={mapX(i)} y={yBase + 20} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
                  {i}
                </text>
              </g>
            ))}
            {/* Right triangle constructing √b */}
            <polygon
              points={`${mapX(0)},${yBase} ${legX},${yBase} ${legX},${yBase - hPx}`}
              fill="rgba(56,189,248,0.16)"
              stroke="#38bdf8"
              strokeWidth={1.8}
            />
            {/* Compass arc dropping hypotenuse √b onto number line */}
            <path
              d={`M ${legX} ${yBase - hPx} A ${rootX - mapX(0)} ${rootX - mapX(0)} 0 0 1 ${rootX} ${yBase}`}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.6}
              strokeDasharray="4 3"
            />
            <circle cx={rootX} cy={yBase} r={4.5} fill="#f59e0b" />
            <text x={rootX + 10} y={yBase - 14} textAnchor="start" className="fill-amber-400 text-[11px] font-mono font-semibold">
              √{b} ≈ {sqrtB.toFixed(2)}
            </text>
            <circle cx={mapX(a + sqrtB)} cy={yBase} r={4.5} fill="#10b981" />
            <text x={mapX(a + sqrtB)} y={42} textAnchor="middle" className="fill-emerald-400 text-[11px] font-mono font-semibold">
              a + √b = {(a + sqrtB).toFixed(2)}
            </text>
            <line x1={mapX(a + sqrtB)} y1={48} x2={mapX(a + sqrtB)} y2={yBase - 6} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1.2} />
          </svg>
        );
      }

      case 'g9_compound_interest': {
        const P = params.principal ?? 10000;
        const r = params.rate ?? 10;
        const n = Math.max(1, Math.round(params.years ?? 4));
        const maxVal = P * Math.pow(1 + r / 200, 2 * n) * 1.08;
        const toX = (yr: number) => 44 + (yr / n) * (W - 74);
        const toY = (val: number) => 185 - ((val - P * 0.85) / Math.max(1, maxVal - P * 0.85)) * 145;
        const siPts = Array.from({ length: n + 1 }, (_, i) => `${toX(i)},${toY(P + (P * r * i) / 100)}`).join(' ');
        const ciPts = Array.from({ length: n + 1 }, (_, i) => `${toX(i)},${toY(P * Math.pow(1 + r / 100, i))}`).join(' ');
        const ciHalfPts = Array.from({ length: n + 1 }, (_, i) => `${toX(i)},${toY(P * Math.pow(1 + r / 200, 2 * i))}`).join(' ');
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={44} y1={185} x2={W - 24} y2={185} stroke="#475569" strokeWidth={1.4} />
            <line x1={44} y1={26} x2={44} y2={185} stroke="#475569" strokeWidth={1.4} />
            <polyline fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" points={siPts} />
            <polyline fill="none" stroke="#38bdf8" strokeWidth={2.5} points={ciPts} />
            <polyline fill="none" stroke="#10b981" strokeWidth={2.5} points={ciHalfPts} />
            <text x={W - 32} y={40} textAnchor="end" className="fill-emerald-400 text-[10px] font-mono">Half-Yearly CI</text>
            <text x={W - 32} y={55} textAnchor="end" className="fill-sky-400 text-[10px] font-mono">Annual CI</text>
            <text x={W - 32} y={70} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">Simple Interest</text>
            {Array.from({ length: n + 1 }, (_, i) => (
              <text key={i} x={toX(i)} y={202} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
                Y{i}
              </text>
            ))}
          </svg>
        );
      }

      case 'g9_expansions': {
        const a = params.a ?? 6;
        const b = params.b ?? 3;
        const side = 152;
        const aPx = (a / (a + b)) * side;
        const bPx = side - aPx;
        const ox = 144;
        const oy = 32;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <rect x={ox} y={oy} width={aPx} height={aPx} fill="rgba(14,165,233,0.28)" stroke="#38bdf8" strokeWidth={1.6} />
            <rect x={ox + aPx} y={oy} width={bPx} height={aPx} fill="rgba(245,158,11,0.26)" stroke="#f59e0b" strokeWidth={1.6} />
            <rect x={ox} y={oy + aPx} width={aPx} height={bPx} fill="rgba(245,158,11,0.26)" stroke="#f59e0b" strokeWidth={1.6} />
            <rect x={ox + aPx} y={oy + aPx} width={bPx} height={bPx} fill="rgba(16,185,129,0.32)" stroke="#10b981" strokeWidth={1.6} />
            <text x={ox + aPx / 2} y={oy + aPx / 2 + 4} textAnchor="middle" className="fill-sky-200 text-[11px] font-mono font-semibold">
              a² = {a * a}
            </text>
            <text x={ox + aPx + bPx / 2} y={oy + aPx / 2 + 4} textAnchor="middle" className="fill-amber-200 text-[10px] font-mono">
              ab={a * b}
            </text>
            <text x={ox + aPx / 2} y={oy + aPx + bPx / 2 + 4} textAnchor="middle" className="fill-amber-200 text-[10px] font-mono">
              ab={a * b}
            </text>
            <text x={ox + aPx + bPx / 2} y={oy + aPx + bPx / 2 + 4} textAnchor="middle" className="fill-emerald-200 text-[10px] font-mono">
              b²={b * b}
            </text>
            <text x={ox + aPx / 2} y={oy - 8} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">a = {a}</text>
            <text x={ox + aPx + bPx / 2} y={oy - 8} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">b = {b}</text>
          </svg>
        );
      }

      case 'g9_factorisation': {
        const p = params.p ?? 3;
        const q = params.q ?? 5;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <rect x={120} y={36} width={110} height={82} fill="rgba(14,165,233,0.22)" stroke="#38bdf8" strokeWidth={1.5} />
            <rect x={230} y={36} width={92} height={82} fill="rgba(16,185,129,0.22)" stroke="#10b981" strokeWidth={1.5} />
            <rect x={120} y={118} width={110} height={66} fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth={1.5} />
            <rect x={230} y={118} width={92} height={66} fill="rgba(139,92,246,0.24)" stroke="#a78bfa" strokeWidth={1.5} />
            <text x={175} y={82} textAnchor="middle" className="fill-sky-200 text-xs font-mono font-semibold">x²</text>
            <text x={276} y={82} textAnchor="middle" className="fill-emerald-200 text-xs font-mono font-semibold">{p >= 0 ? `+${p}x` : `${p}x`}</text>
            <text x={175} y={156} textAnchor="middle" className="fill-amber-200 text-xs font-mono font-semibold">{q >= 0 ? `+${q}x` : `${q}x`}</text>
            <text x={276} y={156} textAnchor="middle" className="fill-violet-200 text-xs font-mono font-semibold">{p * q >= 0 ? `+${p * q}` : `${p * q}`}</text>
            <text x={175} y={24} textAnchor="middle" className="fill-slate-300 text-[11px] font-mono">x</text>
            <text x={276} y={24} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono">{p >= 0 ? `+${p}` : p}</text>
            <text x={102} y={82} textAnchor="middle" className="fill-slate-300 text-[11px] font-mono">x</text>
            <text x={102} y={156} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono">{q >= 0 ? `+${q}` : q}</text>
          </svg>
        );
      }

      case 'g9_simultaneous':
      case 'g10_straight_line': {
        const cx = W / 2;
        const cy = H / 2;
        const sc = 17;
        const m1 = sim.simKind === 'g9_simultaneous' ? (params.m1 ?? 1) : (params.m ?? 1);
        const c1 = sim.simKind === 'g9_simultaneous' ? (params.c1 ?? 1) : (params.c ?? 2);
        const m2 =
          sim.simKind === 'g9_simultaneous'
            ? (params.m2 ?? -1)
            : Math.abs(m1) < 1e-6
              ? 100
              : -1 / m1;
        const c2 = sim.simKind === 'g9_simultaneous' ? (params.c2 ?? 5) : c1;

        const lineEnd = (m: number, c: number) => {
          const xL = -10;
          const xR = 10;
          return {
            x1: cx + xL * sc,
            y1: cy - (m * xL + c) * sc,
            x2: cx + xR * sc,
            y2: cy - (m * xR + c) * sc,
          };
        };
        const l1 = lineEnd(m1, c1);
        const l2 = lineEnd(m2, c2);
        const hasIx = Math.abs(m1 - m2) > 1e-6;
        const ix = hasIx ? (c2 - c1) / (m1 - m2) : 0;
        const iy = hasIx ? m1 * ix + c1 : 0;

        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={20} y1={cy} x2={W - 20} y2={cy} stroke="#475569" strokeWidth={1.2} />
            <line x1={cx} y1={14} x2={cx} y2={H - 14} stroke="#475569" strokeWidth={1.2} />
            <line x1={l1.x1} y1={l1.y1} x2={l1.x2} y2={l1.y2} stroke="#38bdf8" strokeWidth={2.4} />
            <line x1={l2.x1} y1={l2.y1} x2={l2.x2} y2={l2.y2} stroke="#10b981" strokeWidth={2.2} strokeDasharray={sim.simKind === 'g10_straight_line' ? '5 3' : undefined} />
            {hasIx && Math.abs(ix) <= 10 && Math.abs(iy) <= 6 && (
              <>
                <circle cx={cx + ix * sc} cy={cy - iy * sc} r={5} fill="#f59e0b" />
                <text x={cx + ix * sc + 8} y={cy - iy * sc - 8} className="fill-amber-300 text-[11px] font-mono font-semibold">
                  ({ix.toFixed(1)}, {iy.toFixed(1)})
                </text>
              </>
            )}
            <text x={W - 26} y={28} textAnchor="end" className="fill-sky-400 text-[10px] font-mono">L₁: y = {m1}x {c1 >= 0 ? `+ ${c1}` : `− ${Math.abs(c1)}`}</text>
            <text x={W - 26} y={44} textAnchor="end" className="fill-emerald-400 text-[10px] font-mono">
              {sim.simKind === 'g10_straight_line' ? 'Perpendicular L₂ (m₁m₂ = −1)' : `L₂: y = ${m2}x ${c2 >= 0 ? `+ ${c2}` : `− ${Math.abs(c2)}`}`}
            </text>
          </svg>
        );
      }

      case 'g9_indices':
      case 'g9_logarithms': {
        const base = Math.max(2, params.base ?? 2);
        const cx = 135;
        const cy = 165;
        const scX = 32;
        const scY = 20;
        const expPts: string[] = [];
        const logPts: string[] = [];
        for (let x = -2.5; x <= 3.5; x += 0.2) {
          const y = Math.pow(base, x);
          if (y <= 8) expPts.push(`${cx + x * scX},${cy - y * scY}`);
        }
        for (let x = 0.25; x <= 8.5; x += 0.2) {
          const y = Math.log(x) / Math.log(base);
          if (y >= -2.5 && y <= 5) logPts.push(`${cx + x * scX},${cy - y * scY}`);
        }
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={26} y1={cy} x2={W - 20} y2={cy} stroke="#475569" strokeWidth={1.2} />
            <line x1={cx} y1={16} x2={cx} y2={H - 16} stroke="#475569" strokeWidth={1.2} />
            {sim.simKind === 'g9_logarithms' && (
              <line x1={cx - 48} y1={cy + 30} x2={cx + 210} y2={cy - 132} stroke="#64748b" strokeDasharray="4 4" strokeWidth={1.1} />
            )}
            <polyline fill="none" stroke="#38bdf8" strokeWidth={2.5} points={expPts.join(' ')} />
            {sim.simKind === 'g9_logarithms' && (
              <polyline fill="none" stroke="#10b981" strokeWidth={2.5} points={logPts.join(' ')} />
            )}
            <circle cx={cx} cy={cy - scY} r={4} fill="#f59e0b" />
            <text x={cx + 8} y={cy - scY - 6} className="fill-amber-300 text-[10px] font-mono">(0, 1)</text>
            <text x={W - 26} y={28} textAnchor="end" className="fill-sky-400 text-[10px] font-mono">y = {base}^x</text>
            {sim.simKind === 'g9_logarithms' && (
              <text x={W - 26} y={44} textAnchor="end" className="fill-emerald-400 text-[10px] font-mono">y = log_{base}(x)</text>
            )}
          </svg>
        );
      }

      case 'g9_triangles': {
        const a = params.sideA ?? 6;
        const b = params.sideB ?? 7;
        const c = params.sideC ?? 8;
        const valid = a + b > c && b + c > a && c + a > b;
        if (!valid) {
          return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
              <line x1={70} y1={140} x2={370} y2={140} stroke="#f43f5e" strokeWidth={3} />
              <line x1={70} y1={140} x2={150} y2={105} stroke="#38bdf8" strokeWidth={2.4} />
              <line x1={370} y1={140} x2={275} y2={108} stroke="#10b981" strokeWidth={2.4} />
              <text x={W / 2} y={76} textAnchor="middle" className="fill-rose-400 text-xs font-mono font-semibold">
                Cannot close triangle: sum of two shorter sides ≤ longest side!
              </text>
            </svg>
          );
        }
        const scale = 170 / Math.max(a, b, c);
        const ax = 125;
        const ay = 176;
        const bx = ax + c * scale;
        const by = ay;
        const cosA = (b * b + c * c - a * a) / (2 * b * c);
        const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
        const cxPt = ax + b * cosA * scale;
        const cyPt = clamp(ay - b * sinA * scale, 26, 160);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <polygon points={`${ax},${ay} ${bx},${by} ${cxPt},${cyPt}`} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth={2.2} />
            <text x={(ax + bx) / 2} y={ay + 18} textAnchor="middle" className="fill-slate-300 text-[11px] font-mono">c = {c}</text>
            <text x={(ax + cxPt) / 2 - 14} y={(ay + cyPt) / 2} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono">b = {b}</text>
            <text x={(bx + cxPt) / 2 + 14} y={(by + cyPt) / 2} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono">a = {a}</text>
          </svg>
        );
      }

      case 'g9_midpoint_theorem': {
        const base = params.base ?? 10;
        const apexX = params.apexX ?? 4;
        const apexY = params.apexY ?? 7;
        const bx = 75;
        const by = 180;
        const cxPt = bx + base * 20;
        const cyPt = by;
        const ax = bx + apexX * 20;
        const ay = clamp(by - apexY * 14, 28, 130);
        const dx = (ax + bx) / 2;
        const dy = (ay + by) / 2;
        const ex = (ax + cxPt) / 2;
        const ey = (ay + cyPt) / 2;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <polygon points={`${ax},${ay} ${bx},${by} ${cxPt},${cyPt}`} fill="rgba(14,165,233,0.14)" stroke="#38bdf8" strokeWidth={2} />
            <polygon points={`${ax},${ay} ${dx},${dy} ${ex},${ey}`} fill="rgba(16,185,129,0.22)" stroke="#10b981" strokeWidth={2} />
            <line x1={dx} y1={dy} x2={ex} y2={ey} stroke="#f59e0b" strokeWidth={2.8} />
            <circle cx={dx} cy={dy} r={4} fill="#f59e0b" />
            <circle cx={ex} cy={ey} r={4} fill="#f59e0b" />
            <text x={(dx + ex) / 2} y={dy - 7} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono font-semibold">DE = {(base / 2).toFixed(1)}</text>
            <text x={(bx + cxPt) / 2} y={by + 18} textAnchor="middle" className="fill-sky-300 text-[11px] font-mono">BC = {base} (DE ∥ BC)</text>
          </svg>
        );
      }

      case 'g9_pythagoras': {
        const a = params.a ?? 3;
        const b = params.b ?? 4;
        const sc = 88 / Math.max(a, b, 5);
        const x0 = 185;
        const y0 = 152;
        const aPx = a * sc;
        const bPx = b * sc;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            {/* Square on leg a (left) */}
            <rect x={x0 - aPx} y={y0 - aPx} width={aPx} height={aPx} fill="rgba(56,189,248,0.22)" stroke="#38bdf8" strokeWidth={1.6} />
            {/* Square on leg b (bottom) */}
            <rect x={x0} y={y0} width={bPx} height={Math.min(54, bPx)} fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth={1.6} />
            {/* Right triangle */}
            <polygon points={`${x0},${y0} ${x0 + bPx},${y0} ${x0},${y0 - aPx}`} fill="rgba(16,185,129,0.28)" stroke="#10b981" strokeWidth={2.2} />
            <rect x={x0} y={y0 - 11} width={11} height={11} fill="none" stroke="#94a3b8" strokeWidth={1.2} />
            <text x={x0 - aPx / 2} y={y0 - aPx / 2 + 4} textAnchor="middle" className="fill-sky-200 text-[11px] font-mono font-semibold">a²={a * a}</text>
            <text x={x0 + bPx / 2} y={y0 + Math.min(54, bPx) / 2 + 4} textAnchor="middle" className="fill-amber-200 text-[11px] font-mono font-semibold">b²={b * b}</text>
            <text x={x0 + bPx / 2 + 16} y={y0 - aPx / 2 - 4} textAnchor="start" className="fill-emerald-300 text-[11px] font-mono font-semibold">
              c² = {a * a + b * b} (c = {Math.hypot(a, b).toFixed(2)})
            </text>
          </svg>
        );
      }

      case 'g9_polygons': {
        const n = Math.max(3, Math.round(params.sides ?? 6));
        const cx = W / 2;
        const cy = H / 2;
        const R = 76;
        const verts = Array.from({ length: n }, (_, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
        });
        const pts = verts.map((v) => `${v.x},${v.y}`).join(' ');
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <polygon points={pts} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth={2.2} />
            {verts.slice(2, n - 1).map((v, idx) => (
              <line key={idx} x1={verts[0].x} y1={verts[0].y} x2={v.x} y2={v.y} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.2} />
            ))}
            {verts.map((v, i) => (
              <circle key={i} cx={v.x} cy={v.y} r={3.5} fill="#10b981" />
            ))}
            <text x={cx} y={cy + 4} textAnchor="middle" className="fill-slate-200 text-xs font-mono font-semibold">
              n = {n} ({(((n - 2) * 180) / n).toFixed(1)}°)
            </text>
          </svg>
        );
      }

      case 'g9_area_shear': {
        const b = params.base ?? 8;
        const h = params.height ?? 5;
        const s = params.shear ?? 3;
        const sc = 16;
        const yBot = 174;
        const yTop = yBot - h * sc;
        const x1 = 120;
        const x2 = x1 + b * sc;
        const tx1 = x1 + s * sc;
        const tx2 = x2 + s * sc;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={26} y1={yTop} x2={W - 26} y2={yTop} stroke="#64748b" strokeDasharray="5 4" strokeWidth={1.2} />
            <line x1={26} y1={yBot} x2={W - 26} y2={yBot} stroke="#64748b" strokeDasharray="5 4" strokeWidth={1.2} />
            <polygon points={`${x1},${yBot} ${x2},${yBot} ${tx2},${yTop} ${tx1},${yTop}`} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth={2.2} />
            <polygon points={`${x1},${yBot} ${x2},${yBot} ${(tx1 + tx2) / 2},${yTop}`} fill="rgba(16,185,129,0.28)" stroke="#10b981" strokeWidth={2} />
            <text x={(x1 + x2) / 2} y={yBot + 18} textAnchor="middle" className="fill-slate-300 text-[11px] font-mono">Base b = {b}</text>
            <text x={W - 30} y={yTop - 8} textAnchor="end" className="fill-amber-300 text-[10px] font-mono">Parallel Height h = {h}</text>
          </svg>
        );
      }

      case 'g9_circle_chords': {
        const r = params.radius ?? 10;
        const d = Math.min(r - 0.5, params.dist ?? 6);
        const cx = W / 2;
        const cy = H / 2;
        const Rpx = 78;
        const dPx = (d / r) * Rpx;
        const halfChordPx = Math.sqrt(Math.max(1, Rpx * Rpx - dPx * dPx));
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <circle cx={cx} cy={cy} r={Rpx} fill="rgba(14,165,233,0.10)" stroke="#38bdf8" strokeWidth={2} />
            <line x1={cx - halfChordPx} y1={cy + dPx} x2={cx + halfChordPx} y2={cy + dPx} stroke="#10b981" strokeWidth={2.8} />
            <line x1={cx} y1={cy} x2={cx} y2={cy + dPx} stroke="#f59e0b" strokeWidth={2} />
            <line x1={cx} y1={cy} x2={cx + halfChordPx} y2={cy + dPx} stroke="#a78bfa" strokeWidth={1.8} strokeDasharray="4 3" />
            <circle cx={cx} cy={cy} r={3.5} fill="#f8fafc" />
            <text x={cx - 12} y={cy - 8} className="fill-slate-200 text-[11px] font-mono">O</text>
            <text x={cx + 8} y={cy + dPx / 2 + 3} className="fill-amber-300 text-[10px] font-mono">d={d}</text>
            <text x={cx + halfChordPx / 2 + 12} y={cy + dPx / 2 - 4} className="fill-violet-300 text-[10px] font-mono">r={r}</text>
            <text x={cx} y={cy + dPx + 16} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono font-semibold">
              Chord AB = {(2 * Math.sqrt(Math.max(0, r * r - d * d))).toFixed(2)}
            </text>
          </svg>
        );
      }

      case 'g9_statistics': {
        const freqs = [params.f1 ?? 4, params.f2 ?? 9, params.f3 ?? 14, params.f4 ?? 8, params.f5 ?? 5];
        const labels = ['0-10', '10-20', '20-30', '30-40', '40-50'];
        const maxF = Math.max(1, ...freqs);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={48} y1={178} x2={W - 36} y2={178} stroke="#64748b" strokeWidth={1.4} />
            {freqs.map((f, i) => {
              const barH = (f / maxF) * 130;
              const x = 62 + i * 66;
              const y = 178 - barH;
              const isMode = f === maxF;
              return (
                <g key={labels[i]}>
                  <rect
                    x={x}
                    y={y}
                    width={54}
                    height={barH}
                    rx={4}
                    fill={isMode ? 'rgba(16,185,129,0.45)' : 'rgba(56,189,248,0.32)'}
                    stroke={isMode ? '#10b981' : '#38bdf8'}
                    strokeWidth={1.6}
                  />
                  <text x={x + 27} y={y - 6} textAnchor="middle" className="fill-slate-200 text-[10px] font-mono">{f}</text>
                  <text x={x + 27} y={196} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">{labels[i]}</text>
                </g>
              );
            })}
          </svg>
        );
      }

      case 'g9_mensuration_3d': {
        const r = params.radius ?? 7;
        const h = params.height ?? 10;
        const rx = clamp(r * 3.4, 22, 52);
        const hPx = clamp(h * 6.5, 42, 118);
        const cx = 135;
        const topY = 110 - hPx / 2;
        const botY = 110 + hPx / 2;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            {/* 3D Cylinder Left */}
            <rect x={cx - rx} y={topY} width={rx * 2} height={hPx} fill="rgba(56,189,248,0.18)" />
            <line x1={cx - rx} y1={topY} x2={cx - rx} y2={botY} stroke="#38bdf8" strokeWidth={2} />
            <line x1={cx + rx} y1={topY} x2={cx + rx} y2={botY} stroke="#38bdf8" strokeWidth={2} />
            <ellipse cx={cx} cy={topY} rx={rx} ry={12} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" strokeWidth={2} />
            <ellipse cx={cx} cy={botY} rx={rx} ry={12} fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth={2} />
            {/* Unrolled 2D Net Right */}
            <rect x={250} y={topY} width={145} height={hPx} fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth={1.8} />
            <text x={322} y={114} textAnchor="middle" className="fill-emerald-200 text-[11px] font-mono font-semibold">
              CSA Net: 2πr × h
            </text>
            <text x={322} y={topY - 8} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">
              2πr = {(2 * Math.PI * r).toFixed(1)} cm
            </text>
          </svg>
        );
      }

      case 'g9_trig_coordinate': {
        const deg = params.angleDeg ?? 30;
        const Hval = params.hyp ?? 10;
        const rad = (deg * Math.PI) / 180;
        const bx = 115;
        const by = 174;
        const len = 175;
        const ax = bx + len * Math.cos(rad);
        const ay = by;
        const cxPt = ax;
        const cyPt = by - len * Math.sin(rad);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <polygon points={`${bx},${by} ${ax},${ay} ${cxPt},${cyPt}`} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth={2.2} />
            <rect x={ax - 12} y={ay - 12} width={12} height={12} fill="none" stroke="#94a3b8" strokeWidth={1.2} />
            <text x={(bx + ax) / 2} y={by + 18} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono">
              Base = {(Hval * Math.cos(rad)).toFixed(2)}
            </text>
            <text x={ax + 12} y={(ay + cyPt) / 2} className="fill-amber-300 text-[11px] font-mono">
              Opp = {(Hval * Math.sin(rad)).toFixed(2)}
            </text>
            <text x={(bx + cxPt) / 2 - 22} y={(by + cyPt) / 2 - 8} className="fill-sky-300 text-[11px] font-mono">
              H = {Hval}
            </text>
            <text x={bx + 26} y={by - 10} className="fill-slate-200 text-[11px] font-mono font-semibold">θ = {deg}°</text>
          </svg>
        );
      }

      // ================= GRADE 10 SVG RENDERERS =================
      case 'g10_gst': {
        const mp = params.mp ?? 15000;
        const disc = params.discount ?? 20;
        const rate = params.gstRate ?? 18;
        const inter = (params.interState ?? 0) >= 1;
        const sp = mp * (1 - disc / 100);
        const gst = (sp * rate) / 100;
        const bill = sp + gst;
        const maxBar = Math.max(mp, bill, 1);
        const wMp = (mp / maxBar) * 240;
        const wSp = (sp / maxBar) * 240;
        const wGst = (gst / maxBar) * 240;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <text x={30} y={48} className="fill-slate-300 text-[11px] font-mono">Marked Price</text>
            <rect x={140} y={34} width={wMp} height={24} rx={5} fill="rgba(148,163,184,0.35)" stroke="#94a3b8" />
            <text x={146 + wMp} y={50} className="fill-slate-200 text-[11px] font-mono">₹{mp.toFixed(0)}</text>

            <text x={30} y={100} className="fill-sky-300 text-[11px] font-mono">Taxable SP (−{disc}%)</text>
            <rect x={140} y={86} width={wSp} height={24} rx={5} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" />
            <text x={146 + wSp} y={102} className="fill-sky-200 text-[11px] font-mono">₹{sp.toFixed(0)}</text>

            <text x={30} y={152} className="fill-emerald-300 text-[11px] font-mono">Final Consumer Bill</text>
            <rect x={140} y={138} width={wSp} height={26} rx={4} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" />
            {inter ? (
              <rect x={140 + wSp} y={138} width={wGst} height={26} rx={4} fill="rgba(245,158,11,0.5)" stroke="#f59e0b" />
            ) : (
              <>
                <rect x={140 + wSp} y={138} width={wGst / 2} height={26} fill="rgba(245,158,11,0.5)" stroke="#f59e0b" />
                <rect x={140 + wSp + wGst / 2} y={138} width={wGst / 2} height={26} fill="rgba(16,185,129,0.5)" stroke="#10b981" />
              </>
            )}
            <text x={146 + wSp + wGst} y={155} className="fill-emerald-300 text-[11px] font-mono font-semibold">₹{bill.toFixed(0)}</text>
            <text x={140} y={190} className="fill-amber-300 text-[10px] font-mono">
              {inter ? `Inter-State IGST (${rate}%): ₹${gst.toFixed(0)}` : `Intra-State: CGST (${rate / 2}%) ₹${(gst / 2).toFixed(0)} + SGST (${rate / 2}%) ₹${(gst / 2).toFixed(0)}`}
            </text>
          </svg>
        );
      }

      case 'g10_banking_rd': {
        const P = params.monthlyP ?? 1000;
        const n = params.months ?? 36;
        const r = params.rate ?? 8;
        const prin = P * n;
        const intr = (P * ((n * (n + 1)) / 24) * r) / 100;
        const mv = prin + intr;
        const prinW = (prin / mv) * 340;
        const intW = (intr / mv) * 340;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <text x={50} y={58} className="fill-slate-300 text-xs font-mono">Recurring Deposit Breakdown ({n} monthly deposits)</text>
            <rect x={50} y={76} width={prinW} height={46} rx={6} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" strokeWidth={1.8} />
            <rect x={50 + prinW} y={76} width={Math.max(12, intW)} height={46} rx={6} fill="rgba(16,185,129,0.45)" stroke="#10b981" strokeWidth={1.8} />
            <text x={50 + prinW / 2} y={104} textAnchor="middle" className="fill-sky-100 text-[11px] font-mono font-semibold">
              Deposited ₹{prin.toFixed(0)}
            </text>
            <text x={50 + prinW + Math.max(12, intW) / 2} y={68} textAnchor="middle" className="fill-emerald-300 text-[10px] font-mono font-semibold">
              +₹{intr.toFixed(0)} Int
            </text>
            <text x={W / 2} y={162} textAnchor="middle" className="fill-amber-300 text-sm font-mono font-semibold">
              Maturity Value = ₹{mv.toFixed(0)}
            </text>
          </svg>
        );
      }

      case 'g10_shares_dividends': {
        const nv = params.nv ?? 100;
        const mv = Math.max(1, params.mv ?? 125);
        const divRate = params.divRate ?? 15;
        const yieldPct = (divRate * nv) / mv;
        const maxPct = Math.max(30, divRate, yieldPct);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <text x={60} y={48} className="fill-slate-300 text-[11px] font-mono">Nominal vs Market Price</text>
            <rect x={60} y={62} width={clamp(nv, 20, 260)} height={22} rx={4} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" />
            <text x={68 + clamp(nv, 20, 260)} y={77} className="fill-sky-300 text-[11px] font-mono">NV = ₹{nv}</text>
            <rect x={60} y={92} width={clamp(mv, 20, 260)} height={22} rx={4} fill="rgba(245,158,11,0.35)" stroke="#f59e0b" />
            <text x={68 + clamp(mv, 20, 260)} y={107} className="fill-amber-300 text-[11px] font-mono">MV = ₹{mv}</text>

            <text x={60} y={145} className="fill-slate-300 text-[11px] font-mono">Declared Dividend % vs Actual Return %</text>
            <rect x={60} y={156} width={(divRate / maxPct) * 240} height={18} rx={4} fill="rgba(16,185,129,0.35)" stroke="#10b981" />
            <text x={68 + (divRate / maxPct) * 240} y={169} className="fill-emerald-300 text-[10px] font-mono">Div {divRate}%</text>
            <rect x={60} y={180} width={(yieldPct / maxPct) * 240} height={18} rx={4} fill="rgba(139,92,246,0.4)" stroke="#a78bfa" />
            <text x={68 + (yieldPct / maxPct) * 240} y={193} className="fill-violet-300 text-[10px] font-mono">Return {yieldPct.toFixed(2)}%</text>
          </svg>
        );
      }

      case 'g10_linear_inequations': {
        const rawA = params.a ?? -2;
        const a = rawA === 0 ? 1 : rawA;
        const b = params.b ?? 3;
        const c = params.c ?? 9;
        const bound = clamp((c - b) / a, -8, 8);
        const flipped = a < 0;
        const toX = (v: number) => 40 + ((v + 8) / 16) * (W - 80);
        const bx = toX(bound);
        const yLine = 122;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={30} y1={yLine} x2={W - 30} y2={yLine} stroke="#64748b" strokeWidth={1.8} />
            {[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((tick) => (
              <g key={tick}>
                <line x1={toX(tick)} y1={yLine - 6} x2={toX(tick)} y2={yLine + 6} stroke="#94a3b8" strokeWidth={1.2} />
                <text x={toX(tick)} y={yLine + 24} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">{tick}</text>
              </g>
            ))}
            <line
              x1={bx}
              y1={yLine}
              x2={flipped ? W - 30 : 30}
              y2={yLine}
              stroke="#10b981"
              strokeWidth={5}
            />
            <circle cx={bx} cy={yLine} r={6.5} fill="#10b981" stroke="#f8fafc" strokeWidth={2} />
            <text x={bx} y={yLine - 20} textAnchor="middle" className="fill-emerald-300 text-xs font-mono font-semibold">
              x {flipped ? '≥' : '≤'} {((c - b) / a).toFixed(2)}
            </text>
            {flipped && (
              <text x={W / 2} y={44} textAnchor="middle" className="fill-rose-400 text-[11px] font-mono">
                Dividing by negative a ({a}) flipped ≤ to ≥!
              </text>
            )}
          </svg>
        );
      }

      case 'g10_quadratic': {
        const rawA = params.a ?? 1;
        const a = rawA === 0 ? 1 : rawA;
        const b = params.b ?? -5;
        const c = params.c ?? 6;
        const cx = W / 2;
        const cy = 126;
        const scX = 24;
        const scY = 12;
        const pts: string[] = [];
        for (let x = -7; x <= 7; x += 0.2) {
          const y = a * x * x + b * x + c;
          if (y >= -9 && y <= 11) pts.push(`${cx + x * scX},${cy - y * scY}`);
        }
        const disc = b * b - 4 * a * c;
        const vx = -b / (2 * a);
        const vy = a * vx * vx + b * vx + c;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={22} y1={cy} x2={W - 22} y2={cy} stroke="#475569" strokeWidth={1.3} />
            <line x1={cx} y1={14} x2={cx} y2={H - 14} stroke="#475569" strokeWidth={1.3} />
            <polyline fill="none" stroke="#38bdf8" strokeWidth={2.6} points={pts.join(' ')} />
            {disc >= 0 && (
              <>
                <circle cx={cx + ((-b + Math.sqrt(disc)) / (2 * a)) * scX} cy={cy} r={4.5} fill="#10b981" />
                <circle cx={cx + ((-b - Math.sqrt(disc)) / (2 * a)) * scX} cy={cy} r={4.5} fill="#10b981" />
              </>
            )}
            <circle cx={clamp(cx + vx * scX, 24, W - 24)} cy={clamp(cy - vy * scY, 18, H - 18)} r={4.5} fill="#f59e0b" />
          </svg>
        );
      }

      case 'g10_ratio_proportion': {
        const a = params.a ?? 4;
        const c = params.c ?? 9;
        const b = Math.sqrt(a * c);
        const maxV = Math.max(a, b, c, 1);
        const hBar = (v: number) => (v / maxV) * 120;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={55} y1={174} x2={W - 55} y2={174} stroke="#475569" strokeWidth={1.4} />
            {[
              { label: `a = ${a}`, val: a, color: '#38bdf8', x: 96 },
              { label: `b = √(ac) = ${b.toFixed(2)}`, val: b, color: '#10b981', x: 192 },
              { label: `c = ${c}`, val: c, color: '#f59e0b', x: 288 },
            ].map((item) => (
              <g key={item.label}>
                <rect x={item.x} y={174 - hBar(item.val)} width={58} height={hBar(item.val)} rx={5} fill={item.color} fillOpacity={0.35} stroke={item.color} strokeWidth={1.8} />
                <text x={item.x + 29} y={194} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">{item.label}</text>
              </g>
            ))}
          </svg>
        );
      }

      case 'g10_remainder_factor': {
        const k = params.k ?? 2;
        const d = params.shift ?? 0;
        const ox = 110;
        const oy = 116;
        const scX = 56;
        const scY = 14;
        const pts: string[] = [];
        for (let x = -0.5; x <= 4.5; x += 0.1) {
          const y = x * x * x - 6 * x * x + 11 * x - 6 + d;
          if (y >= -7 && y <= 8) pts.push(`${ox + x * scX},${oy - y * scY}`);
        }
        const fk = k * k * k - 6 * k * k + 11 * k - 6 + d;
        const py = clamp(oy - fk * scY, 20, H - 20);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={26} y1={oy} x2={W - 22} y2={oy} stroke="#475569" strokeWidth={1.3} />
            <line x1={ox} y1={16} x2={ox} y2={H - 16} stroke="#475569" strokeWidth={1.3} />
            <polyline fill="none" stroke="#38bdf8" strokeWidth={2.5} points={pts.join(' ')} />
            <line x1={ox + k * scX} y1={oy} x2={ox + k * scX} y2={py} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} />
            <circle cx={ox + k * scX} cy={py} r={5.5} fill={Math.abs(fk) < 1e-6 ? '#10b981' : '#f59e0b'} />
            <text x={ox + k * scX + 8} y={py - 8} className="fill-amber-300 text-[11px] font-mono font-semibold">
              f({k}) = {fk.toFixed(2)}
            </text>
          </svg>
        );
      }

      case 'g10_matrices': {
        const a = params.m11 ?? 2;
        const b = params.m12 ?? 1;
        const c = params.m21 ?? 0;
        const d = params.m22 ?? 2;
        const cx = W / 2;
        const cy = H / 2 + 18;
        const sc = 26;
        const p0 = `${cx},${cy}`;
        const p1 = `${cx + a * sc},${cy - c * sc}`;
        const p2 = `${cx + (a + b) * sc},${cy - (c + d) * sc}`;
        const p3 = `${cx + b * sc},${cy - d * sc}`;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={30} y1={cy} x2={W - 30} y2={cy} stroke="#475569" strokeWidth={1.2} />
            <line x1={cx} y1={16} x2={cx} y2={H - 16} stroke="#475569" strokeWidth={1.2} />
            {/* Original unit square */}
            <rect x={cx} y={cy - sc} width={sc} height={sc} fill="rgba(148,163,184,0.22)" stroke="#94a3b8" strokeDasharray="3 2" />
            {/* Transformed parallelogram */}
            <polygon points={`${p0} ${p1} ${p2} ${p3}`} fill="rgba(56,189,248,0.28)" stroke="#38bdf8" strokeWidth={2.2} />
            <text x={32} y={32} className="fill-sky-300 text-[11px] font-mono">A = [[{a}, {b}], [{c}, {d}]]</text>
            <text x={32} y={48} className="fill-emerald-300 text-[11px] font-mono">Signed Area = det(A) = {a * d - b * c}</text>
          </svg>
        );
      }

      case 'g10_ap_gp': {
        const a = params.a ?? 2;
        const d = params.d ?? 3;
        const r = params.r ?? 2;
        const n = Math.max(3, Math.round(params.n ?? 6));
        const apVals = Array.from({ length: n }, (_, i) => a + i * d);
        const gpVals = Array.from({ length: n }, (_, i) => a * Math.pow(r, i));
        const maxVal = Math.max(1, ...apVals, ...gpVals);
        const stepX = (W - 90) / n;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={42} y1={182} x2={W - 26} y2={182} stroke="#475569" strokeWidth={1.3} />
            {apVals.map((ap, i) => {
              const gp = gpVals[i];
              const x = 52 + i * stepX;
              const hAp = (ap / maxVal) * 136;
              const hGp = (gp / maxVal) * 136;
              return (
                <g key={i}>
                  <rect x={x} y={182 - hAp} width={stepX * 0.36} height={hAp} rx={3} fill="rgba(56,189,248,0.5)" stroke="#38bdf8" />
                  <rect x={x + stepX * 0.4} y={182 - hGp} width={stepX * 0.36} height={hGp} rx={3} fill="rgba(16,185,129,0.5)" stroke="#10b981" />
                  <text x={x + stepX * 0.38} y={198} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">T{i + 1}</text>
                </g>
              );
            })}
            <text x={48} y={26} className="fill-sky-400 text-[10px] font-mono">■ AP (Linear)</text>
            <text x={148} y={26} className="fill-emerald-400 text-[10px] font-mono">■ GP (Exponential)</text>
          </svg>
        );
      }

      case 'g10_reflection': {
        const px = params.px ?? 4;
        const py = params.py ?? 3;
        const cx = W / 2;
        const cy = H / 2;
        const sc = 17;
        const pts = [
          { label: `P(${px},${py})`, x: px, y: py, color: '#38bdf8' },
          { label: `Mx(${px},${-py})`, x: px, y: -py, color: '#f59e0b' },
          { label: `My(${-px},${py})`, x: -px, y: py, color: '#10b981' },
          { label: `Mo(${-px},${-py})`, x: -px, y: -py, color: '#a78bfa' },
        ];
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={30} y1={cy} x2={W - 30} y2={cy} stroke="#64748b" strokeWidth={1.4} />
            <line x1={cx} y1={14} x2={cx} y2={H - 14} stroke="#64748b" strokeWidth={1.4} />
            <line x1={cx + px * sc} y1={cy - py * sc} x2={cx + px * sc} y2={cy + py * sc} stroke="#f59e0b" strokeDasharray="3 3" />
            <line x1={cx + px * sc} y1={cy - py * sc} x2={cx - px * sc} y2={cy - py * sc} stroke="#10b981" strokeDasharray="3 3" />
            {pts.map((pt) => (
              <g key={pt.label}>
                <circle cx={cx + pt.x * sc} cy={cy - pt.y * sc} r={5} fill={pt.color} />
                <text x={cx + pt.x * sc + (pt.x >= 0 ? 8 : -8)} y={cy - pt.y * sc + (pt.y >= 0 ? -8 : 14)} textAnchor={pt.x >= 0 ? 'start' : 'end'} className="fill-slate-200 text-[10px] font-mono">
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>
        );
      }

      case 'g10_section_formula': {
        const m = params.m ?? 2;
        const n = params.n ?? 3;
        const x2 = params.x2 ?? 4;
        const y2 = params.y2 ?? -3;
        const ax = 76;
        const ay = 52;
        const bx = 260 + x2 * 18;
        const by = 130 - y2 * 10;
        const t = m / (m + n);
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={ax} y1={ay} x2={px} y2={py} stroke="#38bdf8" strokeWidth={3.2} />
            <line x1={px} y1={py} x2={bx} y2={by} stroke="#f59e0b" strokeWidth={3.2} />
            <circle cx={ax} cy={ay} r={5} fill="#38bdf8" />
            <circle cx={bx} cy={by} r={5} fill="#f59e0b" />
            <circle cx={px} cy={py} r={6} fill="#10b981" stroke="#f8fafc" strokeWidth={1.8} />
            <text x={ax} y={ay - 12} className="fill-sky-300 text-[11px] font-mono">A(−1, 7)</text>
            <text x={bx} y={by + 18} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono">B({x2}, {y2})</text>
            <text x={px + 10} y={py - 10} className="fill-emerald-300 text-[11px] font-mono font-semibold">
              P ({m}:{n})
            </text>
          </svg>
        );
      }

      case 'g10_similarity': {
        const k = params.k ?? 2;
        const s1 = 44;
        const s2 = clamp(s1 * k, 44, 150);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <polygon points={`58,176 ${58 + s1},176 ${58 + s1 * 0.4},${176 - s1 * 0.85}`} fill="rgba(56,189,248,0.25)" stroke="#38bdf8" strokeWidth={2} />
            <text x={58 + s1 / 2} y={194} textAnchor="middle" className="fill-sky-300 text-[10px] font-mono">△₁ (1×)</text>
            <polygon points={`185,176 ${185 + s2},176 ${185 + s2 * 0.4},${176 - s2 * 0.85}`} fill="rgba(16,185,129,0.24)" stroke="#10b981" strokeWidth={2.2} />
            <text x={185 + s2 / 2} y={194} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono font-semibold">
              △₂ (Sides {k}× · Area {(k * k).toFixed(2)}×)
            </text>
          </svg>
        );
      }

      case 'g10_loci': {
        const half = params.halfDist ?? 4;
        const yOff = params.pOffset ?? 3;
        const R = params.fixedR ?? 5;
        const cx = W / 2;
        const cy = H / 2;
        const sc = 16;
        const ax = cx - half * sc;
        const bx = cx + half * sc;
        const py = cy - yOff * sc;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={cx} y1={16} x2={cx} y2={H - 16} stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" />
            <circle cx={cx} cy={cy} r={R * sc} fill="none" stroke="#38bdf8" strokeWidth={1.6} strokeDasharray="4 3" />
            <line x1={ax} y1={cy} x2={bx} y2={cy} stroke="#94a3b8" strokeWidth={1.8} />
            <line x1={ax} y1={cy} x2={cx} y2={py} stroke="#f59e0b" strokeWidth={1.8} />
            <line x1={bx} y1={cy} x2={cx} y2={py} stroke="#f59e0b" strokeWidth={1.8} />
            <circle cx={ax} cy={cy} r={4.5} fill="#38bdf8" />
            <circle cx={bx} cy={cy} r={4.5} fill="#38bdf8" />
            <circle cx={cx} cy={py} r={5.5} fill="#10b981" />
            <text x={ax - 12} y={cy + 16} className="fill-sky-300 text-[10px] font-mono">A</text>
            <text x={bx + 6} y={cy + 16} className="fill-sky-300 text-[10px] font-mono">B</text>
            <text x={cx + 8} y={py - 6} className="fill-emerald-300 text-[10px] font-mono font-semibold">P (PA = PB)</text>
          </svg>
        );
      }

      case 'g10_circles_tangents': {
        const theta = params.theta ?? 52;
        const cx = W / 2;
        const cy = 108;
        const R = 74;
        const halfCentral = (theta * Math.PI) / 180;
        const ax = cx - R * Math.sin(halfCentral);
        const ay = cy + R * Math.cos(halfCentral);
        const bx = cx + R * Math.sin(halfCentral);
        const by = cy + R * Math.cos(halfCentral);
        const topX = cx;
        const topY = cy - R;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <circle cx={cx} cy={cy} r={R} fill="rgba(14,165,233,0.10)" stroke="#38bdf8" strokeWidth={2} />
            {/* Inscribed angle at top */}
            <polygon points={`${topX},${topY} ${ax},${ay} ${bx},${by}`} fill="rgba(16,185,129,0.14)" stroke="#10b981" strokeWidth={2} />
            {/* Central angle */}
            <polyline points={`${ax},${ay} ${cx},${cy} ${bx},${by}`} fill="none" stroke="#f59e0b" strokeWidth={2.2} />
            {/* Tangent at bottom point */}
            <line x1={cx - 110} y1={cy + R} x2={cx + 110} y2={cy + R} stroke="#a78bfa" strokeWidth={1.8} strokeDasharray="4 3" />
            <circle cx={cx} cy={cy} r={3.5} fill="#f8fafc" />
            <text x={topX} y={topY - 8} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono font-semibold">θ = {theta}°</text>
            <rect x={cx - 38} y={cy + 18} width={76} height={18} rx={4} fill="rgba(15,23,42,0.88)" stroke="rgba(245,158,11,0.45)" strokeWidth={1} />
            <text x={cx} y={cy + 31} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono font-semibold">2θ = {2 * theta}°</text>
            <text x={cx + 96} y={cy + R - 6} className="fill-violet-300 text-[10px] font-mono">Tangent</text>
          </svg>
        );
      }

      case 'g10_mensuration_recast': {
        const R = params.sphereR ?? 6;
        const r = Math.max(1, params.coneR ?? 12);
        const h = (4 * R * R * R) / (r * r);
        const srPx = clamp(R * 6, 18, 56);
        const crPx = clamp(r * 4.2, 20, 62);
        const chPx = clamp(h * 4.5, 28, 126);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <circle cx={116} cy={112} r={srPx} fill="rgba(245,158,11,0.32)" stroke="#f59e0b" strokeWidth={2} />
            <text x={116} y={188} textAnchor="middle" className="fill-amber-300 text-[11px] font-mono">Sphere R = {R} cm</text>
            <text x={212} y={116} textAnchor="middle" className="fill-slate-400 text-lg font-mono">→</text>
            <polygon points={`${320 - crPx},168 ${320 + crPx},168 320,${168 - chPx}`} fill="rgba(56,189,248,0.28)" stroke="#38bdf8" strokeWidth={2} />
            <ellipse cx={320} cy={168} rx={crPx} ry={10} fill="rgba(56,189,248,0.35)" stroke="#38bdf8" strokeWidth={1.6} />
            <text x={320} y={194} textAnchor="middle" className="fill-sky-300 text-[11px] font-mono">
              Cone r={r}, h={h.toFixed(1)} cm
            </text>
          </svg>
        );
      }

      case 'g10_heights_distances': {
        const h = params.height ?? 120;
        const aDeg = Math.min((params.nearAngle ?? 45) - 5, params.farAngle ?? 30);
        const bDeg = Math.max(aDeg + 5, params.nearAngle ?? 45);
        const dNear = h / Math.tan((bDeg * Math.PI) / 180);
        const dFar = h / Math.tan((aDeg * Math.PI) / 180);
        const cliffX = 64;
        const seaY = 176;
        const topY = clamp(seaY - h * 0.65, 34, 130);
        const scX = 310 / Math.max(dFar, 80);
        const xNear = cliffX + dNear * scX;
        const xFar = cliffX + dFar * scX;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={30} y1={seaY} x2={W - 22} y2={seaY} stroke="#0284c7" strokeWidth={2} />
            <line x1={cliffX} y1={topY} x2={cliffX} y2={seaY} stroke="#e2e8f0" strokeWidth={3.2} />
            <line x1={cliffX} y1={topY} x2={xNear} y2={seaY} stroke="#10b981" strokeWidth={2} />
            <line x1={cliffX} y1={topY} x2={xFar} y2={seaY} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" />
            <circle cx={xNear} cy={seaY} r={4.5} fill="#10b981" />
            <circle cx={xFar} cy={seaY} r={4.5} fill="#f59e0b" />
            <text x={cliffX - 10} y={(topY + seaY) / 2} textAnchor="end" className="fill-slate-200 text-[10px] font-mono">h={h}m</text>
            <text x={xNear} y={seaY + 18} textAnchor="middle" className="fill-emerald-300 text-[10px] font-mono">β={bDeg}°</text>
            <text x={xFar} y={seaY + 18} textAnchor="middle" className="fill-amber-300 text-[10px] font-mono">α={aDeg}°</text>
            <text x={(xNear + xFar) / 2} y={seaY - 8} textAnchor="middle" className="fill-sky-300 text-[10px] font-mono font-semibold">
              d = {(dFar - dNear).toFixed(1)}m
            </text>
          </svg>
        );
      }

      case 'g10_ogive_probability': {
        const target = Math.max(2, Math.min(12, Math.round(params.targetSum ?? 7)));
        const sums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52 sm:h-56" role="img" aria-label={sim.simTitle}>
            <line x1={32} y1={176} x2={W - 24} y2={176} stroke="#475569" strokeWidth={1.4} />
            {sums.map((s, i) => {
              const ways = 6 - Math.abs(7 - s);
              const barH = (ways / 6) * 124;
              const x = 40 + i * 34;
              const active = s === target;
              return (
                <g key={s}>
                  <rect
                    x={x}
                    y={176 - barH}
                    width={24}
                    height={barH}
                    rx={4}
                    fill={active ? 'rgba(16,185,129,0.65)' : 'rgba(56,189,248,0.28)'}
                    stroke={active ? '#10b981' : '#38bdf8'}
                    strokeWidth={1.6}
                  />
                  <text x={x + 12} y={176 - barH - 5} textAnchor="middle" className="fill-slate-300 text-[9px] font-mono">{ways}/36</text>
                  <text x={x + 12} y={194} textAnchor="middle" className={active ? 'fill-emerald-300 text-[10px] font-mono font-bold' : 'fill-slate-400 text-[10px] font-mono'}>
                    {s}
                  </text>
                </g>
              );
            })}
            <text x={W / 2} y={24} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono">
              Two-Dice Probability Distribution (n(S) = 36)
            </text>
          </svg>
        );
      }
    }
  };

  return (
    <div
      data-testid={`chapter-sim-canvas-${sim.id}`}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950/95 text-slate-100 p-4 space-y-4"
    >
      {/* Headline + Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="text-xs font-mono font-semibold text-sky-300">{metrics.headline}</div>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors"
        >
          Reset Defaults
        </button>
      </div>

      {/* Interactive SVG Stage */}
      <div className="rounded-lg bg-slate-900/80 border border-slate-800/80 p-2 overflow-hidden">
        {renderVisualSvg()}
      </div>

      {/* Live Mathematical Readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {metrics.readouts.map((r) => {
          const colorCls =
            r.accent === 'emerald'
              ? 'text-emerald-300'
              : r.accent === 'amber'
                ? 'text-amber-300'
                : r.accent === 'rose'
                  ? 'text-rose-300'
                  : 'text-sky-300';
          return (
            <div
              key={r.label}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
            >
              <div className="text-[10px] text-slate-400">{r.label}</div>
              <div className={`text-xs font-mono font-semibold mt-0.5 ${colorCls}`}>{r.value}</div>
            </div>
          );
        })}
      </div>

      {/* Presets */}
      {sim.presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Exam Presets:</span>
          {sim.presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApplyPreset(preset.params)}
              className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-900 hover:border-sky-500/60 text-[11px] font-mono text-slate-200 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {sim.controls.map((ctrl) => {
          const val = params[ctrl.key] ?? sim.defaultParams[ctrl.key] ?? ctrl.min;
          return (
            <label
              key={ctrl.key}
              className="block rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 font-medium">{ctrl.label}</span>
                <span className="font-mono text-sky-300 font-semibold">
                  {ctrl.unit === '₹' ? `₹${val}` : `${val}${ctrl.unit ? ` ${ctrl.unit}` : ''}`}
                </span>
              </div>
              <input
                type="range"
                aria-label={ctrl.label}
                min={ctrl.min}
                max={ctrl.max}
                step={ctrl.step}
                value={val}
                onChange={(e) => onChangeParam(ctrl.key, Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
};
