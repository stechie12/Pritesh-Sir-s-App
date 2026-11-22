import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_CHAPTER_SIMULATIONS,
  GRADE_9_CHAPTER_SIMULATIONS,
  GRADE_10_CHAPTER_SIMULATIONS,
  computeChapterSimMetrics,
} from '../data/chapterSimulations';

test('Grade 9 has 16 unique chapters and Grade 10 has 18 unique chapters (1 simulation per chapter)', () => {
  assert.equal(GRADE_9_CHAPTER_SIMULATIONS.length, 16);
  assert.equal(GRADE_10_CHAPTER_SIMULATIONS.length, 18);

  const g9Nums = new Set(GRADE_9_CHAPTER_SIMULATIONS.map((c) => c.chapterNumber));
  const g10Nums = new Set(GRADE_10_CHAPTER_SIMULATIONS.map((c) => c.chapterNumber));
  assert.equal(g9Nums.size, 16);
  assert.equal(g10Nums.size, 18);

  for (const sim of ALL_CHAPTER_SIMULATIONS) {
    assert.ok(sim.controls.length >= 1, `${sim.id} must have interactive controls`);
    assert.ok(sim.keyFormulas.length >= 1, `${sim.id} must have LaTeX formulas`);
    assert.ok(sim.examTip.length >= 15, `${sim.id} must have an exam tip`);
    const metrics = computeChapterSimMetrics(sim.simKind, sim.defaultParams);
    assert.ok(metrics.headline.length > 5, `${sim.id} headline must compute cleanly`);
    assert.equal(metrics.readouts.length, 3, `${sim.id} must return 3 readouts`);
  }
});

test('Key Grade 9 & Grade 10 chapter simulations compute mathematically exact Selina textbook answers', () => {
  // Grade 9 Ch 10 Pythagoras (3, 4, 5)
  const pyth = computeChapterSimMetrics('g9_pythagoras', { a: 3, b: 4 });
  assert.ok(pyth.headline.includes('25'));
  assert.ok(pyth.readouts[2].value.includes('5'));

  // Grade 10 Ch 1 GST: MP 15000, 20% discount -> SP 12000, 18% GST -> 14160
  const gst = computeChapterSimMetrics('g10_gst', {
    mp: 15000,
    discount: 20,
    gstRate: 18,
    interState: 0,
  });
  assert.ok(gst.headline.includes('14160'));
  assert.ok(gst.readouts[1].value.includes('1080'));

  // Grade 10 Ch 2 Banking RD: P=1000, n=36, r=8% -> MV = 40440
  const rd = computeChapterSimMetrics('g10_banking_rd', {
    monthlyP: 1000,
    months: 36,
    rate: 8,
  });
  assert.ok(rd.headline.includes('40440'));

  // Grade 10 Ch 16 Sphere R=6 recast to Cone r=12 -> h=6
  const recast = computeChapterSimMetrics('g10_mensuration_recast', {
    sphereR: 6,
    coneR: 12,
  });
  assert.ok(recast.headline.includes('= 6 cm'));

  // Grade 10 Ch 17 Two-boat cliff h=120, 30° and 45° -> 87.85 m
  const hd = computeChapterSimMetrics('g10_heights_distances', {
    height: 120,
    farAngle: 30,
    nearAngle: 45,
  });
  assert.ok(hd.headline.includes('87.85'));
});
