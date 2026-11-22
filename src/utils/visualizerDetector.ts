export type InlineVisualizerSpec =
  | { kind: 'trig'; initialAngleDeg: number }
  | { kind: 'quadratic'; a: number; b: number; c: number }
  | { kind: 'coordinate'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; initialAngleDeg: number; radius: number }
  | { kind: 'compound_interest'; principal: number; rate: number; years: number }
  | { kind: 'calculus'; preset: 'x2' | 'x3' | 'sin'; initialX: number }
  | { kind: 'progression'; mode: 'AP' | 'GP'; a: number; step: number; n: number }
  | { kind: 'mensuration'; shape: 'cylinder' | 'cone' | 'sphere'; radius: number; height: number };

export type SimulationCategory =
  | 'Geometry & Trig'
  | 'Algebra & Calculus'
  | 'Commercial & Solids';

export interface SimulationPreset {
  label: string;
  spec: InlineVisualizerSpec;
}

export interface SimulationCatalogEntry {
  id: InlineVisualizerSpec['kind'];
  title: string;
  shortTitle: string;
  category: SimulationCategory;
  grades: string;
  description: string;
  keyFormulas: string[];
  examTip: string;
  defaultSpec: InlineVisualizerSpec;
  presets: SimulationPreset[];
  askPrompt: string;
}

