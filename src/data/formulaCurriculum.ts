import { CurriculumBoard, GradeLevel } from '../utils/adaptiveEngine';

export interface FormulaItem {
  id: string;
  title: string;
  latex: string;
  variables: string;
  boardNote: string;
  askTutorPrompt: string;
}

export interface FormulaChapter {
  id: string;
  chapterNumber: string;
  title: string;
  boards: CurriculumBoard[];
  grades: GradeLevel[];
  summary: string;
  formulas: FormulaItem[];
}

export const FORMULA_CHAPTERS: FormulaChapter[] = [
  // ================= ALGEBRA & NUMBER SYSTEMS =================
  {
    id: 'surds-irrational',
    chapterNumber: 'Ch 01',
    title: 'Rational & Irrational Numbers (Surds)',
    boards: ['ICSE', 'CBSE'],
    grades: ['9', '10'],
    summary: 'Radical laws, conjugate pairs, and denominator rationalization.',
    formulas: [
      {
        id: 'surd-product',
        title: 'Product & Quotient Laws of Surds',
        latex: '\\begin{gathered} \\sqrt[n]{a} \\times \\sqrt[n]{b} = \\sqrt[n]{ab} \\\\[4pt] \\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}} \\end{gathered}',
        variables: 'a, b > 0 rational; n ≥ 2 integer order',
        boardNote: 'Simplify pure surds into mixed surds (e.g. √18 = 3√2) before adding like terms.',
        askTutorPrompt: 'Explain surds and laws of surds with worked examples',
      },
      {
        id: 'surd-rationalize',
        title: 'Binomial Conjugate Rationalization',
        latex: '\\frac{1}{a + b\\sqrt{c}} = \\frac{a - b\\sqrt{c}}{a^2 - b^2 c}',
        variables: '(a − b√c) is the rationalizing factor (conjugate) of (a + b√c)',
        boardNote: 'Selina Class 9 Ex 1(C): If a² − b²c = 1, then 1/x equals the conjugate directly.',
        askTutorPrompt: 'Rationalize 1 / (3 + 2√2) step by step',
      },
      {
        id: 'surd-reciprocal-square',
        title: 'Reciprocal Sum & Square Identity',
        latex: 'x^2 + \\frac{1}{x^2} = \\left(x + \\frac{1}{x}\\right)^2 - 2',
        variables: 'Find x + 1/x first after rationalizing 1/x',
        boardNote: 'Frequently tested 4-mark question in ICSE Standard 9 Term 1.',
        askTutorPrompt: 'If x = 2 + √3, find x^2 + 1/x^2',
      },
    ],
  },
  {
    id: 'expansions-polynomials',
    chapterNumber: 'Ch 02',
    title: 'Expansions & Algebraic Identities',
    boards: ['ICSE', 'CBSE'],
    grades: ['8', '9', '10'],
    summary: 'Binomial squares, cubic expansions, and three-term identities.',
    formulas: [
      {
        id: 'cubic-sum',
        title: 'Cube of a Binomial & Sum of Cubes',
        latex: '\\begin{gathered} (a \\pm b)^3 = a^3 \\pm b^3 \\pm 3ab(a \\pm b) \\\\[4pt] a^3 + b^3 = (a + b)(a^2 - ab + b^2) \\end{gathered}',
        variables: 'a, b are algebraic terms or real numbers',
        boardNote: 'Rearrange to a³ + b³ = (a + b)³ − 3ab(a + b) when given (a + b) and ab.',
        askTutorPrompt: 'If a + b = 6 and ab = 8, find a^3 + b^3',
      },
      {
        id: 'trinomial-square',
        title: 'Square of a Trinomial',
        latex: '(a + b + c)^2 = a^2 + b^2 + c^2 + 2(ab + bc + ca)',
        variables: 'Preserve signs of b and c when substituting negative terms',
        boardNote: 'Core identity across Selina Ch 4 (ICSE) and NCERT Ch 2 Polynomials (CBSE).',
        askTutorPrompt: 'Expand (2x - 3y + 4z)^2 using algebraic identities',
      },
      {
        id: 'conditional-cube',
        title: 'Zero-Sum Conditional Cubic Identity',
        latex: 'a + b + c = 0 \\implies a^3 + b^3 + c^3 = 3abc',
        variables: 'Applies whenever the three base terms sum to zero',
        boardNote: 'High-yield shortcut for numerical cubes like 12³ + (−7)³ + (−5)³.',
        askTutorPrompt: 'Evaluate 12^3 - 7^3 - 5^3 without cubing using conditional identity',
      },
    ],
  },
  {
    id: 'trigonometry',
    chapterNumber: 'Ch 03',
    title: 'Trigonometrical Ratios & Identities',
    boards: ['ICSE', 'CBSE'],
    grades: ['9', '10', '11', '12'],
    summary: 'Quotient, Pythagorean, complementary, and elevation relations.',
    formulas: [
      {
        id: 'trig-pythagorean',
        title: 'Fundamental Pythagorean Identities',
        latex: '\\begin{gathered} \\sin^2\\theta + \\cos^2\\theta = 1 \\\\[4pt] 1 + \\tan^2\\theta = \\sec^2\\theta, \\quad 1 + \\cot^2\\theta = \\csc^2\\theta \\end{gathered}',
        variables: '0° < θ < 90° for acute right-triangle proofs',
        boardNote: 'Rewrite sec²θ − tan²θ = 1 as (sec θ − tan θ)(sec θ + tan θ) = 1 in Section B proofs.',
        askTutorPrompt: 'Give me the complete trigonometric ratios table for 0 to 90 degrees',
      },
      {
        id: 'trig-quotient',
        title: 'Quotient & Reciprocal Ratios',
        latex: '\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}, \\quad \\cot\\theta = \\frac{\\cos\\theta}{\\sin\\theta}, \\quad \\sec\\theta = \\frac{1}{\\cos\\theta}',
        variables: 'At θ = 90°: cos 90° = 0, sin 90° = 1 ⇒ cot 90° = 0',
        boardNote: 'Converting LHS into sin θ and cos θ resolves 90% of identity proofs.',
        askTutorPrompt: 'What is cot 90 degrees?',
      },
      {
        id: 'trig-complementary',
        title: 'Complementary Angle Pairs',
        latex: '\\begin{gathered} \\sin(90^\\circ - \\theta) = \\cos\\theta, \\quad \\tan(90^\\circ - \\theta) = \\cot\\theta \\\\[4pt] \\sec(90^\\circ - \\theta) = \\csc\\theta \\end{gathered}',
        variables: 'Use when two acute angles add up to 90° (e.g. 18° and 72°)',
        boardNote: 'Transform only ONE angle in each complementary pair so factors cancel cleanly.',
        askTutorPrompt: 'Evaluate sin(18°)/cos(72°) + tan(26°)/cot(64°)',
      },
      {
        id: 'trig-heights',
        title: 'Dual-Angle Heights & Distances Shortcut',
        latex: 'd = h(\\cot\\alpha - \\cot\\beta), \\qquad \\alpha < \\beta',
        variables: 'h = vertical cliff/tower height; d = horizontal distance between two points',
        boardNote: 'Always draw the horizontal sightline first before marking angles of depression.',
        askTutorPrompt: 'Explain how to solve two-boat heights and distances problems',
      },
    ],
  },
  {
    id: 'coordinate-geometry',
    chapterNumber: 'Ch 04',
    title: 'Coordinate Geometry',
    boards: ['ICSE', 'CBSE'],
    grades: ['9', '10', '11'],
    summary: 'Distance, midpoint, section formula, slope, and collinearity tests.',
    formulas: [
      {
        id: 'coord-distance',
        title: 'Distance Formula Between Two Points',
        latex: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
        variables: 'P(x₁, y₁) and Q(x₂, y₂) on the Cartesian plane',
        boardNote: 'To prove a right triangle, show AB² + BC² = AC² without taking square roots first.',
        askTutorPrompt: 'Find the distance between A(1, 1) and C(5, 4) and verify right triangle with B(5, 1)',
      },
      {
        id: 'coord-section',
        title: 'Internal Section & Midpoint Formula',
        latex: '\\begin{gathered} P(x, y) = \\left(\\frac{m_1 x_2 + m_2 x_1}{m_1 + m_2},\\; \\frac{m_1 y_2 + m_2 y_1}{m_1 + m_2}\\right) \\\\[6pt] M = \\left(\\frac{x_1+x_2}{2},\\; \\frac{y_1+y_2}{2}\\right) \\end{gathered}',
        variables: 'P divides segment AB internally in ratio m₁ : m₂',
        boardNote: 'When finding the ratio cut by the x-axis, set y = 0 in the section formula directly.',
        askTutorPrompt: 'Find the point dividing A(-1, 7) and B(4, -3) in the ratio 2:3',
      },
      {
        id: 'coord-slope-line',
        title: 'Slope & Point-Slope Equation of a Line',
        latex: 'm = \\frac{y_2 - y_1}{x_2 - x_1} = \\tan\\theta, \\qquad y - y_1 = m(x - x_1)',
        variables: 'Parallel lines: m₁ = m₂ · Perpendicular lines: m₁ · m₂ = −1',
        boardNote: 'Essential for ICSE Standard 10 Equation of a Straight Line (Selina Ch 14).',
        askTutorPrompt: 'Find the equation of a line perpendicular to 2x + 3y = 6 passing through (1, 4)',
      },
    ],
  },
  {
    id: 'circle-geometry',
    chapterNumber: 'Ch 05',
    title: 'Circles & Geometric Proofs',
    boards: ['ICSE', 'CBSE'],
    grades: ['9', '10'],
    summary: 'Chord bisection, cyclic quadrilaterals, and tangent-chord theorems.',
    formulas: [
      {
        id: 'circle-chord-bisector',
        title: 'Perpendicular from Centre Bisects Chord',
        latex: '\\begin{gathered} OM \\perp AB \\implies AM = MB = \\sqrt{r^2 - d^2} \\\\[4pt] AB = 2\\sqrt{r^2 - d^2} \\end{gathered}',
        variables: 'r = radius OA; d = perpendicular distance OM from centre O',
        boardNote: 'Memorize Pythagorean triples (3,4,5), (5,12,13), (8,15,17) for chord sums.',
        askTutorPrompt: 'A chord of a circle of radius 13 cm is 5 cm from the centre. Find the chord length.',
      },
      {
        id: 'circle-angle-centre',
        title: 'Angle at Centre & Cyclic Quadrilateral',
        latex: '\\angle AOB = 2\\angle ACB, \\qquad \\angle A + \\angle C = 180^\\circ',
        variables: 'Angle in a semicircle is always 90°; opposite angles of cyclic quad are supplementary',
        boardNote: 'Always cite the exact theorem statement in brackets to earn full ICSE/CBSE proof marks.',
        askTutorPrompt: 'Explain angle at the centre theorem and cyclic quadrilateral properties',
      },
      {
        id: 'circle-tangent-secant',
        title: 'Tangent-Secant & Alternate Segment Theorem',
        latex: '\\begin{gathered} PT^2 = PA \\times PB \\\\[4pt] \\angle(\\text{tangent, chord}) = \\angle(\\text{alternate segment}) \\end{gathered}',
        variables: 'PT = tangent length from external point P; PAB = secant',
        boardNote: 'ICSE Class 10 Ch 18 favorite for combined chord-tangent calculation questions.',
        askTutorPrompt: 'Explain the Tangent-Secant Theorem PT^2 = PA × PB with an example',
      },
    ],
  },
  {
    id: 'commercial-icse',
    chapterNumber: 'Ch 06',
    title: 'Commercial Maths (Compound Interest, GST & Banking)',
    boards: ['ICSE'],
    grades: ['8', '9', '10'],
    summary: 'ICSE Selina commercial arithmetic: Compound Interest, GST, and Recurring Deposits.',
    formulas: [
      {
        id: 'icse-ci',
        title: 'Compound Interest & 2-Year CI − SI Difference',
        latex: 'A = P\\left(1 + \\frac{r}{100}\\right)^n, \\qquad \\text{CI}_2 - \\text{SI}_2 = P\\left(\\frac{r}{100}\\right)^2',
        variables: 'P = principal; r = rate % per period; n = number of compounding periods',
        boardNote: 'For half-yearly compounding, halve r and double n (2n).',
        askTutorPrompt: 'Find the difference between CI and SI on 12000 for 2 years at 5% p.a.',
      },
      {
        id: 'icse-rd',
        title: 'Recurring Deposit Interest & Maturity Value',
        latex: 'I = P \\times \\frac{n(n+1)}{2 \\times 12} \\times \\frac{r}{100}, \\qquad \\text{MV} = P \\cdot n + I',
        variables: 'P = monthly deposit; n = total months (always convert years × 12)',
        boardNote: 'ICSE Class 10 Ch 2 guaranteed 3–4 mark question in Section A.',
        askTutorPrompt: 'Explain the Recurring Deposit Maturity Value formula with an example',
      },
      {
        id: 'icse-gst',
        title: 'Intra-State vs Inter-State GST & ITC',
        latex: '\\begin{gathered} \\text{CGST} = \\text{SGST} = \\frac{1}{2}\\text{GST}\\%, \\qquad \\text{IGST} = \\text{GST}\\% \\\\[4pt] \\text{Net GST Payable} = \\text{Output Tax} - \\text{Input Tax (ITC)} \\end{gathered}',
        variables: 'Taxable Value = Marked Price − Discount (never tax discount)',
        boardNote: 'Apply discount first, then calculate CGST + SGST on the discounted selling price.',
        askTutorPrompt: 'How do you calculate CGST, SGST, and total bill after a 20% discount?',
      },
    ],
  },
  {
    id: 'mensuration-heron',
    chapterNumber: 'Ch 07',
    title: 'Mensuration, Solids & Heron’s Formula',
    boards: ['ICSE', 'CBSE'],
    grades: ['8', '9', '10'],
    summary: 'Triangle area, cylinders, cones, spheres, and volume conservation.',
    formulas: [
      {
        id: 'heron-area',
        title: 'Heron’s Formula for Triangle Area',
        latex: 's = \\frac{a + b + c}{2}, \\qquad \\text{Area} = \\sqrt{s(s-a)(s-b)(s-c)}',
        variables: 'a, b, c = triangle side lengths; s = semi-perimeter',
        boardNote: 'Core CBSE NCERT Class 9 Ch 10 & ICSE Class 9 Ch 20 formula — factor inside √ before multiplying.',
        askTutorPrompt: 'Find the area of a triangle with sides 13 cm, 14 cm, and 15 cm using Heron formula',
      },
      {
        id: 'cone-sphere-vol',
        title: 'Cylinder, Cone & Sphere Volumes',
        latex: '\\begin{gathered} V_{\\text{cyl}} = \\pi r^2 h, \\qquad V_{\\text{cone}} = \\frac{1}{3}\\pi r^2 h \\\\[4pt] V_{\\text{sphere}} = \\frac{4}{3}\\pi R^3 \\end{gathered}',
        variables: 'Slant height of cone: l = √(r² + h²) · CSA of cone = πrl',
        boardNote: 'In melting & recasting sums, keep π symbolic so it cancels on both sides.',
        askTutorPrompt: 'A sphere of radius 6 cm is melted into a cone of radius 12 cm. Find cone height.',
      },
    ],
  },
  {
    id: 'quadratic-calculus',
    chapterNumber: 'Ch 08',
    title: 'Quadratic Equations & Senior Calculus',
    boards: ['ICSE', 'CBSE'],
    grades: ['10', '11', '12'],
    summary: 'Discriminant root nature, Vieta relations, limits, and derivatives.',
    formulas: [
      {
        id: 'quad-sridharacharya',
        title: 'Quadratic Formula & Discriminant',
        latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}, \\qquad \\Delta = b^2 - 4ac',
        variables: 'Δ > 0 real & distinct · Δ = 0 real & equal · Δ < 0 no real roots',
        boardNote: 'Arrange strictly in ax² + bx + c = 0 before identifying a, b, and c.',
        askTutorPrompt: 'Solve x^2 - 5x + 6 = 0 using the quadratic formula',
      },
      {
        id: 'calc-limits',
        title: 'Standard Trigonometric & Power Limits',
        latex: '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1, \\qquad \\lim_{x \\to 0} \\frac{1 - \\cos kx}{x^2} = \\frac{k^2}{2}',
        variables: 'x must be measured in radians for trigonometric limits',
        boardNote: 'High-frequency Class 11 NCERT Ch 13 & ISC Section A MCQ identity.',
        askTutorPrompt: 'Differentiate x^3 * sin(x)',
      },
      {
        id: 'matrix-adjoint',
        title: 'Determinant of Adjoint Matrix',
        latex: 'A \\cdot \\operatorname{adj}(A) = |A| I_n, \\qquad |\\operatorname{adj}(A)| = |A|^{n-1}',
        variables: 'A is a non-singular n × n square matrix',
        boardNote: 'Class 12 CBSE NCERT Ex 4.5 & ISC Matrices & Determinants exam favorite.',
        askTutorPrompt: 'If A is a 3x3 matrix with determinant 5, what is |adj A|?',
      },
    ],
  },
  {
    id: 'ap-gp-progressions',
    chapterNumber: 'Ch 09',
    title: 'Arithmetic & Geometric Progressions (AP & GP)',
    boards: ['ICSE', 'CBSE'],
    grades: ['10', '11'],
    summary: 'nth term formulas, finite series sums, and three-term selection shortcuts.',
    formulas: [
      {
        id: 'ap-nth-sum',
        title: 'AP nth Term & Sum of n Terms',
        latex: '\\begin{gathered} T_n = a + (n - 1)d \\\\[4pt] S_n = \\frac{n}{2}\\left[2a + (n - 1)d\\right] = \\frac{n}{2}(a + l) \\end{gathered}',
        variables: 'a = first term · d = common difference · l = last term',
        boardNote: 'Choose 3 AP terms as (a − d), a, (a + d) so d cancels immediately in sum sums.',
        askTutorPrompt: 'Find the 10th term and sum of 10 terms of AP with a = 3, d = 4',
      },
      {
        id: 'gp-nth-sum',
        title: 'GP nth Term & Sum of n Terms',
        latex: '\\begin{gathered} T_n = a r^{n-1} \\\\[4pt] S_n = \\frac{a(r^n - 1)}{r - 1} \\quad (r \\ne 1), \\qquad S_\\infty = \\frac{a}{1 - r} \\; (|r| < 1) \\end{gathered}',
        variables: 'a = first term · r = common ratio (T₂ / T₁)',
        boardNote: 'Selina Class 10 Ch 11: Choose 3 GP terms as a/r, a, ar when their product is given.',
        askTutorPrompt: 'Find the 5th term and sum of 5 terms of GP with a = 2, r = 3',
      },
    ],
  },
  {
    id: 'matrices-2x2',
    chapterNumber: 'Ch 10',
    title: 'Matrices (2×2 Operations, Determinant & Inverse)',
    boards: ['ICSE', 'CBSE'],
    grades: ['10', '12'],
    summary: 'Matrix multiplication compatibility, determinant, and 2×2 inverse shortcut.',
    formulas: [
      {
        id: 'matrix-det-inv',
        title: '2×2 Determinant & Inverse Shortcut',
        latex: 'A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\implies |A| = ad - bc, \\qquad A^{-1} = \\frac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}',
        variables: 'Matrix A is invertible if and only if |A| = ad − bc ≠ 0',
        boardNote: 'Swap main diagonal entries (a ↔ d) and negate off-diagonal entries (−b, −c).',
        askTutorPrompt: 'Find determinant and inverse of matrix [[4, 7], [2, 6]]',
      },
      {
        id: 'matrix-mult-rule',
        title: 'Matrix Multiplication Order Compatibility',
        latex: 'A_{m \\times n} \\cdot B_{n \\times p} = (AB)_{m \\times p}, \\qquad AB \\ne BA \\text{ in general}',
        variables: 'Inner dimensions (n) must match; outer dimensions (m × p) give product order',
        boardNote: 'Always write the order beneath each matrix before solving ICSE Ch 9 matrix equations.',
        askTutorPrompt: 'Explain how to multiply two 2x2 matrices step by step',
      },
    ],
  },
];

