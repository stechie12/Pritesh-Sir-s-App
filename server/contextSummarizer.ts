import type { Request, Response, NextFunction } from 'express';

export interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ContextSummaryResult {
  history: HistoryTurn[];
  wasSummarized: boolean;
  originalChars: number;
  summarizedChars: number;
  savedChars: number;
  removedVisualizerTags: number;
  removedDuplicateTurns: number;
  summarizedTurnCount: number;
}

export interface ContextSummarizerOptions {
  /** Character budget across history before older turns are compacted into a digest. */
  maxRawChars?: number;
  /** Number of history turns beyond which older turns are compacted even if chars are moderate. */
  maxRawTurns?: number;
  /** How many most recent turns to retain verbatim (after stripping stale visualizer specs). */
  keepRecentTurns?: number;
  /** Maximum characters kept per single recent turn before smart middle-truncation. */
  maxSingleTurnChars?: number;
}

const DEFAULT_MAX_RAW_CHARS = 3400;
const DEFAULT_MAX_RAW_TURNS = 6;
const DEFAULT_KEEP_RECENT_TURNS = 4;
const DEFAULT_MAX_SINGLE_TURN_CHARS = 1100;

/**
 * Strips stale `[[SIM:...]]` directives, raw visualizer JSON payloads, verbose
 * code fences describing visualizers, and redundant whitespace/greetings from
 * historical conversation turns so the model never wastes tokens or echoes
 * outdated interactive widgets.
 */
export function stripVisualizerSpecsAndNoise(text: string): {
  cleaned: string;
  removedVisualizerTags: number;
} {
  if (typeof text !== 'string' || !text) {
    return { cleaned: '', removedVisualizerTags: 0 };
  }

  let removed = 0;
  let working = text;

  // 1. Strip complete [[SIM:{...}]] directives
  working = working.replace(/\[\[\s*SIM\s*:[\s\S]*?\]\]/gi, () => {
    removed += 1;
    return '';
  });

  // 2. Strip any truncated/dangling [[SIM:... directive at end of an interrupted turn
  working = working.replace(/\[\[\s*SIM\s*:[\s\S]*$/gi, () => {
    removed += 1;
    return '';
  });

  // 3. Strip fenced JSON blocks that contain visualizer spec keys ("kind" + "params"/"title")
  working = working.replace(/```(?:json)?\s*\{[\s\S]*?"kind"\s*:\s*"[^"]+"[\s\S]*?\}\s*```/gi, () => {
    removed += 1;
    return '';
  });

  // 4. Strip inline raw visualizer JSON objects like {"kind":"quadratic","a":1,...}
  working = working.replace(
    /\{\s*"kind"\s*:\s*"(?:quadratic|trig|triangle|circle|mensuration|linear|apgp|stats|matrix|gst|banking|inequation|locus|probability|coordinate)"[^{}]{0,400}\}/gi,
    () => {
      removed += 1;
      return '';
    }
  );

  // 5. Collapse excessive blank lines and trailing spaces
  working = working
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleaned: working, removedVisualizerTags: removed };
}

/**
 * Detects whether the student's current prompt looks like a follow-up answer
 * to a recent quiz/exercise so we preserve slightly more immediate context.
 */
function isQuizOrStepFollowUp(question: string): boolean {
  const q = (question || '').trim().toLowerCase();
  if (!q) return false;
  if (/^(?:q\s*1|1[\).:\s]|a\b|b\b|c\b|d\b|option|my answer|check my|grade|verify)/i.test(q)) {
    return true;
  }
  if (/\b(?:answer|answers|check this|is it right|step\s*\d|next step|why did you)\b/i.test(q)) {
    return true;
  }
  return q.length <= 40 && /\d/.test(q);
}

/**
 * Compacts a single overly long historical turn while keeping its opening
 * context and final conclusion/answer intact.
 */
function compactSingleTurn(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const headLen = Math.floor(maxChars * 0.58);
  const tailLen = Math.max(120, maxChars - headLen - 28);
  return `${text.slice(0, headLen).trimEnd()}\n… [middle omitted] …\n${text
    .slice(text.length - tailLen)
    .trimStart()}`;
}

/**
 * Extracts concise mathematical signals (equations, final answers, topic keywords)
 * from older turns to build a high-signal, low-token running digest.
 */
