import type { ChapterMasteryItem } from './adaptiveEngine';

export interface MasteryRadarPoint {
  axisLabel: string;
  fullChapter: string;
  chapterMastery: number;
  adaptiveBenchmark: number;
  delta: number;
  attempted: number;
  correct: number;
  masteryStatus: ChapterMasteryItem['masteryStatus'];
  unattempted: boolean;
}

export interface MasteryRadarSummary {
  adaptiveRating: number;
  benchmarkScore: number;
  tierLabel: 'Foundation' | 'Board Standard' | 'Challenging HOTS';
  attemptedChaptersCount: number;
  aboveBenchmarkCount: number;
  belowBenchmarkCount: number;
  strongestChapter: MasteryRadarPoint | null;
  priorityGapChapter: MasteryRadarPoint | null;
}

/**
 * Maps a student's Adaptive ELO Rating (600–2600) onto a 0–100 mastery benchmark index
 * so chapter-wise accuracy (%) can be visually compared directly against their ELO tier.
 *
 * Calibrated anchors:
 * - 1100 ELO (Foundation)  -> 57%
 * - 1350 ELO (Standard)    -> 73%
 * - 1450 ELO (Mastery)     -> 80%
 * - 1600 ELO (Challenging) -> 90%
 * - 1750+ ELO (Olympiad)   -> 100%
 */
export function normalizeAdaptiveRatingToScale(adaptiveRating: number): number {
  const safeRating = Number.isFinite(adaptiveRating) ? adaptiveRating : 1350;
  const scaled = Math.round(50 + (safeRating - 1000) / 15);
  return Math.max(20, Math.min(100, scaled));
}

export function getAdaptiveTierLabel(
  adaptiveRating: number
): 'Foundation' | 'Board Standard' | 'Challenging HOTS' {
  if (adaptiveRating >= 1480) return 'Challenging HOTS';
  if (adaptiveRating >= 1240) return 'Board Standard';
  return 'Foundation';
}

/**
 * Produces concise, readable axis labels for polar radar ticks without truncating mid-word awkwardly.
 */
export function shortenChapterLabel(chapter: string, maxLength = 18): string {
  const cleaned = chapter
    .replace(/^Ch(?:apter)?\s*\d+\s*[·:\-–]\s*/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Topic';
  if (cleaned.length <= maxLength) return cleaned;

  const abbreviations: Array<[RegExp, string]> = [
    [/Goods\s+(?:and|&)\s+Services\s+Tax/i, 'GST'],
    [/Trigonometrical\s+Identities/i, 'Trig Identities'],
    [/Rational\s+(?:and|&)\s+Irrational\s+Numbers/i, 'Surds & Irrat.'],
    [/Coordinate\s+Geometry/i, 'Coordinate Geo.'],
    [/Trigonometr(?:y|ical\s+Ratios)/i, 'Trigonometry'],
    [/Quadratic\s+Equations/i, 'Quadratics'],
    [/Compound\s+Interest/i, 'Compound Int.'],
    [/Circle\s+Chord\s+Properties/i, 'Circle Chords'],
    [/Arithmetic\s+(?:and|&)\s+Geometric\s+Progressions/i, 'AP & GP'],
    [/Simultaneous\s+Linear\s+Equations|Linear\s+Equations/i, 'Linear Eqns.'],
    [/Probability/i, 'Probability'],
    [/Limits\s+(?:and|&)\s+Derivatives/i, 'Limits & Deriv.'],
    [/Mensuration/i, 'Mensuration'],
  ];

  for (const [pattern, short] of abbreviations) {
    if (pattern.test(cleaned)) {
      return short;
    }
  }

  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Builds Recharts RadarChart data points mapping chapter-wise mastery levels (0–100%)
 * against the student's normalized Adaptive ELO Rating benchmark.
 */
export function buildMasteryRadarData(
  chapters: ChapterMasteryItem[],
  adaptiveRating: number,
  options: { maxAxes?: number; attemptedOnly?: boolean } = {}
): MasteryRadarPoint[] {
  const maxAxes = options.maxAxes ?? 8;
  const attemptedOnly = options.attemptedOnly ?? false;
  const benchmark = normalizeAdaptiveRatingToScale(adaptiveRating);

  const attempted = chapters
    .filter((ch) => ch.attempted > 0)
    .sort((a, b) => b.attempted - a.attempted || a.chapter.localeCompare(b.chapter));

  const unattempted = chapters
    .filter((ch) => ch.attempted === 0)
    .sort((a, b) => a.chapter.localeCompare(b.chapter));

  const pool =
    attemptedOnly && attempted.length >= 3
      ? attempted
      : [...attempted, ...unattempted];

  const selected = pool.slice(0, Math.max(3, maxAxes));

  const usedLabels = new Set<string>();
  return selected.map((item) => {
    let axisLabel = shortenChapterLabel(item.chapter);
    if (usedLabels.has(axisLabel)) {
      axisLabel = shortenChapterLabel(item.chapter, 22);
    }
    usedLabels.add(axisLabel);

    const mastery = item.attempted > 0 ? Math.max(0, Math.min(100, item.accuracyPercent)) : 0;
    return {
      axisLabel,
      fullChapter: item.chapter,
      chapterMastery: mastery,
      adaptiveBenchmark: benchmark,
      delta: mastery - benchmark,
      attempted: item.attempted,
      correct: item.correct,
      masteryStatus: item.masteryStatus,
      unattempted: item.attempted === 0,
    };
  });
}

/**
 * Computes summary alignment metrics comparing chapter mastery against the student's ELO rating.
 */
export function summarizeRadarAlignment(
  points: MasteryRadarPoint[],
  adaptiveRating: number
): MasteryRadarSummary {
  const benchmarkScore = normalizeAdaptiveRatingToScale(adaptiveRating);
  const attemptedPoints = points.filter((p) => !p.unattempted);

  const aboveBenchmarkCount = attemptedPoints.filter(
    (p) => p.chapterMastery >= benchmarkScore
  ).length;
  const belowBenchmarkCount = attemptedPoints.filter(
    (p) => p.chapterMastery < benchmarkScore
  ).length;

  const strongestChapter =
    attemptedPoints.length > 0
      ? [...attemptedPoints].sort(
          (a, b) => b.chapterMastery - a.chapterMastery || b.attempted - a.attempted
        )[0]
      : null;

  const priorityGapChapter =
    attemptedPoints.length > 0
      ? [...attemptedPoints].sort(
          (a, b) => a.delta - b.delta || b.attempted - a.attempted
        )[0]
      : points[0] || null;

  return {
    adaptiveRating,
    benchmarkScore,
    tierLabel: getAdaptiveTierLabel(adaptiveRating),
    attemptedChaptersCount: attemptedPoints.length,
    aboveBenchmarkCount,
    belowBenchmarkCount,
    strongestChapter,
    priorityGapChapter,
  };
}