export const SIMULATION_CATALOG: SimulationCatalogEntry[] = [
  {
    id: 'trig',
    title: 'Unit Circle & Right-Triangle Trig',
    shortTitle: 'Unit Circle Trig',
    category: 'Geometry & Trig',
    grades: 'Std 9–12',
    description:
      'Scrub any angle from 0° to 180° to inspect exact sin, cos, tan, and cot values on the live unit circle and right triangle.',
    keyFormulas: [
      '\\sin\\theta = \\frac{\\text{Opp}}{\\text{Hyp}},\\; \\cos\\theta = \\frac{\\text{Adj}}{\\text{Hyp}},\\; \\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}',
      '\\sin^2\\theta + \\cos^2\\theta = 1',
    ],
    examTip: 'Remember tan 90° and sec 90° are undefined because cos 90° = 0 in the denominator.',
    defaultSpec: { kind: 'trig', initialAngleDeg: 30 },
    presets: [
      { label: '30° Standard', spec: { kind: 'trig', initialAngleDeg: 30 } },
      { label: '45° Isosceles', spec: { kind: 'trig', initialAngleDeg: 45 } },
      { label: '60° Standard', spec: { kind: 'trig', initialAngleDeg: 60 } },
      { label: '90° Limit', spec: { kind: 'trig', initialAngleDeg: 90 } },
    ],
    askPrompt: 'Explain how the unit circle gives exact sin, cos, and tan values for 30°, 45°, and 60°',
  },
  {
    id: 'quadratic',
    title: 'Quadratic Parabola & Discriminant',
    shortTitle: 'Quadratic Parabola',
    category: 'Algebra & Calculus',
    grades: 'Std 9–11',
    description:
      'Adjust coefficients a, b, and c to watch the parabola shift, track the vertex (h, k), and see how Δ = b² − 4ac controls real vs. complex roots.',
    keyFormulas: [
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      '\\Delta = b^2 - 4ac,\\quad h = -\\frac{b}{2a}',
    ],
    examTip: 'When Δ > 0 the parabola crosses the x-axis twice; when Δ = 0 it touches tangentially at the vertex.',
    defaultSpec: { kind: 'quadratic', a: 1, b: -4, c: 3 },
    presets: [
      { label: '2 Real Roots (x² − 4x + 3)', spec: { kind: 'quadratic', a: 1, b: -4, c: 3 } },
      { label: 'Equal Root (x² − 4x + 4)', spec: { kind: 'quadratic', a: 1, b: -4, c: 4 } },
      { label: 'Inverted (−x² + 2x + 3)', spec: { kind: 'quadratic', a: -1, b: 2, c: 3 } },
      { label: 'Complex Roots (x² + 2x + 5)', spec: { kind: 'quadratic', a: 1, b: 2, c: 5 } },
    ],
    askPrompt: 'Explain how the discriminant Δ = b² - 4ac determines the nature of roots of a quadratic equation',
  },
  {
    id: 'coordinate',
    title: 'Coordinate Geometry Plane',
    shortTitle: 'Coordinate Plane',
    category: 'Geometry & Trig',
    grades: 'Std 9–11',
    description:
      'Move points A(x₁, y₁) and B(x₂, y₂) on the Cartesian plane to compute live distance, midpoint, slope m, and line equation y = mx + c.',
    keyFormulas: [
      'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
      'm = \\frac{y_2 - y_1}{x_2 - x_1},\\quad M = \\left(\\frac{x_1+x_2}{2},\\, \\frac{y_1+y_2}{2}\\right)',
    ],
    examTip: 'Perpendicular lines satisfy m₁ · m₂ = −1, while parallel lines always share the exact same slope m.',
    defaultSpec: { kind: 'coordinate', x1: -2, y1: -1, x2: 4, y2: 3 },
    presets: [
      { label: '3-4-5 Triangle', spec: { kind: 'coordinate', x1: 0, y1: 0, x2: 3, y2: 4 } },
      { label: 'Negative Slope', spec: { kind: 'coordinate', x1: -3, y1: 4, x2: 3, y2: -2 } },
      { label: 'Horizontal Line', spec: { kind: 'coordinate', x1: -4, y1: 2, x2: 4, y2: 2 } },
    ],
    askPrompt: 'Derive the distance, midpoint, and slope formulas for two points A(x₁, y₁) and B(x₂, y₂)',
  },
  {
    id: 'circle',
    title: 'Circle Theorems Explorer',
    shortTitle: 'Circle Theorems',
    category: 'Geometry & Trig',
    grades: 'Std 9–10',
    description:
      'Explore the central vs. inscribed angle theorem (∠AOB = 2∠ACB), angle in a semicircle, chord length, arc length, and sector area.',
    keyFormulas: [
      '\\angle AOB = 2\\,\\angle ACB,\\quad \\text{Chord} = 2r\\sin\\!\\left(\\frac{\\theta}{2}\\right)',
      '\\text{Arc} = \\frac{\\theta}{360^\\circ}\\cdot 2\\pi r,\\quad \\text{Sector} = \\frac{\\theta}{360^\\circ}\\cdot \\pi r^2',
    ],
    examTip: 'Always check whether both angles stand on the exact same arc before applying the centre-angle theorem.',
    defaultSpec: { kind: 'circle', initialAngleDeg: 100, radius: 5 },
    presets: [
      { label: 'Central 100° → Inscribed 50°', spec: { kind: 'circle', initialAngleDeg: 100, radius: 5 } },
      { label: 'Semicircle (180° → 90°)', spec: { kind: 'circle', initialAngleDeg: 180, radius: 7 } },
      { label: 'Equilateral Chord (60°)', spec: { kind: 'circle', initialAngleDeg: 60, radius: 6 } },
    ],
    askPrompt: 'Prove that the angle subtended by an arc at the centre of a circle is double the angle at the remaining circumference',
  },
  {
    id: 'mensuration',
    title: '3D Mensuration Solids Lab',
    shortTitle: 'Mensuration Solids',
    category: 'Commercial & Solids',
    grades: 'Std 8–10',
    description:
      'Compare Cylinders, Cones (with slant height l = √(r² + h²)), and Spheres with live Curved Surface Area, Total Surface Area, and Volume.',
    keyFormulas: [
      'V_{\\text{cyl}} = \\pi r^2 h,\\quad V_{\\text{cone}} = \\tfrac{1}{3}\\pi r^2 h',
      'V_{\\text{sphere}} = \\tfrac{4}{3}\\pi r^3,\\quad \\text{CSA}_{\\text{cone}} = \\pi r\\sqrt{r^2 + h^2}',
    ],
    examTip: 'When a solid is melted and recast into another shape, total volume stays conserved—cancel π before multiplying.',
    defaultSpec: { kind: 'mensuration', shape: 'cylinder', radius: 5, height: 10 },
    presets: [
      { label: 'Cylinder (r=7, h=10)', spec: { kind: 'mensuration', shape: 'cylinder', radius: 7, height: 10 } },
      { label: 'Cone (r=6, h=8, l=10)', spec: { kind: 'mensuration', shape: 'cone', radius: 6, height: 8 } },
      { label: 'Sphere (r=7)', spec: { kind: 'mensuration', shape: 'sphere', radius: 7, height: 10 } },
    ],
    askPrompt: 'Compare the CSA, TSA, and Volume formulas of a cylinder, cone, and sphere with an ICSE example',
  },
  {
    id: 'compound_interest',
    title: 'Compound vs. Simple Interest Growth',
    shortTitle: 'Compound Interest',
    category: 'Commercial & Solids',
    grades: 'Std 8–10',
    description:
      'Vary Principal (P), annual rate (R%), and years (T) to visualize how exponential compounding pulls ahead of linear simple interest.',
    keyFormulas: [
      'A = P\\left(1 + \\frac{R}{100}\\right)^T,\\quad \\text{CI} = A - P',
      '\\text{SI} = \\frac{P \\cdot R \\cdot T}{100}',
    ],
    examTip: 'For half-yearly compounding, halve the annual rate (R/2) and double the number of periods (2T).',
    defaultSpec: { kind: 'compound_interest', principal: 10000, rate: 10, years: 5 },
    presets: [
      { label: '₹10,000 @ 10% · 5 yrs', spec: { kind: 'compound_interest', principal: 10000, rate: 10, years: 5 } },
      { label: '₹25,000 @ 8% · 10 yrs', spec: { kind: 'compound_interest', principal: 25000, rate: 8, years: 10 } },
      { label: 'High Growth @ 15% · 12 yrs', spec: { kind: 'compound_interest', principal: 15000, rate: 15, years: 12 } },
    ],
    askPrompt: 'Explain the difference between Simple Interest and Compound Interest with a step-by-step worked example',
  },
  {
    id: 'progression',
    title: 'AP & GP Sequences Visualizer',
    shortTitle: 'AP & GP Series',
    category: 'Algebra & Calculus',
    grades: 'Std 10–11',
    description:
      'Switch between Arithmetic and Geometric Progressions to watch each term aₙ grow and compute the exact nth term and partial sum Sₙ.',
    keyFormulas: [
      '\\text{AP: } a_n = a + (n-1)d,\\quad S_n = \\frac{n}{2}[2a + (n-1)d]',
      '\\text{GP: } a_n = a r^{n-1},\\quad S_n = a\\frac{r^n - 1}{r - 1}\\;(r \\neq 1)',
    ],
    examTip: 'Check consecutive differences (a₂ − a₁) for AP and consecutive ratios (a₂ / a₁) for GP before writing formulas.',
    defaultSpec: { kind: 'progression', mode: 'AP', a: 3, step: 4, n: 8 },
    presets: [
      { label: 'AP (a=3, d=4, n=8)', spec: { kind: 'progression', mode: 'AP', a: 3, step: 4, n: 8 } },
      { label: 'Decreasing AP (a=20, d=−3)', spec: { kind: 'progression', mode: 'AP', a: 20, step: -3, n: 8 } },
      { label: 'GP Doubling (a=2, r=2)', spec: { kind: 'progression', mode: 'GP', a: 2, step: 2, n: 6 } },
    ],
    askPrompt: 'Compare the nth term and sum of n terms formulas for Arithmetic Progression (AP) and Geometric Progression (GP)',
  },
  {
    id: 'calculus',
    title: 'Calculus Derivative & Tangent Line',
    shortTitle: 'Derivative & Tangent',
    category: 'Algebra & Calculus',
    grades: 'Std 11–12',
    description:
      'Slide x along y = x², y = x³, or y = sin(x) to watch the tangent line tilt and inspect the exact instantaneous derivative f′(x).',
    keyFormulas: [
      'f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}',
      '\\frac{d}{dx}(x^n) = n x^{n-1},\\quad \\frac{d}{dx}(\\sin x) = \\cos x',
    ],
    examTip: 'Where the tangent line is horizontal, f′(x) = 0 — marking a local maximum, minimum, or stationary point.',
    defaultSpec: { kind: 'calculus', preset: 'x2', initialX: 1 },
    presets: [
      { label: 'f(x) = x² at x = 1', spec: { kind: 'calculus', preset: 'x2', initialX: 1 } },
      { label: 'f(x) = x³ at x = −1', spec: { kind: 'calculus', preset: 'x3', initialX: -1 } },
      { label: 'f(x) = sin(x) at x = 0', spec: { kind: 'calculus', preset: 'sin', initialX: 0 } },
    ],
    askPrompt: 'Explain the geometric meaning of the derivative dy/dx as the slope of the tangent line to a curve',
  },
];