function buildOlderTurnsDigest(olderTurns: HistoryTurn[]): string {
  const topics: string[] = [];
  const equations: string[] = [];
  const userGoals: string[] = [];

  const topicMatcher =
    /\b(gst|banking|recurring deposit|shares|dividend|inequation|quadratic|discriminant|ratio|proportion|componendo|remainder|factor theorem|matrix|matrices|arithmetic progression|geometric progression|reflection|section formula|midpoint|straight line|slope|similarity|loci|locus|circle|tangent|chord|cyclic|mensuration|cone|sphere|cylinder|trigonometr\w*|identit\w*|heights? and distances?|ogive|median|mean|mode|probability|surds?|rationaliz\w*|compound interest|expansion|factoris\w*|simultaneous|indices|logarithm|pythagoras|congruen\w*|statistics|coordinate)\b/gi;

  const eqMatcher =
    /(?:\$[^$\n]{3,65}\$|[a-zA-Z0-9²³√θπ]+\s*=\s*[-+]?[a-zA-Z0-9²³√θπ./+*^() ]{1,42})/g;

  for (const turn of olderTurns) {
    const clean = turn.text.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    // Collect distinct syllabus topics
    const topicHits = clean.match(topicMatcher) || [];
    for (const hit of topicHits) {
      const normalized = hit.toLowerCase();
      if (!topics.includes(normalized) && topics.length < 6) {
        topics.push(normalized);
      }
    }

    // Collect key equations / final answers
    const eqHits = clean.match(eqMatcher) || [];
    for (const eq of eqHits) {
      const trimmedEq = eq.replace(/\$/g, '').trim();
      if (trimmedEq.length >= 4 && trimmedEq.length <= 58 && !equations.includes(trimmedEq)) {
        equations.push(trimmedEq);
      }
      if (equations.length >= 5) break;
    }

    // Collect concise user prompt goals (skip trivial greetings)
    if (turn.role === 'user' && clean.length >= 6 && !/^(hi|hello|hey|ok|okay|thanks|thank you|cool|nice)[!.\s]*$/i.test(clean)) {
      const snippet = clean.slice(0, 72) + (clean.length > 72 ? '…' : '');
      if (userGoals.length < 4) {
        userGoals.push(snippet);
      }
    }
  }

  const lines: string[] = [
    `[Context Summary of ${olderTurns.length} earlier turns — compact digest]`,
  ];
  if (topics.length > 0) {
    lines.push(`Topics covered: ${topics.join(', ')}.`);
  }
  if (userGoals.length > 0) {
    lines.push(`Earlier questions: ${userGoals.join(' | ')}.`);
  }
  if (equations.length > 0) {
    lines.push(`Key expressions/results: ${equations.join('; ')}.`);
  }
  return lines.join('\n');
}

/**
 * Pure, deterministic context summarizer that intercepts outgoing chat history:
 * 1. Strips stale `[[SIM:...]]` tags and raw visualizer JSON from ALL history turns.
 * 2. Deduplicates consecutive identical or trivial filler turns.
 * 3. When total context exceeds `maxRawChars` or `maxRawTurns`, summarizes older
 *    turns into a compact digest while keeping the latest turns coherent and intact.
 */
