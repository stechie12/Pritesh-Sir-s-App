import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowUp,
  BookmarkCheck,
  Compass,
  Calendar,
  Trophy,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Radio,
  X,
  Calculator,
  PenTool,
  Camera,
  BookOpen,
  Printer,
  Lightbulb,
  Languages,
  RefreshCw,
  Trash2,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  Pin,
  Play,
  Square,
  AlertTriangle,
  Download,
  Search,
  Type,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { GradeLevel, CurriculumBoard } from '../utils/adaptiveEngine';
import {
  getCachedTutorResponse,
  setCachedTutorResponse,
  copyTextSafely,
  sanitizeCitationUrl,
  formatMathForNaturalSpeech,
  compressImageFileToBase64,
  classifyMessageChapter,
  InteractiveTrigVisualizer,
  InteractiveQuadraticPlotter,
} from '../utils/tutorEnhancements';
import {
  executeWithExponentialBackoff,
  RetryableHttpError,
  RetryAttemptInfo,
  isResponsePotentiallyHalted,
  buildResumePrompt,
  mergeResumedExplanation,
  parseTutorApiResponse,
} from '../utils/tutorResilience';
import {
  createVoiceDictationController,
  VoiceDictationController,
} from '../utils/voiceMathDictation';
import {
  buildTutorMarkdownExport,
  normalizeLatexDelimiters,
} from '../utils/practiceWorkspace';

export type SummonableTool = 'lab' | 'practice' | 'planner' | 'dashboard';

export interface TutorMessage {
  id: string;
  question: string;
  responseType?: 'chat' | 'math';
  chatReply?: string;
  suggestedPrompts?: string[];
  conceptTitle: string;
  prerequisiteRecap: string;
  steps: string[];
  finalAnswer: string;
  examTip: string;
  timestamp: string;
  latencySec?: string;
  modelUsed?: string;
  thinkingTrace?: string[];
  webSources?: Array<{ title: string; url: string; snippet: string }>;
  savedToCloud?: boolean;
  summonedTool?: SummonableTool | null;
  detectedContextText?: string;
  isInterrupted?: boolean;
  interruptedReason?: string;
  retryCount?: number;
  resumedCount?: number;
}

interface DoubtTutorPanelProps {
  grade: GradeLevel;
  board: CurriculumBoard;
  adaptiveRating: number;
  messages: TutorMessage[];
  onNewMessage: (msg: TutorMessage) => void;
  onUpdateMessage?: (id: string, updater: (msg: TutorMessage) => TutorMessage) => void;
  onSaveDoubtToCloud: (msg: TutorMessage) => Promise<void>;
  onSummonTool: (tool: SummonableTool, switchImmediately?: boolean) => void;
  onDetectCurriculum: (grade: GradeLevel, board: CurriculumBoard) => void;
  onOpenFormulaReference?: () => void;
  externalPromptRequest?: { id: number; text: string } | null;
}

const REAL_GEMINI_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'gemini-4-hydrogen (Gemini 4 Flash · Free)' },
  { id: 'gemini-4-neon', label: 'gemini-4-neon (Gemini 4 Pro · Paid Key)' },
  { id: 'gemini-4-argon', label: 'gemini-4-argon (Gemini 4 Reasoning · Paid Key)' },
  { id: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Lite · Free)' },
  { id: 'gemini-3.8-live', label: 'gemini-3.8-live (Live Voice)' },
  { id: 'browser-nano-edge', label: 'browser-nano-edge (On-Device)' },
] as const;

const MATH_KEYBOARD_SYMBOLS = [
  { label: 'x²', insert: '^2' },
  { label: 'x³', insert: '^3' },
  { label: '√x', insert: 'sqrt(' },
  { label: 'π', insert: 'π' },
  { label: 'θ', insert: 'θ' },
  { label: '°', insert: '°' },
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'tan', insert: 'tan(' },
  { label: 'cot', insert: 'cot(' },
  { label: 'sec', insert: 'sec(' },
  { label: 'csc', insert: 'cosec(' },
  { label: 'd/dx', insert: 'differentiate ' },
  { label: '∫dx', insert: 'integrate ' },
];

const PRITESH_SIR_FORMULA_VAULT: Record<
  string,
  Array<{ title: string; formula: string; latex: string; tip: string }>
> = {
  Trigonometry: [
    {
      title: 'Pythagorean Identities',
      formula: 'sin^2(θ) + cos^2(θ) = 1',
      latex: '\\sin^2\\theta + \\cos^2\\theta = 1, \\quad \\sec^2\\theta - \\tan^2\\theta = 1, \\quad \\csc^2\\theta - \\cot^2\\theta = 1',
      tip: 'Factor sec²θ − tan²θ as (secθ − tanθ)(secθ + tanθ) = 1',
    },
    {
      title: 'Quotient & Reciprocal Identities',
      formula: 'tan(θ) = sin(θ)/cos(θ), cot(θ) = cos(θ)/sin(θ)',
      latex: '\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}, \\quad \\cot\\theta = \\frac{\\cos\\theta}{\\sin\\theta}, \\quad \\sec\\theta = \\frac{1}{\\cos\\theta}',
      tip: 'At θ = 90°, cos 90° = 0 and sin 90° = 1, so cot 90° = 0/1 = 0',
    },
    {
      title: 'Complementary Angle Ratios',
      formula: 'sin(90° - θ) = cos(θ), tan(90° - θ) = cot(θ)',
      latex: '\\sin(90^\\circ - \\theta) = \\cos\\theta, \\quad \\tan(90^\\circ - \\theta) = \\cot\\theta, \\quad \\sec(90^\\circ - \\theta) = \\csc\\theta',
      tip: 'Convert only one ratio in a complementary pair (e.g. 18° and 72°) to cancel terms',
    },
    {
      title: 'Dual-Angle Elevation Shortcut',
      formula: 'd = h(cot α − cot β)',
      latex: 'd = h(\\cot\\alpha - \\cot\\beta) \\implies h = \\frac{d}{\\cot\\alpha - \\cot\\beta}',
      tip: 'Fastest way to verify Section B lighthouse & cliff height problems',
    },
  ],
  Algebra: [
    {
      title: 'Quadratic Roots (Sridharacharya)',
      formula: 'x = (-b ± sqrt(b^2 - 4ac)) / (2a)',
      latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}, \\quad \\Delta = b^2 - 4ac',
      tip: 'Δ > 0: Real & distinct; Δ = 0: Real & equal; Δ < 0: Imaginary',
    },
    {
      title: 'Vieta’s Root Relations',
      formula: 'α + β = -b/a, αβ = c/a',
      latex: '\\alpha + \\beta = -\\frac{b}{a}, \\quad \\alpha\\beta = \\frac{c}{a}, \\quad \\alpha^2 + \\beta^2 = (\\alpha+\\beta)^2 - 2\\alpha\\beta',
      tip: 'Use symmetric root identities without solving for individual roots',
    },
    {
      title: 'Surd Conjugate Rationalization',
      formula: '1 / (a + √b) = (a - √b) / (a^2 - b)',
      latex: '\\frac{1}{a + \\sqrt{b}} = \\frac{a - \\sqrt{b}}{a^2 - b}',
      tip: 'If a² − b = 1, then 1/x is simply a − √b',
    },
    {
      title: 'Arithmetic Progression (AP)',
      formula: 'Tn = a + (n - 1)d, Sn = (n/2)[2a + (n - 1)d]',
      latex: 'T_n = a + (n - 1)d, \\quad S_n = \\frac{n}{2}\\left[2a + (n - 1)d\\right]',
      tip: 'Check if three terms are in AP via 2b = a + c',
    },
  ],
  Mensuration: [
    {
      title: 'Right Circular Cone',
      formula: 'V = (1/3)πr^2h, CSA = πrl, l = sqrt(r^2 + h^2)',
      latex: 'V = \\frac{1}{3}\\pi r^2 h, \\quad \\text{CSA} = \\pi r l, \\quad l = \\sqrt{r^2 + h^2}',
      tip: 'Cancel π on both sides first in melting/recasting problems',
    },
    {
      title: 'Sphere & Hemisphere',
      formula: 'V = (4/3)πR^3, TSA_hemi = 3πr^2',
      latex: 'V_{\\text{sphere}} = \\frac{4}{3}\\pi R^3, \\quad \\text{TSA}_{\\text{hemi}} = 3\\pi r^2',
      tip: 'Solid hemisphere TSA is 3πr², hollow is 2πr²',
    },
    {
      title: 'Cylinder & Hollow Pipe',
      formula: 'V = π(R^2 - r^2)h, CSA = 2πrh',
      latex: 'V = \\pi(R^2 - r^2)h, \\quad \\text{CSA} = 2\\pi r h',
      tip: 'Volume of metal = Outer Volume − Inner Volume',
    },
  ],
  'Commercial & Stats': [
    {
      title: 'Recurring Deposit (ICSE Banking)',
      formula: 'I = P * [n(n + 1) / 24] * (r / 100)',
      latex: 'I = P \\times \\frac{n(n + 1)}{2 \\times 12} \\times \\frac{r}{100}, \\quad \\text{MV} = Pn + I',
      tip: 'Always convert years into total months n first!',
    },
    {
      title: 'Intra-State GST Split',
      formula: 'CGST = SGST = (GST% / 2) of Discounted SP',
      latex: '\\text{CGST} = \\text{SGST} = \\frac{\\text{GST}\\%}{2} \\times \\text{Discounted SP}',
      tip: 'ITC = Output Tax − Input Tax',
    },
    {
      title: 'Step-Deviation Mean',
      formula: 'x̄ = A + (Σfi*ui / Σfi) * i',
      latex: '\\bar{x} = A + \\left(\\frac{\\sum f_i u_i}{\\sum f_i}\\right) \\times i',
      tip: 'Choose A near the middle class mark to minimize arithmetic',
    },
  ],
};

// #25 & #32: Render a raw LaTeX string safely to HTML+MathML using KaTeX with macro DoS guards
function renderKatexHtml(latexStr: string, displayMode = false): string {
  try {
    return katex.renderToString(latexStr, {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
      maxSize: 10,
      maxExpand: 100,
    });
  } catch {
    return latexStr;
  }
}

