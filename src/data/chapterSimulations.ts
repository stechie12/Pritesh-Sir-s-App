export type ChapterSimGrade = '9' | '10';

export type ChapterSimKind =
  // Grade 9 (16 chapters)
  | 'g9_rational_surds'
  | 'g9_compound_interest'
  | 'g9_expansions'
  | 'g9_factorisation'
  | 'g9_simultaneous'
  | 'g9_indices'
  | 'g9_logarithms'
  | 'g9_triangles'
  | 'g9_midpoint_theorem'
  | 'g9_pythagoras'
  | 'g9_polygons'
  | 'g9_area_shear'
  | 'g9_circle_chords'
  | 'g9_statistics'
  | 'g9_mensuration_3d'
  | 'g9_trig_coordinate'
  // Grade 10 (18 chapters)
  | 'g10_gst'
  | 'g10_banking_rd'
  | 'g10_shares_dividends'
  | 'g10_linear_inequations'
  | 'g10_quadratic'
  | 'g10_ratio_proportion'
  | 'g10_remainder_factor'
  | 'g10_matrices'
  | 'g10_ap_gp'
  | 'g10_reflection'
  | 'g10_section_formula'
  | 'g10_straight_line'
  | 'g10_similarity'
  | 'g10_loci'
  | 'g10_circles_tangents'
  | 'g10_mensuration_recast'
  | 'g10_heights_distances'
  | 'g10_ogive_probability';

export interface ChapterSimControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface ChapterSimPreset {
  label: string;
  params: Record<string, number>;
}

export interface ChapterSimulationItem {
  id: string;
  grade: ChapterSimGrade;
  chapterNumber: number;
  chapterTitle: string;
  simTitle: string;
  boardTag: string;
  description: string;
  simKind: ChapterSimKind;
  defaultParams: Record<string, number>;
  controls: ChapterSimControl[];
  presets: ChapterSimPreset[];
  keyFormulas: string[];
  examTip: string;
  askPrompt: string;
}

export interface ChapterSimReadout {
  label: string;
  value: string;
  accent?: 'sky' | 'emerald' | 'amber' | 'rose';
}

