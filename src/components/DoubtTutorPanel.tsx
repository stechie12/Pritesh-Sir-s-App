import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MathScratchpad } from './MathScratchpad';
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
  Sliders,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { GradeLevel, CurriculumBoard } from '../utils/adaptiveEngine';
import {
  copyTextSafely,
  sanitizeCitationUrl,
  formatMathForNaturalSpeech,
  compressImageFileToBase64,
  classifyMessageChapter,
} from '../utils/tutorEnhancements';
import {
  parseSseChunkBuffer,
  stripPartialSimDirective,
} from '../utils/streamTutor';
import {
  buildThinkingStageLabel,
  computeNextRevealedLength,
} from '../utils/typewriterBuffer';
import { InlineMathVisualizer } from '../utils/mathVisualizers';
import {
  type InlineVisualizerSpec,
  parseAiVisualizerDirective,
  sanitizeVisualizerSpec,
} from '../utils/visualizerDetector';
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
  wrapStandaloneLatexEnvironments,
} from '../utils/practiceWorkspace';
import {
  buildPedagogyPromptPrefix,
  detectCommonMathTraps,
  generateTwinProblem,
  type TutorPedagogyConfig,
} from '../utils/tutorPedagogy';
import type { SavedInsightItem, WorkspacePreferences } from '../utils/workspacePreferences';
import type { PowerHubTab } from '../data/featureSuiteCatalog';
import { getPerformanceCadence } from '../utils/performanceMode';

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
  thoughtDurationSec?: string;
  modelUsed?: string;
  thoughtText?: string;
  thinkingTrace?: string[];
  webSources?: Array<{ title: string; url: string; snippet: string }>;
  savedToCloud?: boolean;
  summonedTool?: SummonableTool | null;
  visualizerSpec?: InlineVisualizerSpec | null;
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
  onOpenSimulationsLibrary?: (initialSpec?: InlineVisualizerSpec | null) => void;
  externalPromptRequest?: { id: number; text: string } | null;
  pedagogy?: TutorPedagogyConfig;
  prefs?: WorkspacePreferences;
  onSaveInsight?: (item: SavedInsightItem) => void;
  onSendToNotes?: (title: string, chapter: string, body: string) => void;
  onOpenPowerStudio?: (tab?: PowerHubTab, focusKey?: string) => void;
  performanceModeActive?: boolean;
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

  // Convert standalone \begin{aligned}...\end{aligned} or \begin{matrix}...\end{matrix} not already wrapped in $$ (Safari-safe, no lookbehind)
  text = wrapStandaloneLatexEnvironments(text);

  // Ensure $$...$$ display math blocks are separated with blank lines so remark-math never glues consecutive equations inline
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => {
    const body = inner.trim();
    if (!body) return '';
    return `\n\n$$\n${body}\n$$\n\n`;
  });

  // Preserve visual break after standalone bold step headings (e.g. "**Step 2: Split the middle term**\nReplace...")
  text = text.replace(/^(\*\*[^*\n]+\*\*)\n(?=\S)/gm, '$1\n\n');

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
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

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