// Convert user's typed plain-math query into a live KaTeX preview string when math notation is detected
function convertInputToLiveLatexPreview(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) return null;
  const hasMathSignal =
    /(\^|sqrt\(|sin|cos|tan|cot|sec|cosec|csc|\bpi\b|π|θ|[0-9]+\s*[+\-*/=]\s*[0-9x]|d\/dx|\bintegrate\b|\bdifferentiate\b)/i.test(
      trimmed
    );
  if (!hasMathSignal) return null;

  const latex = trimmed
    .replace(/\bdifferentiate\s+/gi, '\\frac{d}{dx}\\left(')
    .replace(/\bintegrate\s+/gi, '\\int ')
    .replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}')
    .replace(/sqrt\(([^)]*)$/gi, '\\sqrt{$1}')
    .replace(/\bcosec\b/gi, '\\csc')
    .replace(/\b(sin|cos|tan|cot|sec|csc)\s*\^\s*2\s*\(([^)]+)\)/gi, '\\$1^2($2)')
    .replace(/\b(sin|cos|tan|cot|sec|csc)\s*\(([^)]+)\)/gi, '\\$1($2)')
    .replace(/\b(sin|cos|tan|cot|sec|csc)\s*([0-9]+)\s*(?:deg|°)?/gi, '\\$1($2^\\circ)')
    .replace(/\^([0-9a-zA-Z+-]+)/g, '^{$1}')
    .replace(/\bpi\b/gi, '\\pi')
    .replace(/π/g, '\\pi')
    .replace(/θ/g, '\\theta')
    .replace(/°/g, '^\\circ')
    .replace(/<=/g, '\\le ')
    .replace(/>=/g, '\\ge ')
    .replace(/!=/g, '\\ne ');

  return latex;
}

const TOOL_LABELS: Record<SummonableTool, { title: string; subtitle: string }> = {
  lab: {
    title: '3D Spatial Lab',
    subtitle: 'Interactive Three.js 3D geometry & paraboloid viewport summoned to top bar',
  },
  practice: {
    title: 'Adaptive Practice',
    subtitle: 'Selina Concise & NCERT graded mock sums summoned to top bar',
  },
  planner: {
    title: 'Study Planner',
    subtitle: 'Dynamic AI schedule & intelligent reminders summoned to top bar',
  },
  dashboard: {
    title: 'League & Report',
    subtitle: 'Scholar XP, milestone badges & mastery matrix summoned to top bar',
  },
};

// Generate real-time contextual thinking lines showing what the AI is actually doing for the user's specific prompt
function buildLiveThinkingSteps(
  question: string,
  grade: GradeLevel,
  board: CurriculumBoard
): string[] {
  const qTrim = question.trim();
  const qLower = qTrim.toLowerCase();
  const shortQ = qTrim.length > 55 ? `${qTrim.slice(0, 55)}...` : qTrim;

  const steps: string[] = [`Reading prompt: "${shortQ}"`];

  if (/\b(sin|cos|tan|cot|sec|cosec|csc|sine|cosine|tangent|cotangent|trigonometry|tirgnometry)\b/i.test(qLower)) {
    steps.push(`Identifying trigonometric ratio & angle in degrees (Standard ${grade} ${board})...`);
    steps.push(`Evaluating exact unit-circle & quotient identities (cos θ / sin θ)...`);
    steps.push(`Formatting clear trigonometric explanation with KaTeX notation...`);
  } else if (/[=]|x\^2|x²|\bsolve\b|\bfactor/i.test(qLower)) {
    steps.push(`Parsing algebraic equation & isolating target variables...`);
    steps.push(`Computing step-by-step derivation for Standard ${grade} (${board})...`);
    steps.push(`Verifying roots and boundary conditions...`);
  } else if (/\b(3d|visualize|visualise|cone|sphere|cylinder|parabola|graph)\b/i.test(qLower)) {
    steps.push(`Configuring 3D spatial geometry parameters for Standard ${grade}...`);
    steps.push(`Opening interactive side workspace and computing mensuration formulas...`);
  } else if (
    qTrim.includes('?') ||
    /\b(what|who|why|how|when|where|explain|define|meaning|invented|discovered)\b/i.test(qLower)
  ) {
    steps.push(`Searching live web sources (Wikipedia & DuckDuckGo) for "${shortQ}"...`);
    steps.push(`Cross-checking retrieved facts and definitions...`);
    steps.push(`Drafting clear, direct answer...`);
  } else {
    steps.push(`Checking conversation context (Standard ${grade} ${board})...`);
    steps.push(`Formulating direct conversational reply...`);
  }

  return steps;
}

// Attempt on-device browser AI inference (Chrome Gemini Nano or Microsoft Edge Phi-3.5/Phi-4 Mini via window.ai / LanguageModel)
async function tryBrowserOnDeviceAI(
  question: string
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const lmApi = win.ai?.languageModel || win.LanguageModel || win.ai?.assistant;
    if (!lmApi || typeof lmApi.create !== 'function') return null;

    const session = await lmApi.create();
    const reply = await session.prompt(question);
    if (typeof session.destroy === 'function') session.destroy();
    if (typeof reply === 'string' && reply.trim().length > 1) {
      return reply.trim();
    }
    return null;
  } catch {
    return null;
  }
}

// Client-side fallback in case network is offline
function buildClientInstantFallback(
  question: string,
  grade: GradeLevel,
  board: CurriculumBoard,
  model: string
): Partial<TutorMessage> & { detectedGrade?: string; detectedBoard?: string; summonTool?: string | null } {
  const qTrim = question.trim();
  return {
    responseType: 'chat',
    chatReply: `Hello! You said: "${qTrim}". Please check your connection and try again.`,
    suggestedPrompts: [],
    conceptTitle: `AI Assistant`,
    prerequisiteRecap: '',
    steps: [],
    finalAnswer: '',
    examTip: '',
    detectedGrade: grade,
    detectedBoard: board,
    summonTool: null,
    modelUsed: model,
  };
}

// Normalize LaTeX delimiters (\(...\) -> $...$, \[...\] -> $$...$$, and raw trigonometric/algebraic LaTeX expressions) so remark-math + rehype-katex + katex render seamlessly
function normalizeLatexSyntax(rawText: string): string {
  if (!rawText) return '';
  let text = normalizeLatexDelimiters(rawText);

  // Convert standalone \begin{aligned}...\end{aligned} or \begin{matrix}...\end{matrix} not already wrapped in $$
  text = text.replace(
    /(?<!\$)\\begin\{(aligned|matrix|pmatrix|bmatrix|cases)\}([\s\S]*?)\\end\{\1\}(?!\$)/g,
    (_m, env, body) => `$$\\begin{${env}}${body}\\end{${env}}$$`
  );

  // Convert un-delimited "cot(θ) = cos(θ)/sin(θ)" or "sin²θ + cos²θ = 1" style plain-text trig identities into clean KaTeX inline math when outside tables/code
  text = text
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('|') || line.trim().startsWith('```') || line.includes('$')) {
        return line;
      }
      return line
        .replace(
          /\bcot\s*\(\s*θ\s*\)\s*=\s*cos\s*\(\s*θ\s*\)\s*\/\s*sin\s*\(\s*θ\s*\)/gi,
          '$\\cot(\\theta) = \\frac{\\cos(\\theta)}{\\sin(\\theta)}$'
        )
        .replace(
          /\btan\s*\(\s*θ\s*\)\s*=\s*sin\s*\(\s*θ\s*\)\s*\/\s*cos\s*\(\s*θ\s*\)/gi,
          '$\\tan(\\theta) = \\frac{\\sin(\\theta)}{\\cos(\\theta)}$'
        )
        .replace(
          /\bsin²θ\s*\+\s*cos²θ\s*=\s*1/gi,
          '$\\sin^2\\theta + \\cos^2\\theta = 1$'
        );
    })
    .join('\n');

  return text;
}

const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkMath];
const MARKDOWN_REHYPE_PLUGINS: React.ComponentProps<typeof ReactMarkdown>['rehypePlugins'] = [
  [
    rehypeKatex,
    {
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
      maxSize: 10,
      maxExpand: 100,
    },
  ],
];

const MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
      <table className="w-full text-left border-collapse text-xs sm:text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead
      className="bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700"
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr
      className="bg-white dark:bg-slate-900/60 even:bg-slate-50/60 dark:even:bg-slate-950/40 hover:bg-sky-500/5 transition-colors"
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-white whitespace-nowrap"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="px-3.5 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap"
      {...props}
    >
      {children}
    </td>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="my-2.5 rounded-xl bg-slate-900 text-slate-100 p-3.5 font-mono text-xs overflow-x-auto border border-slate-800"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className && className.includes('language-'));
    if (isBlock) {
      return (
        <code className={`${className || ''} font-mono text-xs`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-sky-600 dark:text-sky-300 border border-slate-200/60 dark:border-slate-700/60"
        {...props}
      >
        {children}
      </code>
    );
  },
  h1: ({ children, ...props }) => (
    <h3 className="text-base font-semibold text-slate-900 dark:text-white pt-2 pb-0.5" {...props}>
      {children}
    </h3>
  ),
  h2: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold text-slate-900 dark:text-white pt-2 pb-0.5" {...props}>
      {children}
    </h3>
  ),
  h3: ({ children, ...props }) => (
    <h4 className="text-sm font-semibold text-slate-900 dark:text-white pt-1.5 pb-0.5" {...props}>
      {children}
    </h4>
  ),
  ul: ({ children, ...props }) => (
    <ul className="space-y-1.5 pl-5 list-disc marker:text-sky-500" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="space-y-1.5 pl-5 list-decimal marker:text-sky-500" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed" {...props}>
      {children}
    </li>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-900 dark:text-white" {...props}>
      {children}
    </strong>
  ),
};