export function summarizeConversationContext(
  params: {
    question: string;
    history: HistoryTurn[];
  },
  options: ContextSummarizerOptions = {}
): ContextSummaryResult {
  const maxRawChars = options.maxRawChars ?? DEFAULT_MAX_RAW_CHARS;
  const maxRawTurns = options.maxRawTurns ?? DEFAULT_MAX_RAW_TURNS;
  const baseKeepRecent = options.keepRecentTurns ?? DEFAULT_KEEP_RECENT_TURNS;
  const maxSingleTurnChars = options.maxSingleTurnChars ?? DEFAULT_MAX_SINGLE_TURN_CHARS;

  const rawHistory = Array.isArray(params.history) ? params.history : [];
  const originalChars = rawHistory.reduce(
    (sum, item) => sum + (typeof item?.text === 'string' ? item.text.length : 0),
    0
  );

  if (rawHistory.length === 0) {
    return {
      history: [],
      wasSummarized: false,
      originalChars: 0,
      summarizedChars: 0,
      savedChars: 0,
      removedVisualizerTags: 0,
      removedDuplicateTurns: 0,
      summarizedTurnCount: 0,
    };
  }

  let removedVisualizerTags = 0;
  let removedDuplicateTurns = 0;

  // Step 1: Strip stale visualizer specs & noise from every turn, and deduplicate adjacent repeats
  const cleanedTurns: HistoryTurn[] = [];
  for (const item of rawHistory) {
    if (!item || (item.role !== 'user' && item.role !== 'model') || typeof item.text !== 'string') {
      continue;
    }
    const { cleaned, removedVisualizerTags: removedHere } = stripVisualizerSpecsAndNoise(item.text);
    removedVisualizerTags += removedHere;
    if (!cleaned) continue;

    const prev = cleanedTurns[cleanedTurns.length - 1];
    if (
      prev &&
      prev.role === item.role &&
      prev.text.toLowerCase().replace(/\s+/g, ' ') === cleaned.toLowerCase().replace(/\s+/g, ' ')
    ) {
      removedDuplicateTurns += 1;
      continue;
    }

    cleanedTurns.push({ role: item.role, text: cleaned });
  }

  const cleanedChars = cleanedTurns.reduce((sum, t) => sum + t.text.length, 0);
  const keepRecent = isQuizOrStepFollowUp(params.question)
    ? Math.max(baseKeepRecent, 6)
    : baseKeepRecent;

  let finalTurns: HistoryTurn[] = cleanedTurns;
  let summarizedTurnCount = 0;

  // Step 2: If context window is large, summarize older turns into a single compact digest
  if (
    cleanedTurns.length > keepRecent &&
    (cleanedChars > maxRawChars || cleanedTurns.length > maxRawTurns)
  ) {
    const splitIdx = cleanedTurns.length - keepRecent;
    const olderTurns = cleanedTurns.slice(0, splitIdx);
    const recentTurns = cleanedTurns
      .slice(splitIdx)
      .map((turn) => ({
        role: turn.role,
        text: compactSingleTurn(turn.text, maxSingleTurnChars),
      }));

    const digestText = buildOlderTurnsDigest(olderTurns);
    summarizedTurnCount = olderTurns.length;
    finalTurns = [
      { role: 'user', text: digestText },
      {
        role: 'model',
        text: 'Understood — I have the context summary above and will continue seamlessly.',
      },
      ...recentTurns,
    ];
  } else if (cleanedChars > maxRawChars) {
    // Even with few turns, compact any single massive model answer
    finalTurns = cleanedTurns.map((turn) => ({
      role: turn.role,
      text: compactSingleTurn(turn.text, maxSingleTurnChars),
    }));
  }

  const summarizedChars = finalTurns.reduce((sum, t) => sum + t.text.length, 0);
  const savedChars = Math.max(0, originalChars - summarizedChars);
  const wasSummarized =
    summarizedTurnCount > 0 ||
    removedVisualizerTags > 0 ||
    removedDuplicateTurns > 0 ||
    savedChars > 0;

  return {
    history: finalTurns,
    wasSummarized,
    originalChars,
    summarizedChars,
    savedChars,
    removedVisualizerTags,
    removedDuplicateTurns,
    summarizedTurnCount,
  };
}

/**
 * Express middleware that intercepts outgoing AI tutor requests (`/api/tutor/doubt`
 * and `/api/tutor/doubt/stream`) before validation & Gemini invocation, stripping
 * stale visualizer specs and compacting oversized conversation histories.
 */
export function contextSummarizerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    if (req.body && typeof req.body === 'object' && Array.isArray(req.body.history)) {
      const question = typeof req.body.question === 'string' ? req.body.question : '';
      const result = summarizeConversationContext({
        question,
        history: req.body.history as HistoryTurn[],
      });

      req.body.history = result.history;
      res.locals.contextSummary = {
        wasSummarized: result.wasSummarized,
        originalChars: result.originalChars,
        summarizedChars: result.summarizedChars,
        savedChars: result.savedChars,
        removedVisualizerTags: result.removedVisualizerTags,
        summarizedTurnCount: result.summarizedTurnCount,
      };

      if (result.wasSummarized && !res.headersSent) {
        res.setHeader('X-Context-Summarized', '1');
        res.setHeader('X-Context-Saved-Chars', String(result.savedChars));
      }
    }
  } catch {
    // Never block a student's question if summarization fails unexpectedly
  }
  next();
}