export const SIMULATION_CATEGORIES: Array<'All' | SimulationCategory> = [
  'All',
  'Geometry & Trig',
  'Algebra & Calculus',
  'Commercial & Solids',
];

export function filterSimulationCatalog(
  query: string,
  category: 'All' | SimulationCategory = 'All'
): SimulationCatalogEntry[] {
  const q = query.trim().toLowerCase();
  return SIMULATION_CATALOG.filter((entry) => {
    if (category !== 'All' && entry.category !== category) return false;
    if (!q) return true;
    const haystack = `${entry.title} ${entry.shortTitle} ${entry.category} ${entry.grades} ${entry.description} ${entry.examTip} ${entry.presets
      .map((p) => p.label)
      .join(' ')}`.toLowerCase();
    return haystack.includes(q);
  });
}

export interface VisualizerDetectInput {
  question: string;
  conceptTitle?: string;
  chatReply?: string;
  finalAnswer?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseFiniteNum(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const SIM_DIRECTIVE_REGEX = /\[\[SIM:([a-z_]+)([^\]]*)\]\]/gi;

/**
 * Parses an explicit AI-summoned simulation directive such as:
 *   [[SIM:quadratic a=1 b=-4 c=3]]
 *   [[SIM:trig angle=45]]
 *   [[SIM:mensuration shape=cone radius=6 height=8]]
 * Strips all [[SIM:...]] tags from the displayed reply text and returns the validated spec.
 */
export function parseAiVisualizerDirective(rawText: string): {
  cleanText: string;
  spec: InlineVisualizerSpec | null;
} {
  if (!rawText) return { cleanText: '', spec: null };

  let lastSpec: InlineVisualizerSpec | null = null;
  const matches = [...rawText.matchAll(SIM_DIRECTIVE_REGEX)];

  for (const match of matches) {
    const rawKind = (match[1] || '').toLowerCase();
    const rawAttrs = match[2] || '';
    const attrs: Record<string, string> = {};
    for (const pair of rawAttrs.matchAll(/([a-z0-9_]+)\s*=\s*([a-z0-9._-]+)/gi)) {
      attrs[pair[1].toLowerCase()] = pair[2];
    }

    switch (rawKind) {
      case 'trig':
      case 'trigonometry': {
        lastSpec = {
          kind: 'trig',
          initialAngleDeg: clamp(Math.round(parseFiniteNum(attrs.angle ?? attrs.deg, 30)), 0, 180),
        };
        break;
      }
      case 'quadratic':
      case 'parabola': {
        let a = clamp(parseFiniteNum(attrs.a, 1), -5, 5);
        if (Math.abs(a) < 0.1) a = 1;
        lastSpec = {
          kind: 'quadratic',
          a,
          b: clamp(parseFiniteNum(attrs.b, -4), -10, 10),
          c: clamp(parseFiniteNum(attrs.c, 3), -10, 10),
        };
        break;
      }
      case 'coordinate':
      case 'coord': {
        lastSpec = {
          kind: 'coordinate',
          x1: clamp(Math.round(parseFiniteNum(attrs.x1, -2)), -6, 6),
          y1: clamp(Math.round(parseFiniteNum(attrs.y1, -1)), -6, 6),
          x2: clamp(Math.round(parseFiniteNum(attrs.x2, 4)), -6, 6),
          y2: clamp(Math.round(parseFiniteNum(attrs.y2, 3)), -6, 6),
        };
        break;
      }
      case 'circle': {
        lastSpec = {
          kind: 'circle',
          initialAngleDeg: clamp(Math.round(parseFiniteNum(attrs.angle ?? attrs.deg, 100)), 20, 180),
          radius: clamp(parseFiniteNum(attrs.radius ?? attrs.r, 5), 2, 20),
        };
        break;
      }
      case 'compound_interest':
      case 'interest': {
        lastSpec = {
          kind: 'compound_interest',
          principal: clamp(Math.round(parseFiniteNum(attrs.principal ?? attrs.p, 10000)), 1000, 100000),
          rate: clamp(parseFiniteNum(attrs.rate ?? attrs.r, 10), 1, 25),
          years: clamp(Math.round(parseFiniteNum(attrs.years ?? attrs.t, 5)), 1, 15),
        };
        break;
      }
      case 'calculus':
      case 'derivative': {
        const rawPreset = (attrs.preset || attrs.fn || 'x2').toLowerCase();
        const preset: 'x2' | 'x3' | 'sin' =
          rawPreset === 'x3' || rawPreset === 'cubic'
            ? 'x3'
            : rawPreset === 'sin'
            ? 'sin'
            : 'x2';
        lastSpec = {
          kind: 'calculus',
          preset,
          initialX: clamp(parseFiniteNum(attrs.x ?? attrs.initialx, 1), -3, 3),
        };
        break;
      }
      case 'progression':
      case 'ap':
      case 'gp': {
        const mode: 'AP' | 'GP' =
          rawKind === 'gp' || (attrs.mode || '').toUpperCase() === 'GP' ? 'GP' : 'AP';
        lastSpec = {
          kind: 'progression',
          mode,
          a: clamp(parseFiniteNum(attrs.a, mode === 'GP' ? 2 : 3), -10, 20),
          step:
            mode === 'GP'
              ? clamp(parseFiniteNum(attrs.step ?? attrs.r, 2), 0.5, 4)
              : clamp(parseFiniteNum(attrs.step ?? attrs.d, 4), -10, 10),
          n: clamp(Math.round(parseFiniteNum(attrs.n, mode === 'GP' ? 6 : 8)), 3, 12),
        };
        break;
      }
      case 'mensuration':
      case 'solid':
      case 'solids': {
        const rawShape = (attrs.shape || 'cylinder').toLowerCase();
        const shape: 'cylinder' | 'cone' | 'sphere' =
          rawShape === 'cone' ? 'cone' : rawShape === 'sphere' ? 'sphere' : 'cylinder';
        lastSpec = {
          kind: 'mensuration',
          shape,
          radius: clamp(parseFiniteNum(attrs.radius ?? attrs.r, 5), 1, 15),
          height: clamp(parseFiniteNum(attrs.height ?? attrs.h, 10), 2, 20),
        };
        break;
      }
      default:
        break;
    }
  }

  const cleanText = rawText
    .replace(SIM_DIRECTIVE_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, spec: lastSpec };
}

/**
 * Validates an arbitrary JSON object (e.g., from API response or localStorage) as an InlineVisualizerSpec.
 */
export function sanitizeVisualizerSpec(raw: unknown): InlineVisualizerSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  switch (obj.kind) {
    case 'trig':
      return { kind: 'trig', initialAngleDeg: clamp(Number(obj.initialAngleDeg ?? 30) || 30, 0, 180) };
    case 'quadratic': {
      const a = clamp(Number(obj.a ?? 1) || 1, -5, 5);
      return {
        kind: 'quadratic',
        a: Math.abs(a) < 0.1 ? 1 : a,
        b: clamp(Number(obj.b ?? -4) || 0, -10, 10),
        c: clamp(Number(obj.c ?? 3) || 0, -10, 10),
      };
    }
    case 'coordinate':
      return {
        kind: 'coordinate',
        x1: clamp(Math.round(Number(obj.x1 ?? -2) || 0), -6, 6),
        y1: clamp(Math.round(Number(obj.y1 ?? -1) || 0), -6, 6),
        x2: clamp(Math.round(Number(obj.x2 ?? 4) || 0), -6, 6),
        y2: clamp(Math.round(Number(obj.y2 ?? 3) || 0), -6, 6),
      };
    case 'circle':
      return {
        kind: 'circle',
        initialAngleDeg: clamp(Math.round(Number(obj.initialAngleDeg ?? 100) || 100), 20, 180),
        radius: clamp(Number(obj.radius ?? 5) || 5, 2, 20),
      };
    case 'compound_interest':
      return {
        kind: 'compound_interest',
        principal: clamp(Math.round(Number(obj.principal ?? 10000) || 10000), 1000, 100000),
        rate: clamp(Number(obj.rate ?? 10) || 10, 1, 25),
        years: clamp(Math.round(Number(obj.years ?? 5) || 5), 1, 15),
      };
    case 'calculus': {
      const preset = obj.preset === 'x3' || obj.preset === 'sin' ? obj.preset : 'x2';
      return {
        kind: 'calculus',
        preset,
        initialX: clamp(Number(obj.initialX ?? 1) || 0, -3, 3),
      };
    }
    case 'progression': {
      const mode = obj.mode === 'GP' ? 'GP' : 'AP';
      return {
        kind: 'progression',
        mode,
        a: clamp(Number(obj.a ?? (mode === 'GP' ? 2 : 3)) || 1, -10, 20),
        step:
          mode === 'GP'
            ? clamp(Number(obj.step ?? 2) || 2, 0.5, 4)
            : clamp(Number(obj.step ?? 4) || 1, -10, 10),
        n: clamp(Math.round(Number(obj.n ?? (mode === 'GP' ? 6 : 8)) || 6), 3, 12),
      };
    }
    case 'mensuration': {
      const shape = obj.shape === 'cone' || obj.shape === 'sphere' ? obj.shape : 'cylinder';
      return {
        kind: 'mensuration',
        shape,
        radius: clamp(Number(obj.radius ?? 5) || 5, 1, 15),
        height: clamp(Number(obj.height ?? 10) || 10, 2, 20),
      };
    }
    default:
      return null;
  }
}