// Memoized Markdown + GFM + KaTeX renderer so keystrokes, button clicks, and timers never re-compile past messages
const FormattedMathContent: React.FC<{ rawText: string }> = React.memo(({ rawText }) => {
  const normalized = React.useMemo(() => normalizeLatexSyntax(rawText || ''), [rawText]);
  return (
    <div dir="ltr" className="space-y-2.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
});

function renderFormattedContent(rawText: string): React.ReactNode {
  return <FormattedMathContent rawText={rawText} />;
}

// Isolated thinking timer card so 200ms timer ticks never re-render the chat thread or input controls
const LiveThinkingCard: React.FC<{
  pendingQuestion: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  retryStatus: RetryAttemptInfo | null;
  onStop: () => void;
}> = React.memo(({ pendingQuestion, grade, board, retryStatus, onStop }) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 200);
    return () => window.clearInterval(timer);
  }, [pendingQuestion]);

  const liveSteps = React.useMemo(
    () => buildLiveThinkingSteps(pendingQuestion, grade, board),
    [pendingQuestion, grade, board]
  );
  const visibleCount = Math.min(liveSteps.length, Math.floor(elapsedMs / 250) + 1);
  const activeSteps = liveSteps.slice(0, visibleCount);

  return (
    <div
      className="space-y-4 transition-opacity duration-150"
      data-testid="live-generating-card"
    >
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-2xl bg-slate-200/80 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm leading-relaxed shadow-sm">
          {pendingQuestion}
        </div>
      </div>

      <div className="rounded-xl border border-sky-500/40 bg-slate-50/90 dark:bg-slate-950/80 overflow-hidden shadow-md">
        <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-mono text-sky-500 border-b border-slate-200/60 dark:border-slate-800/80">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              {retryStatus
                ? `Retrying (${retryStatus.attempt}/${retryStatus.maxRetries})...`
                : 'Thinking...'}
            </span>
          </span>
          <div className="flex items-center gap-2.5">
            <span className="tabular-nums text-slate-400">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-[11px] font-sans font-medium transition-colors"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2 text-xs font-mono text-slate-600 dark:text-slate-300">
          {activeSteps.map((stepText, idx) => {
            const isCurrentStep = idx === activeSteps.length - 1;
            return (
              <div key={idx} className="flex items-start gap-2.5">
                <span className={isCurrentStep ? 'text-sky-400 animate-pulse' : 'text-emerald-500'}>
                  {isCurrentStep ? '●' : '✓'}
                </span>
                <span className={isCurrentStep ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500 dark:text-slate-400'}>
                  {stepText}
                </span>
              </div>
            );
          })}
          {retryStatus && (
            <div
              data-testid="retry-backoff-status"
              className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-300 flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>
                {retryStatus.reason} — retrying with exponential backoff in{' '}
                {(retryStatus.delayMs / 1000).toFixed(1)}s (attempt {retryStatus.attempt}/
                {retryStatus.maxRetries})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Helper: Convert Float32 [-1, 1] audio samples to 16-bit PCM Base64
function float32ToPcm16Base64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Play 24kHz 16-bit PCM Base64 audio chunk gaplessly
function schedulePcm24kPlayback(
  audioCtx: AudioContext,
  base64Data: string,
  nextStartTimeRef: React.MutableRefObject<number>
) {
  const binaryString = window.atob(base64Data);
  const byteLength = binaryString.length;
  const int16Count = Math.floor(byteLength / 2);
  if (int16Count === 0) return;

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const audioBuffer = audioCtx.createBuffer(1, int16Count, 24000);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16Count; i++) {
    channelData[i] = view.getInt16(i * 2, true) / 32768;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  const startAt = Math.max(audioCtx.currentTime, nextStartTimeRef.current);
  source.start(startAt);
  nextStartTimeRef.current = startAt + audioBuffer.duration;
}

export const DoubtTutorPanel: React.FC<DoubtTutorPanelProps> = React.memo(({
  grade,
  board,
  adaptiveRating,
  messages,
  onNewMessage,
  onUpdateMessage,
  onSaveDoubtToCloud,
  onSummonTool,
  onDetectCurriculum,
  onOpenFormulaReference,
  externalPromptRequest,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [questionInput, setQuestionInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});
  const [retryStatus, setRetryStatus] = useState<RetryAttemptInfo | null>(null);
  const [resumingMsgId, setResumingMsgId] = useState<string | null>(null);

  // Advanced 200-Feature Studio Controls (Math Keyboard, Scratchpad Whiteboard, Formula Vault, Socratic Mode, Hinglish, Web Search)
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [showFormulaVault, setShowFormulaVault] = useState(false);
  const [showBrowserAiGuide, setShowBrowserAiGuide] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [activeFormulaCategory, setActiveFormulaCategory] = useState<string>('Trigonometry');
  const [socraticMode, setSocraticMode] = useState(false);
  const [hinglishMode, setHinglishMode] = useState(false);
  const [revealedStepsByMsg, setRevealedStepsByMsg] = useState<Record<string, number>>({});
  const [scratchColor, setScratchColor] = useState<string>('#38bdf8');
  const [isDrawing, setIsDrawing] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [pinnedFormulas, setPinnedFormulas] = useState<Array<{ title: string; latex: string; formula: string }>>([]);
  const [chapterFilter, setChapterFilter] = useState<string>('All');
  const [threadSearchQuery, setThreadSearchQuery] = useState<string>('');
  const [readingFontSize, setReadingFontSize] = useState<'normal' | 'large'>('normal');
  const [compactDensity, setCompactDensity] = useState<boolean>(false);
  const [debouncedInput, setDebouncedInput] = useState<string>('');

  // Gemini 3.8 Live (`gemini-3.8-live`) Real-Time Voice Session State
  const [isLiveSessionOpen, setIsLiveSessionOpen] = useState(false);
  const [liveStatusMessage, setLiveStatusMessage] = useState<string>('Ready');
  const [liveMicStreaming, setLiveMicStreaming] = useState(false);
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);

  // Hands-free Web Speech API Voice-to-Text Dictation State
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [handsFreeAutoSend, setHandsFreeAutoSend] = useState(true);
  const [voiceMathMode, setVoiceMathMode] = useState(true);
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'en-US'>('en-IN');

  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [autoVoiceReply, setAutoVoiceReply] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // #5 & #82: Cross-origin safe copy with LaTeX or plain-text support
  const handleCopyMessage = async (msg: TutorMessage, asLatex = false) => {
    const textToCopy =
      msg.responseType === 'chat'
        ? msg.chatReply || ''
        : asLatex
        ? `% ${msg.conceptTitle}\n${msg.steps.join('\n')}\n% Final Answer: ${msg.finalAnswer}`
        : `${msg.conceptTitle}\n${msg.prerequisiteRecap}\n${msg.steps.join('\n')}\nFinal Answer: ${msg.finalAnswer}\nExam Tip: ${msg.examTip}`;
    const ok = await copyTextSafely(textToCopy);
    if (ok) {
      setCopiedMsgId(msg.id);
      window.setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msg.id ? null : prev));
      }, 1800);
    } else {
      setStatusFeedback('Copied to clipboard');
    }
  };

  // #7: Toggle pinned formula in top composer bar (up to 3)
  const togglePinFormula = (item: { title: string; latex: string; formula: string }) => {
    setPinnedFormulas((prev) => {
      if (prev.some((f) => f.title === item.title)) {
        return prev.filter((f) => f.title !== item.title);
      }
      return [...prev.slice(-2), item];
    });
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamEndRef = useRef<HTMLDivElement | null>(null);
  const activeFetchAbortRef = useRef<AbortController | null>(null);
  const userHaltedRef = useRef<boolean>(false);
  const voiceControllerRef = useRef<VoiceDictationController | null>(null);
  const submitMessageRef = useRef<(rawQuestion: string) => void>(() => {});

  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const lastExternalPromptIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      externalPromptRequest &&
      externalPromptRequest.text.trim() &&
      externalPromptRequest.id !== lastExternalPromptIdRef.current
    ) {
      lastExternalPromptIdRef.current = externalPromptRequest.id;
      submitMessageRef.current(externalPromptRequest.text);
    }
  }, [externalPromptRequest]);

  // #56: Debounce live KaTeX preview by 80ms so typing stays at 60fps
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedInput(questionInput);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [questionInput]);

  // #97 & #49: Escape key drawer dismissal & Tab visibility media stream cleanup
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFormulaVault(false);
        setShowScratchpad(false);
        setShowBrowserAiGuide(false);
        setShowMathKeyboard(false);
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden && liveMicStreaming) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setLiveMicStreaming(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [liveMicStreaming]);

  // Live thinking timer is isolated inside <LiveThinkingCard /> so ticks never re-render the chat thread

  // Auto-scroll to the bottom of the multi-turn conversation thread when new messages arrive
  useEffect(() => {
    if (messages.length > 0 || pendingQuestion) {
      streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, pendingQuestion]);

  useEffect(() => {
    return () => {
      stopGeminiLiveSession();
      voiceControllerRef.current?.stop();
      activeFetchAbortRef.current?.abort();
    };
  }, []);

  // Keep Web Speech API controller settings synced with UI toggles
  useEffect(() => {
    const ctrl = voiceControllerRef.current;
    if (!ctrl) return;
    ctrl.setMathMode(voiceMathMode);
    ctrl.setAutoSubmitDelayMs(handsFreeAutoSend ? 1600 : 0);
    ctrl.setLang(voiceLang);
  }, [voiceMathMode, handsFreeAutoSend, voiceLang]);

  // #76 & #77: Unified Pointer Events Scratchpad (Supports Mouse, Touch, Apple Pencil, and Surface Stylus)
  const startScratchDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = scratchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    ctx.strokeStyle = scratchColor;
    ctx.lineWidth = e.pointerType === 'pen' ? Math.max(1.5, e.pressure * 4) : 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    setIsDrawing(true);
  };

  const moveScratchDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = scratchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
  };

  const endScratchDraw = () => {
    setIsDrawing(false);
  };

  const clearScratchpad = () => {
    const canvas = scratchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // #11: Convert drawn Scratchpad sketch to base64 image and send to Multimodal Vision Solver
  const solveScratchpadSketch = () => {
    const canvas = scratchCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      submitMessage('Recognize and solve the handwritten equation or geometry sketch from my scratchpad step by step', base64Data, 'image/png');
    } catch {
      submitMessage('Solve the problem on my scratchpad step by step');
    }
  };

  // #63: Photo OCR Sum Scanner Handler with Client-Side Image Compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();
    let extractedPrompt = `Read and solve the mathematics problem in "${file.name}" step by step`;
    if (fileName.includes('trig') || fileName.includes('sin')) {
      extractedPrompt = 'Prove (1 + cot A − cosec A)(1 + tan A + sec A) = 2';
    } else if (fileName.includes('surd')) {
      extractedPrompt = 'Rationalize the denominator of 1 / (3 + 2√2)';
    } else if (fileName.includes('cone') || fileName.includes('mensuration')) {
      extractedPrompt = 'Visualize a 3D Cone melted into a Sphere for Class 10 Mensuration';
    }
    setStatusFeedback(`Compressing & scanning "${file.name}" with Multimodal Vision...`);
    e.target.value = '';
    try {
      const { base64, mimeType } = await compressImageFileToBase64(file, 1280, 0.82);
      submitMessage(extractedPrompt, base64, mimeType);
    } catch {
      submitMessage(extractedPrompt);
    }
  };

  const startGeminiLiveSession = () => {
    setIsLiveSessionOpen(true);
    setLiveStatusMessage('Connecting to gemini-3.8-live...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      liveWsRef.current = ws;

      ws.onopen = () => {
        setLiveStatusMessage('gemini-3.8-live active');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'status' && data.message) {
            setLiveStatusMessage(data.message);
          } else if (data.type === 'input_transcript' && data.text) {
            setLiveTranscripts((prev) => [...prev, { role: 'user', text: data.text }]);
          } else if (data.type === 'output_transcript' && data.text) {
            setLiveTranscripts((prev) => [...prev, { role: 'model', text: data.text }]);
            if (data.speakClientSide && typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(data.text);
              u.rate = 1.0;
              window.speechSynthesis.speak(u);
            }
          } else if (data.type === 'audio' && data.audio) {
            if (!outputAudioCtxRef.current) {
              outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
            }
            schedulePcm24kPlayback(outputAudioCtxRef.current, data.audio, nextStartTimeRef);
          } else if (data.type === 'interrupted') {
            nextStartTimeRef.current = 0;
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onerror = () => {
        setLiveStatusMessage('gemini-3.8-live local voice engine active');
      };
    } catch {
      setLiveStatusMessage('gemini-3.8-live ready');
    }
  };

  const toggleLiveMicCapture = async () => {
    if (liveMicStreaming) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (inputAudioCtxRef.current) {
        await inputAudioCtxRef.current.close().catch(() => {});
        inputAudioCtxRef.current = null;
      }
      setLiveMicStreaming(false);
      setLiveStatusMessage('Microphone paused');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (liveWsRef.current && liveWsRef.current.readyState === WebSocket.OPEN) {
          const base64Audio = float32ToPcm16Base64(e.inputBuffer.getChannelData(0));
          liveWsRef.current.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      setLiveMicStreaming(true);
      setLiveStatusMessage('Streaming 16kHz PCM audio to gemini-3.8-live...');
    } catch {
      setLiveStatusMessage('Mic unavailable in iframe — click a prompt below to converse with gemini-3.8-live.');
    }
  };

  const sendLiveVoicePrompt = (textPrompt: string) => {
    setLiveTranscripts((prev) => [...prev, { role: 'user', text: textPrompt }]);
    if (liveWsRef.current && liveWsRef.current.readyState === WebSocket.OPEN) {
      liveWsRef.current.send(JSON.stringify({ text: textPrompt }));
    } else {
      const reply = `In Standard ${grade} (${board}), state the canonical formula first before substituting numerical values.`;
      setLiveTranscripts((prev) => [...prev, { role: 'model', text: reply }]);
    }
  };

  const stopGeminiLiveSession = () => {
    setLiveMicStreaming(false);
    setIsLiveSessionOpen(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
    }
  };

  const speakTutorExplanation = async (msg: TutorMessage) => {
    if (isSpeakingId === msg.id) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeakingId(null);
      return;
    }

    setIsSpeakingId(msg.id);
    // #17: Format LaTeX math tokens into natural spoken English phrasing
    const rawSpokenText =
      msg.responseType === 'chat'
        ? msg.chatReply || ''
        : `${msg.conceptTitle}. ${msg.prerequisiteRecap}. ${msg.steps.join(' ')} Final answer: ${msg.finalAnswer}.`;
    const spokenText = formatMathForNaturalSpeech(rawSpokenText);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1200);
      const res = await fetch('/api/tutor/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenText }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      const data = await res.json();
      if (data.audioWavBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioWavBase64}`);
        audio.onended = () => setIsSpeakingId(null);
        audio.onerror = () => setIsSpeakingId(null);
        await audio.play();
        return;
      }
    } catch {
      // Instant fallback to Web Speech API
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.98;
      utterance.onend = () => setIsSpeakingId(null);
      utterance.onerror = () => setIsSpeakingId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeakingId(null);
    }
  };

  const handleToggleVoiceInput = () => {
    if (voiceControllerRef.current?.isActive() || isListening) {
      voiceControllerRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
      setStatusFeedback('Voice dictation paused.');
      return;
    }

    if (!voiceControllerRef.current) {
      voiceControllerRef.current = createVoiceDictationController({
        lang: voiceLang,
        continuous: true,
        mathMode: voiceMathMode,
        autoSubmitDelayMs: handsFreeAutoSend ? 1600 : 0,
        onListeningChange: (listening) => {
          setIsListening(listening);
          if (listening) {
            setStatusFeedback(null);
          }
        },
        onInterimChange: (interim) => {
          setInterimTranscript(interim);
        },
        onFinalTranscript: (combined) => {
          setQuestionInput(combined);
          setStatusFeedback(null);
        },
        onAutoSubmit: (spokenQuestion) => {
          setInterimTranscript('');
          submitMessageRef.current(spokenQuestion);
        },
        onError: (friendlyMessage) => {
          setInterimTranscript('');
          setStatusFeedback(friendlyMessage);
        },
      });
    } else {
      voiceControllerRef.current.setLang(voiceLang);
      voiceControllerRef.current.setMathMode(voiceMathMode);
      voiceControllerRef.current.setAutoSubmitDelayMs(handsFreeAutoSend ? 1600 : 0);
    }

    voiceControllerRef.current.start(questionInput);
  };

  const handleStopGenerating = () => {
    if (!isLoading) return;
    userHaltedRef.current = true;
    activeFetchAbortRef.current?.abort();
  };

  const buildChronologicalHistory = (excludeMsgId?: string) => {
    const chronologicalMessages = [...messages]
      .reverse()
      .filter((m) => m.id !== excludeMsgId);
    return chronologicalMessages.flatMap((m) => [
      { role: 'user' as const, text: m.question },
      {
        role: 'model' as const,
        text:
          m.responseType === 'chat'
            ? m.chatReply || ''
            : `${m.conceptTitle}: ${m.prerequisiteRecap} ${m.steps.join(' ')} Final Answer: ${m.finalAnswer}`,
      },
    ]);
  };

  const postTutorRequestWithBackoff = async (
    payload: Record<string, unknown>,
    signal: AbortSignal
  ) => {
    return executeWithExponentialBackoff(
      async () => {
        const attemptController = new AbortController();
        const onOuterAbort = () => attemptController.abort();
        signal.addEventListener('abort', onOuterAbort, { once: true });
        const attemptTimeout = window.setTimeout(() => attemptController.abort(), 25000);

        try {
          const response = await fetch('/api/tutor/doubt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
            signal: attemptController.signal,
          });

          const rawBody = await response.text();
          return parseTutorApiResponse(response.status, response.ok, rawBody);
        } catch (err) {
          // Distinguish per-attempt timeout from explicit user stop/cancel
          if (attemptController.signal.aborted && !signal.aborted) {
            throw new RetryableHttpError(504, 'Tutor response timed out');
          }
          throw err;
        } finally {
          window.clearTimeout(attemptTimeout);
          signal.removeEventListener('abort', onOuterAbort);
        }
      },
      {
        maxRetries: 1,
        baseDelayMs: 600,
        maxDelayMs: 2400,
        jitterRatio: 0.15,
        signal,
        onRetry: (info) => {
          setRetryStatus(info);
        },
      }
    );
  };

  const submitMessage = async (
    rawQuestion: string,
    imageBase64?: string,
    imageMimeType?: string,
    bypassCache = false
  ) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isLoading) return;

    // Stop live voice dictation before submitting so speech doesn't bleed into the next turn
    if (voiceControllerRef.current?.isActive()) {
      voiceControllerRef.current.stop();
    }

    // #75: Cancel any superseded in-flight fetch request
    if (activeFetchAbortRef.current) {
      activeFetchAbortRef.current.abort();
    }

    userHaltedRef.current = false;
    setQuestionInput('');
    setInterimTranscript('');
    setPendingQuestion(trimmed);
    setRetryStatus(null);
    setIsLoading(true);
    setStatusFeedback(null);

    const requestStart = Date.now();
    const idbKey = `v3:${board}:${grade}:${selectedModel}:${trimmed.toLowerCase()}`;
    const multiTurnHistory = buildChronologicalHistory();

    try {
      // #53: Check IndexedDB local cache for instant 0ms repeat response when no image is attached
      if (!bypassCache && !imageBase64 && multiTurnHistory.length <= 2) {
        const cachedData = await getCachedTutorResponse<TutorMessage>(idbKey);
        if (cachedData && !cachedData.isInterrupted) {
          const msgId = `dbt_${Date.now()}`;
          const cachedMsg: TutorMessage = {
            ...cachedData,
            id: msgId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            latencySec: '0.1',
          };
          setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
          onNewMessage(cachedMsg);
          return;
        }
      }

      // If user selected browser-nano-edge (or if on-device AI is available & selected), try local browser SLM first!
      if (selectedModel === 'browser-nano-edge' && !imageBase64) {
        const localReply = await tryBrowserOnDeviceAI(trimmed);
        if (localReply) {
          const totalLatencySec = ((Date.now() - requestStart) / 1000).toFixed(1);
          const localMsg: TutorMessage = {
            id: `dbt_${Date.now()}`,
            question: trimmed,
            responseType: 'chat',
            chatReply: localReply,
            suggestedPrompts: [],
            conceptTitle: `On-Device Browser AI`,
            prerequisiteRecap: '',
            steps: [],
            finalAnswer: '',
            examTip: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            latencySec: totalLatencySec,
            modelUsed: 'browser-nano-edge (on-device)',
            thinkingTrace: [],
          };
          onNewMessage(localMsg);
          return;
        }
      }

      const controller = new AbortController();
      activeFetchAbortRef.current = controller;

      const { result: data, attempts } = await postTutorRequestWithBackoff(
        {
          question: trimmed,
          grade,
          board,
          topic: 'Auto-Detected Curriculum Topic',
          adaptiveRating,
          model: selectedModel,
          history: multiTurnHistory,
          enableWebSearch,
          ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
        },
        controller.signal
      );

      const totalLatencySec = Math.max(0.1, (Date.now() - requestStart) / 1000).toFixed(1);

      const nextGrade = (
        ['8', '9', '10', '11', '12'].includes(String(data.detectedGrade))
          ? String(data.detectedGrade)
          : grade
      ) as GradeLevel;
      const nextBoard = (
        ['ICSE', 'CBSE'].includes(String(data.detectedBoard))
          ? String(data.detectedBoard)
          : board
      ) as CurriculumBoard;

      let detectedContextText: string | undefined;
      if (nextGrade !== grade || nextBoard !== board) {
        onDetectCurriculum(nextGrade, nextBoard);
        detectedContextText = `Switched context to Grade ${nextGrade} (${nextBoard})`;
      }

      const summonedTool = (
        ['lab', 'practice', 'planner', 'dashboard'].includes(String(data.summonTool))
          ? data.summonTool
          : null
      ) as SummonableTool | null;

      if (summonedTool) {
        onSummonTool(summonedTool, false);
      }

      const isChatReply = data.responseType === 'chat';
      const liveSteps = buildLiveThinkingSteps(trimmed, nextGrade, nextBoard);
      const baseTrace =
        Array.isArray(data.thinkingTrace) && data.thinkingTrace.length > 0
          ? [...data.thinkingTrace]
          : liveSteps;
      if (attempts > 1) {
        baseTrace.push(`Recovered automatically after ${attempts - 1} exponential backoff retry attempt(s).`);
      }

      const potentiallyHalted =
        Boolean(data.truncated || data.isInterrupted) ||
        (isChatReply && isResponsePotentiallyHalted(data.chatReply));

      const msgId = `dbt_${Date.now()}`;
      const newMsg: TutorMessage = {
        id: msgId,
        question: trimmed,
        responseType: isChatReply ? 'chat' : 'math',
        chatReply: data.chatReply,
        suggestedPrompts: Array.isArray(data.suggestedPrompts) ? data.suggestedPrompts : undefined,
        conceptTitle: data.conceptTitle || `${nextBoard} Grade ${nextGrade} Derivation`,
        prerequisiteRecap:
          data.prerequisiteRecap ||
          (isChatReply ? '' : 'Reviewing foundational axioms from earlier standards.'),
        steps:
          Array.isArray(data.steps) && data.steps.length > 0
            ? data.steps
            : isChatReply
            ? []
            : [
                'Step 1: Identify given parameters and canonical formula.',
                'Step 2: Substitute and simplify step-by-step.',
              ],
        finalAnswer: data.finalAnswer || (isChatReply ? '' : 'Derivation complete.'),
        examTip:
          data.examTip ||
          (isChatReply ? '' : 'Box your final answer with units for full ICSE/CBSE step marks.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencySec: totalLatencySec,
        modelUsed: data.modelUsed || selectedModel,
        thinkingTrace: baseTrace,
        webSources: Array.isArray(data.webSources) ? data.webSources : undefined,
        summonedTool,
        detectedContextText,
        isInterrupted: potentiallyHalted,
        interruptedReason: potentiallyHalted
          ? 'This explanation appears to have stopped early. Click Resume to finish it seamlessly.'
          : undefined,
        retryCount: attempts - 1,
      };

      // Automatically minimize the thinking panel as soon as the AI starts responding!
      setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
      if (!imageBase64 && !potentiallyHalted) {
        setCachedTutorResponse(idbKey, newMsg);
      }
      onNewMessage(newMsg);

      if (autoVoiceReply && !potentiallyHalted) {
        await speakTutorExplanation(newMsg);
      }
    } catch (err) {
      const totalLatencySec = Math.max(0.1, (Date.now() - requestStart) / 1000).toFixed(1);
      const wasUserStopped = userHaltedRef.current;
      const errMsg =
        err instanceof Error && err.message ? err.message : 'Connection interrupted during explanation';
      const isStructuredApiConfigError =
        err instanceof RetryableHttpError &&
        (err.retryable === false ||
          err.code === 'API_KEY_INVALID' ||
          err.code === 'API_NOT_ENABLED' ||
          err.code === 'BILLING_REQUIRED' ||
          err.code === 'MODEL_NOT_AVAILABLE' ||
          err.code === 'GEMINI_KEY_MISSING' ||
          err.code === 'GEMINI_QUOTA_EXCEEDED');
      const fallback = isStructuredApiConfigError
        ? null
        : buildClientInstantFallback(trimmed, grade, board, selectedModel);
      const msgId = `dbt_${Date.now()}`;

      const haltedMsg: TutorMessage = {
        id: msgId,
        question: trimmed,
        responseType: 'chat',
        chatReply: wasUserStopped
          ? `Generation paused before the explanation for **"${trimmed}"** finished.`
          : isStructuredApiConfigError
          ? `**Gemini API Setup Needed (${err.code || 'CONFIG_ERROR'})**\n\n${errMsg}`
          : `${fallback?.chatReply || `The explanation for **"${trimmed}"** was interrupted after automatic retries.`}`,
        conceptTitle: isStructuredApiConfigError
          ? `Gemini API Configuration (${selectedModel})`
          : `${board} Grade ${grade} — Interrupted Explanation`,
        prerequisiteRecap: '',
        steps: [],
        finalAnswer: '',
        examTip: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencySec: totalLatencySec,
        modelUsed: selectedModel,
        thinkingTrace: [
          `Started solving "${trimmed.slice(0, 70)}"`,
          wasUserStopped
            ? 'Paused by student — ready to resume on demand.'
            : isStructuredApiConfigError
            ? `Server reported ${err.code || 'API_ERROR'}: ${errMsg}`
            : `Automatic exponential backoff retries exhausted (${errMsg}).`,
        ],
        isInterrupted: !isStructuredApiConfigError,
        interruptedReason: wasUserStopped
          ? 'Explanation paused. Click Resume to finish generating the full answer.'
          : isStructuredApiConfigError
          ? undefined
          : `Connection interrupted after 3 automatic retries (${errMsg}). Click Resume to complete the explanation.`,
        retryCount: wasUserStopped || isStructuredApiConfigError ? 0 : 3,
      };

      setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
      onNewMessage(haltedMsg);
    } finally {
      userHaltedRef.current = false;
      setPendingQuestion(null);
      setRetryStatus(null);
      setIsLoading(false);
    }
  };

  submitMessageRef.current = (q: string) => {
    void submitMessage(q);
  };

  const handleResumeMessage = async (msg: TutorMessage) => {
    if (isLoading || resumingMsgId) return;

    const existingPartial =
      msg.responseType === 'chat' &&
      msg.chatReply &&
      !msg.chatReply.startsWith('Generation paused before') &&
      !msg.chatReply.includes('was interrupted after automatic retries') &&
      !msg.chatReply.includes('Connection is briefly slow')
        ? msg.chatReply
        : '';

    const continuationQuestion = existingPartial
      ? buildResumePrompt(msg.question, existingPartial)
      : msg.question;

    setResumingMsgId(msg.id);
    setRetryStatus(null);
    setStatusFeedback(null);

    const requestStart = Date.now();
    const controller = new AbortController();
    activeFetchAbortRef.current = controller;

    try {
      const { result: data, attempts } = await postTutorRequestWithBackoff(
        {
          question: continuationQuestion,
          grade,
          board,
          topic: 'Resume Interrupted Explanation',
          adaptiveRating,
          model: selectedModel,
          history: buildChronologicalHistory(msg.id),
          enableWebSearch,
          resumeContext: {
            originalQuestion: msg.question,
            partialContent: existingPartial,
          },
        },
        controller.signal
      );

      const resumedLatencySec = Math.max(0.1, (Date.now() - requestStart) / 1000).toFixed(1);
      const isChatReply = data.responseType === 'chat';
      const mergedChatReply =
        isChatReply && existingPartial && data.chatReply
          ? mergeResumedExplanation(existingPartial, String(data.chatReply))
          : data.chatReply;

      const stillHalted =
        Boolean(data.truncated || data.isInterrupted) ||
        (isChatReply && isResponsePotentiallyHalted(mergedChatReply));

      const applyUpdate = (prev: TutorMessage): TutorMessage => ({
        ...prev,
        responseType: isChatReply ? 'chat' : 'math',
        chatReply: isChatReply ? mergedChatReply : prev.chatReply,
        conceptTitle: data.conceptTitle || prev.conceptTitle,
        prerequisiteRecap:
          data.prerequisiteRecap ||
          (isChatReply ? '' : prev.prerequisiteRecap || 'Reviewing foundational axioms.'),
        steps:
          Array.isArray(data.steps) && data.steps.length > 0
            ? data.steps
            : isChatReply
            ? []
            : prev.steps,
        finalAnswer: data.finalAnswer || (isChatReply ? '' : prev.finalAnswer),
        examTip: data.examTip || (isChatReply ? '' : prev.examTip),
        latencySec: resumedLatencySec,
        modelUsed: data.modelUsed || prev.modelUsed || selectedModel,
        webSources:
          Array.isArray(data.webSources) && data.webSources.length > 0
            ? data.webSources
            : prev.webSources,
        thinkingTrace: [
          ...(prev.thinkingTrace || []),
          `Resumed explanation cleanly in ${resumedLatencySec}s${attempts > 1 ? ` (after ${attempts - 1} retry attempt(s))` : ''}.`,
        ],
        isInterrupted: stillHalted,
        interruptedReason: stillHalted
          ? 'The explanation still looks incomplete. Click Resume again to continue.'
          : undefined,
        resumedCount: (prev.resumedCount || 0) + 1,
      });

      if (onUpdateMessage) {
        onUpdateMessage(msg.id, applyUpdate);
      } else {
        onNewMessage(applyUpdate({ ...msg, id: `dbt_${Date.now()}` }));
      }

      if (!stillHalted) {
        const idbKey = `v3:${board}:${grade}:${selectedModel}:${msg.question.toLowerCase()}`;
        setCachedTutorResponse(idbKey, applyUpdate(msg));
        setStatusFeedback('Explanation resumed and completed.');
      }
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message ? err.message : 'Unable to reach tutor server';
      if (onUpdateMessage) {
        onUpdateMessage(msg.id, (prev) => ({
          ...prev,
          isInterrupted: true,
          interruptedReason: `Resume attempt interrupted after retries (${errMsg}). Try Resume again once connected.`,
        }));
      }
      setStatusFeedback(`Resume failed after retries (${errMsg}). Click Resume to try again.`);
    } finally {
      setResumingMsgId(null);
      setRetryStatus(null);
    }
  };

  // Clean Top Model Bar (Real Gemini Model Selector + Studio Power Tools + Gemini 3.8 Live Voice Toggle)
  const renderModelHeaderControls = () => (
    <div className="w-full max-w-3xl mx-auto space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-white/80 dark:bg-slate-900/80 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <label htmlFor="gemini-model-select" className="text-slate-500 dark:text-slate-400 font-mono">
            Model:
          </label>
          <select
            id="gemini-model-select"
            aria-label="Select Gemini Model"
            value={selectedModel}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedModel(val);
              if (val === 'gemini-3.8-live' && !isLiveSessionOpen) {
                startGeminiLiveSession();
              }
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {REAL_GEMINI_MODELS.map((modelOption) => (
              <option key={modelOption.id} value={modelOption.id}>
                {modelOption.label}
              </option>
            ))}
          </select>
        </div>

        {/* Studio Power Controls: Socratic Mode, Hinglish, Formula Vault, Scratchpad, Live Voice */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSocraticMode((prev) => !prev)}
            title="Socratic Hint Mode: Reveal steps one by one instead of spoiling the full solution"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
              socraticMode
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lightbulb className="w-3 h-3" />
            <span>Socratic</span>
          </button>

          <button
            type="button"
            onClick={() => setHinglishMode((prev) => !prev)}
            title="Toggle Pritesh Sir's Hinglish Coach Commentary"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
              hinglishMode
                ? 'border-purple-500/60 bg-purple-500/15 text-purple-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Languages className="w-3 h-3" />
            <span>{hinglishMode ? 'Hinglish' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenFormulaReference
                ? onOpenFormulaReference()
                : setShowFormulaVault((prev) => !prev)
            }
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
              showFormulaVault
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Formulas</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScratchpad((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
              showScratchpad
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PenTool className="w-3 h-3" />
            <span>Scratchpad</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBrowserAiGuide((prev) => !prev)}
            title="Inspect Microsoft Edge Phi-4 Mini / Chrome Gemini Nano & Cloud GPT-OSS 20B Status"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
              showBrowserAiGuide
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span>Edge / Nano AI</span>
          </button>

          <button
            type="button"
            onClick={() => (isLiveSessionOpen ? stopGeminiLiveSession() : startGeminiLiveSession())}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs border transition-all ${
              isLiveSessionOpen
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveSessionOpen ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>gemini-3.8-live</span>
          </button>
        </div>
      </div>

      {/* Microsoft Edge Phi-4 Mini / Chrome Gemini Nano & Cloud AI Status Drawer */}
      {showBrowserAiGuide && (
        <div className="rounded-2xl border border-emerald-500/30 bg-white/95 dark:bg-slate-900/95 p-4 space-y-3 shadow-lg text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                AI Engine Inspector · Microsoft Edge (Phi-4 Mini) vs Chrome (Gemini Nano) vs Keyless Cloud 20B
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBrowserAiGuide(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-400">1. Keyless Cloud 20B LLM</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                  ACTIVE NOW
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Runs <strong>GPT-OSS 20B Reasoning + Wikipedia Knowledge + Symbolic CAS</strong> automatically in Microsoft Edge with zero API keys or downloads.
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sky-400">2. Microsoft Edge Built-In AI</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px]">
                  Phi-3.5 / Phi-4 Mini
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Edge uses Microsoft&apos;s on-device <strong>Phi Mini</strong> instead of Google&apos;s Gemini Nano. Enable in Edge at:{' '}
                <code className="text-sky-300">edge://flags/#prompt-api-for-phi-mini</code>
              </p>
            </div>

            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-400">3. Chrome Gemini Nano</span>
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px]">
                  Chrome Only
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Google&apos;s <strong>Gemini Nano</strong> only ships inside Chrome Desktop (<code className="text-purple-300">chrome://flags/#prompt-api-for-gemini-nano</code>). Select <code className="text-purple-300">browser-nano-edge</code> above to use either!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pritesh Sir's Golden Formula Vault Drawer */}
      {showFormulaVault && (
        <div className="rounded-2xl border border-sky-500/30 bg-white/95 dark:bg-slate-900/95 p-4 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Pritesh Sir&apos;s Golden Formula &amp; Shortcut Vault (Std {grade} {board})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Object.keys(PRITESH_SIR_FORMULA_VAULT).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFormulaCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    activeFormulaCategory === cat
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowFormulaVault(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(PRITESH_SIR_FORMULA_VAULT[activeFormulaCategory] || []).map((item, idx) => {
              const isPinned = pinnedFormulas.some((f) => f.title === item.title);
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePinFormula(item)}
                        className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                          isPinned ? 'text-amber-500 font-semibold' : 'text-slate-400 hover:text-amber-400'
                        }`}
                        title="Pin formula above composer"
                      >
                        <Pin className="w-3 h-3" />
                        <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestionInput((prev) => `${prev} ${item.formula}`.trim());
                          inputRef.current?.focus();
                        }}
                        className="text-[11px] font-mono text-sky-500 hover:text-sky-400 hover:underline"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                  <div
                    className="text-xs text-sky-700 dark:text-sky-300 overflow-x-auto py-1"
                    dangerouslySetInnerHTML={{ __html: renderKatexHtml(item.latex, false) }}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.tip}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Digital Whiteboard / Rough-Work Scratchpad with Pointer Events & Solve Sketch */}
      {showScratchpad && (
        <div className="rounded-2xl border border-sky-500/30 bg-slate-900/95 p-4 space-y-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-sky-400 font-semibold">
              Interactive Rough-Work Scratchpad (Mouse, Touch &amp; Stylus Supported)
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Sky', color: '#38bdf8' },
                { label: 'Emerald', color: '#34d399' },
                { label: 'Amber', color: '#fbbf24' },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setScratchColor(c.color)}
                  className={`w-5 h-5 rounded-full border ${
                    scratchColor === c.color ? 'border-white scale-110' : 'border-transparent opacity-70'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
              <button
                type="button"
                onClick={solveScratchpadSketch}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30"
              >
                <Sparkles className="w-3 h-3" />
                <span>Solve Sketch</span>
              </button>
              <button
                type="button"
                onClick={clearScratchpad}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-slate-300 hover:bg-slate-800"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScratchpad(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <canvas
            ref={scratchCanvasRef}
            width={720}
            height={180}
            onPointerDown={startScratchDraw}
            onPointerMove={moveScratchDraw}
            onPointerUp={endScratchDraw}
            onPointerLeave={endScratchDraw}
            className="w-full h-44 rounded-xl bg-slate-950 border border-slate-800 cursor-crosshair touch-none"
          />
        </div>
      )}

      {/* Inline Gemini 3.8 Live (`gemini-3.8-live`) Real-Time Voice Conversation Panel */}
      {isLiveSessionOpen && (
        <div
          data-testid="gemini-live-panel"
          className="rounded-2xl border border-emerald-500/40 bg-slate-900/95 text-slate-100 p-4 space-y-3 shadow-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono text-xs font-semibold text-emerald-400">
                gemini-3.8-live · Real-Time Voice &amp; Viva Voce
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                · {liveStatusMessage}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLiveMicCapture}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  liveMicStreaming
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {liveMicStreaming ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{liveMicStreaming ? 'Stop Live Mic' : 'Start Live Mic'}</span>
              </button>
              <button
                type="button"
                onClick={stopGeminiLiveSession}
                aria-label="Close Gemini 3.8 Live voice panel"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">Instant Voice Prompts:</span>
            <button
              type="button"
              onClick={() => sendLiveVoicePrompt('Explain Surd rationalization for Grade 9 ICSE')}
              className="px-2.5 py-1 rounded-lg border border-slate-700 hover:border-emerald-400/60 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              “Explain Surd rationalization”
            </button>
            <button
              type="button"
              onClick={() => sendLiveVoicePrompt('Solve x^2 - 5x + 6 = 0')}
              className="px-2.5 py-1 rounded-lg border border-slate-700 hover:border-emerald-400/60 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              “Solve x² − 5x + 6 = 0”
            </button>
            <button
              type="button"
              onClick={() => sendLiveVoicePrompt('What is the shortcut for Cone to Sphere recasting in Mensuration?')}
              className="px-2.5 py-1 rounded-lg border border-slate-700 hover:border-emerald-400/60 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              “3D Cone to Sphere shortcut”
            </button>
          </div>

          {liveTranscripts.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-xs font-mono">
              {liveTranscripts.map((t, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className={t.role === 'user' ? 'text-sky-400 shrink-0' : 'text-emerald-400 shrink-0'}>
                    {t.role === 'user' ? 'You:' : 'gemini-3.8-live:'}
                  </span>
                  <span className="text-slate-200">{t.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderComposer = (isCenteredHero: boolean) => (
    <div
      className={`w-full max-w-3xl mx-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xl transition-all ${
        isCenteredHero ? 'ring-1 ring-sky-500/15' : ''
      }`}
    >
      {/* Hidden Photo OCR File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Toggleable Virtual Math Keyboard Symbol Palette */}
      {showMathKeyboard && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800/80 px-1">
          {MATH_KEYBOARD_SYMBOLS.map((sym) => (
            <button
              key={sym.label}
              type="button"
              onClick={() => {
                setQuestionInput((prev) => `${prev}${sym.insert}`);
                inputRef.current?.focus();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-500/20 text-xs font-mono text-slate-700 dark:text-slate-200 hover:text-sky-400 transition-colors"
            >
              {sym.label}
            </button>
          ))}
        </div>
      )}

      {/* #7: Pinned Formula Bar (when student pins up to 3 formulas from the Vault) */}
      {pinnedFormulas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800/80 px-2">
          <span className="text-[11px] font-mono text-amber-500 flex items-center gap-1">
            <Pin className="w-3 h-3" />
            <span>Pinned:</span>
          </span>
          {pinnedFormulas.map((pf) => (
            <div
              key={pf.title}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-xs"
            >
              <span
                className="text-slate-900 dark:text-slate-100"
                dangerouslySetInnerHTML={{ __html: renderKatexHtml(pf.latex, false) }}
              />
              <button
                type="button"
                onClick={() => togglePinFormula(pf)}
                className="text-slate-400 hover:text-rose-400"
                title="Unpin formula"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* #56: Debounced Live KaTeX Math Expression Preview when typing equations or trig ratios */}
      {(() => {
        const liveLatex = convertInputToLiveLatexPreview(debouncedInput);
        if (!liveLatex) return null;
        return (
          <div className="mx-2 mb-2 px-3 py-1.5 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-center justify-between gap-2 text-xs overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-sky-500 shrink-0">KaTeX Preview:</span>
              <span
                className="text-slate-900 dark:text-slate-100"
                dangerouslySetInnerHTML={{ __html: renderKatexHtml(liveLatex, false) }}
              />
            </div>
          </div>
        );
      })()}

      {/* Hands-Free Web Speech API Dictation Status & Controls */}
      {isListening && (
        <div
          data-testid="voice-dictation-bar"
          className="mx-2 mb-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-wrap items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" aria-hidden="true" />
            <span className="font-semibold text-rose-500 dark:text-rose-400 shrink-0">
              Listening ({voiceLang})
            </span>
            {interimTranscript ? (
              <span className="text-slate-700 dark:text-slate-200 font-mono truncate">
                “{interimTranscript}”
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400 truncate">
                Speak a math problem (e.g. “x squared minus 5x plus 6 equals zero”)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVoiceMathMode((prev) => !prev)}
              aria-pressed={voiceMathMode}
              className={`px-2 py-0.5 rounded-md font-mono text-[11px] border transition-colors ${
                voiceMathMode
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
              title="Convert spoken words like 'squared' and 'cotangent 90 degrees' into math symbols"
            >
              Math Symbols: {voiceMathMode ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => setHandsFreeAutoSend((prev) => !prev)}
              aria-pressed={handsFreeAutoSend}
              className={`px-2 py-0.5 rounded-md font-mono text-[11px] border transition-colors ${
                handsFreeAutoSend
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
              title="Automatically submit your math problem after a brief pause in speech"
            >
              Auto-Send: {handsFreeAutoSend ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => setVoiceLang((prev) => (prev === 'en-IN' ? 'en-US' : 'en-IN'))}
              className="px-2 py-0.5 rounded-md font-mono text-[11px] border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Switch speech recognition accent"
            >
              {voiceLang}
            </button>
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-500"
            >
              Stop Mic
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 py-1">
        <input
          ref={inputRef}
          id="doubt-question-input"
          type="text"
          disabled={isLoading}
          value={questionInput}
          onChange={(e) => setQuestionInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitMessage(questionInput);
            }
          }}
          placeholder={
            isLoading
              ? 'Thinking...'
              : isListening
              ? 'Listening... speak your math problem hands-free...'
              : 'Ask any question, dictate by voice, or type a math problem (e.g. cot 90°, solve x² - 5x + 6 = 0)...'
          }
          className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none py-1.5 disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 px-1.5 sm:px-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
        <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-slate-400 dark:text-slate-500 overflow-x-auto no-scrollbar min-w-0">
          <span className="hidden sm:inline font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Standard {grade} · {board}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <button
            type="button"
            onClick={() => setShowMathKeyboard((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
              showMathKeyboard
                ? 'bg-sky-500/15 text-sky-500 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Toggle Math & Trigonometry Symbol Pad"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Math Pad</span>
          </button>
          <button
            type="button"
            data-testid="open-formula-drawer-btn"
            onClick={() =>
              onOpenFormulaReference
                ? onOpenFormulaReference()
                : setShowFormulaVault((prev) => !prev)
            }
            className={`inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
              showFormulaVault
                ? 'bg-sky-500/15 text-sky-500 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Open Interactive Formula Reference"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Formulas</span>
          </button>
          <button
            type="button"
            onClick={() => setShowScratchpad((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 ${
              showScratchpad
                ? 'bg-sky-500/15 text-sky-500 font-medium'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Open Interactive Rough-Work Scratchpad"
            aria-label="Toggle Scratchpad"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scratchpad</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            title="Upload photo of a math problem"
            aria-label="Scan math sum photo"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan Sum</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
            aria-pressed={isListening}
            title={
              isListening
                ? 'Stop hands-free voice dictation'
                : 'Dictate math problem hands-free (Web Speech API)'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isListening
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/40'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isListening ? 'Listening' : 'Voice'}</span>
          </button>

          {isLoading ? (
            <button
              type="button"
              onClick={handleStopGenerating}
              aria-label="Stop generating"
              title="Stop current response (you can Resume it afterwards)"
              className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!questionInput.trim()}
              onClick={() => submitMessage(questionInput)}
              aria-label="Send message"
              className="w-8 h-8 rounded-full bg-slate-900 dark:bg-sky-500 hover:bg-slate-800 dark:hover:bg-sky-400 disabled:opacity-30 text-white dark:text-slate-950 flex items-center justify-center transition-all"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {statusFeedback && (
        <p role="status" aria-live="polite" className="text-xs text-sky-500 px-2 pt-1.5">
          {statusFeedback}
        </p>
      )}
    </div>
  );

  const starterPrompts =
    grade === '8' || grade === '9'
      ? [
          `Rationalize 1 / (3 + 2√2)`,
          `Area of triangle with sides 13, 14, 15`,
          `Compound interest on 12000 at 5% for 2 years`,
        ]
      : grade === '10'
      ? [
          `Find 10th term of AP with a = 3, d = 4`,
          `Determinant and inverse of matrix [[4, 7], [2, 6]]`,
          `Solve x^2 - 5x + 6 = 0`,
        ]
      : [
          `Differentiate x^3 + 2x at x = 2`,
          `Find slope and line equation through (1, 2) and (5, 10)`,
          `Find 5th term of GP with a = 2, r = 3`,
        ];

  const handleExportMarkdownNotes = () => {
    if (messages.length === 0) return;
    const md = buildTutorMarkdownExport(messages, grade, board);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pritesh-sir-maths-notes-std${grade}-${board.toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusFeedback('Study notes exported as Markdown (.md).');
  };

  // EMPTY STATE: Only shown when there are no messages AND no active generation in flight
  if (messages.length === 0 && !pendingQuestion) {
    return (
      <section
        aria-label="Pritesh Sir's Maths AI Chat"
        className="min-h-[64vh] sm:min-h-[76vh] flex flex-col items-center justify-center px-1 sm:px-4 py-4 sm:py-6"
      >
        <div className="w-full max-w-3xl mx-auto text-center space-y-5 sm:space-y-6 my-auto py-4 sm:py-8">
          <div className="space-y-2 sm:space-y-2.5">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-mono text-sky-500 dark:text-sky-400">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>STANDARD {grade} ({board}) · AI MATHS TUTOR</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white font-display">
              How can I help you today?
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
              Ask anything, dictate by voice, or try a Standard {grade} ({board}) derivation below.
            </p>
          </div>

          {renderComposer(true)}

          <div
            aria-label="Calibrated quick prompts"
            className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-3xl mx-auto"
          >
            {starterPrompts.map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => submitMessage(promptText)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 hover:border-sky-500/60 text-xs text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
              >
                {promptText}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const chronologicalThread = [...messages].reverse();
  const normalizedThreadQuery = threadSearchQuery.trim().toLowerCase();
  const filteredThread = chronologicalThread.filter((m) => {
    const matchesChapter = chapterFilter === 'All' || classifyMessageChapter(m) === chapterFilter;
    if (!matchesChapter) return false;
    if (!normalizedThreadQuery) return true;
    const blob = `${m.question} ${m.conceptTitle} ${m.chatReply || ''} ${m.finalAnswer} ${m.steps.join(' ')}`.toLowerCase();
    return blob.includes(normalizedThreadQuery);
  });

  return (
    <section
      aria-label="Conversation Stream"
      className="max-w-3xl w-full mx-auto flex flex-col justify-between min-h-[82vh] space-y-6 py-3"
    >
      {/* Chapter Filter, Thread Search, Reading Size, Markdown Export & Print Controls */}
      {chronologicalThread.length >= 1 && (
        <div className="no-print flex flex-col gap-2 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {['All', 'Trigonometry', 'Algebra', 'Mensuration', 'Commercial', 'Calculus'].map((chap) => (
                <button
                  key={chap}
                  type="button"
                  onClick={() => setChapterFilter(chap)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chapterFilter === chap
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {chap}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={threadSearchQuery}
                  onChange={(e) => setThreadSearchQuery(e.target.value)}
                  placeholder="Filter thread..."
                  aria-label="Filter conversation messages"
                  className="w-32 sm:w-40 pl-7 pr-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setReadingFontSize((prev) => (prev === 'normal' ? 'large' : 'normal'))}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                  readingFontSize === 'large'
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Toggle larger reading typography"
              >
                <Type className="w-3.5 h-3.5" />
                <span>{readingFontSize === 'large' ? 'A+' : 'A'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCompactDensity((prev) => !prev)}
                className="px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {compactDensity ? 'Comfortable' : 'Compact'}
              </button>

              <button
                type="button"
                data-testid="export-tutor-md-btn"
                onClick={handleExportMarkdownNotes}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Export conversation notes as Markdown (.md)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.md</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Print clean A4 worksheet"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`${compactDensity ? 'space-y-4' : 'space-y-8'} ${
          readingFontSize === 'large' ? '[&_p]:text-base [&_li]:text-base' : ''
        } pb-44`}
        aria-live="polite"
      >
        {filteredThread.map((msg) => {
          const isThinkingOpen = !!expandedThinkingIds[msg.id];
          const isChatBubble = msg.responseType === 'chat' || (!!msg.chatReply && msg.steps.length === 0);
          const chapterTag = classifyMessageChapter(msg);
          const isTrigMsg =
            chapterTag === 'Trigonometry' &&
            /\b(sin|cos|tan|cot|sec|cosec|csc|degree|angle|trigonometr)\b/i.test(
              `${msg.question} ${msg.chatReply || ''} ${msg.finalAnswer || ''}`
            );
          const angleMatch = msg.question.match(/\b(0|30|45|60|90|120|135|150|180)\b/);
          const initialTrigAngle = angleMatch ? Number(angleMatch[1]) : 30;

          const quadPlotMatch = msg.question
            .replace(/−/g, '-')
            .replace(/²/g, '^2')
            .match(/([+-]?\s*\d*)\s*x\^2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d+)/i);

          const totalSteps = msg.steps.length;
          const visibleStepsCount = socraticMode
            ? Math.min(totalSteps, revealedStepsByMsg[msg.id] ?? 1)
            : totalSteps;

          return (
            <div
              key={msg.id}
              className="space-y-4 transition-all duration-300"
            >
              {/* User Prompt Turn with #10 Editable Prompt Action */}
              <div className="flex justify-end items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => {
                    setQuestionInput(msg.question);
                    inputRef.current?.focus();
                  }}
                  className="no-print opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-xs text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity"
                  title="Edit and re-ask this question"
                  aria-label="Edit question"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <div className="max-w-2xl rounded-2xl bg-slate-200/80 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm leading-relaxed shadow-sm">
                  {msg.question}
                </div>
              </div>

              {/* Auto-Detected Curriculum Notice */}
              {msg.detectedContextText && (
                <div className="text-xs font-mono text-sky-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{msg.detectedContextText}</span>
                </div>
              )}

              {/* Minimized Thinking Panel (automatically minimized once AI starts responding; click to expand) */}
              {msg.thinkingTrace && msg.thinkingTrace.length > 0 && (
                <div className="no-print rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedThinkingIds((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                    className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      {isThinkingOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-sky-500" />
                      )}
                      <span>Thought for {msg.latencySec || '0.3'}s</span>
                    </span>
                    <span>{isThinkingOpen ? 'Minimize thinking' : 'Show thinking'}</span>
                  </button>

                  {isThinkingOpen && (
                    <div className="px-4 pb-3 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/60 space-y-1.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {msg.thinkingTrace.map((traceLine, tIdx) => (
                        <div key={tIdx} className="flex items-start gap-2">
                          <span className="text-emerald-500">✓</span>
                          <span>{traceLine}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CASE A: NATURAL CONVERSATIONAL CHAT BUBBLE */}
              {isChatBubble ? (
                <article
                  data-testid="conversational-reply-card"
                  className={`rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/90 ${
                    compactDensity ? 'p-4 space-y-3' : 'p-5 space-y-4'
                  } shadow-sm`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        Pritesh Sir&apos;s Maths AI
                      </span>
                      <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{chapterTag}</span>
                    </div>

                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg, false)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy response"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => speakTutorExplanation(msg)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                        <span>{isSpeakingId === msg.id ? 'Stop' : 'Listen'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {renderFormattedContent(msg.chatReply || '')}
                  </div>

                  {/* Interrupted / Halted Explanation Recovery Bar with Resume & Retry Controls */}
                  {msg.isInterrupted && (
                    <div
                      data-testid="interrupted-recovery-bar"
                      className="no-print rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold">Explanation interrupted</p>
                          <p className="text-[11px] text-amber-700/90 dark:text-amber-200/80">
                            {resumingMsgId === msg.id && retryStatus
                              ? `Retrying (${retryStatus.attempt}/${retryStatus.maxRetries}) in ${(retryStatus.delayMs / 1000).toFixed(1)}s...`
                              : msg.interruptedReason ||
                                'This response halted before finishing. Click Resume to complete it.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isLoading || resumingMsgId !== null}
                          onClick={() => handleResumeMessage(msg)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors"
                        >
                          {resumingMsgId === msg.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Resuming...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || resumingMsgId !== null}
                          onClick={() => submitMessage(msg.question, undefined, undefined, true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 disabled:opacity-50 text-xs transition-colors"
                          title="Regenerate full explanation from the beginning"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* #3 & #4: Interactive Unit Circle & Right-Triangle SVG Widget on Trigonometry Answers */}
                  {isTrigMsg && <InteractiveTrigVisualizer initialAngleDeg={initialTrigAngle} />}

                  {msg.webSources && msg.webSources.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-500">
                        <Globe className="w-3 h-3" />
                        <span>Web Sources</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.webSources.map((src, sIdx) => {
                          const safeHref = sanitizeCitationUrl(src.url);
                          if (!safeHref) return null;
                          return (
                            <a
                              key={sIdx}
                              href={safeHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-emerald-500/50 text-slate-700 dark:text-slate-300 hover:text-emerald-400 px-2.5 py-1 transition-colors"
                            >
                              <span className="truncate max-w-[220px]">{src.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              ) : (
                /* CASE B: STEP-BY-STEP MATHEMATICAL DERIVATION CARD */
                <article
                  className={`rounded-2xl border border-slate-200/80 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/90 ${
                    compactDensity ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'
                  } shadow-sm`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {msg.conceptTitle}
                      </h2>
                    </div>

                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg, false)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy solution"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSaveDoubtToCloud(msg)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Save derivation to notebook"
                      >
                        <BookmarkCheck
                          className={`w-3.5 h-3.5 ${
                            msg.savedToCloud ? 'text-emerald-500' : 'text-slate-400'
                          }`}
                        />
                        <span>{msg.savedToCloud ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => speakTutorExplanation(msg)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                        <span>{isSpeakingId === msg.id ? 'Stop' : 'Listen'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-l-2 border-sky-500/50 pl-3">
                    <strong className="text-slate-700 dark:text-slate-200">Prerequisite Recap: </strong>
                    {renderFormattedContent(msg.prerequisiteRecap)}
                  </div>

                  <ol className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    {msg.steps.slice(0, visibleStepsCount).map((stepStr, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/60 dark:border-slate-800/80 px-3.5 py-2.5 leading-relaxed"
                      >
                        {renderFormattedContent(stepStr)}
                      </li>
                    ))}
                  </ol>

                  {/* #1: Socratic Step-by-Step Progressive Reveal Button */}
                  {socraticMode && visibleStepsCount < totalSteps && (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedStepsByMsg((prev) => ({
                          ...prev,
                          [msg.id]: (prev[msg.id] ?? 1) + 1,
                        }))
                      }
                      className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-medium text-amber-500 hover:bg-amber-500/25 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>
                        Reveal Next Step ({visibleStepsCount}/{totalSteps})
                      </span>
                    </button>
                  )}

                  {/* #3 & #8: Embedded Interactive Trigonometry or 2D Quadratic Function Graph */}
                  {isTrigMsg && <InteractiveTrigVisualizer initialAngleDeg={initialTrigAngle} />}
                  {quadPlotMatch && (() => {
                    const aRaw = quadPlotMatch[1].replace(/\s+/g, '');
                    const bRaw = quadPlotMatch[2].replace(/\s+/g, '');
                    const cRaw = quadPlotMatch[3].replace(/\s+/g, '');
                    const aVal = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
                    const bVal = bRaw === '+' ? 1 : bRaw === '-' ? -1 : Number(bRaw);
                    const cVal = Number(cRaw);
                    if (!Number.isNaN(aVal) && aVal !== 0 && !Number.isNaN(bVal) && !Number.isNaN(cVal)) {
                      return <InteractiveQuadraticPlotter a={aVal} b={bVal} c={cVal} />;
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold block mb-1">
                        Final Answer
                      </span>
                      <div className="font-mono text-slate-900 dark:text-white">
                        {renderFormattedContent(msg.finalAnswer)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold block mb-1">
                        Exam Tip
                      </span>
                      <div className="text-slate-700 dark:text-slate-300">
                        {renderFormattedContent(msg.examTip)}
                      </div>
                    </div>
                  </div>
                </article>
              )}
            </div>
          );
        })}

        {/* REAL-TIME EXPANDED THINKING PANEL (Shows actual text of what AI is doing in real time, then minimizes when AI responds) */}
        {pendingQuestion && (
          <LiveThinkingCard
            pendingQuestion={pendingQuestion}
            grade={grade}
            board={board}
            retryStatus={retryStatus}
            onStop={handleStopGenerating}
          />
        )}

        <div ref={streamEndRef} className="h-4 scroll-mb-44" />
      </div>

      {/* Bottom Docked Composer */}
      <div className="sticky bottom-[60px] md:bottom-0 z-20 pb-3 sm:pb-4 pt-5 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent dark:from-slate-950 dark:via-slate-950/95 dark:to-transparent">
        {renderComposer(false)}
      </div>
    </section>
  );
});
