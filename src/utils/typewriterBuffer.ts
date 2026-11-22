import { extractThoughtHeadline } from './streamTutor';

export interface TypewriterStepOptions {
  /** Current number of revealed characters */
  currentLength: number;
  /** Full target text currently buffered from the SSE stream */
  targetText: string;
  /** Frame elapsed time in milliseconds (clamped defensively) */
  deltaMs: number;
  /** True once the SSE stream has finished sending tokens */
  isStreamComplete?: boolean;
  /** True when user prefers reduced motion — reveals full buffer immediately */
  reducedMotion?: boolean;
}

const DEFAULT_THINKING_STAGES = [
  'Analyzing your question',
  'Mapping syllabus concepts',
  'Reasoning step by step',
  'Checking algebraic accuracy',
] as const;

/**
 * Pure deterministic pacing function for silky, adaptive ChatGPT / Copilot-style
 * dynamic typing reveal over SSE chunks.
 *
 * - Keeps a calm, readable base speed when backlog is small (~55 chars/sec)
 * - Smoothly accelerates proportional to buffered backlog so long math
 *   derivations never fall painfully behind the live SSE stream
 * - Avoids stopping right in the middle of a LaTeX backslash command (e.g. `\fra`)
 *   when the rest of the command is already in the buffer, preventing visual flicker.
 */
export function computeNextRevealedLength({
  currentLength,
  targetText,
  deltaMs,
  isStreamComplete = false,
  reducedMotion = false,
}: TypewriterStepOptions): number {
  const targetLen = targetText.length;
  if (targetLen <= 0) return 0;

  const clampedCurrent = Math.max(0, Math.min(currentLength, targetLen));
  if (clampedCurrent >= targetLen) return targetLen;
  if (reducedMotion) return targetLen;

  // Clamp frame delta so tab-switch pauses don't cause erratic math
  const safeDeltaMs = Math.max(0, Math.min(deltaMs, 120));
  if (safeDeltaMs === 0) return clampedCurrent;

  const backlog = targetLen - clampedCurrent;

  // Adaptive velocity in characters per second:
  // Base 52 cps + proportional catch-up based on queue size.
  // When stream is already done, finish briskly (~2.2x) so final handoff feels crisp.
  const baseCps = isStreamComplete ? 140 : 52;
  const catchupMultiplier = isStreamComplete ? 2.4 : 1.35;
  const charsPerSec = Math.min(480, baseCps + backlog * catchupMultiplier);

  // Guarantee at least 1 char advance on any active frame >= 12ms when backlog > 0
  const rawStep = (charsPerSec * safeDeltaMs) / 1000;
  const step = Math.max(safeDeltaMs >= 12 ? 1 : 0, Math.round(rawStep));
  if (step <= 0) return clampedCurrent;

  let nextLen = Math.min(targetLen, clampedCurrent + step);

  // Avoid slicing right inside a LaTeX command like `\frac` or `\sqrt` if the
  // full command letters are already present in targetText (max +12 char lookahead).
  if (nextLen < targetLen) {
    nextLen = avoidMidLatexCommandSplit(targetText, nextLen);
  }

  return Math.min(targetLen, Math.max(clampedCurrent, nextLen));
}

/**
 * Checks whether `index` lands inside a `\commandName` token (e.g. `\fr|ac`) and,
 * if the command completes within 12 characters, advances past the command letters
 * so KaTeX / markdown never flickers on half-typed commands.
 */
export function avoidMidLatexCommandSplit(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index;

  // Walk backwards at most 14 chars looking for a backslash preceded by non-backslash
  let scan = index - 1;
  const minScan = Math.max(0, index - 14);
  while (scan >= minScan && /[a-zA-Z]/.test(text[scan])) {
    scan--;
  }

  if (scan >= 0 && text[scan] === '\\' && (scan === 0 || text[scan - 1] !== '\\')) {
    // Only snap forward if the character at `index` is still part of the command name
    if (/[a-zA-Z]/.test(text[index])) {
      let end = index;
      const maxEnd = Math.min(text.length, index + 12);
      while (end < maxEnd && /[a-zA-Z]/.test(text[end])) {
        end++;
      }
      return end;
    }
  }

  return index;
}

/**
 * Returns the crispest thinking headline for the live Fluent thinking card:
 * - Uses Gemini's actual streamed thought heading once any thought text arrives.
 * - While waiting for the very first thought packet, cycles gently through
 *   clear mathematical reasoning stages based on elapsed time.
 */
export function buildThinkingStageLabel(elapsedMs: number, thoughtText: string): string {
  const realHeadline = extractThoughtHeadline(thoughtText);
  if (realHeadline && realHeadline !== 'Thinking') {
    return realHeadline;
  }

  const safeElapsed = Math.max(0, elapsedMs);
  const stageIdx = Math.min(
    DEFAULT_THINKING_STAGES.length - 1,
    Math.floor(safeElapsed / 2400)
  );
  return DEFAULT_THINKING_STAGES[stageIdx];
}