export const GRADE_9_CHAPTER_SIMULATIONS: ChapterSimulationItem[] = [
  {
    id: 'sim_g9_ch01',
    grade: '9',
    chapterNumber: 1,
    chapterTitle: 'Rational & Irrational Numbers',
    simTitle: 'Surds Spiral & Rationalization Lab',
    boardTag: 'ICSE Ch 1 · CBSE Ch 1',
    description:
      'Construct √n geometrically on the number line via right-triangle hypotenuses and rationalize 1 / (a + √b) live.',
    simKind: 'g9_rational_surds',
    defaultParams: { a: 3, b: 2 },
    controls: [
      { key: 'a', label: 'Rational part a', min: 1, max: 7, step: 1 },
      { key: 'b', label: 'Radicand b (in √b)', min: 2, max: 11, step: 1 },
    ],
    presets: [
      { label: '1 / (3 + √2)', params: { a: 3, b: 2 } },
      { label: '1 / (2 + √3)', params: { a: 2, b: 3 } },
      { label: '1 / (4 + √7)', params: { a: 4, b: 7 } },
    ],
    keyFormulas: [
      '\\frac{1}{a + \\sqrt{b}} = \\frac{a - \\sqrt{b}}{a^2 - b}',
      '(\\sqrt{x} + \\sqrt{y})(\\sqrt{x} - \\sqrt{y}) = x - y',
    ],
    examTip:
      'Multiply numerator and denominator by the exact conjugate (a − √b) so the denominator becomes a clean rational integer a² − b.',
    askPrompt: 'Explain how to rationalize 1 / (3 + 2√2) and plot √5 on the number line for Std 9.',
  },
  {
    id: 'sim_g9_ch02',
    grade: '9',
    chapterNumber: 2,
    chapterTitle: 'Compound Interest',
    simTitle: 'SI vs CI Exponential Growth Lab',
    boardTag: 'ICSE Ch 2 · Commercial Maths',
    description:
      'Compare Simple Interest (linear) against annual and half-yearly Compound Interest growth curves year by year.',
    simKind: 'g9_compound_interest',
    defaultParams: { principal: 10000, rate: 10, years: 4 },
    controls: [
      { key: 'principal', label: 'Principal P', min: 2000, max: 50000, step: 1000, unit: '₹' },
      { key: 'rate', label: 'Rate r', min: 4, max: 20, step: 1, unit: '%' },
      { key: 'years', label: 'Time n', min: 1, max: 8, step: 1, unit: 'yrs' },
    ],
    presets: [
      { label: '₹10,000 @ 10% (3 yrs)', params: { principal: 10000, rate: 10, years: 3 } },
      { label: '₹12,000 @ 8% (5 yrs)', params: { principal: 12000, rate: 8, years: 5 } },
    ],
    keyFormulas: [
      'A = P\\left(1 + \\frac{r}{100}\\right)^n',
      'A_{\\text{half-yearly}} = P\\left(1 + \\frac{r}{200}\\right)^{2n}',
    ],
    examTip:
      'For half-yearly compounding, halve the rate (r/2) and double the time periods (2n) before evaluating.',
    askPrompt: 'Solve a Std 9 Selina Compound Interest problem comparing annual and half-yearly compounding.',
  },
  {
    id: 'sim_g9_ch03',
    grade: '9',
    chapterNumber: 3,
    chapterTitle: 'Expansions',
    simTitle: 'Geometric Area Model for (a + b)²',
    boardTag: 'ICSE Ch 4 · CBSE Ch 2',
    description:
      'Partition a square of side (a + b) into a², ab, ab, and b² regions to see why the middle 2ab term never disappears.',
    simKind: 'g9_expansions',
    defaultParams: { a: 6, b: 3 },
    controls: [
      { key: 'a', label: 'Segment a', min: 1, max: 10, step: 1 },
      { key: 'b', label: 'Segment b', min: 1, max: 8, step: 1 },
    ],
    presets: [
      { label: '(6 + 3)² = 81', params: { a: 6, b: 3 } },
      { label: '(8 + 2)² = 100', params: { a: 8, b: 2 } },
      { label: '(5 + 5)² = 100', params: { a: 5, b: 5 } },
    ],
    keyFormulas: [
      '(a + b)^2 = a^2 + 2ab + b^2',
      '(a + b)^3 = a^3 + b^3 + 3ab(a + b)',
    ],
    examTip:
      'Never write (a + b)² = a² + b² — always include the two rectangular strips of area ab each (= 2ab).',
    askPrompt: 'Teach me Std 9 Expansions identities including (x + 1/x)² and (x + 1/x)³ shortcuts.',
  },
  {
    id: 'sim_g9_ch04',
    grade: '9',
    chapterNumber: 4,
    chapterTitle: 'Factorisation',
    simTitle: 'Splitting the Middle Term Rectangle Lab',
    boardTag: 'ICSE Ch 5 · CBSE Ch 2',
    description:
      'Build the exact factor rectangle (x + p)(x + q) = x² + (p+q)x + pq and see how sum and product lock the factors.',
    simKind: 'g9_factorisation',
    defaultParams: { p: 3, q: 5 },
    controls: [
      { key: 'p', label: 'Factor shift p', min: -6, max: 8, step: 1 },
      { key: 'q', label: 'Factor shift q', min: -6, max: 8, step: 1 },
    ],
    presets: [
      { label: 'x² + 8x + 15', params: { p: 3, q: 5 } },
      { label: 'x² − 5x + 6', params: { p: -2, q: -3 } },
      { label: 'x² − 9 (Diff. of Squares)', params: { p: 3, q: -3 } },
    ],
    keyFormulas: [
      'x^2 + (p+q)x + pq = (x+p)(x+q)',
      'a^2 - b^2 = (a-b)(a+b)',
    ],
    examTip:
      'Check the sign of the constant term pq first: positive means p and q have the SAME sign; negative means OPPOSITE signs.',
    askPrompt: 'Walk me through splitting the middle term and difference of squares factorisation for Std 9.',
  },
  {
    id: 'sim_g9_ch05',
    grade: '9',
    chapterNumber: 5,
    chapterTitle: 'Simultaneous Linear Equations',
    simTitle: 'Two-Line Intersection & Solution Classifier',
    boardTag: 'ICSE Ch 6 · CBSE Ch 4',
    description:
      'Vary slopes and intercepts of two linear equations to watch their unique intersection (x, y) or parallel no-solution state.',
    simKind: 'g9_simultaneous',
    defaultParams: { m1: 1, c1: 1, m2: -1, c2: 5 },
    controls: [
      { key: 'm1', label: 'Line 1 slope m₁', min: -3, max: 3, step: 0.5 },
      { key: 'c1', label: 'Line 1 intercept c₁', min: -5, max: 5, step: 1 },
      { key: 'm2', label: 'Line 2 slope m₂', min: -3, max: 3, step: 0.5 },
      { key: 'c2', label: 'Line 2 intercept c₂', min: -5, max: 5, step: 1 },
    ],
    presets: [
      { label: 'Unique Intersection (2, 3)', params: { m1: 1, c1: 1, m2: -1, c2: 5 } },
      { label: 'Parallel (No Solution)', params: { m1: 1, c1: 2, m2: 1, c2: -2 } },
      { label: 'Perpendicular Lines', params: { m1: 2, c1: -1, m2: -0.5, c2: 4 } },
    ],
    keyFormulas: [
      'x = \\frac{c_2 - c_1}{m_1 - m_2}, \\quad y = m_1 x + c_1',
      'm_1 = m_2, c_1 \\ne c_2 \\Rightarrow \\text{Parallel (No Solution)}',
    ],
    examTip:
      'Always substitute your solved (x, y) back into BOTH original equations to guarantee full marks in elimination/cross-multiplication.',
    askPrompt: 'Solve a pair of simultaneous linear equations by elimination and cross-multiplication for Std 9.',
  },
  {
    id: 'sim_g9_ch06',
    grade: '9',
    chapterNumber: 6,
    chapterTitle: 'Indices (Exponents)',
    simTitle: 'Power Laws & Exponential Curve Lab',
    boardTag: 'ICSE Ch 7 · Laws of Indices',
    description:
      'Explore base a^m × a^n = a^(m+n), negative exponents a^(−k) = 1/a^k, and exponential growth curves.',
    simKind: 'g9_indices',
    defaultParams: { base: 2, m: 3, n: 2 },
    controls: [
      { key: 'base', label: 'Base a', min: 2, max: 5, step: 1 },
      { key: 'm', label: 'Exponent m', min: -3, max: 4, step: 1 },
      { key: 'n', label: 'Exponent n', min: -3, max: 4, step: 1 },
    ],
    presets: [
      { label: '2³ × 2² = 2⁵', params: { base: 2, m: 3, n: 2 } },
      { label: '3² × 3⁻² = 3⁰ = 1', params: { base: 3, m: 2, n: -2 } },
    ],
    keyFormulas: [
      'a^m \\times a^n = a^{m+n}, \\quad \\frac{a^m}{a^n} = a^{m-n}',
      'a^0 = 1, \\quad a^{-n} = \\frac{1}{a^n}, \\quad a^{p/q} = \\sqrt[q]{a^p}',
    ],
    examTip:
      'Reduce composite numbers like 8, 27, 32, or 81 into prime bases (2³, 3³, 2⁵, 3⁴) before applying index laws.',
    askPrompt: 'Give me 3 tricky Std 9 Selina Indices simplification sums and solve the first one step by step.',
  },
  {
    id: 'sim_g9_ch07',
    grade: '9',
    chapterNumber: 7,
    chapterTitle: 'Logarithms',
    simTitle: 'Exponential ↔ Logarithm Mirror Curve Lab',
    boardTag: 'ICSE Ch 8 · Logarithms',
    description:
      'See y = log_b(x) as the exact mirror reflection of y = b^x across y = x, and verify the product law live.',
    simKind: 'g9_logarithms',
    defaultParams: { base: 2, xVal: 8, yVal: 4 },
    controls: [
      { key: 'base', label: 'Log base b', min: 2, max: 10, step: 1 },
      { key: 'xVal', label: 'Value M', min: 1, max: 32, step: 1 },
      { key: 'yVal', label: 'Value N', min: 1, max: 16, step: 1 },
    ],
    presets: [
      { label: 'Base 2: log₂(8 × 4)', params: { base: 2, xVal: 8, yVal: 4 } },
      { label: 'Common Log Base 10', params: { base: 10, xVal: 10, yVal: 10 } },
    ],
    keyFormulas: [
      'b^y = x \\iff \\log_b(x) = y',
      '\\log_b(MN) = \\log_b M + \\log_b N, \\quad \\log_b(M^k) = k\\log_b M',
    ],
    examTip:
      'Logarithm of 1 to ANY valid base is 0, and log_b(b) = 1. Never split log(M + N) into log M + log N!',
    askPrompt: 'Explain the laws of logarithms and solve a Std 9 Selina Ch 8 logarithm equation.',
  },
  {
    id: 'sim_g9_ch08',
    grade: '9',
    chapterNumber: 8,
    chapterTitle: 'Triangles & Congruence',
    simTitle: 'Triangle Inequality & Angle-Side Lab',
    boardTag: 'ICSE Ch 9 · CBSE Ch 7',
    description:
      'Adjust sides a, b, c to test the Triangle Inequality (a + b > c), compute interior angles via Cosine Rule, and classify the triangle.',
    simKind: 'g9_triangles',
    defaultParams: { sideA: 6, sideB: 7, sideC: 8 },
    controls: [
      { key: 'sideA', label: 'Side a', min: 2, max: 12, step: 1 },
      { key: 'sideB', label: 'Side b', min: 2, max: 12, step: 1 },
      { key: 'sideC', label: 'Side c', min: 2, max: 12, step: 1 },
    ],
    presets: [
      { label: 'Equilateral (6, 6, 6)', params: { sideA: 6, sideB: 6, sideC: 6 } },
      { label: 'Right Triangle (6, 8, 10)', params: { sideA: 6, sideB: 8, sideC: 10 } },
      { label: 'Invalid (2, 3, 9)', params: { sideA: 2, sideB: 3, sideC: 9 } },
    ],
    keyFormulas: [
      'a + b > c, \\quad b + c > a, \\quad c + a > b',
      '\\angle A + \\angle B + \\angle C = 180^\\circ',
    ],
    examTip:
      'The greater side always lies opposite the greater angle. For congruence proofs, cite SSS, SAS, ASA, AAS, or RHS explicitly.',
    askPrompt: 'Explain SSS, SAS, ASA, AAS, and RHS congruence rules with a Std 9 proof example.',
  },
  {
    id: 'sim_g9_ch09',
    grade: '9',
    chapterNumber: 9,
    chapterTitle: 'Mid-Point & Intercept Theorem',
    simTitle: 'Mid-Segment Parallel & Half-Base Verifier',
    boardTag: 'ICSE Ch 12 · CBSE Ch 8',
    description:
      'Move the triangle apex (Ax, Ay) and base length to verify DE ∥ BC and DE = ½ BC under every possible triangle shape.',
    simKind: 'g9_midpoint_theorem',
    defaultParams: { base: 10, apexX: 4, apexY: 7 },
    controls: [
      { key: 'base', label: 'Base BC', min: 4, max: 14, step: 1 },
      { key: 'apexX', label: 'Apex shift x', min: 1, max: 11, step: 1 },
      { key: 'apexY', label: 'Altitude h', min: 3, max: 10, step: 1 },
    ],
    presets: [
      { label: 'Symmetric Triangle', params: { base: 10, apexX: 5, apexY: 7 } },
      { label: 'Obtuse Skew Triangle', params: { base: 8, apexX: 10, apexY: 6 } },
    ],
    keyFormulas: [
      'DE \\parallel BC \\quad \\text{and} \\quad DE = \\frac{1}{2} BC',
      '\\text{Area}(\\triangle ADE) = \\frac{1}{4} \\text{Area}(\\triangle ABC)',
    ],
    examTip:
      'Whenever a diagram marks two midpoints on two sides of a triangle, immediately draw the joining segment — it is parallel to and half of the third side.',
    askPrompt: 'Prove the Mid-Point Theorem and solve a Std 9 Selina Ch 12 problem using it.',
  },
  {
    id: 'sim_g9_ch10',
    grade: '9',
    chapterNumber: 10,
    chapterTitle: 'Pythagoras Theorem',
    simTitle: 'Visual Area Squares (a² + b² = c²) Lab',
    boardTag: 'ICSE Ch 13 · Pythagoras Theorem',
    description:
      'Resize legs a and b to inspect the three geometric squares built on each side and verify Area(a²) + Area(b²) = Area(c²).',
    simKind: 'g9_pythagoras',
    defaultParams: { a: 3, b: 4 },
    controls: [
      { key: 'a', label: 'Leg a', min: 2, max: 12, step: 1 },
      { key: 'b', label: 'Leg b', min: 2, max: 12, step: 1 },
    ],
    presets: [
      { label: '(3, 4, 5) Triplet', params: { a: 3, b: 4 } },
      { label: '(5, 12, 13) Triplet', params: { a: 5, b: 12 } },
      { label: '(8, 6, 10) Triplet', params: { a: 8, b: 6 } },
    ],
    keyFormulas: [
      'a^2 + b^2 = c^2 \\implies c = \\sqrt{a^2 + b^2}',
      '\\text{Common Triplets: } (3,4,5), (5,12,13), (8,15,17), (7,24,25)',
    ],
    examTip:
      'Memorize primitive Pythagorean triplets (3,4,5), (5,12,13), (8,15,17) to spot missing sides instantly in exams.',
    askPrompt: 'Solve a Std 9 Pythagoras Theorem ladder/diagonal word problem step by step.',
  },
  {
    id: 'sim_g9_ch11',
    grade: '9',
    chapterNumber: 11,
    chapterTitle: 'Rectilinear Figures & Polygons',
    simTitle: 'Regular Polygon Angle & Diagonal Lab',
    boardTag: 'ICSE Ch 14 · CBSE Ch 8',
    description:
      'Sweep polygon sides n from Triangle (3) to Dodecagon (12) to watch interior angles approach 180° while exterior sum stays locked at 360°.',
    simKind: 'g9_polygons',
    defaultParams: { sides: 6 },
    controls: [{ key: 'sides', label: 'Number of sides n', min: 3, max: 12, step: 1 }],
    presets: [
      { label: 'Pentagon (n=5)', params: { sides: 5 } },
      { label: 'Hexagon (n=6)', params: { sides: 6 } },
      { label: 'Octagon (n=8)', params: { sides: 8 } },
    ],
    keyFormulas: [
      '\\text{Sum of Interior Angles} = (n - 2) \\times 180^\\circ',
      '\\text{Each Exterior Angle} = \\frac{360^\\circ}{n}, \\quad \\text{Diagonals} = \\frac{n(n-3)}{2}',
    ],
    examTip:
      'Always solve regular polygon problems via the exterior angle first: Exterior = 180° − Interior, then n = 360° / Exterior!',
    askPrompt: 'If each interior angle of a regular polygon is 144°, find its number of sides and diagonals.',
  },
  {
    id: 'sim_g9_ch12',
    grade: '9',
    chapterNumber: 12,
    chapterTitle: 'Area Theorems (Same Base & Parallels)',
    simTitle: 'Parallelogram & Triangle Shear Invariance Lab',
    boardTag: 'ICSE Ch 16 · Area Theorems',
    description:
      'Slide the top edge horizontally (shear) between parallel lines and observe that Parallelogram area (b×h) and inscribed Triangle area (½bh) remain strictly constant.',
    simKind: 'g9_area_shear',
    defaultParams: { base: 8, height: 5, shear: 3 },
    controls: [
      { key: 'base', label: 'Base b', min: 4, max: 12, step: 1 },
      { key: 'height', label: 'Height h', min: 2, max: 8, step: 1 },
      { key: 'shear', label: 'Horizontal shear s', min: -4, max: 6, step: 1 },
    ],
    presets: [
      { label: 'Rectangle (Shear = 0)', params: { base: 8, height: 5, shear: 0 } },
      { label: 'Tilted Parallelogram', params: { base: 8, height: 5, shear: 4 } },
    ],
    keyFormulas: [
      '\\text{Area}(\\parallel\\text{gm}) = b \\times h',
      '\\text{Area}(\\triangle) = \\frac{1}{2} \\text{Area}(\\parallel\\text{gm on same base \\& parallels})',
    ],
    examTip:
      'To prove two triangles equal in area, show they stand on the SAME base and lie between the SAME pair of parallel lines.',
    askPrompt: 'Explain Area Theorems for parallelograms and triangles on the same base for Std 9.',
  },
  {
    id: 'sim_g9_ch13',
    grade: '9',
    chapterNumber: 13,
    chapterTitle: 'Circle: Chords & Arc Properties',
    simTitle: 'Perpendicular from Centre to Chord Lab',
    boardTag: 'ICSE Ch 17 · CBSE Ch 9',
    description:
      'Adjust radius r and chord distance d from center O to compute exact chord length 2√(r² − d²) and verify bisection.',
    simKind: 'g9_circle_chords',
    defaultParams: { radius: 10, dist: 6 },
    controls: [
      { key: 'radius', label: 'Radius r', min: 5, max: 15, step: 1 },
      { key: 'dist', label: 'Distance d from O', min: 1, max: 14, step: 1 },
    ],
    presets: [
      { label: 'r = 10, d = 6 ⇒ Chord = 16', params: { radius: 10, dist: 6 } },
      { label: 'r = 13, d = 5 ⇒ Chord = 24', params: { radius: 13, dist: 5 } },
    ],
    keyFormulas: [
      '\\text{Chord } AB = 2\\sqrt{r^2 - d^2}',
      'OM \\perp AB \\iff AM = MB',
    ],
    examTip:
      'Always join the center O to one endpoint of the chord to form a right triangle with hypotenuse r and legs d and (chord/2).',
    askPrompt: 'Solve a Std 9 circle problem with two parallel chords of lengths 16 cm and 12 cm in a circle of radius 10 cm.',
  },
  {
    id: 'sim_g9_ch14',
    grade: '9',
    chapterNumber: 14,
    chapterTitle: 'Statistics (Mean, Median & Histogram)',
    simTitle: 'Interactive Frequency Histogram & Mean Lab',
    boardTag: 'ICSE Ch 19 · CBSE Ch 12',
    description:
      'Tune frequencies across 5 class intervals to see the histogram bars reshape and watch the grouped Mean and Modal Class recalculate immediately.',
    simKind: 'g9_statistics',
    defaultParams: { f1: 4, f2: 9, f3: 14, f4: 8, f5: 5 },
    controls: [
      { key: 'f1', label: '0–10 freq', min: 1, max: 20, step: 1 },
      { key: 'f2', label: '10–20 freq', min: 1, max: 20, step: 1 },
      { key: 'f3', label: '20–30 freq', min: 1, max: 20, step: 1 },
      { key: 'f4', label: '30–40 freq', min: 1, max: 20, step: 1 },
      { key: 'f5', label: '40–50 freq', min: 1, max: 20, step: 1 },
    ],
    presets: [
      { label: 'Bell-Shaped Marks', params: { f1: 4, f2: 9, f3: 14, f4: 8, f5: 5 } },
      { label: 'High-Scorer Skew', params: { f1: 2, f2: 4, f3: 7, f4: 15, f5: 18 } },
    ],
    keyFormulas: [
      '\\bar{x} = \\frac{\\sum f_i x_i}{\\sum f_i}',
      '\\text{Class Mark } x_i = \\frac{\\text{Lower} + \\text{Upper}}{2}',
    ],
    examTip:
      'Ensure class intervals are continuous (exclusive form) before plotting a histogram; if inclusive, adjust boundaries by ±0.5.',
    askPrompt: 'Explain how to find mean and median for grouped data and draw a frequency polygon in Std 9.',
  },
  {
    id: 'sim_g9_ch15',
    grade: '9',
    chapterNumber: 15,
    chapterTitle: 'Mensuration (Solids: Cuboid & Cylinder)',
    simTitle: 'Right Circular Cylinder Net & Volume Lab',
    boardTag: 'ICSE Ch 20 · CBSE Ch 11',
    description:
      'Unroll a cylinder into its 2D net (two circles + rectangle of width 2πr) and inspect Curved Surface Area, TSA, and Volume live.',
    simKind: 'g9_mensuration_3d',
    defaultParams: { radius: 7, height: 10 },
    controls: [
      { key: 'radius', label: 'Radius r', min: 2, max: 14, step: 1, unit: 'cm' },
      { key: 'height', label: 'Height h', min: 3, max: 20, step: 1, unit: 'cm' },
    ],
    presets: [
      { label: 'r = 7, h = 10 (π = 22/7)', params: { radius: 7, height: 10 } },
      { label: 'r = 14, h = 15', params: { radius: 14, height: 15 } },
    ],
    keyFormulas: [
      '\\text{CSA} = 2\\pi r h, \\quad \\text{TSA} = 2\\pi r(r + h)',
      '\\text{Volume} = \\pi r^2 h',
    ],
    examTip:
      'When r or h is a multiple of 7, substitute π = 22/7 early so the 7 cancels cleanly without messy decimals.',
    askPrompt: 'Solve a Std 9 Mensuration problem on hollow cylinder volume and surface area.',
  },
  {
    id: 'sim_g9_ch16',
    grade: '9',
    chapterNumber: 16,
    chapterTitle: 'Trigonometry & Coordinate Geometry',
    simTitle: 'Right-Triangle T-Ratios & Distance Lab',
    boardTag: 'ICSE Ch 22–26 · CBSE Ch 3',
    description:
      'Sweep acute angle θ (15°–75°) and hypotenuse H to see Opposite (H sin θ), Adjacent (H cos θ), and all 6 trigonometric ratios live.',
    simKind: 'g9_trig_coordinate',
    defaultParams: { angleDeg: 30, hyp: 10 },
    controls: [
      { key: 'angleDeg', label: 'Angle θ', min: 15, max: 75, step: 5, unit: '°' },
      { key: 'hyp', label: 'Hypotenuse H', min: 4, max: 20, step: 1 },
    ],
    presets: [
      { label: '30° Standard Angle', params: { angleDeg: 30, hyp: 10 } },
      { label: '45° Isosceles Right', params: { angleDeg: 45, hyp: 10 } },
      { label: '60° Standard Angle', params: { angleDeg: 60, hyp: 10 } },
    ],
    keyFormulas: [
      '\\sin\\theta = \\frac{P}{H}, \\quad \\cos\\theta = \\frac{B}{H}, \\quad \\tan\\theta = \\frac{P}{B}',
      'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
    ],
    examTip:
      'Remember Pandit Badri Prasad / Har Har Bole (SOH-CAH-TOA) and verify sin²θ + cos²θ = 1 after computing ratios.',
    askPrompt: 'Help me memorize the Std 9 standard trigonometry table (0° to 90°) and solve a distance formula problem.',
  },
];

