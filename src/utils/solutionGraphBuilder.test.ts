import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSolutionGraphModel, getVisibleGraphSlice } from './solutionGraphBuilder';
import { ProblemItem } from './adaptiveEngine';

const sampleChordProblem: ProblemItem = {
  id: 'selina_9_chords_04',
  grade: '9',
  board: 'CBSE',
  chapter: 'Ch 17 · Circle Chord Properties',
  exerciseRef: 'Selina Class 9 Ex 17(A) · Q.6',
  difficulty: 'Standard',
  marks: 4,
  question: 'In a circle of radius 13 cm, a chord AB is 5 cm from centre O. Find AB.',
  options: ['24 cm', '12 cm', '10 cm', '26 cm'],
  correctIndex: 0,
  prerequisiteRecap: 'Perpendicular from centre bisects the chord.',
  shortcutTrick: '5-12-13 triple.',
  stepByStepSolution: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
};

const sampleCoordProblem: ProblemItem = {
  id: 'selina_9_coord_05',
  grade: '9',
  board: 'ICSE',
  chapter: 'Ch 26 · Coordinate Geometry',
  exerciseRef: 'Selina Class 9 Ex 26(A) · Q.7',
  difficulty: 'Standard',
  marks: 4,
  question: 'Vertices A(1,1), B(5,1), C(5,4). Find AC and angle B.',
  options: ['AC = 5, 90°', 'AC = 7, 60°', 'AC = 4, 90°', 'AC = 6, 45°'],
  correctIndex: 0,
  prerequisiteRecap: 'Distance formula.',
  shortcutTrick: '3-4-5 right triangle.',
  stepByStepSolution: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
};

const sampleGenericProblem: ProblemItem = {
  id: 'custom_generic_01',
  grade: '8',
  board: 'ICSE',
  chapter: 'Ch 14 · Linear Equations',
  exerciseRef: 'Ex 14(B)',
  difficulty: 'Foundation',
  marks: 3,
  question: 'Solve 2x + 4 = 10',
  options: ['x = 3', 'x = 2', 'x = 4', 'x = 5'],
  correctIndex: 0,
  prerequisiteRecap: 'Balance both sides.',
  shortcutTrick: 'Isolate x.',
  stepByStepSolution: ['2x = 6', 'x = 3'],
};

describe('solutionGraphBuilder', () => {
  it('builds geometric proof model for circle chord theorem with progressive step reveals', () => {
    const model = buildSolutionGraphModel(sampleChordProblem);
    assert.equal(model.kind, 'coordinate');
    assert.equal(model.categoryLabel, 'Geometric Proof');
    assert.ok(model.segments.some((s) => s.id === 'circle-outline'));
    assert.ok(model.markers.some((m) => m.id === 'O' && m.x === 0 && m.y === 0));

    const step0 = getVisibleGraphSlice(model, 0);
    const step3 = getVisibleGraphSlice(model, 3);
    assert.ok(step0.segments.length < step3.segments.length);
    assert.ok(step0.markers.length < step3.markers.length);
    assert.equal(step3.segments.length, model.segments.length);
  });

  it('builds Cartesian right-triangle proof for Coordinate Geometry problem', () => {
    const model = buildSolutionGraphModel(sampleCoordProblem);
    assert.equal(model.kind, 'coordinate');
    assert.match(model.categoryLabel, /Coordinate Geometry/i);
    assert.ok(model.markers.some((m) => m.id === 'A' && m.x === 1 && m.y === 1));
    assert.ok(model.markers.some((m) => m.id === 'B' && m.x === 5 && m.y === 1));
    assert.ok(model.markers.some((m) => m.id === 'C' && m.x === 5 && m.y === 4));

    const step1 = getVisibleGraphSlice(model, 1);
    const step3 = getVisibleGraphSlice(model, 3);
    assert.equal(step1.segments.some((s) => s.id === 'hyp-ac'), false);
    assert.equal(step3.segments.some((s) => s.id === 'hyp-ac'), true);
    assert.equal(step3.segments.some((s) => s.id === 'right-angle-box'), true);
  });

  it('falls back cleanly to derivation progress model for generic problems', () => {
    const model = buildSolutionGraphModel(sampleGenericProblem);
    assert.equal(model.kind, 'comparison');
    assert.equal(model.markers.length, 2);
    const slice0 = getVisibleGraphSlice(model, 0);
    assert.equal(slice0.markers.length, 1);
    const slice1 = getVisibleGraphSlice(model, 1);
    assert.equal(slice1.markers.length, 2);
  });
});
