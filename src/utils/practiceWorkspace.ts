import type { AttemptEntry, ProblemItem } from './adaptiveEngine';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface ConfidenceCalibration {
  label: string;
  overconfident: boolean;
  underconfident: boolean;
  tone: 'emerald' | 'amber' | 'rose' | 'sky';
}

export interface SessionStats {
  attempted: number;
  correct: number;
  accuracyPercent: number;
  avgTimeSec: number;
}

/**
 * Toggles a problem or formula ID inside an immutable bookmark array.
 */
export function toggleIdInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * Toggles an MCQ option index in the per-problem strike-through elimination set.
 */
export function toggleOptionElimination(
  eliminatedByProblem: Record<string, number[]>,
  problemId: string,
  optionIndex: number
): Record<string, number[]> {
  const current = eliminatedByProblem[problemId] || [];
  const next = current.includes(optionIndex)
    ? current.filter((idx) => idx !== optionIndex)
    : [...current, optionIndex].sort((a, b) => a - b);
  return {
    ...eliminatedByProblem,
    [problemId]: next,
  };
}

/**
 * Evaluates student self-confidence against actual correctness to flag overconfidence traps.
 */
export function evaluateConfidenceCalibration(
  confidence: ConfidenceLevel | null,
  isCorrect: boolean
): ConfidenceCalibration | null {
  if (!confidence) return null;
  if (confidence === 'high' && !isCorrect) {
    return {
      label: 'Overconfidence Alert · Double-check sign & formula assumptions',
      overconfident: true,
      underconfident: false,
      tone: 'rose',
    };
  }
  if (confidence === 'low' && isCorrect) {
    return {
      label: 'Stronger Than You Thought · Trust your derivation',
      overconfident: false,
      underconfident: true,
      tone: 'sky',
    };
  }
  if (confidence === 'high' && isCorrect) {
    return {
      label: 'Well-Calibrated Mastery',
      overconfident: false,
      underconfident: false,
      tone: 'emerald',
    };
  }
  return {
    label: isCorrect ? 'Solid Progress' : 'Identified Gap · Review Steps',
    overconfident: false,
    underconfident: false,
    tone: isCorrect ? 'emerald' : 'amber',
  };
}

/**
 * Searches problems across chapter, exercise reference, question text, difficulty, and board.
 */
