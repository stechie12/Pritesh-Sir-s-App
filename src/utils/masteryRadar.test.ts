import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChapterMasteryItem } from './adaptiveEngine.ts';
import {
  buildMasteryRadarData,
  getAdaptiveTierLabel,
  normalizeAdaptiveRatingToScale,
  shortenChapterLabel,
  summarizeRadarAlignment,
} from './masteryRadar.ts';

const SAMPLE_CHAPTERS: ChapterMasteryItem[] = [
  {
    chapter: 'Ch 1 · Rational and Irrational Numbers',
    attempted: 5,
    correct: 5,
    accuracyPercent: 100,
    masteryStatus: 'Mastered',
  },
  {
    chapter: 'Ch 3 · Compound Interest',
    attempted: 4,
    correct: 2,
    accuracyPercent: 50,
    masteryStatus: 'Needs Review',
  },
  {
    chapter: 'Ch 4 · Expansions',
    attempted: 3,
    correct: 2,
    accuracyPercent: 67,
    masteryStatus: 'Developing',
  },
  {
    chapter: 'Ch 17 · Circle Chord Properties',
    attempted: 0,
    correct: 0,
    accuracyPercent: 0,
    masteryStatus: 'Developing',
  },
  {
    chapter: 'Ch 26 · Coordinate Geometry (Distance & Right-Triangle Proof)',
    attempted: 2,
    correct: 2,
    accuracyPercent: 100,
    masteryStatus: 'Mastered',
  },
];

test('normalizeAdaptiveRatingToScale maps ELO tiers monotonically within 20–100', () => {
  assert.equal(normalizeAdaptiveRatingToScale(1000), 50);
  assert.equal(normalizeAdaptiveRatingToScale(1350), 73);
  assert.equal(normalizeAdaptiveRatingToScale(1450), 80);
  assert.equal(normalizeAdaptiveRatingToScale(1600), 90);
  assert.equal(normalizeAdaptiveRatingToScale(2400), 100);
  assert.equal(normalizeAdaptiveRatingToScale(400), 20);

  assert.equal(getAdaptiveTierLabel(1150), 'Foundation');
  assert.equal(getAdaptiveTierLabel(1358), 'Board Standard');
  assert.equal(getAdaptiveTierLabel(1520), 'Challenging HOTS');
});

test('shortenChapterLabel strips chapter prefixes and parentheticals into concise polar ticks', () => {
  assert.equal(shortenChapterLabel('Ch 1 · Rational and Irrational Numbers'), 'Surds & Irrat.');
  assert.equal(
    shortenChapterLabel('Ch 26 · Coordinate Geometry (Distance & Right-Triangle Proof)'),
    'Coordinate Geo.'
  );
  assert.equal(shortenChapterLabel('Ch 4 · Expansions'), 'Expansions');
  assert.equal(shortenChapterLabel('Ch 17 · Circle Chord Properties'), 'Circle Chords');
});

test('buildMasteryRadarData prioritizes attempted chapters and calculates delta against adaptive rating', () => {
  const points = buildMasteryRadarData(SAMPLE_CHAPTERS, 1350, { maxAxes: 8 });
  assert.equal(points.length, 5);

  // Attempted chapters come first sorted by attempt count descending
  assert.equal(points[0].fullChapter, 'Ch 1 · Rational and Irrational Numbers');
  assert.equal(points[0].chapterMastery, 100);
  assert.equal(points[0].adaptiveBenchmark, 73);
  assert.equal(points[0].delta, 27);

  // Unattempted chapter stays at 0 mastery with unattempted flag
  const unattempted = points.find((p) => p.fullChapter.includes('Circle Chord'));
  assert.equal(unattempted?.unattempted, true);
  assert.equal(unattempted?.chapterMastery, 0);

  // attemptedOnly mode filters to attempted chapters when >= 3 exist
  const attemptedOnlyPoints = buildMasteryRadarData(SAMPLE_CHAPTERS, 1350, {
    attemptedOnly: true,
  });
  assert.equal(attemptedOnlyPoints.length, 4);
  assert.ok(attemptedOnlyPoints.every((p) => !p.unattempted));
});

test('summarizeRadarAlignment identifies strongest chapter and priority gap against ELO target', () => {
  const points = buildMasteryRadarData(SAMPLE_CHAPTERS, 1350);
  const summary = summarizeRadarAlignment(points, 1350);

  assert.equal(summary.benchmarkScore, 73);
  assert.equal(summary.tierLabel, 'Board Standard');
  assert.equal(summary.attemptedChaptersCount, 4);
  assert.equal(summary.aboveBenchmarkCount, 2); // 100%, 100%
  assert.equal(summary.belowBenchmarkCount, 2); // 50%, 67%
  assert.equal(summary.strongestChapter?.fullChapter, 'Ch 1 · Rational and Irrational Numbers');
  assert.equal(summary.priorityGapChapter?.fullChapter, 'Ch 3 · Compound Interest');
});