export const GRADE_10_CHAPTER_SIMULATIONS: ChapterSimulationItem[] = [
  {
    id: 'sim_g10_ch01',
    grade: '10',
    chapterNumber: 1,
    chapterTitle: 'Goods and Services Tax (GST)',
    simTitle: 'Intra-State (CGST/SGST) vs Inter-State (IGST) Flow',
    boardTag: 'ICSE Ch 1 · Commercial Maths',
    description:
      'Adjust Marked Price, Discount %, GST Rate, and State Mode to trace Taxable Value, CGST/SGST split, and Final Consumer Bill.',
    simKind: 'g10_gst',
    defaultParams: { mp: 15000, discount: 20, gstRate: 18, interState: 0 },
    controls: [
      { key: 'mp', label: 'Marked Price MP', min: 1000, max: 50000, step: 1000, unit: '₹' },
      { key: 'discount', label: 'Discount', min: 0, max: 50, step: 5, unit: '%' },
      { key: 'gstRate', label: 'GST Slab', min: 5, max: 28, step: 1, unit: '%' },
      { key: 'interState', label: 'Mode (0=Intra, 1=Inter)', min: 0, max: 1, step: 1 },
    ],
    presets: [
      { label: 'Selina Ex 1(A): ₹15k, 20% off, 18%', params: { mp: 15000, discount: 20, gstRate: 18, interState: 0 } },
      { label: 'Inter-State IGST 12%', params: { mp: 20000, discount: 10, gstRate: 12, interState: 1 } },
    ],
    keyFormulas: [
      '\\text{Taxable SP} = \\text{MP} \\times \\left(1 - \\frac{d}{100}\\right)',
      '\\text{Intra: } \\text{CGST} = \\text{SGST} = \\frac{\\text{GST}}{2}, \\quad \\text{Inter: IGST} = \\text{GST}',
    ],
    examTip:
      'Always deduct discount from Marked Price FIRST — GST is strictly calculated on the discounted Taxable Selling Price.',
    askPrompt: 'Solve a Std 10 ICSE GST Input Tax Credit (ITC) chain problem from Manufacturer → Wholesaler → Retailer.',
  },
  {
    id: 'sim_g10_ch02',
    grade: '10',
    chapterNumber: 2,
    chapterTitle: 'Banking (Recurring Deposit)',
    simTitle: 'Monthly RD Deposit & Maturity Calculator',
    boardTag: 'ICSE Ch 2 · Banking',
    description:
      'Visualize total deposited principal (P × n) vs accumulated Recurring Deposit interest across n monthly installments.',
    simKind: 'g10_banking_rd',
    defaultParams: { monthlyP: 1000, months: 36, rate: 8 },
    controls: [
      { key: 'monthlyP', label: 'Monthly Deposit P', min: 200, max: 5000, step: 200, unit: '₹' },
      { key: 'months', label: 'Months n', min: 6, max: 60, step: 6, unit: 'mo' },
      { key: 'rate', label: 'Rate r', min: 4, max: 14, step: 1, unit: '%' },
    ],
    presets: [
      { label: 'Selina Ex 2: ₹1000 × 36m @ 8%', params: { monthlyP: 1000, months: 36, rate: 8 } },
      { label: '₹2000 × 24m @ 10%', params: { monthlyP: 2000, months: 24, rate: 10 } },
    ],
    keyFormulas: [
      'I = P \\times \\frac{n(n+1)}{24} \\times \\frac{r}{100}',
      '\\text{Maturity Value (MV)} = P \\cdot n + I',
    ],
    examTip:
      'Convert years into months immediately (e.g., 2.5 years = 30 months) — using years in n(n+1)/24 is the #1 exam mistake.',
    askPrompt: 'Solve a Std 10 Banking RD problem where Maturity Value is given and we must find the rate of interest r.',
  },
  {
    id: 'sim_g10_ch03',
    grade: '10',
    chapterNumber: 3,
    chapterTitle: 'Shares and Dividends',
    simTitle: 'Nominal vs Market Value Yield Lab',
    boardTag: 'ICSE Ch 3 · Shares & Dividends',
    description:
      'Compare Nominal Value (NV) vs Market Value (MV) to see why dividend is always paid on NV while investor return % depends on MV.',
    simKind: 'g10_shares_dividends',
    defaultParams: { nv: 100, mv: 125, divRate: 15, shares: 40 },
    controls: [
      { key: 'nv', label: 'Nominal Value NV', min: 10, max: 200, step: 10, unit: '₹' },
      { key: 'mv', label: 'Market Value MV', min: 10, max: 300, step: 5, unit: '₹' },
      { key: 'divRate', label: 'Dividend %', min: 5, max: 25, step: 1, unit: '%' },
      { key: 'shares', label: 'No. of Shares', min: 10, max: 200, step: 10 },
    ],
    presets: [
      { label: 'At Premium (NV 100, MV 125)', params: { nv: 100, mv: 125, divRate: 15, shares: 40 } },
      { label: 'At Discount (NV 100, MV 80)', params: { nv: 100, mv: 80, divRate: 12, shares: 50 } },
    ],
    keyFormulas: [
      '\\text{Annual Income} = n \\times \\frac{d}{100} \\times \\text{NV}',
      '\\text{Return \\%} \\times \\text{MV} = \\text{Dividend \\%} \\times \\text{NV}',
    ],
    examTip:
      'Golden Identity: Return% × MV = Dividend% × NV. This 1-line equation solves 80% of Board Exam Shares problems in seconds!',
    askPrompt: 'Solve a Std 10 Shares & Dividends problem comparing two investment options.',
  },
  {
    id: 'sim_g10_ch04',
    grade: '10',
    chapterNumber: 4,
    chapterTitle: 'Linear Inequations',
    simTitle: 'Number-Line Solution Set & Sign-Flip Lab',
    boardTag: 'ICSE Ch 4 · Linear Inequations',
    description:
      'Solve ax + b ≤ c on the live number line and watch the inequality flip direction automatically whenever a < 0.',
    simKind: 'g10_linear_inequations',
    defaultParams: { a: -2, b: 3, c: 9 },
    controls: [
      { key: 'a', label: 'Coefficient a', min: -4, max: 4, step: 1 },
      { key: 'b', label: 'Constant b', min: -8, max: 8, step: 1 },
      { key: 'c', label: 'RHS bound c', min: -8, max: 12, step: 1 },
    ],
    presets: [
      { label: '−2x + 3 ≤ 9 (Sign Flip!)', params: { a: -2, b: 3, c: 9 } },
      { label: '2x − 4 ≤ 6', params: { a: 2, b: -4, c: 6 } },
    ],
    keyFormulas: [
      'a > 0: ax + b \\le c \\implies x \\le \\frac{c - b}{a}',
      'a < 0: ax + b \\le c \\implies x \\ge \\frac{c - b}{a} \\text{ (Flip!)}',
    ],
    examTip:
      'Watch the Replacement Set! Use discrete dots for x ∈ W, N, Z, and a solid shaded ray with hollow/filled endpoint for x ∈ R.',
    askPrompt: 'Solve a compound linear inequation −3 ≤ 2x − 1 < 7 for x ∈ R and x ∈ Z with number line steps.',
  },
  {
    id: 'sim_g10_ch05',
    grade: '10',
    chapterNumber: 5,
    chapterTitle: 'Quadratic Equations',
    simTitle: 'Parabola, Discriminant Δ & Roots Explorer',
    boardTag: 'ICSE Ch 5 · CBSE Ch 4',
    description:
      'Vary a, b, c in ax² + bx + c = 0 to watch real distinct roots (Δ > 0), equal tangent root (Δ = 0), and complex roots (Δ < 0).',
    simKind: 'g10_quadratic',
    defaultParams: { a: 1, b: -5, c: 6 },
    controls: [
      { key: 'a', label: 'a (x²)', min: -3, max: 3, step: 0.5 },
      { key: 'b', label: 'b (x)', min: -8, max: 8, step: 1 },
      { key: 'c', label: 'c (const)', min: -8, max: 8, step: 1 },
    ],
    presets: [
      { label: 'x² − 5x + 6 = 0 (Δ > 0)', params: { a: 1, b: -5, c: 6 } },
      { label: 'x² − 4x + 4 = 0 (Δ = 0)', params: { a: 1, b: -4, c: 4 } },
      { label: 'x² + 2x + 5 = 0 (Δ < 0)', params: { a: 1, b: 2, c: 5 } },
    ],
    keyFormulas: [
      '\\Delta = b^2 - 4ac, \\quad x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
      '\\alpha + \\beta = -\\frac{b}{a}, \\quad \\alpha\\beta = \\frac{c}{a}',
    ],
    examTip:
      'When asked for roots "correct to 2 significant figures", compute to 3 decimals first, then round carefully at the final step.',
    askPrompt: 'Solve (k + 4)x² + (k + 1)x + 1 = 0 for real and equal roots using discriminant Δ = 0.',
  },
  {
    id: 'sim_g10_ch06',
    grade: '10',
    chapterNumber: 6,
    chapterTitle: 'Ratio and Proportion',
    simTitle: 'Mean Proportional & Componendo-Dividendo Lab',
    boardTag: 'ICSE Ch 7 · Ratio & Proportion',
    description:
      'Explore continued proportion a : b = b : c (so b = √(ac)) and verify Componendo & Dividendo ratios interactively.',
    simKind: 'g10_ratio_proportion',
    defaultParams: { a: 4, c: 9 },
    controls: [
      { key: 'a', label: 'First term a', min: 1, max: 25, step: 1 },
      { key: 'c', label: 'Third term c', min: 1, max: 36, step: 1 },
    ],
    presets: [
      { label: '4 : 6 : 9 (Mean = 6)', params: { a: 4, c: 9 } },
      { label: '2 : 6 : 18 (Mean = 6)', params: { a: 2, c: 18 } },
    ],
    keyFormulas: [
      'a:b = b:c \\implies b = \\sqrt{ac}',
      '\\frac{a}{b} = \\frac{c}{d} \\implies \\frac{a+b}{a-b} = \\frac{c+d}{c-d}',
    ],
    examTip:
      'Whenever an equation contains (A + B)/(A − B), apply Componendo & Dividendo immediately to strip away all cross terms!',
    askPrompt: 'Solve a Std 10 ICSE Componendo and Dividendo problem step by step.',
  },
  {
    id: 'sim_g10_ch07',
    grade: '10',
    chapterNumber: 7,
    chapterTitle: 'Remainder & Factor Theorem',
    simTitle: 'Cubic Polynomial f(x) & Remainder Evaluator',
    boardTag: 'ICSE Ch 8 · CBSE Ch 2',
    description:
      'Move test divisor (x − k) along cubic f(x) = x³ − 6x² + 11x − 6 to see f(k) = Remainder vanish at the exact factor roots k = 1, 2, 3.',
    simKind: 'g10_remainder_factor',
    defaultParams: { k: 2, shift: 0 },
    controls: [
      { key: 'k', label: 'Test value k in (x − k)', min: -1, max: 5, step: 0.5 },
      { key: 'shift', label: 'Vertical shift d', min: -4, max: 4, step: 1 },
    ],
    presets: [
      { label: 'Exact Factor k = 2 (Rem = 0)', params: { k: 2, shift: 0 } },
      { label: 'Non-Factor k = 4 (Rem = 6)', params: { k: 4, shift: 0 } },
    ],
    keyFormulas: [
      '\\text{Remainder when } f(x) \\div (x - k) = f(k)',
      '(x - k) \\text{ is a factor} \\iff f(k) = 0',
    ],
    examTip:
      'To factorize a cubic completely, first guess a root from factors of the constant term (±1, ±2, ±3), then divide to get a quadratic.',
    askPrompt: 'Factorise 2x³ + x² − 13x + 6 completely using the Factor Theorem for Std 10.',
  },
  {
    id: 'sim_g10_ch08',
    grade: '10',
    chapterNumber: 8,
    chapterTitle: 'Matrices',
    simTitle: '2×2 Matrix Linear Transform & Determinant Lab',
    boardTag: 'ICSE Ch 9 · Matrices',
    description:
      'Edit entries of 2×2 matrix A to watch how A transforms the unit square into a parallelogram whose signed area equals det(A) = ad − bc.',
    simKind: 'g10_matrices',
    defaultParams: { m11: 2, m12: 1, m21: 0, m22: 2 },
    controls: [
      { key: 'm11', label: 'a₁₁', min: -3, max: 3, step: 1 },
      { key: 'm12', label: 'a₁₂', min: -3, max: 3, step: 1 },
      { key: 'm21', label: 'a₂₁', min: -3, max: 3, step: 1 },
      { key: 'm22', label: 'a₂₂', min: -3, max: 3, step: 1 },
    ],
    presets: [
      { label: 'Shear + Scale (det = 4)', params: { m11: 2, m12: 1, m21: 0, m22: 2 } },
      { label: '90° Rotation (det = 1)', params: { m11: 0, m12: -1, m21: 1, m22: 0 } },
      { label: 'Singular Matrix (det = 0)', params: { m11: 2, m12: 1, m21: 2, m22: 1 } },
    ],
    keyFormulas: [
      '\\det(A) = ad - bc, \\quad \\text{tr}(A) = a + d',
      'A^2 - \\text{tr}(A)\\,A + \\det(A)\\,I = O',
    ],
    examTip:
      'Remember matrix multiplication is NOT commutative (AB ≠ BA in general), and A² means A × A, never squaring each element.',
    askPrompt: 'Solve a Std 10 ICSE Matrices problem finding A² − 5A + 7I step by step.',
  },
  {
    id: 'sim_g10_ch09',
    grade: '10',
    chapterNumber: 9,
    chapterTitle: 'Arithmetic & Geometric Progressions',
    simTitle: 'AP Linear vs GP Exponential Series Lab',
    boardTag: 'ICSE Ch 10–11 · CBSE Ch 5',
    description:
      'Compare nth term T_n and partial sum S_n of an Arithmetic Progression (common difference d) and Geometric Progression (common ratio r).',
    simKind: 'g10_ap_gp',
    defaultParams: { a: 2, d: 3, r: 2, n: 6 },
    controls: [
      { key: 'a', label: 'First term a', min: 1, max: 10, step: 1 },
      { key: 'd', label: 'AP diff d', min: 1, max: 8, step: 1 },
      { key: 'r', label: 'GP ratio r', min: 1.5, max: 3, step: 0.5 },
      { key: 'n', label: 'Terms n', min: 3, max: 8, step: 1 },
    ],
    presets: [
      { label: 'a=2, d=3, r=2 (6 terms)', params: { a: 2, d: 3, r: 2, n: 6 } },
      { label: 'a=3, d=4, r=1.5 (7 terms)', params: { a: 3, d: 4, r: 1.5, n: 7 } },
    ],
    keyFormulas: [
      'T_n^{\\text{AP}} = a + (n-1)d, \\quad S_n^{\\text{AP}} = \\frac{n}{2}[2a + (n-1)d]',
      'T_n^{\\text{GP}} = a r^{n-1}, \\quad S_n^{\\text{GP}} = a\\frac{r^n - 1}{r - 1}',
    ],
    examTip:
      'For three terms in AP, assume (a − d, a, a + d) so their sum cancels d instantly; for three terms in GP, assume (a/r, a, ar) so their product cancels r!',
    askPrompt: 'Solve a Std 10 AP and GP combined sum finding the sum of first 15 terms.',
  },
  {
    id: 'sim_g10_ch10',
    grade: '10',
    chapterNumber: 10,
    chapterTitle: 'Reflection (Coordinate Transformations)',
    simTitle: 'Coordinate Mirror Reflection Lab (Mx, My, Mo)',
    boardTag: 'ICSE Ch 12 · Reflection',
    description:
      'Drag point P(x, y) across all four quadrants to see its simultaneous images under M_x (x-axis), M_y (y-axis), and M_o (Origin).',
    simKind: 'g10_reflection',
    defaultParams: { px: 4, py: 3 },
    controls: [
      { key: 'px', label: 'Point x', min: -5, max: 5, step: 1 },
      { key: 'py', label: 'Point y', min: -5, max: 5, step: 1 },
    ],
    presets: [
      { label: 'P(4, 3) in Quad I', params: { px: 4, py: 3 } },
      { label: 'Invariant on x-axis (4, 0)', params: { px: 4, py: 0 } },
      { label: 'P(−3, 2) in Quad II', params: { px: -3, py: 2 } },
    ],
    keyFormulas: [
      'M_x(x, y) = (x, -y), \\quad M_y(x, y) = (-x, y)',
      'M_o(x, y) = (-x, -y)',
    ],
    examTip:
      'A point is INVARIANT under reflection if it lies directly on the mirror line (e.g., (4, 0) stays (4, 0) under M_x).',
    askPrompt: 'Explain Reflection across x-axis, y-axis, origin, and line x = k with a Std 10 ICSE graph question.',
  },
  {
    id: 'sim_g10_ch11',
    grade: '10',
    chapterNumber: 11,
    chapterTitle: 'Section and Mid-Point Formula',
    simTitle: 'Internal Ratio m : n Segment Divider Lab',
    boardTag: 'ICSE Ch 13 · CBSE Ch 7',
    description:
      'Slide ratio m : n along segment AB to watch dividing point P(x, y) track smoothly between A(x₁, y₁) and B(x₂, y₂).',
    simKind: 'g10_section_formula',
    defaultParams: { m: 2, n: 3, x2: 4, y2: -3 },
    controls: [
      { key: 'm', label: 'Ratio part m', min: 1, max: 6, step: 1 },
      { key: 'n', label: 'Ratio part n', min: 1, max: 6, step: 1 },
      { key: 'x2', label: 'B coordinate x₂', min: 0, max: 6, step: 1 },
      { key: 'y2', label: 'B coordinate y₂', min: -5, max: 5, step: 1 },
    ],
    presets: [
      { label: 'Selina Ex 13: Ratio 2:3', params: { m: 2, n: 3, x2: 4, y2: -3 } },
      { label: 'Exact Midpoint (1:1)', params: { m: 1, n: 1, x2: 5, y2: 3 } },
    ],
    keyFormulas: [
      'P(x, y) = \\left(\\frac{mx_2 + nx_1}{m+n}, \\frac{my_2 + ny_1}{m+n}\\right)',
      'G = \\left(\\frac{x_1+x_2+x_3}{3}, \\frac{y_1+y_2+y_3}{3}\\right)',
    ],
    examTip:
      'To find the ratio in which the x-axis divides AB, set the y-coordinate formula equal to 0 and assume ratio k : 1!',
    askPrompt: 'Find the ratio in which the x-axis divides the segment joining A(−1, 7) and B(4, −3) using Section Formula.',
  },
  {
    id: 'sim_g10_ch12',
    grade: '10',
    chapterNumber: 12,
    chapterTitle: 'Equation of a Straight Line',
    simTitle: 'Slope-Intercept, Parallel & Perpendicular Lab',
    boardTag: 'ICSE Ch 14 · Straight Lines',
    description:
      'Tune slope m and y-intercept c of line L₁ to inspect its inclination angle θ = tan⁻¹(m) and automatic perpendicular normal L₂ (m₂ = −1/m).',
    simKind: 'g10_straight_line',
    defaultParams: { m: 1, c: 2 },
    controls: [
      { key: 'm', label: 'Slope m', min: -3, max: 3, step: 0.5 },
      { key: 'c', label: 'y-intercept c', min: -4, max: 4, step: 1 },
    ],
    presets: [
      { label: 'y = x + 2 (45°)', params: { m: 1, c: 2 } },
      { label: 'y = 2x − 1 (Steep)', params: { m: 2, c: -1 } },
      { label: 'y = −0.5x + 3', params: { m: -0.5, c: 3 } },
    ],
    keyFormulas: [
      'y = mx + c, \\quad y - y_1 = m(x - x_1)',
      '\\text{Parallel: } m_1 = m_2, \\quad \\text{Perpendicular: } m_1 m_2 = -1',
    ],
    examTip:
      'Rewrite any line ax + by + c = 0 as y = (−a/b)x − c/b first to read its slope m = −a/b without sign errors.',
    askPrompt: 'Find the equation of the perpendicular bisector of the line joining A(2, 3) and B(6, −1) for Std 10.',
  },
  {
    id: 'sim_g10_ch13',
    grade: '10',
    chapterNumber: 13,
    chapterTitle: 'Similarity of Triangles',
    simTitle: 'Scale Factor k, Area k² & Volume k³ Lab',
    boardTag: 'ICSE Ch 15 · CBSE Ch 6',
    description:
      'Scale a triangle by factor k to observe linear perimeter grow by k, shaded area grow by k², and equivalent 3D model volume grow by k³.',
    simKind: 'g10_similarity',
    defaultParams: { k: 2, base: 4 },
    controls: [
      { key: 'k', label: 'Scale factor k', min: 1, max: 3.5, step: 0.5 },
      { key: 'base', label: 'Original base b', min: 2, max: 6, step: 1 },
    ],
    presets: [
      { label: 'Double Scale (k = 2 ⇒ Area 4×)', params: { k: 2, base: 4 } },
      { label: 'Triple Scale (k = 3 ⇒ Area 9×)', params: { k: 3, base: 3 } },
    ],
    keyFormulas: [
      '\\frac{\\text{Perimeter}_2}{\\text{Perimeter}_1} = k, \\quad \\frac{\\text{Area}_2}{\\text{Area}_1} = k^2, \\quad \\frac{\\text{Vol}_2}{\\text{Vol}_1} = k^3',
      '\\text{BPT: } DE \\parallel BC \\implies \\frac{AD}{DB} = \\frac{AE}{EC}',
    ],
    examTip:
      'In Map & Model sums, always convert cm to m (÷100) or km (÷100,000), and square k for area or cube k for volume!',
    askPrompt: 'Solve a Std 10 ICSE Similarity map-scale and model-volume problem step by step.',
  },
  {
    id: 'sim_g10_ch14',
    grade: '10',
    chapterNumber: 14,
    chapterTitle: 'Loci (Locus & Constructions)',
    simTitle: 'Equidistant Point & Perpendicular Bisector Locus',
    boardTag: 'ICSE Ch 16 · Loci',
    description:
      'Move point P along the perpendicular bisector of AB and along a fixed radius circle to verify equal distances PA = PB live.',
    simKind: 'g10_loci',
    defaultParams: { halfDist: 4, pOffset: 3, fixedR: 5 },
    controls: [
      { key: 'halfDist', label: 'Half AB distance', min: 2, max: 6, step: 1 },
      { key: 'pOffset', label: 'Point P height y', min: -5, max: 5, step: 1 },
      { key: 'fixedR', label: 'Circle locus radius R', min: 2, max: 7, step: 1 },
    ],
    presets: [
      { label: 'PA = PB = 5 (3-4-5)', params: { halfDist: 4, pOffset: 3, fixedR: 5 } },
      { label: 'On Midpoint (y = 0)', params: { halfDist: 5, pOffset: 0, fixedR: 5 } },
    ],
    keyFormulas: [
      'PA = PB \\implies \\text{Locus is Perpendicular Bisector of } AB',
      'OP = R \\implies \\text{Locus is Circle centred at } O \\text{ of radius } R',
    ],
    examTip:
      'Equidistant from two POINTS ⇒ Perpendicular Bisector. Equidistant from two intersecting LINES ⇒ Angle Bisector!',
    askPrompt: 'Summarize all 5 standard Loci theorems for Std 10 ICSE with a construction example.',
  },
  {
    id: 'sim_g10_ch15',
    grade: '10',
    chapterNumber: 15,
    chapterTitle: 'Circles (Angles, Cyclic Quads & Tangents)',
    simTitle: 'Central Angle 2θ, Cyclic Quad & Alternate Segment Lab',
    boardTag: 'ICSE Ch 17–18 · CBSE Ch 10',
    description:
      'Sweep inscribed angle θ to watch the central angle stay locked at 2θ, opposite cyclic angle at 180° − θ, and tangent-chord angle equal θ.',
    simKind: 'g10_circles_tangents',
    defaultParams: { theta: 52 },
    controls: [{ key: 'theta', label: 'Inscribed Angle θ', min: 25, max: 80, step: 1, unit: '°' }],
    presets: [
      { label: 'Standard 52° (Centre = 104°)', params: { theta: 52 } },
      { label: 'Semicircle 90° Case (θ=45°)', params: { theta: 45 } },
      { label: 'Steep Arc (θ = 70°)', params: { theta: 70 } },
    ],
    keyFormulas: [
      '\\angle AOB = 2 \\angle ACB, \\quad \\angle A + \\angle C = 180^\\circ',
      '\\text{Tangent-Chord (Alternate Segment): } \\angle BAT = \\angle ACB',
    ],
    examTip:
      'Always write the exact geometric theorem in brackets beside every step (e.g., "Angle at centre is twice angle at circumference") for full ICSE/CBSE proof marks.',
    askPrompt: 'Explain the Alternate Segment Theorem and solve a Std 10 Circle Tangent angle-chasing sum.',
  },
  {
    id: 'sim_g10_ch16',
    grade: '10',
    chapterNumber: 16,
    chapterTitle: 'Mensuration 3D (Cylinder, Cone & Sphere)',
    simTitle: 'Sphere-to-Cone Melting & Volume Conservation Lab',
    boardTag: 'ICSE Ch 20 · CBSE Ch 12',
    description:
      'Melt a sphere of radius R into a cone of base radius r and compute the exact conserved cone height h = 4R³ / r² without ever losing π.',
    simKind: 'g10_mensuration_recast',
    defaultParams: { sphereR: 6, coneR: 12 },
    controls: [
      { key: 'sphereR', label: 'Sphere Radius R', min: 2, max: 12, step: 1, unit: 'cm' },
      { key: 'coneR', label: 'Cone Base Radius r', min: 3, max: 16, step: 1, unit: 'cm' },
    ],
    presets: [
      { label: 'Selina Ex 20(D): R=6, r=12 ⇒ h=6', params: { sphereR: 6, coneR: 12 } },
      { label: 'R=9, r=9 ⇒ h=36', params: { sphereR: 9, coneR: 9 } },
    ],
    keyFormulas: [
      '\\frac{4}{3}\\pi R^3 = \\frac{1}{3}\\pi r^2 h \\implies h = \\frac{4 R^3}{r^2}',
      'l = \\sqrt{r^2 + h^2}, \\quad \\text{CSA}_{\\text{cone}} = \\pi r l',
    ],
    examTip:
      'NEVER substitute π = 22/7 in melting/recasting sums — cancel π on both sides first to eliminate arithmetic errors!',
    askPrompt: 'Solve a Std 10 Mensuration problem where a metallic cone is melted and recast into small spherical balls.',
  },
  {
    id: 'sim_g10_ch17',
    grade: '10',
    chapterNumber: 17,
    chapterTitle: 'Trigonometric Identities & Heights and Distances',
    simTitle: 'Two-Boat Cliff Depression Sightline Lab',
    boardTag: 'ICSE Ch 21–22 · CBSE Ch 8–9',
    description:
      'Adjust cliff height h and angles of depression α (far boat) & β (near boat) to calculate exact distance d = h(cot α − cot β) live.',
    simKind: 'g10_heights_distances',
    defaultParams: { height: 120, farAngle: 30, nearAngle: 45 },
    controls: [
      { key: 'height', label: 'Cliff Height h', min: 30, max: 200, step: 10, unit: 'm' },
      { key: 'farAngle', label: 'Far Angle α', min: 20, max: 45, step: 5, unit: '°' },
      { key: 'nearAngle', label: 'Near Angle β', min: 45, max: 75, step: 5, unit: '°' },
    ],
    presets: [
      { label: 'Selina Ex 22: h=120m, 30° & 45°', params: { height: 120, farAngle: 30, nearAngle: 45 } },
      { label: 'h=100m, 30° & 60°', params: { height: 100, farAngle: 30, nearAngle: 60 } },
    ],
    keyFormulas: [
      'd = h(\\cot\\alpha - \\cot\\beta)',
      '\\sin^2\\theta + \\cos^2\\theta = 1, \\quad \\sec^2\\theta - \\tan^2\\theta = 1',
    ],
    examTip:
      'The steeper angle (larger θ) ALWAYS belongs to the boat closer to the cliff! Label the right triangle clearly before writing tan θ.',
    askPrompt: 'Solve a Std 10 Heights and Distances problem with two ships on opposite sides of a 100m lighthouse.',
  },
  {
    id: 'sim_g10_ch18',
    grade: '10',
    chapterNumber: 18,
    chapterTitle: 'Ogive (Central Tendency) & Probability',
    simTitle: 'Cumulative Ogive Median & Dice/Card Probability Lab',
    boardTag: 'ICSE Ch 24–25 · CBSE Ch 13–14',
    description:
      'Explore cumulative frequency quartiles (Q₁, Median Q₂, Q₃) alongside exact probability P(E) = favorable / total outcomes.',
    simKind: 'g10_ogive_probability',
    defaultParams: { targetSum: 7, redBalls: 5, blueBalls: 3 },
    controls: [
      { key: 'targetSum', label: '2-Dice Target Sum', min: 2, max: 12, step: 1 },
      { key: 'redBalls', label: 'Red Balls in Bag', min: 1, max: 12, step: 1 },
      { key: 'blueBalls', label: 'Blue Balls in Bag', min: 1, max: 12, step: 1 },
    ],
    presets: [
      { label: 'Most Likely Dice Sum = 7', params: { targetSum: 7, redBalls: 5, blueBalls: 3 } },
      { label: 'Sum = 9 & 8 Red / 4 Blue', params: { targetSum: 9, redBalls: 8, blueBalls: 4 } },
    ],
    keyFormulas: [
      'P(E) = \\frac{n(E)}{n(S)}, \\quad P(E) + P(\\bar{E}) = 1',
      '\\text{IQR} = Q_3 - Q_1, \\quad \\text{Median} = \\left(\\frac{N}{2}\\right)^{\\text{th}} \\text{ obs. on Ogive}',
    ],
    examTip:
      'For two dice, n(S) = 36 always. For a deck of 52 cards: 4 suits × 13 cards, 12 face cards (J, Q, K), and 26 red / 26 black cards.',
    askPrompt: 'Solve a Std 10 Probability problem with two dice and a Std 10 Ogive median/IQR problem.',
  },
];

