import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInlineVisualizerSpec,
  filterSimulationCatalog,
  parseAiVisualizerDirective,
  sanitizeVisualizerSpec,
  SIMULATION_CATALOG,
} from './visualizerDetector';
import { classifyMessageChapter } from './tutorEnhancements';

test('parseAiVisualizerDirective parses explicit AI-summoned simulations and strips raw directive tags', () => {
  const quad = parseAiVisualizerDirective(
    'Here is how the parabola opens upward.\n\n[[SIM:quadratic a=1 b=-4 c=3]]'
  );
  assert.equal(quad.cleanText, 'Here is how the parabola opens upward.');
  assert.deepEqual(quad.spec, { kind: 'quadratic', a: 1, b: -4, c: 3 });

  const trig = parseAiVisualizerDirective('Standard angle check:\n[[SIM:trig angle=60]]');
  assert.equal(trig.cleanText, 'Standard angle check:');
  assert.deepEqual(trig.spec, { kind: 'trig', initialAngleDeg: 60 });

  const cone = parseAiVisualizerDirective(
    'Slant height is 10 cm.\n[[SIM:mensuration shape=cone radius=6 height=8]]'
  );
  assert.equal(cone.cleanText, 'Slant height is 10 cm.');
  assert.deepEqual(cone.spec, { kind: 'mensuration', shape: 'cone', radius: 6, height: 8 });

  const gp = parseAiVisualizerDirective(
    'Each term doubles.\n[[SIM:progression mode=GP a=2 step=3 n=5]]'
  );
  assert.deepEqual(gp.spec, { kind: 'progression', mode: 'GP', a: 2, step: 3, n: 5 });

  const greeting = parseAiVisualizerDirective(
    'Hello! Whether you are working on Mensuration or Algebra, ask me anything!'
  );
  assert.equal(greeting.spec, null);
  assert.match(greeting.cleanText, /Mensuration/);
});

test('sanitizeVisualizerSpec clamps out-of-range values and rejects unknown kinds', () => {
  assert.equal(sanitizeVisualizerSpec(null), null);
  assert.equal(sanitizeVisualizerSpec({ kind: 'unknown' }), null);
  assert.deepEqual(sanitizeVisualizerSpec({ kind: 'trig', initialAngleDeg: 999 }), {
    kind: 'trig',
    initialAngleDeg: 180,
  });
  assert.deepEqual(sanitizeVisualizerSpec({ kind: 'quadratic', a: 0, b: -4, c: 3 }), {
    kind: 'quadratic',
    a: 1,
    b: -4,
    c: 3,
  });
});

test('SIMULATION_CATALOG lists all 8 interactive simulations with presets', () => {
  assert.equal(SIMULATION_CATALOG.length, 8);
  const kinds = new Set(SIMULATION_CATALOG.map((c) => c.id));
  assert.equal(kinds.size, 8);
  for (const item of SIMULATION_CATALOG) {
    assert.ok(item.title.length > 0);
    assert.ok(item.presets.length >= 3);
    assert.ok(sanitizeVisualizerSpec(item.defaultSpec) !== null);
  }
});

test('detectInlineVisualizerSpec ignores greetings even when AI reply mentions Mensuration or Algebra', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'hi',
    conceptTitle: 'AI Assistant',
    chatReply:
      'Hello! Whether you are struggling with Logarithms, stuck on a Mensuration proof, or simplifying Algebraic Expressions, let me know!',
  });
  assert.equal(spec, null);
});

test('detectInlineVisualizerSpec detects Trigonometry and extracts standard angle from question', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'Explain sin 60° and cos 60° in trigonometry',
  });
  assert.deepEqual(spec, { kind: 'trig', initialAngleDeg: 60 });
});

test('detectInlineVisualizerSpec detects Quadratic equations and extracts a, b, c', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'Solve 2x^2 - 5x + 3 = 0 by factorization',
  });
  assert.deepEqual(spec, { kind: 'quadratic', a: 2, b: -5, c: 3 });
});