/**
 * Returns curriculum-relevant formula chapters for the active board and grade,
 * prioritizing chapters that match both board and grade first.
 */
export function getFormulaChaptersForCurriculum(
  board: CurriculumBoard,
  grade: GradeLevel
): FormulaChapter[] {
  const boardChapters = FORMULA_CHAPTERS.filter((ch) => ch.boards.includes(board));
  const exactGrade = boardChapters.filter((ch) => ch.grades.includes(grade));
  const otherGrades = boardChapters.filter((ch) => !ch.grades.includes(grade));
  return [...exactGrade, ...otherGrades];
}

/**
 * Filters chapters and their formula items by free-text search query.
 */
export function filterFormulaChapters(
  chapters: FormulaChapter[],
  query: string
): FormulaChapter[] {
  const q = query.trim().toLowerCase();
  if (!q) return chapters;

  return chapters
    .map((ch) => {
      const chapterMatches =
        ch.title.toLowerCase().includes(q) ||
        ch.summary.toLowerCase().includes(q) ||
        ch.chapterNumber.toLowerCase().includes(q);
      if (chapterMatches) return ch;

      const matchingFormulas = ch.formulas.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.variables.toLowerCase().includes(q) ||
          f.boardNote.toLowerCase().includes(q) ||
          f.latex.toLowerCase().includes(q)
      );
      if (matchingFormulas.length === 0) return null;
      return { ...ch, formulas: matchingFormulas };
    })
    .filter((ch): ch is FormulaChapter => ch !== null);
}