export const ALL_CHAPTER_SIMULATIONS: ChapterSimulationItem[] = [
  ...GRADE_9_CHAPTER_SIMULATIONS,
  ...GRADE_10_CHAPTER_SIMULATIONS,
];

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Pure mathematical engine returning exact live readouts for every Grade 9 & Grade 10 chapter simulation.
 */
export function computeChapterSimMetrics(
  simKind: ChapterSimKind,
  params: Record<string, number>
): { headline: string; readouts: ChapterSimReadout[] } {
  switch (simKind) {
    case 'g9_rational_surds': {
      const a = params.a ?? 3;
      const b = params.b ?? 2;
      const denom = a * a - b;
      const val = 1 / (a + Math.sqrt(b));
      return {
        headline: `1 / (${a} + √${b}) = (${a} − √${b}) / ${denom}`,
        readouts: [
          { label: 'Conjugate', value: `${a} − √${b}`, accent: 'sky' },
          { label: 'Rational Denominator (a² − b)', value: String(denom), accent: denom === 0 ? 'rose' : 'emerald' },
          { label: 'Decimal Value', value: fmt(val, 4), accent: 'amber' },
        ],
      };
    }
    case 'g9_compound_interest': {
      const P = params.principal ?? 10000;
      const r = params.rate ?? 10;
      const n = params.years ?? 4;
      const si = (P * r * n) / 100;
      const amtAnnual = P * Math.pow(1 + r / 100, n);
      const amtHalf = P * Math.pow(1 + r / 200, 2 * n);
      const ciAnnual = amtAnnual - P;
      return {
        headline: `CI beats SI by ₹${fmt(ciAnnual - si, 0)} over ${n} years`,
        readouts: [
          { label: 'Simple Interest (SI)', value: `₹${fmt(si, 0)}`, accent: 'sky' },
          { label: 'Annual CI Amount', value: `₹${fmt(amtAnnual, 0)}`, accent: 'emerald' },
          { label: 'Half-Yearly CI Amount', value: `₹${fmt(amtHalf, 0)}`, accent: 'amber' },
        ],
      };
    }
    case 'g9_expansions': {
      const a = params.a ?? 6;
      const b = params.b ?? 3;
      const total = (a + b) * (a + b);
      return {
        headline: `(${a} + ${b})² = ${a * a} + 2(${a * b}) + ${b * b} = ${total}`,
        readouts: [
          { label: 'a² Square', value: String(a * a), accent: 'sky' },
          { label: '2ab Rectangles', value: String(2 * a * b), accent: 'amber' },
          { label: 'b² Square', value: String(b * b), accent: 'emerald' },
        ],
      };
    }
    case 'g9_factorisation': {
      const p = params.p ?? 3;
      const q = params.q ?? 5;
      const sum = p + q;
      const prod = p * q;
      const fmtTerm = (v: number) => (v >= 0 ? `+ ${v}` : `− ${Math.abs(v)}`);
      return {
        headline: `x² ${fmtTerm(sum)}x ${fmtTerm(prod)} = (x ${fmtTerm(p)})(x ${fmtTerm(q)})`,
        readouts: [
          { label: 'Middle Term Sum (p+q)', value: String(sum), accent: 'sky' },
          { label: 'Constant Product (pq)', value: String(prod), accent: 'emerald' },
          { label: 'Roots', value: `x = ${-p}, ${-q}`, accent: 'amber' },
        ],
      };
    }
    case 'g9_simultaneous': {
      const m1 = params.m1 ?? 1;
      const c1 = params.c1 ?? 1;
      const m2 = params.m2 ?? -1;
      const c2 = params.c2 ?? 5;
      if (Math.abs(m1 - m2) < 1e-6) {
        const coincident = Math.abs(c1 - c2) < 1e-6;
        return {
          headline: coincident ? 'Coincident Lines · Infinitely Many Solutions' : 'Parallel Lines · No Solution',
          readouts: [
            { label: 'Slopes', value: `m₁ = m₂ = ${fmt(m1)}`, accent: 'amber' },
            { label: 'Classification', value: coincident ? 'Dependent' : 'Inconsistent', accent: 'rose' },
            { label: 'Intersection', value: coincident ? 'Every point' : 'None', accent: 'sky' },
          ],
        };
      }
      const ix = (c2 - c1) / (m1 - m2);
      const iy = m1 * ix + c1;
      return {
        headline: `Unique Intersection at (${fmt(ix)}, ${fmt(iy)})`,
        readouts: [
          { label: 'Solution x', value: fmt(ix), accent: 'sky' },
          { label: 'Solution y', value: fmt(iy), accent: 'emerald' },
          { label: 'Angle Type', value: Math.abs(m1 * m2 + 1) < 1e-4 ? 'Perpendicular (90°)' : 'Intersecting', accent: 'amber' },
        ],
      };
    }
    case 'g9_indices': {
      const a = params.base ?? 2;
      const m = params.m ?? 3;
      const n = params.n ?? 2;
      const sumExp = m + n;
      const diffExp = m - n;
      return {
        headline: `${a}^(${m}) × ${a}^(${n}) = ${a}^(${sumExp}) = ${fmt(Math.pow(a, sumExp), 4)}`,
        readouts: [
          { label: 'Product Law a^(m+n)', value: `${a}^${sumExp} = ${fmt(Math.pow(a, sumExp), 3)}`, accent: 'emerald' },
          { label: 'Quotient Law a^(m−n)', value: `${a}^${diffExp} = ${fmt(Math.pow(a, diffExp), 3)}`, accent: 'sky' },
          { label: 'Power Law (a^m)^n', value: `${a}^${m * n}`, accent: 'amber' },
        ],
      };
    }
    case 'g9_logarithms': {
      const b = Math.max(2, params.base ?? 2);
      const M = Math.max(1, params.xVal ?? 8);
      const N = Math.max(1, params.yVal ?? 4);
      const logM = Math.log(M) / Math.log(b);
      const logN = Math.log(N) / Math.log(b);
      return {
        headline: `log_${b}(${M} × ${N}) = ${fmt(logM, 3)} + ${fmt(logN, 3)} = ${fmt(logM + logN, 3)}`,
        readouts: [
          { label: `log_${b}(${M})`, value: fmt(logM, 3), accent: 'sky' },
          { label: `log_${b}(${N})`, value: fmt(logN, 3), accent: 'emerald' },
          { label: `log_${b}(M/N)`, value: fmt(logM - logN, 3), accent: 'amber' },
        ],
      };
    }
    case 'g9_triangles': {
      const a = params.sideA ?? 6;
      const b = params.sideB ?? 7;
      const c = params.sideC ?? 8;
      const valid = a + b > c && b + c > a && c + a > b;
      if (!valid) {
        return {
          headline: `Invalid Triangle: Triangle Inequality Violated`,
          readouts: [
            { label: 'Inequality Check', value: 'Failed (sum ≤ 3rd side)', accent: 'rose' },
            { label: 'Perimeter', value: 'N/A', accent: 'sky' },
            { label: 'Area', value: '0', accent: 'amber' },
          ],
        };
      }
      const s = (a + b + c) / 2;
      const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      const angC = (Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)))) * 180) / Math.PI;
      const kind = a === b && b === c ? 'Equilateral' : a === b || b === c || a === c ? 'Isosceles' : 'Scalene';
      return {
        headline: `Valid ${kind} Triangle · Area = ${fmt(area, 2)} sq.u`,
        readouts: [
          { label: 'Type', value: kind, accent: 'emerald' },
          { label: 'Angle C (opp. c)', value: `${fmt(angC, 1)}°`, accent: 'sky' },
          { label: 'Heron Area', value: `${fmt(area, 2)} u²`, accent: 'amber' },
        ],
      };
    }
    case 'g9_midpoint_theorem': {
      const base = params.base ?? 10;
      const h = params.apexY ?? 7;
      const de = base / 2;
      const fullArea = 0.5 * base * h;
      return {
        headline: `DE = ${fmt(de, 1)} = ½ BC (${base}) · DE ∥ BC`,
        readouts: [
          { label: 'Mid-Segment DE', value: `${fmt(de, 1)} u`, accent: 'emerald' },
          { label: 'Area(△ADE)', value: `${fmt(fullArea / 4, 2)} u²`, accent: 'sky' },
          { label: 'Area(△ABC)', value: `${fmt(fullArea, 2)} u² (4×)`, accent: 'amber' },
        ],
      };
    }
    case 'g9_pythagoras': {
      const a = params.a ?? 3;
      const b = params.b ?? 4;
      const cSq = a * a + b * b;
      const c = Math.sqrt(cSq);
      const isTriplet = Number.isInteger(c);
      return {
        headline: `${a}² + ${b}² = ${a * a} + ${b * b} = ${cSq} ⇒ c = ${fmt(c, 3)}`,
        readouts: [
          { label: 'Square a²', value: String(a * a), accent: 'sky' },
          { label: 'Square b²', value: String(b * b), accent: 'amber' },
          { label: 'Hypotenuse c', value: isTriplet ? `${c} (Triplet!)` : fmt(c, 3), accent: 'emerald' },
        ],
      };
    }
    case 'g9_polygons': {
      const n = Math.max(3, Math.round(params.sides ?? 6));
      const intSum = (n - 2) * 180;
      const eachInt = intSum / n;
      const eachExt = 360 / n;
      const diags = (n * (n - 3)) / 2;
      return {
        headline: `Regular ${n}-gon · Interior = ${fmt(eachInt, 1)}°, Exterior = ${fmt(eachExt, 1)}°`,
        readouts: [
          { label: 'Interior Sum', value: `${intSum}°`, accent: 'sky' },
          { label: 'Each Exterior Angle', value: `${fmt(eachExt, 1)}°`, accent: 'emerald' },
          { label: 'Total Diagonals', value: String(diags), accent: 'amber' },
        ],
      };
    }
    case 'g9_area_shear': {
      const b = params.base ?? 8;
      const h = params.height ?? 5;
      const s = params.shear ?? 3;
      const pArea = b * h;
      const tArea = 0.5 * b * h;
      return {
        headline: `Invariant Area: ▱ = ${pArea} u², △ = ${tArea} u² (Shear = ${s})`,
        readouts: [
          { label: 'Parallelogram Area', value: `${pArea} u²`, accent: 'sky' },
          { label: 'Inscribed Triangle', value: `${tArea} u² (½)`, accent: 'emerald' },
          { label: 'Slant Side Length', value: fmt(Math.hypot(s, h), 2), accent: 'amber' },
        ],
      };
    }
    case 'g9_circle_chords': {
      const r = params.radius ?? 10;
      const d = Math.min(r - 0.5, params.dist ?? 6);
      const halfChord = Math.sqrt(Math.max(0, r * r - d * d));
      const chord = 2 * halfChord;
      return {
        headline: `Chord AB = 2√(${r}² − ${fmt(d, 1)}²) = ${fmt(chord, 2)} cm`,
        readouts: [
          { label: 'Half-Chord AM = MB', value: `${fmt(halfChord, 2)} cm`, accent: 'sky' },
          { label: 'Full Chord AB', value: `${fmt(chord, 2)} cm`, accent: 'emerald' },
          { label: 'Distance from O', value: `${fmt(d, 1)} cm`, accent: 'amber' },
        ],
      };
    }
    case 'g9_statistics': {
      const freqs = [params.f1 ?? 4, params.f2 ?? 9, params.f3 ?? 14, params.f4 ?? 8, params.f5 ?? 5];
      const mids = [5, 15, 25, 35, 45];
      const labels = ['0–10', '10–20', '20–30', '30–40', '40–50'];
      const totalF = freqs.reduce((s, v) => s + v, 0);
      const sumFx = freqs.reduce((s, f, i) => s + f * mids[i], 0);
      const mean = totalF > 0 ? sumFx / totalF : 0;
      let maxIdx = 0;
      freqs.forEach((f, i) => {
        if (f > freqs[maxIdx]) maxIdx = i;
      });
      return {
        headline: `Grouped Mean x̄ = ${fmt(mean, 2)} · Modal Class ${labels[maxIdx]}`,
        readouts: [
          { label: 'Total Frequency Σf', value: String(totalF), accent: 'sky' },
          { label: 'Mean (Σfx / Σf)', value: fmt(mean, 2), accent: 'emerald' },
          { label: 'Modal Class', value: `${labels[maxIdx]} (f=${freqs[maxIdx]})`, accent: 'amber' },
        ],
      };
    }
    case 'g9_mensuration_3d': {
      const r = params.radius ?? 7;
      const h = params.height ?? 10;
      const csa = 2 * Math.PI * r * h;
      const tsa = 2 * Math.PI * r * (r + h);
      const vol = Math.PI * r * r * h;
      return {
        headline: `Cylinder (r=${r}, h=${h}) · Volume = ${fmt(vol, 1)} cm³`,
        readouts: [
          { label: 'CSA (2πrh)', value: `${fmt(csa, 1)} cm²`, accent: 'sky' },
          { label: 'TSA (2πr(r+h))', value: `${fmt(tsa, 1)} cm²`, accent: 'amber' },
          { label: 'Volume (πr²h)', value: `${fmt(vol, 1)} cm³`, accent: 'emerald' },
        ],
      };
    }
    case 'g9_trig_coordinate': {
      const deg = params.angleDeg ?? 30;
      const H = params.hyp ?? 10;
      const rad = (deg * Math.PI) / 180;
      const opp = H * Math.sin(rad);
      const adj = H * Math.cos(rad);
      return {
        headline: `θ = ${deg}° · sin = ${fmt(Math.sin(rad), 3)}, cos = ${fmt(Math.cos(rad), 3)}, tan = ${fmt(Math.tan(rad), 3)}`,
        readouts: [
          { label: 'Opposite P = H sin θ', value: fmt(opp, 2), accent: 'sky' },
          { label: 'Adjacent B = H cos θ', value: fmt(adj, 2), accent: 'emerald' },
          { label: 'sin²θ + cos²θ', value: '1.000', accent: 'amber' },
        ],
      };
    }
    // ================= GRADE 10 =================
    case 'g10_gst': {
      const mp = params.mp ?? 15000;
      const disc = params.discount ?? 20;
      const rate = params.gstRate ?? 18;
      const inter = (params.interState ?? 0) >= 1;
      const sp = mp * (1 - disc / 100);
      const gstAmt = (sp * rate) / 100;
      const bill = sp + gstAmt;
      return {
        headline: `Taxable SP = ₹${fmt(sp, 0)} · Total Bill = ₹${fmt(bill, 0)}`,
        readouts: [
          { label: 'Taxable SP', value: `₹${fmt(sp, 0)}`, accent: 'sky' },
          {
            label: inter ? `IGST (${rate}%)` : `CGST + SGST (${rate / 2}% each)`,
            value: inter ? `₹${fmt(gstAmt, 0)}` : `₹${fmt(gstAmt / 2, 0)} + ₹${fmt(gstAmt / 2, 0)}`,
            accent: 'amber',
          },
          { label: 'Final Bill', value: `₹${fmt(bill, 0)}`, accent: 'emerald' },
        ],
      };
    }
    case 'g10_banking_rd': {
      const P = params.monthlyP ?? 1000;
      const n = params.months ?? 36;
      const r = params.rate ?? 8;
      const principal = P * n;
      const interest = (P * ((n * (n + 1)) / 24) * r) / 100;
      const mv = principal + interest;
      return {
        headline: `Maturity Value = ₹${fmt(mv, 0)} (Interest ₹${fmt(interest, 0)})`,
        readouts: [
          { label: 'Total Deposited (P×n)', value: `₹${fmt(principal, 0)}`, accent: 'sky' },
          { label: 'RD Interest I', value: `₹${fmt(interest, 0)}`, accent: 'amber' },
          { label: 'Maturity Value', value: `₹${fmt(mv, 0)}`, accent: 'emerald' },
        ],
      };
    }
    case 'g10_shares_dividends': {
      const nv = params.nv ?? 100;
      const mv = Math.max(1, params.mv ?? 125);
      const divRate = params.divRate ?? 15;
      const shares = params.shares ?? 40;
      const investment = shares * mv;
      const income = (shares * divRate * nv) / 100;
      const yieldPct = (income / investment) * 100;
      const status = mv > nv ? 'At Premium' : mv < nv ? 'At Discount' : 'At Par';
      return {
        headline: `${status} · Annual Income = ₹${fmt(income, 0)} (${fmt(yieldPct, 2)}% Return)`,
        readouts: [
          { label: 'Total Investment', value: `₹${fmt(investment, 0)}`, accent: 'sky' },
          { label: 'Annual Dividend', value: `₹${fmt(income, 0)}`, accent: 'emerald' },
          { label: 'Actual Return %', value: `${fmt(yieldPct, 2)}%`, accent: 'amber' },
        ],
      };
    }
    case 'g10_linear_inequations': {
      const rawA = params.a ?? -2;
      const a = rawA === 0 ? 1 : rawA;
      const b = params.b ?? 3;
      const c = params.c ?? 9;
      const bound = (c - b) / a;
      const flipped = a < 0;
      const sign = flipped ? '≥' : '≤';
      return {
        headline: `${a}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)} ≤ ${c}  ⇒  x ${sign} ${fmt(bound, 2)}`,
        readouts: [
          { label: 'Critical Boundary', value: fmt(bound, 2), accent: 'sky' },
          { label: 'Solution Set (x ∈ R)', value: `x ${sign} ${fmt(bound, 2)}`, accent: 'emerald' },
          { label: 'Inequality Sign', value: flipped ? 'Flipped (a < 0)' : 'Preserved (a > 0)', accent: flipped ? 'rose' : 'amber' },
        ],
      };
    }
    case 'g10_quadratic': {
      const rawA = params.a ?? 1;
      const a = rawA === 0 ? 1 : rawA;
      const b = params.b ?? -5;
      const c = params.c ?? 6;
      const disc = b * b - 4 * a * c;
      const vx = -b / (2 * a);
      const vy = a * vx * vx + b * vx + c;
      let rootsText = 'Complex (No Real Roots)';
      if (disc > 0) {
        const r1 = (-b + Math.sqrt(disc)) / (2 * a);
        const r2 = (-b - Math.sqrt(disc)) / (2 * a);
        rootsText = `x = ${fmt(r1, 2)}, ${fmt(r2, 2)}`;
      } else if (Math.abs(disc) < 1e-6) {
        rootsText = `Equal Root x = ${fmt(vx, 2)}`;
      }
      return {
        headline: `Δ = ${fmt(disc, 1)} · ${rootsText}`,
        readouts: [
          { label: 'Discriminant Δ', value: fmt(disc, 1), accent: disc < 0 ? 'rose' : 'emerald' },
          { label: 'Vertex (h, k)', value: `(${fmt(vx, 2)}, ${fmt(vy, 2)})`, accent: 'sky' },
          { label: 'Nature of Roots', value: disc > 0 ? 'Real & Distinct' : disc === 0 ? 'Real & Equal' : 'Imaginary', accent: 'amber' },
        ],
      };
    }
    case 'g10_ratio_proportion': {
      const a = params.a ?? 4;
      const c = params.c ?? 9;
      const b = Math.sqrt(a * c);
      const cd = a !== b ? (a + b) / (a - b) : NaN;
      return {
        headline: `Continued Proportion ${a} : ${fmt(b, 2)} = ${fmt(b, 2)} : ${c}`,
        readouts: [
          { label: 'Mean Proportional √(ac)', value: fmt(b, 2), accent: 'emerald' },
          { label: 'Common Ratio a/b', value: fmt(a / b, 3), accent: 'sky' },
          { label: '(a+b)/(a−b)', value: Number.isFinite(cd) ? fmt(cd, 2) : '∞ (a=b)', accent: 'amber' },
        ],
      };
    }
    case 'g10_remainder_factor': {
      const k = params.k ?? 2;
      const d = params.shift ?? 0;
      const rem = k * k * k - 6 * k * k + 11 * k - 6 + d;
      const isFactor = Math.abs(rem) < 1e-6;
      return {
        headline: `f(${k}) = ${fmt(rem, 2)} ⇒ (x − ${k}) is ${isFactor ? 'an EXACT Factor!' : 'NOT a factor'}`,
        readouts: [
          { label: 'Divisor', value: `(x − ${k})`, accent: 'sky' },
          { label: 'Remainder f(k)', value: fmt(rem, 2), accent: isFactor ? 'emerald' : 'amber' },
          { label: 'Factor Test', value: isFactor ? 'Yes (f(k) = 0)' : 'No (f(k) ≠ 0)', accent: isFactor ? 'emerald' : 'rose' },
        ],
      };
    }
    case 'g10_matrices': {
      const a = params.m11 ?? 2;
      const b = params.m12 ?? 1;
      const c = params.m21 ?? 0;
      const d = params.m22 ?? 2;
      const det = a * d - b * c;
      const trace = a + d;
      return {
        headline: `det(A) = ${det} · Trace(A) = ${trace} · ${det === 0 ? 'Singular' : 'Invertible'}`,
        readouts: [
          { label: 'Determinant ad − bc', value: String(det), accent: det === 0 ? 'rose' : 'emerald' },
          { label: 'Trace (a + d)', value: String(trace), accent: 'sky' },
          { label: 'Area Scale |det(A)|', value: `${Math.abs(det)}×`, accent: 'amber' },
        ],
      };
    }
    case 'g10_ap_gp': {
      const a = params.a ?? 2;
      const d = params.d ?? 3;
      const r = params.r ?? 2;
      const n = Math.max(1, Math.round(params.n ?? 6));
      const apTn = a + (n - 1) * d;
      const apSn = (n / 2) * (2 * a + (n - 1) * d);
      const gpTn = a * Math.pow(r, n - 1);
      const gpSn = r === 1 ? a * n : (a * (Math.pow(r, n) - 1)) / (r - 1);
      return {
        headline: `At n=${n}: AP T_${n}=${fmt(apTn, 1)} (S_${n}=${fmt(apSn, 1)}) vs GP T_${n}=${fmt(gpTn, 1)}`,
        readouts: [
          { label: `AP Sum S_${n}`, value: fmt(apSn, 1), accent: 'sky' },
          { label: `GP Term T_${n}`, value: fmt(gpTn, 1), accent: 'amber' },
          { label: `GP Sum S_${n}`, value: fmt(gpSn, 1), accent: 'emerald' },
        ],
      };
    }
    case 'g10_reflection': {
      const x = params.px ?? 4;
      const y = params.py ?? 3;
      return {
        headline: `P(${x}, ${y}) → Mx(${x}, ${-y}) · My(${-x}, ${y}) · Mo(${-x}, ${-y})`,
        readouts: [
          { label: 'In x-axis (Mx)', value: `(${x}, ${-y})`, accent: 'sky' },
          { label: 'In y-axis (My)', value: `(${-x}, ${y})`, accent: 'emerald' },
          { label: 'In Origin (Mo)', value: `(${-x}, ${-y})`, accent: 'amber' },
        ],
      };
    }
    case 'g10_section_formula': {
      const x1 = -1;
      const y1 = 7;
      const x2 = params.x2 ?? 4;
      const y2 = params.y2 ?? -3;
      const m = params.m ?? 2;
      const n = params.n ?? 3;
      const px = (m * x2 + n * x1) / (m + n);
      const py = (m * y2 + n * y1) / (m + n);
      return {
        headline: `Dividing A(−1, 7) to B(${x2}, ${y2}) in ${m}:${n} ⇒ P(${fmt(px, 2)}, ${fmt(py, 2)})`,
        readouts: [
          { label: 'Section Point P', value: `(${fmt(px, 2)}, ${fmt(py, 2)})`, accent: 'emerald' },
          { label: 'Midpoint M', value: `(${fmt((x1 + x2) / 2, 2)}, ${fmt((y1 + y2) / 2, 2)})`, accent: 'sky' },
          { label: 'Length AB', value: fmt(Math.hypot(x2 - x1, y2 - y1), 2), accent: 'amber' },
        ],
      };
    }
    case 'g10_straight_line': {
      const m = params.m ?? 1;
      const c = params.c ?? 2;
      const angle = ((Math.atan(m) * 180) / Math.PI + 180) % 180;
      const perpM = Math.abs(m) < 1e-6 ? Infinity : -1 / m;
      const xInt = Math.abs(m) < 1e-6 ? NaN : -c / m;
      return {
        headline: `y = ${fmt(m, 1)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)} · Inclination θ = ${fmt(angle, 1)}°`,
        readouts: [
          { label: 'Inclination θ', value: `${fmt(angle, 1)}°`, accent: 'sky' },
          { label: 'Perp. Slope (−1/m)', value: Number.isFinite(perpM) ? fmt(perpM, 2) : 'Vertical (∞)', accent: 'emerald' },
          { label: 'x-intercept', value: Number.isFinite(xInt) ? fmt(xInt, 2) : 'None', accent: 'amber' },
        ],
      };
    }
    case 'g10_similarity': {
      const k = params.k ?? 2;
      const b = params.base ?? 4;
      return {
        headline: `Scale k = ${k} ⇒ Side ${fmt(b * k, 1)}, Area ${fmt(k * k, 2)}×, Volume ${fmt(k * k * k, 2)}×`,
        readouts: [
          { label: 'Linear Ratio k', value: `${k}× (side ${fmt(b * k, 1)})`, accent: 'sky' },
          { label: 'Area Ratio k²', value: `${fmt(k * k, 2)}×`, accent: 'emerald' },
          { label: '3D Volume Ratio k³', value: `${fmt(k * k * k, 2)}×`, accent: 'amber' },
        ],
      };
    }
    case 'g10_loci': {
      const half = params.halfDist ?? 4;
      const y = params.pOffset ?? 3;
      const R = params.fixedR ?? 5;
      const dist = Math.hypot(half, y);
      return {
        headline: `PA = PB = ${fmt(dist, 2)} u (Always Equidistant on Bisector!)`,
        readouts: [
          { label: 'Distance PA = PB', value: `${fmt(dist, 2)} u`, accent: 'emerald' },
          { label: 'Circle Locus Radius', value: `${R} u`, accent: 'sky' },
          { label: 'Intersections with Circle', value: R > half ? '2 Points' : R === half ? '1 Midpoint' : '0 Points', accent: 'amber' },
        ],
      };
    }
    case 'g10_circles_tangents': {
      const theta = params.theta ?? 52;
      const central = 2 * theta;
      const oppCyclic = 180 - theta;
      return {
        headline: `Inscribed θ = ${theta}° · Centre 2θ = ${central}° · Cyclic Opp = ${oppCyclic}°`,
        readouts: [
          { label: 'Central Angle ∠AOB', value: `${central}°`, accent: 'sky' },
          { label: 'Opposite Cyclic ∠D', value: `${oppCyclic}°`, accent: 'emerald' },
          { label: 'Tangent-Chord ∠BAT', value: `${theta}°`, accent: 'amber' },
        ],
      };
    }
    case 'g10_mensuration_recast': {
      const R = params.sphereR ?? 6;
      const r = Math.max(1, params.coneR ?? 12);
      const h = (4 * R * R * R) / (r * r);
      const volPi = (4 / 3) * R * R * R;
      const l = Math.hypot(r, h);
      return {
        headline: `Recast Cone Height h = 4(${R}³) / ${r}² = ${fmt(h, 2)} cm`,
        readouts: [
          { label: 'Conserved Volume', value: `${fmt(volPi, 1)}π cm³`, accent: 'sky' },
          { label: 'Recast Cone Height h', value: `${fmt(h, 2)} cm`, accent: 'emerald' },
          { label: 'Cone Slant Height l', value: `${fmt(l, 2)} cm`, accent: 'amber' },
        ],
      };
    }
    case 'g10_heights_distances': {
      const h = params.height ?? 120;
      const aDeg = Math.min((params.nearAngle ?? 45) - 5, params.farAngle ?? 30);
      const bDeg = Math.max(aDeg + 5, params.nearAngle ?? 45);
      const dNear = h / Math.tan((bDeg * Math.PI) / 180);
      const dFar = h / Math.tan((aDeg * Math.PI) / 180);
      const gap = Math.max(0, dFar - dNear);
      return {
        headline: `Distance Between Boats = ${fmt(gap, 2)} m (α=${aDeg}°, β=${bDeg}°)`,
        readouts: [
          { label: 'Near Boat Distance', value: `${fmt(dNear, 1)} m`, accent: 'sky' },
          { label: 'Far Boat Distance', value: `${fmt(dFar, 1)} m`, accent: 'amber' },
          { label: 'Gap Between Boats', value: `${fmt(gap, 2)} m`, accent: 'emerald' },
        ],
      };
    }
    case 'g10_ogive_probability': {
      const sumTarget = Math.max(2, Math.min(12, Math.round(params.targetSum ?? 7)));
      const favDice = 6 - Math.abs(7 - sumTarget);
      const red = Math.max(1, params.redBalls ?? 5);
      const blue = Math.max(1, params.blueBalls ?? 3);
      const totalBalls = red + blue;
      return {
        headline: `P(2-Dice Sum = ${sumTarget}) = ${favDice}/36 (${fmt((favDice / 36) * 100, 1)}%)`,
        readouts: [
          { label: `P(Dice Sum = ${sumTarget})`, value: `${favDice}/36 = ${fmt(favDice / 36, 3)}`, accent: 'sky' },
          { label: 'P(Drawing Red Ball)', value: `${red}/${totalBalls} = ${fmt(red / totalBalls, 3)}`, accent: 'emerald' },
          { label: 'P(Not Red)', value: `${blue}/${totalBalls} = ${fmt(blue / totalBalls, 3)}`, accent: 'amber' },
        ],
      };
    }
  }
}