test('detectInlineVisualizerSpec detects Coordinate Geometry with two points', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'Find the distance and slope between (-1, 2) and (3, 5)',
  });
  assert.deepEqual(spec, { kind: 'coordinate', x1: -1, y1: 2, x2: 3, y2: 5 });
});

test('detectInlineVisualizerSpec detects Circle Theorems and central angle', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'In a circle theorem with central angle 120° and radius 7, find inscribed angle',
  });
  assert.deepEqual(spec, { kind: 'circle', initialAngleDeg: 120, radius: 7 });
});

test('detectInlineVisualizerSpec detects Compound Interest and parses P, R, T', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'Find compound interest on 12000 at 8% for 3 years',
  });
  assert.deepEqual(spec, { kind: 'compound_interest', principal: 12000, rate: 8, years: 3 });
});

test('detectInlineVisualizerSpec detects Calculus derivatives before trig fallback', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'Differentiate sin(x) at x = 1 using calculus',
  });
  assert.deepEqual(spec, { kind: 'calculus', preset: 'sin', initialX: 1 });
});

test('detectInlineVisualizerSpec detects AP and GP progressions', () => {
  const ap = detectInlineVisualizerSpec({
    question: 'Find 10th term of AP with a = 3, d = 4, n = 10',
  });
  assert.deepEqual(ap, { kind: 'progression', mode: 'AP', a: 3, step: 4, n: 10 });

  const gp = detectInlineVisualizerSpec({
    question: 'Find sum of first 5 terms of GP with a = 2, r = 3, n = 5',
  });
  assert.deepEqual(gp, { kind: 'progression', mode: 'GP', a: 2, step: 3, n: 5 });
});

test('detectInlineVisualizerSpec detects Mensuration solids (cone, cylinder, sphere)', () => {
  const cone = detectInlineVisualizerSpec({
    question: 'Find curved surface area and volume of a cone with radius 6 and height 8',
  });
  assert.deepEqual(cone, { kind: 'mensuration', shape: 'cone', radius: 6, height: 8 });
});

test('detectInlineVisualizerSpec returns null for non-visual general chat', () => {
  const spec = detectInlineVisualizerSpec({
    question: 'What is number system?',
    conceptTitle: 'General',
    chatReply: 'Natural numbers, whole numbers, integers, rational and irrational numbers.',
  });
  assert.equal(spec, null);
});

test('filterSimulationCatalog filters by category and search query accurately', () => {
  assert.equal(filterSimulationCatalog('', 'All').length, 8);
  assert.equal(filterSimulationCatalog('', 'Geometry & Trig').length, 3);
  assert.equal(filterSimulationCatalog('', 'Algebra & Calculus').length, 3);
  assert.equal(filterSimulationCatalog('', 'Commercial & Solids').length, 2);

  const coneMatches = filterSimulationCatalog('cone', 'All');
  assert.equal(coneMatches.length, 1);
  assert.equal(coneMatches[0].id, 'mensuration');

  const trigMatches = filterSimulationCatalog('unit circle', 'Geometry & Trig');
  assert.equal(trigMatches.length, 1);
  assert.equal(trigMatches[0].id, 'trig');

  assert.equal(filterSimulationCatalog('nonexistent_xyz', 'All').length, 0);
});

test('classifyMessageChapter labels greetings as General even if AI mentions Mensuration or Logarithms', () => {
  const label = classifyMessageChapter({
    question: 'hi',
    conceptTitle: "Pritesh Sir's AI Assistant",
    chatReply:
      'Hello! Whether you are struggling with Logarithms, stuck on a Mensuration proof, or simplifying Algebraic Expressions, ask away!',
  });
  assert.equal(label, 'General');

  const mensurationLabel = classifyMessageChapter({
    question: 'Find the curved surface area of a cone with radius 6 and height 8',
    conceptTitle: 'Mensuration',
  });
  assert.equal(mensurationLabel, 'Mensuration');

  const parabolaLabel = classifyMessageChapter({
    question: 'Visualize the parabola y = x^2 - 4x + 3 with an interactive simulation',
    conceptTitle: 'AI Assistant',
  });
  assert.equal(parabolaLabel, 'Algebra');
});

