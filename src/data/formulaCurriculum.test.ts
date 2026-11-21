import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMULA_CHAPTERS,
  getFormulaChaptersForCurriculum,
  filterFormulaChapters,
} from './formulaCurriculum';

describe('formulaCurriculum', () => {
  it('prioritizes ICSE Grade 9 chapters including ICSE-only Commercial Maths', () => {
    const chapters = getFormulaChaptersForCurriculum('ICSE', '9');
    assert.ok(chapters.length > 0);
    assert.ok(chapters.every((ch) => ch.boards.includes('ICSE')));
    assert.ok(chapters.some((ch) => ch.id === 'commercial-icse'));

    // First chapters should match Grade 9 directly
    const firstNonGrade9Index = chapters.findIndex((ch) => !ch.grades.includes('9'));
    if (firstNonGrade9Index !== -1) {
      for (let i = 0; i < firstNonGrade9Index; i++) {
        assert.ok(chapters[i].grades.includes('9'));
      }
      for (let i = firstNonGrade9Index; i < chapters.length; i++) {
        assert.ok(!chapters[i].grades.includes('9'));
      }
    }
  });

  it('excludes ICSE-only Commercial Maths when CBSE board is selected', () => {
    const cbseChapters = getFormulaChaptersForCurriculum('CBSE', '9');
    assert.ok(cbseChapters.length > 0);
    assert.ok(cbseChapters.every((ch) => ch.boards.includes('CBSE')));
    assert.equal(
      cbseChapters.some((ch) => ch.id === 'commercial-icse'),
      false
    );
  });

  it('filters chapters and individual formulas by search query', () => {
    const allIcse = getFormulaChaptersForCurriculum('ICSE', '9');
    const heronMatches = filterFormulaChapters(allIcse, 'Heron');
    assert.equal(heronMatches.length, 1);
    assert.equal(heronMatches[0].id, 'mensuration-heron');

    const latexMatches = filterFormulaChapters(allIcse, 'sec^2');
    assert.ok(latexMatches.length >= 1);
    assert.equal(latexMatches[0].id, 'trigonometry');
    assert.ok(latexMatches[0].formulas.some((f) => f.id === 'trig-pythagorean'));
  });

  it('ensures every formula item has non-empty LaTeX and tutor prompt', () => {
    for (const ch of FORMULA_CHAPTERS) {
      assert.ok(ch.formulas.length > 0, `Chapter ${ch.id} must have formulas`);
      for (const f of ch.formulas) {
        assert.ok(f.latex.trim().length > 0, `Formula ${f.id} needs latex`);
        assert.ok(f.askTutorPrompt.trim().length > 0, `Formula ${f.id} needs prompt`);
      }
    }
  });
});