export function searchPracticeProblems(
  problems: ProblemItem[],
  query: string
): ProblemItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return problems;
  const tokens = q.split(/\s+/).filter(Boolean);
  return problems.filter((p) => {
    const haystack = `${p.chapter} ${p.exerciseRef} ${p.question} ${p.difficulty} ${p.board} std ${p.grade}`.toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}

/**
 * Picks the next problem prioritizing unsolved sums first, falling back to cyclic rotation.
 */
export function pickSmartNextProblemId(
  problems: ProblemItem[],
  currentProblemId: string,
  attempts: AttemptEntry[]
): string | null {
  if (problems.length === 0) return null;
  if (problems.length === 1) return problems[0].id;

  const solvedIds = new Set(attempts.filter((a) => a.isCorrect).map((a) => a.problemId));
  const currentIdx = Math.max(
    0,
    problems.findIndex((p) => p.id === currentProblemId)
  );

  // First look ahead for an unsolved problem
  for (let offset = 1; offset < problems.length; offset++) {
    const candidate = problems[(currentIdx + offset) % problems.length];
    if (!solvedIds.has(candidate.id)) {
      return candidate.id;
    }
  }

  // All problems solved at least once — advance sequentially
  return problems[(currentIdx + 1) % problems.length].id;
}

/**
 * Computes session summary statistics (accuracy & average solve time).
 */
export function computeSessionStats(sessionAttempts: AttemptEntry[]): SessionStats {
  const attempted = sessionAttempts.length;
  if (attempted === 0) {
    return { attempted: 0, correct: 0, accuracyPercent: 0, avgTimeSec: 0 };
  }
  const correct = sessionAttempts.filter((a) => a.isCorrect).length;
  const totalSec = sessionAttempts.reduce((sum, a) => sum + Math.max(0, a.timeSpentSec), 0);
  return {
    attempted,
    correct,
    accuracyPercent: Math.round((correct / attempted) * 100),
    avgTimeSec: Math.round(totalSec / attempted),
  };
}

/**
 * Escapes CSV cells against spreadsheet formula injection (=, +, -, @, tab, CR) and quotes.
 */
export function escapeCsvCell(value: string | number | boolean): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a clean, injection-safe CSV export of practice attempt history.
 */
export function buildAttemptsCsv(attempts: AttemptEntry[]): string {
  const header = [
    'Timestamp',
    'Problem ID',
    'Chapter',
    'Standard',
    'Board',
    'Difficulty',
    'Result',
    'Time (sec)',
    'ELO Delta',
  ].join(',');

  const rows = attempts.map((a) =>
    [
      escapeCsvCell(a.timestamp),
      escapeCsvCell(a.problemId),
      escapeCsvCell(a.chapter),
      escapeCsvCell(`Std ${a.grade}`),
      escapeCsvCell(a.board),
      escapeCsvCell(a.difficulty),
      escapeCsvCell(a.isCorrect ? 'Correct' : 'Incorrect'),
      escapeCsvCell(a.timeSpentSec),
      escapeCsvCell(a.ratingDelta),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Converts a LaTeX formula string into clean student-readable plaintext for quick pasting.
 */
export function latexToPlaintext(latex: string): string {
  return latex
    .replace(/\\begin\{gathered\}|\\end\{gathered\}/g, '')
    .replace(/\\\\(?:\[\d+pt\])?/g, ' ; ')
    .replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '$1√($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\operatorname\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\implies/g, '⇒')
    .replace(/\\perp/g, '⊥')
    .replace(/\\angle/g, '∠')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\pi/g, 'π')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\circ/g, '°')
    .replace(/\\quad|\\qquad|\\;/g, ' ')
    .replace(/\\(sin|cos|tan|cot|sec|csc|lim)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Repairs common LLM LaTeX delimiter variants (\[...\] -> $$...$$, \(...\) -> $...$).
 */
export function normalizeLatexDelimiters(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => `$$${inner.trim()}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => `$${inner.trim()}$`);
}

/**
 * Wraps standalone \begin{aligned|matrix|pmatrix|bmatrix|cases}...\end{...} blocks in $$...$$
 * without using RegExp lookbehind assertions, ensuring compatibility with Safari < 16.4 and older mobile WebViews.
 */
export function wrapStandaloneLatexEnvironments(rawText: string): string {
  if (!rawText) return '';
  return rawText.replace(
    /(^|[^$])\\begin\{(aligned|matrix|pmatrix|bmatrix|cases)\}([\s\S]*?)\\end\{\2\}(?!\$)/g,
    (_m, prefix: string, env: string, body: string) => `${prefix}$$\\begin{${env}}${body}\\end{${env}}$$`
  );
}

export interface ExportableTutorTurn {
  question: string;
  responseType?: 'chat' | 'math';
  chatReply?: string;
  conceptTitle: string;
  prerequisiteRecap: string;
  steps: string[];
  finalAnswer: string;
  examTip: string;
  timestamp: string;
}

/**
 * Formats a tutor conversation thread into clean Markdown notes ready for download.
 */
export function buildTutorMarkdownExport(
  messages: ExportableTutorTurn[],
  grade: string,
  board: string
): string {
  const chronological = [...messages].reverse();
  const lines: string[] = [
    `# Pritesh Sir's Maths App — Study Notes`,
    ``,
    `- **Curriculum:** Standard ${grade} (${board})`,
    `- **Exported:** ${new Date().toISOString()}`,
    `- **Total Turns:** ${chronological.length}`,
    ``,
    `---`,
    ``,
  ];

  chronological.forEach((msg, index) => {
    lines.push(`## Q${index + 1}: ${msg.question}`);
    lines.push(``);
    if (msg.responseType === 'chat' || (msg.chatReply && msg.steps.length === 0)) {
      lines.push(msg.chatReply || '');
    } else {
      lines.push(`**Concept:** ${msg.conceptTitle}`);
      if (msg.prerequisiteRecap) {
        lines.push(``, `> **Recap:** ${msg.prerequisiteRecap}`);
      }
      if (msg.steps.length > 0) {
        lines.push(``);
        msg.steps.forEach((step, idx) => {
          lines.push(`${idx + 1}. ${step}`);
        });
      }
      if (msg.finalAnswer) {
        lines.push(``, `**Final Answer:** ${msg.finalAnswer}`);
      }
      if (msg.examTip) {
        lines.push(``, `*Exam Tip:* ${msg.examTip}`);
      }
    }
    lines.push(``, `---`, ``);
  });

  return lines.join('\n');
}

/**
 * Formats stopwatch seconds as mm:ss.
 */
export function formatStopwatch(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