const GREETING_ONLY_REGEX =
  /^(?:hi|hello|hey|hii+|yo|hola|namaste|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|thanks|thank\s+you|ok|okay|bye)[!?. ]*$/i;

/**
 * Strict question-only detector used strictly for deterministic local math computations
 * (NEVER scans chatReply text, so greetings or general AI replies mentioning topics never spawn unwanted simulations).
 */
export function detectInlineVisualizerSpec(
  msg: VisualizerDetectInput
): InlineVisualizerSpec | null {
  const q = (msg.question || '').trim();
  if (!q || GREETING_ONLY_REGEX.test(q)) {
    return null;
  }

  // Strictly inspect the student's question (never msg.chatReply!)
  const qLower = q.toLowerCase();

  // 1. Explicit Quadratic Equation (ax^2 + bx + c)
  const normalizedQ = q.replace(/−/g, '-').replace(/²/g, '^2');
  const quadMatch = normalizedQ.match(/([+-]?\s*\d*)\s*x\^2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d+)/i);
  if (quadMatch) {
    const aRaw = quadMatch[1].replace(/\s+/g, '');
    const bRaw = quadMatch[2].replace(/\s+/g, '');
    const cRaw = quadMatch[3].replace(/\s+/g, '');
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
    const b = bRaw === '+' ? 1 : bRaw === '-' ? -1 : Number(bRaw);
    const c = Number(cRaw);
    if (!Number.isNaN(a) && a !== 0 && !Number.isNaN(b) && !Number.isNaN(c)) {
      return {
        kind: 'quadratic',
        a: clamp(a, -5, 5),
        b: clamp(b, -10, 10),
        c: clamp(c, -10, 10),
      };
    }
  }

  // 2. Calculus (Derivatives, Tangents, Integrals, Limits) — check before Trig in case of d/dx sin(x)
  if (/\b(differentiate|derivative|dy\/dx|d\/dx|tangent line|integral|integrate|calculus|slope of curve)\b/i.test(qLower)) {
    const preset: 'x2' | 'x3' | 'sin' = /\bsin\b/i.test(qLower)
      ? 'sin'
      : /x\^?3|x³|cubic/i.test(qLower)
      ? 'x3'
      : 'x2';
    const xMatch = q.match(/\bat\s+x\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const initialX = xMatch ? clamp(Number(xMatch[1]), -3, 3) : 1;
    return { kind: 'calculus', preset, initialX };
  }

  // 3. Coordinate Geometry (2 points, distance, midpoint, slope, equation of line)
  const twoPointsMatch = q.match(
    /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)[\s\S]{0,40}\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/
  );
  if (
    twoPointsMatch ||
    /\b(coordinate geometry|distance formula|midpoint|section formula|slope of|equation of (?:the )?line|y\s*=\s*mx\s*\+\s*c|collinear)\b/i.test(
      qLower
    )
  ) {
    const x1 = twoPointsMatch ? clamp(Math.round(Number(twoPointsMatch[1])), -6, 6) : -2;
    const y1 = twoPointsMatch ? clamp(Math.round(Number(twoPointsMatch[2])), -6, 6) : -1;
    const x2 = twoPointsMatch ? clamp(Math.round(Number(twoPointsMatch[3])), -6, 6) : 4;
    const y2 = twoPointsMatch ? clamp(Math.round(Number(twoPointsMatch[4])), -6, 6) : 3;
    return { kind: 'coordinate', x1, y1, x2, y2 };
  }

  // 4. Compound / Simple Interest & Growth
  if (/\b(compound interest|simple interest|compounded|principal|maturity|exponential growth)\b/i.test(qLower)) {
    const pMatch = q.match(/(?:p\s*=\s*|principal\s*(?:is|of|=)?\s*|on\s+)(?:rs\.?|₹|\$)?\s*(\d{3,6})/i);
    const rMatch = q.match(/(?:r\s*=\s*|at\s+|rate\s*(?:is|of|=)?\s*)(\d+(?:\.\d+)?)\s*%?/i);
    const tMatch = q.match(/(?:t\s*=\s*|for\s+)(\d+)\s*(?:years?|yrs?)/i);
    return {
      kind: 'compound_interest',
      principal: pMatch ? clamp(Number(pMatch[1]), 1000, 100000) : 10000,
      rate: rMatch ? clamp(Number(rMatch[1]), 1, 25) : 10,
      years: tMatch ? clamp(Number(tMatch[1]), 1, 15) : 5,
    };
  }

  // 5. Arithmetic / Geometric Progressions (AP / GP)
  if (
    /\b(arithmetic progression|geometric progression|common difference|common ratio|nth term|sum of (?:first )?n terms)\b/i.test(
      qLower
    ) ||
    /\b(a\.?p\.?|g\.?p\.?)\b/i.test(qLower)
  ) {
    const isGP = /\b(geometric|g\.?p\.?|common ratio|\br\s*=)/i.test(qLower);
    const aMatch = q.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const dMatch = q.match(/\bd\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const rMatch = q.match(/\br\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const nMatch = q.match(/\bn\s*=\s*(\d+)/i);
    return {
      kind: 'progression',
      mode: isGP ? 'GP' : 'AP',
      a: aMatch ? clamp(Number(aMatch[1]), -10, 20) : isGP ? 2 : 3,
      step: isGP
        ? rMatch
          ? clamp(Number(rMatch[1]), 0.5, 4)
          : 2
        : dMatch
        ? clamp(Number(dMatch[1]), -10, 10)
        : 4,
      n: nMatch ? clamp(Number(nMatch[1]), 3, 12) : isGP ? 6 : 8,
    };
  }

  // 6. Mensuration 3D Solids (Cylinder, Cone, Sphere, Hemisphere)
  if (
    /\b(cylinder|cone|sphere|hemisphere|mensuration|curved surface area|total surface area|slant height|volume of a)\b/i.test(
      qLower
    )
  ) {
    const shape: 'cylinder' | 'cone' | 'sphere' = /\b(sphere|hemisphere)\b/i.test(qLower)
      ? 'sphere'
      : /\bcone\b/i.test(qLower)
      ? 'cone'
      : 'cylinder';
    const rMatch = q.match(/(?:radius|r)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/i);
    const hMatch = q.match(/(?:height|h)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/i);
    return {
      kind: 'mensuration',
      shape,
      radius: rMatch ? clamp(Number(rMatch[1]), 1, 15) : 5,
      height: hMatch ? clamp(Number(hMatch[1]), 2, 20) : 10,
    };
  }

  // 7. Circle Theorems
  if (
    /\b(circle theorem|chord|inscribed angle|central angle|cyclic quadrilateral|semicircle|tangent to a circle|circumference|arc length|sector area)\b/i.test(
      qLower
    )
  ) {
    const angMatch = q.match(/\b(\d{2,3})\s*(?:°|deg)/i);
    const rMatch = q.match(/(?:radius|r)\s*(?:=|of|is)?\s*(\d+(?:\.\d+)?)/i);
    return {
      kind: 'circle',
      initialAngleDeg: angMatch ? clamp(Number(angMatch[1]), 20, 180) : 100,
      radius: rMatch ? clamp(Number(rMatch[1]), 2, 20) : 5,
    };
  }

  // 8. General Quadratic / Parabola
  if (/\b(quadratic|parabola|discriminant|vertex of|nature of roots)\b/i.test(qLower)) {
    return { kind: 'quadratic', a: 1, b: -4, c: 3 };
  }

  // 9. Trigonometry
  if (/\b(sin|cos|tan|cot|sec|cosec|csc|trigonometr|unit circle|soh-cah-toa|elevation|depression)\b/i.test(qLower)) {
    const angleMatch = q.match(/\b(0|30|45|60|90|120|135|150|180)\b/);
    return { kind: 'trig', initialAngleDeg: angleMatch ? Number(angleMatch[1]) : 30 };
  }

  return null;
}
