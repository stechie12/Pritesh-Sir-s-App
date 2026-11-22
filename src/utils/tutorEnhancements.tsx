// Modular Client-Side Enhancements for Pritesh Sir's Maths App!
// Covers: IndexedDB + Partition-Safe Storage Cache, Natural Math TTS Formatter,
// Client-Side Offscreen Image Compression, Cross-Origin Safe Clipboard,
// HTTPS Citation Sanitizer, Angle Converter, Mistake Spotter, and Interactive SVG Visualizers.

import React from 'react';

// #100: Partition-safe localStorage wrapper (handles Safari ITP, Brave, and Edge Strict Tracking Prevention)
const memoryFallbackStore = new Map<string, string>();

export function safeStorageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Partitioned or blocked storage in cross-origin iframe
  }
  return memoryFallbackStore.get(key) ?? null;
}

export function safeStorageSet(key: string, value: string): void {
  memoryFallbackStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore quota or SecurityError in strict privacy mode
  }
}

// #53: IndexedDB Client-Side Response Cache for 0ms repeat lookups
const IDB_NAME = 'pritesh_sir_maths_cache_v1';
const IDB_STORE = 'responses';

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedTutorResponse<T>(cacheKey: string): Promise<T | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(cacheKey);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && typeof entry === 'object' && Date.now() - (entry.ts || 0) < 1000 * 60 * 30) {
          resolve(entry.payload as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedTutorResponse<T>(cacheKey: string, payload: T): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ ts: Date.now(), payload }, cacheKey);
  } catch {
    // Ignore IndexedDB write errors in private browsing
  }
}

// #82: Cross-origin iframe safe clipboard copy with textarea fallback
export async function copyTextSafely(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback for cross-origin iframes
  }
  try {
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  } catch {
    return false;
  }
  return false;
}

// #50: Strict HTTPS URL sanitizer for external web citations
export function sanitizeCitationUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