interface LiveStreamState {
  question: string;
  thoughtText: string;
  rawAnswerText: string;
  modelUsed: string;
  phase: 'thinking' | 'streaming';
  startedAt: number;
  thoughtDurationSec: number | null;
  isComplete?: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Windows 11 Fluent + ChatGPT-inspired live streaming turn:
// Multi-ring Fluent orb, kinetic neural wave, shimmering thought headline, and adaptive rAF dynamic typing reveal
const LiveStreamingTurn: React.FC<{
  streamState: LiveStreamState;
  retryStatus: RetryAttemptInfo | null;
  onStop: () => void;
  onTypewriterSettled?: () => void;
  performanceModeActive?: boolean;
}> = React.memo(({ streamState, retryStatus, onStop, onTypewriterSettled, performanceModeActive = false }) => {
  const cadence = React.useMemo(
    () => getPerformanceCadence(performanceModeActive),
    [performanceModeActive]
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(true);
  const [revealedThoughtLen, setRevealedThoughtLen] = useState(0);
  const [revealedAnswerLen, setRevealedAnswerLen] = useState(0);
  const thoughtScrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoCollapsedRef = useRef(false);
  const settledFiredRef = useRef(false);

  const visibleAnswerText = React.useMemo(
    () => stripPartialSimDirective(streamState.rawAnswerText),
    [streamState.rawAnswerText]
  );

  // Refs so the single rAF loop always reads fresh buffered targets without restarting
  const targetThoughtRef = useRef(streamState.thoughtText);
  const targetAnswerRef = useRef(visibleAnswerText);
  const isCompleteRef = useRef(Boolean(streamState.isComplete));
  const revealedThoughtRef = useRef(0);
  const revealedAnswerRef = useRef(0);
  const onSettledRef = useRef(onTypewriterSettled);

  targetThoughtRef.current = streamState.thoughtText;
  targetAnswerRef.current = visibleAnswerText;
  isCompleteRef.current = Boolean(streamState.isComplete);
  onSettledRef.current = onTypewriterSettled;

  // Reset per-turn state whenever a new prompt starts streaming
  useEffect(() => {
    setElapsedMs(Math.max(0, Date.now() - streamState.startedAt));
    hasAutoCollapsedRef.current = false;
    settledFiredRef.current = false;
    revealedThoughtRef.current = 0;
    revealedAnswerRef.current = 0;
    setRevealedThoughtLen(0);
    setRevealedAnswerLen(0);
    setIsThoughtExpanded(true);

    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - streamState.startedAt));
    }, cadence.thinkingTimerIntervalMs);
    return () => window.clearInterval(timer);
  }, [streamState.startedAt, cadence.thinkingTimerIntervalMs]);

  // Smooth adaptive rAF dynamic typewriter loop (throttles commit cadence in Performance Mode)
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();
    let commitAccumulatorMs = 0;
    const reduced = prefersReducedMotion();
    const commitIntervalMs = cadence.typewriterCommitIntervalMs;

    const tick = (now: number) => {
      const dt = Math.max(0, now - lastTs);
      lastTs = now;
      commitAccumulatorMs += dt;

      if (commitAccumulatorMs >= commitIntervalMs || reduced) {
        const stepMs = commitAccumulatorMs;
        commitAccumulatorMs = 0;

        const targetThought = targetThoughtRef.current;
        const targetAnswer = targetAnswerRef.current;
        const done = isCompleteRef.current;

        if (revealedThoughtRef.current < targetThought.length) {
          const nextThought = computeNextRevealedLength({
            currentLength: revealedThoughtRef.current,
            targetText: targetThought,
            deltaMs: stepMs,
            isStreamComplete: done || targetAnswer.length > 0,
            reducedMotion: reduced,
          });
          if (nextThought !== revealedThoughtRef.current) {
            revealedThoughtRef.current = nextThought;
            setRevealedThoughtLen(nextThought);
          }
        }

        if (revealedAnswerRef.current < targetAnswer.length) {
          const nextAnswer = computeNextRevealedLength({
            currentLength: revealedAnswerRef.current,
            targetText: targetAnswer,
            deltaMs: stepMs,
            isStreamComplete: done,
            reducedMotion: reduced,
          });
          if (nextAnswer !== revealedAnswerRef.current) {
            revealedAnswerRef.current = nextAnswer;
            setRevealedAnswerLen(nextAnswer);
          }
        }

        if (
          done &&
          revealedAnswerRef.current >= targetAnswer.length &&
          !settledFiredRef.current
        ) {
          settledFiredRef.current = true;
          onSettledRef.current?.();
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [streamState.startedAt, cadence.typewriterCommitIntervalMs]);

  // Auto-collapse reasoning drawer cleanly the moment answer tokens begin typing
  useEffect(() => {
    if (streamState.phase === 'streaming' && !hasAutoCollapsedRef.current) {
      hasAutoCollapsedRef.current = true;
      setIsThoughtExpanded(false);
    }
  }, [streamState.phase]);

  // Auto-scroll live thought rail to newest reasoning line while expanded
  useEffect(() => {
    if (isThoughtExpanded && thoughtScrollRef.current) {
      thoughtScrollRef.current.scrollTop = thoughtScrollRef.current.scrollHeight;
    }
  }, [revealedThoughtLen, isThoughtExpanded]);

  const isThinkingPhase = streamState.phase === 'thinking';
  const typedThoughtText = streamState.thoughtText.slice(0, revealedThoughtLen);
  const typedAnswerText = visibleAnswerText.slice(0, revealedAnswerLen);
  const isActivelyTyping =
    !streamState.isComplete || revealedAnswerLen < visibleAnswerText.length;

  const liveHeadline = retryStatus
    ? `Reconnecting (${retryStatus.attempt}/${retryStatus.maxRetries})...`
    : buildThinkingStageLabel(elapsedMs, streamState.thoughtText);

  const thoughtSecLabel =
    streamState.thoughtDurationSec !== null
      ? streamState.thoughtDurationSec.toFixed(1)
      : (elapsedMs / 1000).toFixed(1);

  return (
    <div
      className="space-y-4 ai-msg-enter min-w-0"
      data-testid="live-generating-card"
      data-stream-phase={streamState.phase}
    >
      {/* Student Prompt Glass Bubble */}
      <div className="flex justify-end">
        <div className="max-w-full sm:max-w-2xl rounded-2xl fluent-user-bubble text-slate-900 dark:text-slate-100 px-4 py-3 text-sm leading-relaxed break-words">
          {streamState.question}
        </div>
      </div>

      {/* Windows 11 Fluent Glassmorphism Live Thinking Card / Collapsible Rail */}
      <div
        className={
          isThinkingPhase
            ? 'rounded-2xl fluent-glass-card fluent-thinking-card px-4 py-3.5 sm:px-5 sm:py-4 space-y-3'
            : 'space-y-2'
        }
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            data-testid="live-thinking-toggle"
            aria-expanded={isThoughtExpanded}
            onClick={() => setIsThoughtExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition-colors group text-left min-w-0"
          >
            {isThinkingPhase ? (
              <span className="fluent-thinking-orb shrink-0" aria-hidden="true">
                <span className="fluent-thinking-orb-core" />
              </span>
            ) : (
              <span className="w-5 h-5 rounded-lg bg-sky-500/15 border border-sky-500/30 inline-flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-sky-500" aria-hidden="true" />
              </span>
            )}
            <span
              className={`truncate max-w-[210px] sm:max-w-md ${
                isThinkingPhase
                  ? 'ai-shimmer-text font-semibold text-[13px] tracking-tight'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {isThinkingPhase ? `${liveHeadline}…` : `Thought for ${thoughtSecLabel}s`}
            </span>
            {isThinkingPhase && (
              <span
                className="fluent-thinking-wave shrink-0"
                aria-hidden="true"
                data-testid="thinking-wave-indicator"
              >
                <span />
                <span />
                <span />
                <span />
              </span>
            )}
            {isThinkingPhase && (
              <span className="tabular-nums text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                {thoughtSecLabel}s
              </span>
            )}
            {streamState.thoughtText.trim().length > 0 &&
              (isThoughtExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ))}
          </button>

          <button
            type="button"
            data-testid="live-stop-btn"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg fluent-control hover:border-rose-500/50 text-slate-600 dark:text-slate-200 hover:text-rose-500 text-[11px] font-medium shrink-0"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Stop</span>
          </button>
        </div>

        {/* Frosted Inset Reasoning Panel (replaces left border stripe with Fluent glass container) */}
        {isThoughtExpanded && (
          typedThoughtText.trim().length > 0 || retryStatus ? (
            <div
              ref={thoughtScrollRef}
              data-testid="live-thought-rail"
              className="rounded-xl fluent-glass-subtle px-3.5 py-2.5 max-h-48 overflow-y-auto space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
            >
              {typedThoughtText.trim().length > 0 && (
                <div className="[&_p]:text-xs [&_p]:text-slate-600 dark:[&_p]:text-slate-300 [&_li]:text-xs [&_li]:text-slate-600 dark:[&_li]:text-slate-300 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100">
                  <FormattedMathContent rawText={typedThoughtText} />
                  {isThinkingPhase && (
                    <span className="fluent-typing-caret" aria-hidden="true" />
                  )}
                </div>
              )}
              {retryStatus && (
                <div
                  data-testid="retry-backoff-status"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>
                    {retryStatus.reason} — retrying in {(retryStatus.delayMs / 1000).toFixed(1)}s (attempt{' '}
                    {retryStatus.attempt}/{retryStatus.maxRetries})
                  </span>
                </div>
              )}
            </div>
          ) : isThinkingPhase ? (
            <div
              className="rounded-xl fluent-glass-subtle px-3.5 py-3 space-y-2.5"
              aria-hidden="true"
            >
              <div className="ai-thought-shimmer-line w-4/5" />
              <div className="ai-thought-shimmer-line w-3/5" />
              <div className="ai-thought-shimmer-line w-2/5" />
            </div>
          ) : null
        )}
      </div>

      {/* Live Dynamic Typewriter Frosted Glass Answer Card */}
      {visibleAnswerText.length > 0 && (
        <article
          data-testid="live-streaming-answer-card"
          data-revealed-chars={revealedAnswerLen}
          data-buffered-chars={visibleAnswerText.length}
          className="rounded-2xl fluent-glass-card p-5 sm:p-6 space-y-3.5 ai-msg-enter"
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="fluent-thinking-orb shrink-0" aria-hidden="true">
                <span className="fluent-thinking-orb-core" />
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white font-display">
                Pritesh Sir&apos;s Maths AI
              </span>
              <span className="text-xs text-slate-400" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-sky-600 dark:text-sky-400">
                <span>Typing</span>
                <span className="fluent-thinking-wave scale-75" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </div>
          </div>

          <div
            data-testid="live-typing-body"
            data-typing-active={isActivelyTyping ? 'true' : 'false'}
            className={`text-sm text-slate-800 dark:text-slate-100 leading-relaxed ${
              isActivelyTyping ? 'fluent-typing-active' : ''
            }`}
          >
            <FormattedMathContent rawText={typedAnswerText} />
          </div>
        </article>
      )}
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
  onOpenSimulationsLibrary,
  externalPromptRequest,
  pedagogy,
  prefs,
  onSaveInsight,
  onSendToNotes,
  performanceModeActive = false,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('gemini-4-hydrogen');
  const [questionInput, setQuestionInput] = useState('');
  const [zoomedEquationHtml, setZoomedEquationHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveStreamState, setLiveStreamState] = useState<LiveStreamState | null>(null);
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
  const typewriterSettledResolverRef = useRef<(() => void) | null>(null);

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

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  // #97, #47, #49: Escape key dismissal, Spacebar Push-to-Talk, & Tab visibility media cleanup
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFormulaVault(false);
        setShowScratchpad(false);
        setShowBrowserAiGuide(false);
        setShowMathKeyboard(false);
        setZoomedEquationHtml(null);
        return;
      }
      if (
        prefs?.pushToTalkEnabled &&
        e.code === 'Space' &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        if (!voiceControllerRef.current?.isActive()) {
          handleToggleVoiceInput();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (
        prefs?.pushToTalkEnabled &&
        e.code === 'Space' &&
        voiceControllerRef.current?.isActive() &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        voiceControllerRef.current.stop();
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
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [liveMicStreaming, prefs?.pushToTalkEnabled]);

  // Live thinking timer is isolated inside <LiveThinkingCard /> so ticks never re-render the chat thread

  // Auto-scroll cleanly when a turn starts, switches from thinking to streaming, or finishes
  useEffect(() => {
    if (messages.length > 0 || liveStreamState) {
      streamEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, liveStreamState?.startedAt, liveStreamState?.phase]);

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

  const isEmptyState = messages.length === 0 && !liveStreamState;

  // Declaratively sync auto-growing textarea height whenever text changes, empties after submit, or viewport resizes
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!questionInput) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [questionInput, isEmptyState]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let rafId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const target = inputRef.current;
        if (!target) return;
        if (!target.value) {
          target.style.height = '';
          return;
        }
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 140)}px`;
      });
    });
    ro.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [isEmptyState]);

  // #11, #31, #35: Convert drawn Scratchpad sketch to base64 image and send to Multimodal Vision Solver
  const solveScratchpadSketch = (base64Data: string, customPrompt?: string) => {
    setShowScratchpad(false);
    const promptText =
      customPrompt ||
      'Recognize and solve the handwritten equation or geometry sketch from my scratchpad step by step';
    if (base64Data) {
      submitMessage(promptText, base64Data, 'image/png');
    } else {
      submitMessage('Solve the problem on my scratchpad step by step');
    }
  };

  // #40 Clipboard Paste-Image (Ctrl+V screenshot directly into composer)
  const handleComposerPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        setStatusFeedback('Scanning pasted screenshot with Multimodal Vision...');
        try {
          const { base64, mimeType } = await compressImageFileToBase64(file, 1280, 0.82);
          const prompt =
            questionInput.trim() || 'Read and solve the mathematics problem in this pasted image step by step';
          submitMessage(prompt, base64, mimeType);
        } catch {
          setStatusFeedback('Could not read pasted image. Try Scan Sum instead.');
        }
        return;
      }
    }
  };

  // #41 LaTeX Snippet Autocomplete (/frac, /sqrt, /quad, /int, /sum, /pi, /theta)
  const expandLatexShortcuts = (val: string): string =>
    val
      .replace(/(^|\s)\/frac(\s)$/i, '$1\\frac{a}{b}$2')
      .replace(/(^|\s)\/sqrt(\s)$/i, '$1\\sqrt{x}$2')
      .replace(/(^|\s)\/quad(\s)$/i, '$1ax^2 + bx + c = 0$2')
      .replace(/(^|\s)\/int(\s)$/i, '$1\\int $2')
      .replace(/(^|\s)\/sum(\s)$/i, '$1\\sum_{i=1}^{n} $2')
      .replace(/(^|\s)\/pi(\s)$/i, '$1π$2')
      .replace(/(^|\s)\/theta(\s)$/i, '$1θ$2');

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
      utterance.rate = prefs?.ttsRate ?? 0.98;
      utterance.lang = prefs?.ttsAccent ?? 'en-IN';
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
        const attemptTimeout = window.setTimeout(() => attemptController.abort(), 38000);

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
    _bypassCache = false
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

    const requestStart = Date.now();
    userHaltedRef.current = false;
    setQuestionInput('');
    setInterimTranscript('');
    setLiveStreamState({
      question: trimmed,
      thoughtText: '',
      rawAnswerText: '',
      modelUsed: selectedModel,
      phase: 'thinking',
      startedAt: requestStart,
      thoughtDurationSec: null,
    });
    setRetryStatus(null);
    setIsLoading(true);
    setStatusFeedback(null);

    const multiTurnHistory = buildChronologicalHistory();
    let streamedThoughtAcc = '';
    let streamedAnswerAcc = '';
    let streamedThoughtDurationSec: number | null = null;
    let streamedModelLabel = selectedModel;

    try {
      // If user explicitly selected browser-nano-edge, try local browser SLM first
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
          };
          onNewMessage(localMsg);
          return;
        }
      }

      const controller = new AbortController();
      activeFetchAbortRef.current = controller;

      const pedagogyPrefix = pedagogy ? buildPedagogyPromptPrefix(pedagogy, board, grade) : '';
      const outgoingQuestion = pedagogyPrefix ? `${pedagogyPrefix}${trimmed}` : trimmed;

      const requestPayload: Record<string, unknown> = {
        question: outgoingQuestion,
        grade,
        board,
        topic: 'Auto-Detected Curriculum Topic',
        adaptiveRating,
        model: selectedModel,
        history: multiTurnHistory,
        enableWebSearch,
        ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
      };

      // Primary path: real-time SSE streaming of Gemini reasoning thoughts + live answer tokens
      let committedFromStream = false;
      let streamFallbackNeeded = false;

      try {
        const streamRes = await fetch('/api/tutor/doubt/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!streamRes.ok || !streamRes.body) {
          streamFallbackNeeded = true;
        } else {
          const reader = streamRes.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          let detectedGradeFromStream = grade;
          let detectedBoardFromStream = board;
          let summonedToolFromStream: SummonableTool | null = null;
          let detectedContextText: string | undefined;

          const applyMeta = (
            rawGrade?: string,
            rawBoard?: string,
            rawTool?: string | null,
            rawModel?: string
          ) => {
            if (rawModel) {
              streamedModelLabel = rawModel;
            }
            const nextGrade = (
              ['8', '9', '10', '11', '12'].includes(String(rawGrade))
                ? String(rawGrade)
                : detectedGradeFromStream
            ) as GradeLevel;
            const nextBoard = (
              ['ICSE', 'CBSE'].includes(String(rawBoard))
                ? String(rawBoard)
                : detectedBoardFromStream
            ) as CurriculumBoard;
            if (nextGrade !== grade || nextBoard !== board) {
              detectedGradeFromStream = nextGrade;
              detectedBoardFromStream = nextBoard;
              onDetectCurriculum(nextGrade, nextBoard);
              detectedContextText = `Switched context to Grade ${nextGrade} (${nextBoard})`;
            }
            const tool = (
              ['lab', 'practice', 'planner', 'dashboard'].includes(String(rawTool))
                ? rawTool
                : null
            ) as SummonableTool | null;
            if (tool && tool !== summonedToolFromStream) {
              summonedToolFromStream = tool;
              onSummonTool(tool, false);
            }
          };

          let doneEvent: Extract<
            ReturnType<typeof parseSseChunkBuffer>['events'][number],
            { type: 'done' }
          > | null = null;
          let streamErrorEvent: Extract<
            ReturnType<typeof parseSseChunkBuffer>['events'][number],
            { type: 'error' }
          > | null = null;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunkText = decoder.decode(value, { stream: true });
            const parsed = parseSseChunkBuffer(sseBuffer, chunkText);
            sseBuffer = parsed.remainder;

            let needsUiFlush = false;
            for (const ev of parsed.events) {
              if (ev.type === 'meta') {
                applyMeta(ev.detectedGrade, ev.detectedBoard, ev.summonTool, ev.modelUsed);
                needsUiFlush = true;
              } else if (ev.type === 'thought') {
                streamedThoughtAcc += ev.delta;
                needsUiFlush = true;
              } else if (ev.type === 'token') {
                if (streamedThoughtDurationSec === null) {
                  streamedThoughtDurationSec = Math.max(0.1, (Date.now() - requestStart) / 1000);
                }
                streamedAnswerAcc += ev.delta;
                needsUiFlush = true;
              } else if (ev.type === 'done') {
                doneEvent = ev;
                applyMeta(ev.detectedGrade, ev.detectedBoard, ev.summonTool, ev.modelUsed);
              } else if (ev.type === 'error') {
                streamErrorEvent = ev;
              }
            }

            if (needsUiFlush) {
              setLiveStreamState((prev) =>
                prev
                  ? {
                      ...prev,
                      thoughtText: streamedThoughtAcc,
                      rawAnswerText: streamedAnswerAcc,
                      modelUsed: streamedModelLabel,
                      phase: streamedAnswerAcc.length > 0 ? 'streaming' : 'thinking',
                      thoughtDurationSec: streamedThoughtDurationSec,
                    }
                  : prev
              );
            }
          }

          if (streamErrorEvent) {
            const isConfigErr =
              streamErrorEvent.retryable === false ||
              streamErrorEvent.code === 'API_KEY_INVALID' ||
              streamErrorEvent.code === 'API_NOT_ENABLED' ||
              streamErrorEvent.code === 'BILLING_REQUIRED' ||
              streamErrorEvent.code === 'MODEL_NOT_AVAILABLE' ||
              streamErrorEvent.code === 'GEMINI_KEY_MISSING' ||
              streamErrorEvent.code === 'GEMINI_QUOTA_EXCEEDED';

            if (isConfigErr) {
              throw new RetryableHttpError(
                streamErrorEvent.status || 400,
                streamErrorEvent.error || 'Gemini API configuration error',
                {
                  code: streamErrorEvent.code,
                  retryable: false,
                }
              );
            }
            if (!streamedAnswerAcc.trim()) {
              streamFallbackNeeded = true;
            }
          }

          if (doneEvent || (!streamFallbackNeeded && streamedAnswerAcc.trim().length > 0)) {
            const totalLatencySec = Math.max(0.1, (Date.now() - requestStart) / 1000).toFixed(1);
            const finalRawReply = doneEvent ? doneEvent.cleanText : streamedAnswerAcc;
            const parsedDirective = parseAiVisualizerDirective(finalRawReply);
            const cleanChatReply = parsedDirective.cleanText;
            const summonedVisualizerSpec =
              sanitizeVisualizerSpec(doneEvent?.visualizerSpec) ?? parsedDirective.spec ?? null;
            const finalThoughtText = (doneEvent?.thoughtText || streamedThoughtAcc || '').trim();
            const thoughtSecStr =
              streamedThoughtDurationSec !== null
                ? streamedThoughtDurationSec.toFixed(1)
                : totalLatencySec;
            const potentiallyHalted =
              Boolean(doneEvent?.truncated) || isResponsePotentiallyHalted(cleanChatReply);

            const msgId = `dbt_${Date.now()}`;
            const newMsg: TutorMessage = {
              id: msgId,
              question: trimmed,
              responseType: 'chat',
              chatReply: cleanChatReply,
              conceptTitle: 'AI Assistant',
              prerequisiteRecap: '',
              steps: [],
              finalAnswer: '',
              examTip: '',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              latencySec: totalLatencySec,
              thoughtDurationSec: finalThoughtText ? thoughtSecStr : undefined,
              modelUsed: doneEvent?.modelUsed || streamedModelLabel,
              thoughtText: finalThoughtText || undefined,
              webSources:
                doneEvent?.webSources && doneEvent.webSources.length > 0
                  ? doneEvent.webSources
                  : undefined,
              summonedTool: summonedToolFromStream,
              visualizerSpec: summonedVisualizerSpec,
              detectedContextText,
              isInterrupted: potentiallyHalted,
              interruptedReason: potentiallyHalted
                ? 'This explanation appears to have stopped early. Click Resume to finish it seamlessly.'
                : undefined,
            };

            // Let the dynamic typewriter finish gliding through any final buffered characters smoothly (max 750ms)
            if (!userHaltedRef.current && streamedAnswerAcc.trim().length > 0) {
              setLiveStreamState((prev) =>
                prev
                  ? {
                      ...prev,
                      thoughtText: finalThoughtText || prev.thoughtText,
                      rawAnswerText: finalRawReply,
                      phase: 'streaming',
                      thoughtDurationSec:
                        streamedThoughtDurationSec ?? Number(thoughtSecStr),
                      isComplete: true,
                    }
                  : prev
              );

              await new Promise<void>((resolve) => {
                let settled = false;
                const finish = () => {
                  if (settled) return;
                  settled = true;
                  typewriterSettledResolverRef.current = null;
                  resolve();
                };
                typewriterSettledResolverRef.current = finish;
                window.setTimeout(finish, 750);
              });
            }

            setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
            onNewMessage(newMsg);
            committedFromStream = true;

            if (autoVoiceReply && !potentiallyHalted) {
              await speakTutorExplanation(newMsg);
            }
          }
        }
      } catch (streamErr) {
        if (userHaltedRef.current || streamErr instanceof RetryableHttpError) {
          throw streamErr;
        }
        // Transient stream interruption before output arrived -> seamlessly fall back to /api/tutor/doubt with backoff
        if (!streamedAnswerAcc.trim()) {
          streamFallbackNeeded = true;
        } else {
          throw streamErr;
        }
      }

      if (committedFromStream) {
        return;
      }

      // Reliable non-streaming fallback if SSE stream could not complete before emitting output
      if (!streamFallbackNeeded) {
        throw new Error('Empty response received from stream');
      }

      const { result: data, attempts } = await postTutorRequestWithBackoff(
        requestPayload,
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
      const parsedChatDirective =
        typeof data.chatReply === 'string'
          ? parseAiVisualizerDirective(data.chatReply)
          : { cleanText: '', spec: null };
      const cleanChatReply =
        typeof data.chatReply === 'string' ? parsedChatDirective.cleanText : undefined;
      const summonedVisualizerSpec =
        sanitizeVisualizerSpec(data.visualizerSpec) ?? parsedChatDirective.spec ?? null;
      const fallbackThoughtText =
        typeof data.thoughtText === 'string' && data.thoughtText.trim()
          ? data.thoughtText.trim()
          : undefined;

      const potentiallyHalted =
        Boolean(data.truncated || data.isInterrupted) ||
        (isChatReply && isResponsePotentiallyHalted(cleanChatReply));

      const msgId = `dbt_${Date.now()}`;
      const newMsg: TutorMessage = {
        id: msgId,
        question: trimmed,
        responseType: isChatReply ? 'chat' : 'math',
        chatReply: cleanChatReply,
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
        thoughtDurationSec: fallbackThoughtText ? totalLatencySec : undefined,
        modelUsed: data.modelUsed || selectedModel,
        thoughtText: fallbackThoughtText,
        thinkingTrace:
          !fallbackThoughtText && Array.isArray(data.thinkingTrace) && data.thinkingTrace.length > 0
            ? [...data.thinkingTrace]
            : undefined,
        webSources: Array.isArray(data.webSources) ? data.webSources : undefined,
        summonedTool,
        visualizerSpec: summonedVisualizerSpec,
        detectedContextText,
        isInterrupted: potentiallyHalted,
        interruptedReason: potentiallyHalted
          ? 'This explanation appears to have stopped early. Click Resume to finish it seamlessly.'
          : undefined,
        retryCount: attempts - 1,
      };

      setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
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
      const partialCleaned = stripPartialSimDirective(streamedAnswerAcc).trim();
      const partialThought = streamedThoughtAcc.trim();
      const msgId = `dbt_${Date.now()}`;

      const haltedMsg: TutorMessage = {
        id: msgId,
        question: trimmed,
        responseType: 'chat',
        chatReply: wasUserStopped
          ? partialCleaned || `Generation paused before the explanation for **"${trimmed}"** finished.`
          : isStructuredApiConfigError
          ? `**Gemini API Setup Needed (${err.code || 'CONFIG_ERROR'})**\n\n${errMsg}`
          : partialCleaned ||
            `${fallback?.chatReply || `The explanation for **"${trimmed}"** was interrupted after automatic retries.`}`,
        conceptTitle: isStructuredApiConfigError
          ? `Gemini API Configuration (${selectedModel})`
          : `${board} Grade ${grade} — Interrupted Explanation`,
        prerequisiteRecap: '',
        steps: [],
        finalAnswer: '',
        examTip: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencySec: totalLatencySec,
        thoughtDurationSec: partialThought
          ? (streamedThoughtDurationSec ?? Number(totalLatencySec)).toFixed(1)
          : undefined,
        modelUsed: streamedModelLabel || selectedModel,
        thoughtText: partialThought || undefined,
        isInterrupted: !isStructuredApiConfigError,
        interruptedReason: wasUserStopped
          ? 'Explanation paused. Click Resume to continue from where it stopped.'
          : isStructuredApiConfigError
          ? undefined
          : `Connection interrupted (${errMsg}). Click Resume to complete the explanation.`,
        retryCount: wasUserStopped || isStructuredApiConfigError ? 0 : 1,
      };

      setExpandedThinkingIds((prev) => ({ ...prev, [msgId]: false }));
      onNewMessage(haltedMsg);
    } finally {
      userHaltedRef.current = false;
      typewriterSettledResolverRef.current?.();
      typewriterSettledResolverRef.current = null;
      setLiveStreamState(null);
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
      const parsedResumedDirective =
        typeof data.chatReply === 'string'
          ? parseAiVisualizerDirective(data.chatReply)
          : { cleanText: '', spec: null };
      const cleanResumedReply =
        typeof data.chatReply === 'string' ? parsedResumedDirective.cleanText : undefined;
      const mergedChatReply =
        isChatReply && existingPartial && cleanResumedReply
          ? mergeResumedExplanation(existingPartial, cleanResumedReply)
          : cleanResumedReply;
      const resumedVisualizerSpec =
        sanitizeVisualizerSpec(data.visualizerSpec) ?? parsedResumedDirective.spec ?? null;

      const stillHalted =
        Boolean(data.truncated || data.isInterrupted) ||
        (isChatReply && isResponsePotentiallyHalted(mergedChatReply));

      const applyUpdate = (prev: TutorMessage): TutorMessage => ({
        ...prev,
        responseType: isChatReply ? 'chat' : 'math',
        chatReply: isChatReply ? mergedChatReply : prev.chatReply,
        visualizerSpec: resumedVisualizerSpec ?? prev.visualizerSpec ?? null,
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

          {onOpenSimulationsLibrary && (
            <button
              type="button"
              onClick={() => onOpenSimulationsLibrary()}
              title="Browse all 8 interactive math simulations"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[11px] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Sliders className="w-3 h-3 text-sky-400" />
              <span>Simulations</span>
            </button>
          )}

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

      {/* Scratchpad now renders directly inside renderComposer so it works in both empty and active chat views */}

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
    <div className="w-full max-w-3xl mx-auto min-w-0">
      {showScratchpad && (
        <MathScratchpad
          onSolveSketch={solveScratchpadSketch}
          onSolveWithPrompt={(b64, customPrompt) => solveScratchpadSketch(b64, customPrompt)}
          onClose={() => setShowScratchpad(false)}
          isLoading={isLoading}
        />
      )}
    <div
      className={`w-full rounded-2xl sm:rounded-3xl fluent-composer-glass p-3 sm:p-3.5 ${
        isCenteredHero ? 'ring-1 ring-sky-500/15 dark:ring-sky-400/15' : ''
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
        <textarea
          ref={inputRef}
          id="doubt-question-input"
          name="ai-chat-prompt-no-autofill"
          rows={1}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          disabled={isLoading}
          value={questionInput}
          onChange={(e) => {
            setQuestionInput(expandLatexShortcuts(e.target.value));
          }}
          onPaste={handleComposerPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitMessage(questionInput);
            }
          }}
          placeholder={
            isLoading
              ? 'Thinking...'
              : isListening
              ? 'Listening... speak your math problem...'
              : 'Ask Pritesh Sir a math question...'
          }
          className="w-full resize-none bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none py-1.5 leading-snug max-h-36 overflow-y-auto disabled:opacity-50"
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
          {onOpenSimulationsLibrary && (
            <button
              type="button"
              data-testid="open-simulations-drawer-btn"
              onClick={() => onOpenSimulationsLibrary()}
              className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              title="Open Interactive Simulations Library (8 Live Labs)"
              aria-label="Open Simulations Library"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-500" />
              <span>Sims</span>
            </button>
          )}
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
              className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!questionInput.trim()}
              onClick={() => submitMessage(questionInput)}
              aria-label="Send message"
              className="w-8 h-8 rounded-full fluent-primary-btn disabled:opacity-35 text-white flex items-center justify-center"
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
  if (messages.length === 0 && !liveStreamState) {
    return (
      <section
        aria-label="Pritesh Sir's Maths AI Chat"
        className="min-h-[64vh] sm:min-h-[76vh] flex flex-col items-center justify-center px-1 sm:px-4 py-4 sm:py-6"
      >
        <div className="w-full max-w-3xl mx-auto text-center space-y-6 sm:space-y-7 my-auto py-4 sm:py-8">
          <div className="space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center justify-center gap-2 text-[11px] sm:text-xs font-mono text-sky-600 dark:text-sky-400 tracking-wide">
              <span className="w-5 h-5 rounded-lg bg-sky-500/15 border border-sky-500/30 inline-flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-sky-500" />
              </span>
              <span>STANDARD {grade} ({board}) · AI MATHS TUTOR</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white font-display">
              How can I help you today?
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/90 max-w-xl mx-auto leading-relaxed px-2">
              Ask any concept or problem, dictate by voice, sketch on the scratchpad, or pick a Standard {grade} ({board}) prompt below.
            </p>
          </div>

          {renderComposer(true)}

          <div
            aria-label="Calibrated quick prompts"
            className="flex flex-wrap items-center justify-center gap-2.5 pt-1 max-w-3xl mx-auto"
          >
            {starterPrompts.map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => submitMessage(promptText)}
                className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl fluent-glass-subtle hover:border-sky-500/45 hover:-translate-y-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 transition-all"
              >
                <span>{promptText}</span>
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all shrink-0" />
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
        <div className="no-print flex flex-col gap-2 rounded-2xl fluent-glass-subtle px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {['All', 'Trigonometry', 'Algebra', 'Mensuration', 'Commercial', 'Calculus'].map((chap) => (
                <button
                  key={chap}
                  type="button"
                  onClick={() => setChapterFilter(chap)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    chapterFilter === chap
                      ? 'fluent-primary-btn text-white font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10'
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
                  type="search"
                  name="thread-filter-no-autofill"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  value={threadSearchQuery}
                  onChange={(e) => setThreadSearchQuery(e.target.value)}
                  placeholder="Filter thread..."
                  aria-label="Filter conversation messages"
                  className="w-32 sm:w-40 pl-7 pr-2 py-1 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
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
          // Only display an inline simulation when explicitly summoned by the AI (or deterministic math engine)
          const parsedDisplayReply = msg.chatReply ? parseAiVisualizerDirective(msg.chatReply) : null;
          const displayChatReply = parsedDisplayReply ? parsedDisplayReply.cleanText : '';
          const inlineVisualizerSpec =
            sanitizeVisualizerSpec(msg.visualizerSpec) ?? parsedDisplayReply?.spec ?? null;

          const totalSteps = msg.steps.length;
          const visibleStepsCount = socraticMode
            ? Math.min(totalSteps, revealedStepsByMsg[msg.id] ?? 1)
            : totalSteps;

          return (
            <div
              key={msg.id}
              className="space-y-4 min-w-0 ai-msg-enter"
            >
              {/* User Prompt Turn with #10 Editable Prompt Action */}
              <div className="flex justify-end items-center gap-2 group min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setQuestionInput(msg.question);
                    inputRef.current?.focus();
                  }}
                  className="no-print opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-xs text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-opacity shrink-0"
                  title="Edit and re-ask this question"
                  aria-label="Edit question"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <div className="max-w-full sm:max-w-2xl rounded-2xl fluent-user-bubble text-slate-900 dark:text-slate-100 px-4 py-3 text-sm leading-relaxed break-words overflow-hidden">
                  {msg.question}
                </div>
              </div>

              {/* Auto-Detected Curriculum Notice */}
              {msg.detectedContextText && (
                <div className="text-xs font-mono text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{msg.detectedContextText}</span>
                </div>
              )}

              {/* Windows 11 Fluent Collapsible Reasoning Disclosure (frosted inset panel, zero left accent stripe) */}
              {(Boolean(msg.thoughtText?.trim()) ||
                (msg.thinkingTrace && msg.thinkingTrace.length > 0)) && (
                <div className="no-print space-y-2">
                  <button
                    type="button"
                    data-testid="completed-thinking-toggle"
                    aria-expanded={isThinkingOpen}
                    onClick={() =>
                      setExpandedThinkingIds((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg fluent-glass-subtle text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:border-sky-500/40 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
                    <span>
                      Thought for {msg.thoughtDurationSec || msg.latencySec || '1.0'}s
                    </span>
                    {isThinkingOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {isThinkingOpen && (
                    <div
                      data-testid="completed-thought-content"
                      className="rounded-xl fluent-glass-subtle px-3.5 py-2.5 max-h-64 overflow-y-auto space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
                    >
                      {msg.thoughtText?.trim() ? (
                        <div className="[&_p]:text-xs [&_p]:text-slate-600 dark:[&_p]:text-slate-300 [&_li]:text-xs [&_li]:text-slate-600 dark:[&_li]:text-slate-300 [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100">
                          <FormattedMathContent rawText={msg.thoughtText} />
                        </div>
                      ) : (
                        (msg.thinkingTrace || []).map((traceLine, tIdx) => (
                          <div key={tIdx} className="flex items-start gap-2 font-mono">
                            <span className="text-emerald-500">✓</span>
                            <span>{traceLine}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CASE A: NATURAL CONVERSATIONAL FLUENT GLASS CARD */}
              {isChatBubble ? (
                <article
                  data-testid="conversational-reply-card"
                  className={`rounded-2xl fluent-glass-card ${
                    compactDensity ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-200/60 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500 dark:text-sky-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white font-display">
                        Pritesh Sir&apos;s Maths AI
                      </span>
                      <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{chapterTag}</span>
                    </div>

                    <div className="no-print flex items-center gap-1">
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

                      <button
                        type="button"
                        data-testid="regenerate-reply-btn"
                        disabled={isLoading || resumingMsgId !== null}
                        onClick={() => submitMessage(msg.question, undefined, undefined, true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        title="Regenerate a fresh explanation"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden sm:inline">Regenerate</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
                    onClick={(e) => {
                      const target = e.target as HTMLElement | null;
                      const katexEl = target?.closest('.katex') as HTMLElement | null;
                      if (katexEl) {
                        setZoomedEquationHtml(katexEl.outerHTML);
                      }
                    }}
                  >
                    {renderFormattedContent(displayChatReply)}
                  </div>

                  {/* #8 Automatic Common Trap Warnings */}
                  {(() => {
                    const traps = detectCommonMathTraps(`${msg.question} ${displayChatReply}`);
                    if (traps.length === 0) return null;
                    return (
                      <div className="no-print rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs space-y-1">
                        <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Common Exam Trap to Watch</span>
                        </div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                          <strong className="text-slate-900 dark:text-white">{traps[0].title}:</strong>{' '}
                          {traps[0].warning}
                        </p>
                      </div>
                    );
                  })()}

                  {/* #3 ELI-Stuck, #6 Twin Problem, #67 Pin to Insights, #69 Send to Notes */}
                  <div className="no-print flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-white/10">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        submitMessage(
                          `Explain this more simply like I am stuck, using a clear everyday analogy and smaller steps: ${msg.question}`
                        )
                      }
                      className="px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    >
                      Simpler
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        const twin = generateTwinProblem(msg.question, grade);
                        submitMessage(
                          `Give me this twin practice problem and wait or guide me step by step: ${twin}`
                        );
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-600 dark:text-slate-300 disabled:opacity-40"
                    >
                      Twin Problem
                    </button>
                    {onSaveInsight && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveInsight({
                            id: `ins_${Date.now()}`,
                            title: msg.question.slice(0, 64),
                            chapter: chapterTag,
                            content: displayChatReply.slice(0, 420),
                            createdAt: new Date().toISOString(),
                          });
                          setStatusFeedback('Pinned to Saved Insights in Studio.');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-600 dark:text-slate-300"
                      >
                        <Pin className="w-3 h-3 text-amber-500" />
                        <span>Pin Insight</span>
                      </button>
                    )}
                    {onSendToNotes && (
                      <button
                        type="button"
                        onClick={() => {
                          onSendToNotes(msg.question.slice(0, 60), chapterTag, displayChatReply);
                          setStatusFeedback('Saved to Markdown Revision Notes in Studio.');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium fluent-control text-slate-600 dark:text-slate-300"
                      >
                        <BookOpen className="w-3 h-3 text-sky-500" />
                        <span>Save Note</span>
                      </button>
                    )}
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

                  {/* AI-Summoned Interactive Simulation (only shown when explicitly summoned by AI) */}
                  {inlineVisualizerSpec && (
                    <div className="space-y-1">
                      <InlineMathVisualizer spec={inlineVisualizerSpec} />
                      {onOpenSimulationsLibrary && (
                        <div className="no-print flex justify-end">
                          <button
                            type="button"
                            data-testid="expand-sim-in-library-btn"
                            onClick={() => onOpenSimulationsLibrary(inlineVisualizerSpec)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Open in Simulations Library</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

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
                /* CASE B: STEP-BY-STEP MATHEMATICAL DERIVATION FLUENT GLASS CARD */
                <article
                  className={`rounded-2xl fluent-glass-card ${
                    compactDensity ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-4'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500 dark:text-sky-400">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                        {msg.conceptTitle}
                      </h2>
                    </div>

                    <div className="no-print flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg, false)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                        <span>{isSpeakingId === msg.id ? 'Stop' : 'Listen'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl fluent-glass-subtle px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-800 dark:text-slate-100">Prerequisite Recap: </strong>
                    {renderFormattedContent(msg.prerequisiteRecap)}
                  </div>

                  <ol className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                    {msg.steps.slice(0, visibleStepsCount).map((stepStr, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl fluent-glass-subtle px-3.5 py-2.5 leading-relaxed"
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

                  {/* AI-Summoned Interactive Simulation for Math Derivation */}
                  {inlineVisualizerSpec && (
                    <div className="space-y-1">
                      <InlineMathVisualizer spec={inlineVisualizerSpec} />
                      {onOpenSimulationsLibrary && (
                        <div className="no-print flex justify-end">
                          <button
                            type="button"
                            data-testid="expand-sim-in-library-btn"
                            onClick={() => onOpenSimulationsLibrary(inlineVisualizerSpec)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Open in Simulations Library</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

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

        {/* REAL-TIME LIVE STREAMING TURN (Fluent Thinking Animations + Dynamic Typewriter Reveal) */}
        {liveStreamState && (
          <LiveStreamingTurn
            streamState={liveStreamState}
            retryStatus={retryStatus}
            onStop={handleStopGenerating}
            performanceModeActive={performanceModeActive}
            onTypewriterSettled={() => {
              typewriterSettledResolverRef.current?.();
            }}
          />
        )}

        <div ref={streamEndRef} className="h-4 scroll-mb-44" />
      </div>

      {/* Bottom Docked Acrylic Composer */}
      <div className="sticky bottom-[68px] md:bottom-0 z-20 pb-3 sm:pb-4 pt-5 min-w-0 bg-gradient-to-t from-[#edf2f8] via-[#edf2f8]/70 to-transparent dark:from-[#070b14] dark:via-[#070b14]/70 dark:to-transparent">
        {renderComposer(false)}
      </div>

      {/* #81 Click-to-Zoom Equation Modal */}
      {zoomedEquationHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setZoomedEquationHtml(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed mathematical equation"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full rounded-2xl fluent-glass-panel border p-6 space-y-4 text-center"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Equation Zoom View
              </span>
              <button
                type="button"
                onClick={() => setZoomedEquationHtml(null)}
                aria-label="Close zoomed equation"
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className="py-6 px-3 overflow-x-auto text-slate-900 dark:text-white [&_span.katex]:text-2xl sm:[&_span.katex]:text-3xl"
              dangerouslySetInnerHTML={{ __html: zoomedEquationHtml }}
            />
          </div>
        </div>
      )}
    </section>
  );
});
