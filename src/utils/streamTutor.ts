import type { InlineVisualizerSpec } from './visualizerDetector';

export type TutorStreamEvent =
  | {
      type: 'meta';
      modelUsed: string;
      detectedGrade?: string;
      detectedBoard?: string;
      summonTool?: string | null;
    }
  | { type: 'thought'; delta: string }
  | { type: 'token'; delta: string }
  | {
      type: 'done';
      cleanText: string;
      thoughtText: string;
      visualizerSpec: InlineVisualizerSpec | null;
      webSources: Array<{ title: string; url: string; snippet: string }>;
      modelUsed: string;
      detectedGrade?: string;
      detectedBoard?: string;
      summonTool?: string | null;
      truncated?: boolean;
    }
  | {
      type: 'error';
      status?: number;
      code?: string;
      error: string;
      retryable?: boolean;
      modelUsed?: string;
    };

/**
 * Incrementally parses Server-Sent Events (`data: {...}\n\n`) from a streaming text buffer.
 * Returns parsed events plus any incomplete trailing buffer to carry into the next read.
 */
export function parseSseChunkBuffer(
  existingBuffer: string,
  incomingChunk: string
): { events: TutorStreamEvent[]; remainder: string } {
  const combined = (existingBuffer + incomingChunk).replace(/\r\n/g, '\n');
  const frames = combined.split('\n\n');
  const remainder = frames.pop() ?? '';
  const events: TutorStreamEvent[] = [];

  for (const frame of frames) {
    const lines = frame.split('\n');
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) continue;
    const payloadStr = dataLines.join('\n').trim();
    if (!payloadStr || payloadStr === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payloadStr) as TutorStreamEvent;
      if (parsed && typeof parsed.type === 'string') {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed heartbeat/comment frames
    }
  }

  return { events, remainder };
}

/**
 * Strips both completed `[[SIM:...]]` tags and any in-progress trailing `[[SIM:...`
 * prefix while tokens are actively streaming so raw directive syntax never flickers in the UI.
 */
export function stripPartialSimDirective(streamText: string): string {
  if (!streamText) return '';
  let cleaned = streamText.replace(/\[\[SIM:[^\]]*\]\]/gi, '');
  // Hide an incomplete trailing `[[`, `[[S`, `[[SI`, `[[SIM:...` tag while streaming
  cleaned = cleaned.replace(/\[\[(?:S(?:I(?:M(?::[^\]]*)?)?)?)?$/i, '');
  return cleaned.replace(/\n{3,}/g, '\n\n').trimEnd();
}

/**
 * Extracts a concise ChatGPT-style live status headline from Gemini's streaming thought summary
 * (e.g. "**Analyzing the quadratic roots**" -> "Analyzing the quadratic roots").
 */
export function extractThoughtHeadline(thoughtText: string): string {
  const trimmed = (thoughtText || '').trim();
  if (!trimmed) return 'Thinking';

  // Prefer the latest bold markdown heading that Gemini thought summaries emit (e.g. **Checking roots**)
  const boldMatches = [...trimmed.matchAll(/\*\*([^*\n]{3,80})\*\*/g)];
  if (boldMatches.length > 0) {
    const latest = boldMatches[boldMatches.length - 1][1]
      .replace(/[:.]+$/, '')
      .trim();
    if (latest.length >= 3) {
      return latest;
    }
  }

  // Fallback: last non-empty line trimmed cleanly
  const lines = trimmed
    .split('\n')
    .map((l) => l.replace(/^[-*#\d.)\s]+/, '').trim())
    .filter((l) => l.length >= 6);
  if (lines.length === 0) return 'Thinking';
  const last = lines[lines.length - 1];
  return last.length > 64 ? `${last.slice(0, 61).trimEnd()}…` : last;
}