// #17: Convert LaTeX and symbolic math notation into natural spoken English for Text-to-Speech
export function formatMathForNaturalSpeech(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\$\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 divided by $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\\sin\b/g, 'sine ')
    .replace(/\\cos\b/g, 'cosine ')
    .replace(/\\tan\b/g, 'tangent ')
    .replace(/\\cot\b/g, 'cotangent ')
    .replace(/\\sec\b/g, 'secant ')
    .replace(/\\csc\b/g, 'cosecant ')
    .replace(/\bcosec\b/gi, 'cosecant ')
    .replace(/\bcot\b/gi, 'cotangent ')
    .replace(/\\theta\b|θ/g, ' theta ')
    .replace(/\\alpha\b|α/g, ' alpha ')
    .replace(/\\beta\b|β/g, ' beta ')
    .replace(/\\Delta\b|Δ/g, ' discriminant delta ')
    .replace(/\\pi\b|π/g, ' pi ')
    .replace(/\^\\circ|°/g, ' degrees ')
    .replace(/\^2|²/g, ' squared ')
    .replace(/\^3|³/g, ' cubed ')
    .replace(/\\pm|±/g, ' plus or minus ')
    .replace(/\\implies|⇒/g, ' implies ')
    .replace(/\\times|×/g, ' multiplied by ')
    .replace(/\\div|÷/g, ' divided by ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}|*_`#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// #63: Client-side offscreen canvas image resizer & compressor before base64 upload
export function compressImageFileToBase64(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Empty image data'));
        return;
      }
      const img = new Image();
      img.onerror = () => {
        const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        resolve({ base64: rawBase64, mimeType: file.type || 'image/png' });
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve({ base64: rawBase64, mimeType: file.type || 'image/png' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = compressedUrl.includes(',') ? compressedUrl.split(',')[1] : compressedUrl;
          resolve({ base64, mimeType: 'image/jpeg' });
        } catch {
          const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve({ base64: rawBase64, mimeType: file.type || 'image/png' });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// #20: Auto-classify a TutorMessage into a curriculum chapter for Notebook filtering
export function classifyMessageChapter(msg: {
  question: string;
  conceptTitle?: string;
  chatReply?: string;
}): 'Trigonometry' | 'Algebra' | 'Mensuration' | 'Commercial' | 'Calculus' | 'General' {
  const q = (msg.question || '').trim();
  const qLower = q.toLowerCase();
  if (
    !qLower ||
    /^(?:hi|hello|hey|hii+|yo|hola|namaste|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you|ok|okay|bye)[!?. ]*$/i.test(
      qLower
    )
  ) {
    return 'General';
  }
  const title =
    msg.conceptTitle && msg.conceptTitle !== 'AI Assistant' && !/interrupted/i.test(msg.conceptTitle)
      ? msg.conceptTitle
      : '';
  const combined = `${qLower} ${title.toLowerCase()}`;
  if (/\b(sin|cos|tan|cot|sec|cosec|csc|trigonometr|angle|elevation|depression|unit circle)\b/.test(combined)) {
    return 'Trigonometry';
  }
  if (/\b(differentiate|derivative|integral|integrate|limit|calculus|d\/dx)\b/.test(combined)) {
    return 'Calculus';
  }
  if (/\b(cone|sphere|cylinder|hemisphere|mensuration|volume|surface area|cuboid)\b/.test(combined)) {
    return 'Mensuration';
  }
  if (/\b(gst|banking|recurring deposit|dividend|shares|interest|tax|maturity)\b/.test(combined)) {
    return 'Commercial';
  }
  if (/\b(quadratic|parabola|vertex|equation|root|discriminant|matrix|matrices|ap|gp|progression|surd|factor|polynomial|solve|logarithm)\b|x\^2|x²/.test(combined)) {
    return 'Algebra';
  }
  return 'General';
}

// #22: Exact Degree <-> Radian & Standard Trig Ratio lookup helper
export function getTrigAngleInsight(degInput: number): {
  deg: number;
  radLatex: string;
  sinVal: string;
  cosVal: string;
  tanVal: string;
  cotVal: string;
} {
  const normalized = ((degInput % 360) + 360) % 360;
  const known: Record<
    number,
    { radLatex: string; sinVal: string; cosVal: string; tanVal: string; cotVal: string }
  > = {
    0: { radLatex: '0', sinVal: '0', cosVal: '1', tanVal: '0', cotVal: '\\text{Undefined}' },
    30: {
      radLatex: '\\frac{\\pi}{6}',
      sinVal: '\\frac{1}{2}',
      cosVal: '\\frac{\\sqrt{3}}{2}',
      tanVal: '\\frac{1}{\\sqrt{3}}',
      cotVal: '\\sqrt{3}',
    },
    45: {
      radLatex: '\\frac{\\pi}{4}',
      sinVal: '\\frac{1}{\\sqrt{2}}',
      cosVal: '\\frac{1}{\\sqrt{2}}',
      tanVal: '1',
      cotVal: '1',
    },
    60: {
      radLatex: '\\frac{\\pi}{3}',
      sinVal: '\\frac{\\sqrt{3}}{2}',
      cosVal: '\\frac{1}{2}',
      tanVal: '\\sqrt{3}',
      cotVal: '\\frac{1}{\\sqrt{3}}',
    },
    90: { radLatex: '\\frac{\\pi}{2}', sinVal: '1', cosVal: '0', tanVal: '\\text{Undefined}', cotVal: '0' },
    180: { radLatex: '\\pi', sinVal: '0', cosVal: '-1', tanVal: '0', cotVal: '\\text{Undefined}' },
    270: { radLatex: '\\frac{3\\pi}{2}', sinVal: '-1', cosVal: '0', tanVal: '\\text{Undefined}', cotVal: '0' },
  };

  if (known[normalized]) {
    return { deg: normalized, ...known[normalized] };
  }

  const rad = (normalized * Math.PI) / 180;
  const s = Math.sin(rad);
  const c = Math.cos(rad);
  return {
    deg: normalized,
    radLatex: `${(rad / Math.PI).toFixed(2)}\\pi`,
    sinVal: s.toFixed(4),
    cosVal: c.toFixed(4),
    tanVal: Math.abs(c) < 1e-9 ? '\\text{Undefined}' : (s / c).toFixed(4),
    cotVal: Math.abs(s) < 1e-9 ? '\\text{Undefined}' : (c / s).toFixed(4),
  };
}

// #3 & #4: Interactive Unit Circle & Right-Triangle SVG Visualizer Component for Trigonometry Answers
export const InteractiveTrigVisualizer: React.FC<{ initialAngleDeg?: number }> = React.memo(({
  initialAngleDeg = 30,
}) => {
  const [angleDeg, setAngleDeg] = React.useState<number>(initialAngleDeg);
  const rad = (angleDeg * Math.PI) / 180;
  const cosX = Math.cos(rad);
  const sinY = Math.sin(rad);
  const cx = 95;
  const cy = 95;
  const r = 68;
  const px = cx + r * cosX;
  const py = cy - r * sinY;
  const insight = getTrigAngleInsight(angleDeg);

  return (
    <div
      dir="ltr"
      className="my-3 rounded-2xl border border-sky-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-900 dark:text-white">
          Interactive Unit Circle &amp; Right-Triangle Visualizer (θ = {angleDeg}°)
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {[0, 30, 45, 60, 90].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAngleDeg(preset)}
              className={`px-2 py-0.5 rounded-md text-xs font-mono transition-colors ${
                angleDeg === preset
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-500/20'
              }`}
            >
              {preset}°
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="flex items-center justify-center">
          <svg
            viewBox="0 0 190 190"
            className="w-44 h-44 select-none"
            role="img"
            aria-label={`Unit circle showing angle ${angleDeg} degrees`}
          >
            {/* Axes */}
            <line x1="12" y1={cy} x2="178" y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={cx} y1="12" x2={cx} y2="178" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
            {/* Unit Circle */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.45" />
            {/* Adjacent (cos) leg */}
            <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#10b981" strokeWidth="2.5" />
            {/* Opposite (sin) leg */}
            <line x1={px} y1={cy} x2={px} y2={py} stroke="#f59e0b" strokeWidth="2.5" />
            {/* Hypotenuse (r = 1) */}
            <line x1={cx} y1={cy} x2={px} y2={py} stroke="#38bdf8" strokeWidth="2.5" />
            {/* Point on Unit Circle */}
            <circle cx={px} cy={py} r="4.5" fill="#38bdf8" />
            <text x={cx + 12} y={cy - 6} fontSize="10" fill="#94a3b8" fontFamily="monospace">
              θ={angleDeg}°
            </text>
          </svg>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Radians:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {angleDeg}° = {(angleDeg * Math.PI / 180).toFixed(3)} rad
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
            <span className="text-amber-500">sin({angleDeg}°) [Opp/Hyp]:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{sinY.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
            <span className="text-emerald-500">cos({angleDeg}°) [Adj/Hyp]:</span>
            <span className="text-slate-900 dark:text-white font-semibold">{cosX.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
            <span className="text-sky-500">tan({angleDeg}°) [sin/cos]:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {Math.abs(cosX) < 1e-7 ? 'Undefined (∞)' : (sinY / cosX).toFixed(4)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-purple-400">cot({angleDeg}°) [cos/sin]:</span>
            <span className="text-slate-900 dark:text-white font-semibold">
              {Math.abs(sinY) < 1e-7
                ? 'Undefined (∞)'
                : `${(cosX / sinY).toFixed(4)} (Exact: ${insight.cotVal
                    .replace(/\\frac\{([^}]+)\}\{\\sqrt\{([^}]+)\}\}/g, '$1/√$2')
                    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
                    .replace(/\\text\{([^}]+)\}/g, '$1')
                    .replace(/\\/g, '')})`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <label htmlFor="unit-circle-slider" className="text-[11px] font-mono text-slate-500 shrink-0">
          Scrub Angle (0°–180°):
        </label>
        <input
          id="unit-circle-slider"
          type="range"
          min={0}
          max={180}
          step={1}
          value={angleDeg}
          onChange={(e) => setAngleDeg(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </div>
    </div>
  );
});

// #8: Interactive 2D Quadratic Parabola SVG Plotter when quadratic equations are solved
export const InteractiveQuadraticPlotter: React.FC<{ a: number; b: number; c: number }> = React.memo(({
  a,
  b,
  c,
}) => {
  const width = 280;
  const height = 160;
  const cx = width / 2;
  const cy = height / 2 + 15;
  const scaleX = 18;
  const scaleY = 10;

  const points: string[] = [];
  for (let px = 0; px <= width; px += 3) {
    const x = (px - cx) / scaleX;
    const y = a * x * x + b * x + c;
    const py = cy - y * scaleY;
    if (py >= -30 && py <= height + 30) {
      points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const disc = b * b - 4 * a * c;

  return (
    <div
      dir="ltr"
      className="my-3 rounded-2xl border border-emerald-500/25 bg-slate-50/90 dark:bg-slate-950/80 p-3.5 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-900 dark:text-white">
          2D Function Graph: y = {a === 1 ? '' : a === -1 ? '-' : a}x² {b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`}x{' '}
          {c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`}
        </span>
        <span className="font-mono text-[11px] text-emerald-500">
          Vertex: ({vertexX.toFixed(2)}, {vertexY.toFixed(2)}) · Δ = {disc.toFixed(1)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        role="img"
        aria-label="Quadratic function graph"
      >
        <line x1={0} y1={cy} x2={width} y2={cy} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={cx} y1={0} x2={cx} y2={height} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
        {points.length > 1 && (
          <polyline fill="none" stroke="#10b981" strokeWidth="2.2" points={points.join(' ')} />
        )}
        <circle
          cx={cx + vertexX * scaleX}
          cy={cy - vertexY * scaleY}
          r="4"
          fill="#38bdf8"
        />
      </svg>
    </div>
  );
});
