import type { AttemptEntry, CurriculumBoard, GradeLevel } from './adaptiveEngine';

/**
 * Feature #55: Real SM-2 Spaced Repetition Flashcard Scheduler.
 */
export interface Sm2Card {
  id: string;
  chapter: string;
  front: string;
  back: string;
  grade: GradeLevel;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: number;
}

export function reviewSm2Card(card: Sm2Card, quality: 1 | 3 | 4 | 5, nowMs: number = Date.now()): Sm2Card {
  let { repetitions, intervalDays, easeFactor } = card;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    Number((easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))).toFixed(2))
  );

  return {
    ...card,
    repetitions,
    intervalDays,
    easeFactor,
    nextReviewAt: nowMs + intervalDays * 86_400_000,
  };
}

export const INITIAL_SM2_FLASHCARDS: Sm2Card[] = [
  { id: 'fc_1', chapter: 'Surds', grade: '9', front: 'Rationalizing factor of (a + b√c)', back: '(a − b√c), giving denominator a² − b²c', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_2', chapter: 'Expansions', grade: '9', front: 'a³ + b³ + c³ − 3abc identity', back: '(a + b + c)(a² + b² + c² − ab − bc − ca); equals 0 if a+b+c = 0', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_3', chapter: 'Trigonometry', grade: '10', front: 'Three fundamental Pythagorean Trig identities', back: 'sin²θ + cos²θ = 1 · 1 + tan²θ = sec²θ · 1 + cot²θ = cosec²θ', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_4', chapter: 'Quadratic Equations', grade: '10', front: 'Condition for real and equal roots of ax² + bx + c = 0', back: 'Discriminant Δ = b² − 4ac = 0, giving x = −b / (2a)', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_5', chapter: 'Banking (RD)', grade: '10', front: 'ICSE Recurring Deposit Interest Formula', back: 'I = P × [n(n + 1) / 24] × (r / 100); Maturity Value = P·n + I', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_6', chapter: 'Coordinate Geometry', grade: '10', front: 'Section Formula dividing (x₁,y₁) and (x₂,y₂) in ratio m₁:m₂', back: '((m₁x₂ + m₂x₁)/(m₁+m₂), (m₁y₂ + m₂y₁)/(m₁+m₂))', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_7', chapter: 'Mensuration', grade: '10', front: 'Volume & CSA of a Right Circular Cone', back: 'V = (1/3)πr²h · CSA = πrl where slant height l = √(r² + h²)', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_8', chapter: 'Circles', grade: '10', front: 'Alternate Segment Theorem', back: 'Angle between tangent and chord through contact point equals angle subtended by chord in alternate segment.', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_9', chapter: 'AP & GP', grade: '11', front: 'Sum of first n terms of an AP and GP (r ≠ 1)', back: 'AP: Sₙ = (n/2)[2a + (n−1)d] · GP: Sₙ = a(rⁿ − 1)/(r − 1)', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
  { id: 'fc_10', chapter: 'Calculus', grade: '12', front: 'Integration by Parts (ILATE)', back: '∫ u·dv = u·v − ∫ v·du (Choose u by Inverse, Log, Algebraic, Trig, Exponential)', repetitions: 0, intervalDays: 1, easeFactor: 2.5, nextReviewAt: 0 },
];

/**
 * Feature #56: 60-Second Mental Math Sprint problem generator.
 */
export interface MentalSprintQuestion {
  prompt: string;
  answer: number;
  category: 'Squares' | 'Cubes' | 'Percentages' | 'Fractions' | 'Arithmetic';
}

export function generateMentalSprintQuestion(seedOffset: number = Math.floor(Math.random() * 1000)): MentalSprintQuestion {
  const mode = Math.abs(seedOffset) % 5;
  const r = (min: number, max: number) => min + (Math.abs(seedOffset * 31 + min * 7) % (max - min + 1));

  if (mode === 0) {
    const n = r(11, 29);
    return { prompt: `${n}² = ?`, answer: n * n, category: 'Squares' };
  }
  if (mode === 1) {
    const n = r(3, 12);
    return { prompt: `${n}³ = ?`, answer: n * n * n, category: 'Cubes' };
  }
  if (mode === 2) {
    const pct = [5, 10, 15, 20, 25, 30, 40][Math.abs(seedOffset) % 7];
    const base = [80, 120, 160, 200, 240, 300, 400][Math.abs(seedOffset * 3) % 7];
    return { prompt: `${pct}% of ${base} = ?`, answer: (pct * base) / 100, category: 'Percentages' };
  }
  if (mode === 3) {
    const d = [2, 3, 4, 5, 6, 8][Math.abs(seedOffset) % 6];
    const mult = r(3, 12);
    const num = d * mult;
    return { prompt: `${num} ÷ ${d} = ?`, answer: mult, category: 'Fractions' };
  }
  const a = r(14, 48);
  const b = r(9, 37);
  return { prompt: `${a} + ${b} = ?`, answer: a + b, category: 'Arithmetic' };
}

/**
 * Feature #52 & #57: Past 10 Years Board Bank + CBSE Assertion-Reason & Case-Study Bank.
 */
export interface PastBoardQuestion {
  id: string;
  year: number;
  board: CurriculumBoard;
  grade: GradeLevel;
  chapter: string;
  marks: 2 | 3 | 4 | 5;
  difficulty: 'Foundation' | 'Standard' | 'Challenging';
  question: string;
  markingScheme: string[];
  answer: string;
}

export const PAST_10YR_BOARD_BANK: PastBoardQuestion[] = [
  {
    id: 'pyq_2025_icse_gst',
    year: 2025,
    board: 'ICSE',
    grade: '10',
    chapter: 'GST & Commercial Maths',
    marks: 3,
    difficulty: 'Foundation',
    question: 'A retailer buys a scientific calculator for ₹1,200 (intra-state) at 18% GST and sells it to a student at ₹1,500. Find the net GST paid by the retailer to the State Government.',
    markingScheme: ['Input SGST = 9% of 1200 = ₹108 [M1]', 'Output SGST = 9% of 1500 = ₹135 [M1]', 'Net SGST paid = 135 − 108 = ₹27 [A1]'],
    answer: '₹27',
  },
  {
    id: 'pyq_2024_icse_quad',
    year: 2024,
    board: 'ICSE',
    grade: '10',
    chapter: 'Quadratic Equations',
    marks: 3,
    difficulty: 'Standard',
    question: 'Find the values of k for which the quadratic equation (k + 4)x² + (k + 1)x + 1 = 0 has real and equal roots.',
    markingScheme: ['Set Δ = b² − 4ac = 0: (k+1)² − 4(k+4)(1) = 0 [M1]', 'Simplify: k² − 2k − 15 = 0 -> (k − 5)(k + 3) = 0 [M1]', 'k = 5 or k = −3 [A1]'],
    answer: 'k = 5 or k = −3',
  },
  {
    id: 'pyq_2023_icse_trig',
    year: 2023,
    board: 'ICSE',
    grade: '10',
    chapter: 'Trigonometrical Identities',
    marks: 4,
    difficulty: 'Challenging',
    question: 'Prove that (sin θ / (1 − cos θ)) + (tan θ / (1 + cos θ)) = sec θ·cosec θ + cot θ.',
    markingScheme: ['Convert tan θ = sin θ / cos θ and take common denominator [M1]', 'Use 1 − cos²θ = sin²θ identity [M1]', 'Split numerator terms cleanly [M1]', 'Arrive at sec θ·cosec θ + cot θ [A1]'],
    answer: 'Verified Identity (LHS = RHS)',
  },
  {
    id: 'pyq_2022_cbse_ap',
    year: 2022,
    board: 'CBSE',
    grade: '10',
    chapter: 'Arithmetic Progressions',
    marks: 3,
    difficulty: 'Standard',
    question: 'If the sum of the first 7 terms of an AP is 49 and that of 17 terms is 289, find the sum of its first n terms.',
    markingScheme: ['(7/2)(2a+6d)=49 -> a+3d=7 [M1]', '(17/2)(2a+16d)=289 -> a+8d=17 => d=2, a=1 [M1]', 'Sₙ = (n/2)[2 + (n−1)2] = n² [A1]'],
    answer: 'Sₙ = n²',
  },
  {
    id: 'pyq_2021_icse_cone',
    year: 2021,
    board: 'ICSE',
    grade: '9',
    chapter: 'Mensuration & Solids',
    marks: 4,
    difficulty: 'Standard',
    question: 'A metallic sphere of radius 4.2 cm is melted and recast into a cylinder of radius 6 cm. Find the height of the cylinder.',
    markingScheme: ['Volume conserved: (4/3)πr₁³ = πr₂²h [M1]', 'Cancel π: (4/3)(4.2)³ = 36h [M1]', 'Compute h = 98.784 / 36 [M1]', 'h = 2.744 cm [A1]'],
    answer: '2.744 cm',
  },
  {
    id: 'pyq_2019_cbse_calc',
    year: 2019,
    board: 'CBSE',
    grade: '12',
    chapter: 'Calculus — Definite Integrals',
    marks: 4,
    difficulty: 'Challenging',
    question: 'Evaluate ∫₀^(π/2) [sin⁴x / (sin⁴x + cos⁴x)] dx using King’s Property.',
    markingScheme: ['Let I = ∫₀^(π/2) sin⁴x/(sin⁴x+cos⁴x) dx [B1]', 'Apply f(a−x): I = ∫₀^(π/2) cos⁴x/(cos⁴x+sin⁴x) dx [M1]', 'Add both: 2I = ∫₀^(π/2) 1 dx = π/2 [M1]', 'I = π/4 [A1]'],
    answer: 'π / 4',
  },
  {
    id: 'pyq_2018_icse_coord',
    year: 2018,
    board: 'ICSE',
    grade: '10',
    chapter: 'Coordinate Geometry',
    marks: 3,
    difficulty: 'Foundation',
    question: 'Find the equation of a line passing through (−2, 3) and perpendicular to 2x − 3y + 5 = 0.',
    markingScheme: ['Slope of given line m₁ = 2/3 [M1]', 'Perpendicular slope m₂ = −3/2 [M1]', 'y − 3 = (−3/2)(x + 2) => 3x + 2y = 0 [A1]'],
    answer: '3x + 2y = 0',
  },
  {
    id: 'pyq_2016_cbse_prob',
    year: 2016,
    board: 'CBSE',
    grade: '10',
    chapter: 'Probability',
    marks: 3,
    difficulty: 'Foundation',
    question: 'Two unbiased dice are thrown simultaneously. Find the probability of getting a doublet or a total of 9.',
    markingScheme: ['Total outcomes = 36 [B1]', 'Doublets = 6, Sum 9 = {(3,6),(4,5),(5,4),(6,3)} = 4 (disjoint) [M1]', 'P = (6 + 4)/36 = 10/36 = 5/18 [A1]'],
    answer: '5 / 18',
  },
];

export interface AssertionReasonItem {
  id: string;
  chapter: string;
  assertion: string;
  reason: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export const CBSE_ASSERTION_REASON_BANK: AssertionReasonItem[] = [
  {
    id: 'ar_1',
    chapter: 'Quadratic Equations',
    assertion: 'The quadratic equation 3x² − 6x + 3 = 0 has two equal real roots.',
    reason: 'A quadratic equation ax² + bx + c = 0 has equal real roots whenever its discriminant b² − 4ac = 0.',
    correctOption: 'A',
    explanation: 'Both A and R are true, and R is the exact explanation: Δ = (−6)² − 4(3)(3) = 36 − 36 = 0.',
  },
  {
    id: 'ar_2',
    chapter: 'Trigonometry',
    assertion: 'The value of sin θ increases as θ increases from 0° to 90°.',
    reason: 'The value of cos θ also increases as θ increases from 0° to 90°.',
    correctOption: 'C',
    explanation: 'Assertion is true (0 → 1), but Reason is false because cos θ decreases from 1 to 0 over [0°, 90°].',
  },
  {
    id: 'ar_3',
    chapter: 'Circles',
    assertion: 'Exactly two tangents can be drawn to a circle from a point lying outside the circle.',
    reason: 'The lengths of tangents drawn from an external point to a circle are equal.',
    correctOption: 'B',
    explanation: 'Both statements are true, but equality of lengths does not explain why there are two tangents.',
  },
  {
    id: 'ar_4',
    chapter: 'Coordinate Geometry',
    assertion: 'The point (0, 5) lies on the x-axis.',
    reason: 'Every point on the y-axis has its x-coordinate equal to 0.',
    correctOption: 'D',
    explanation: 'Assertion is false ((0, 5) lies on the y-axis!), while Reason is true.',
  },
];

/**
 * Feature #54: Mistake Vault Entry.
 */
export type MistakeRootCause = 'Careless' | 'Concept' | 'Formula' | 'Time';

export interface MistakeVaultEntry {
  id: string;
  question: string;
  chapter: string;
  cause: MistakeRootCause;
  note: string;
  resolved: boolean;
  createdAt: string;
}

/**
 * Feature #61: Deterministic Shareable Quiz Code Encoder / Decoder.
 */
export interface SharedQuizPayload {
  board: CurriculumBoard;
  grade: GradeLevel;
  chapter: string;
  count: number;
  seed: number;
}

export function encodeQuizCode(payload: SharedQuizPayload): string {
  const b = payload.board === 'CBSE' ? 'C' : 'I';
  const ch = payload.chapter.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'MIX';
  return `PSMA-${b}${payload.grade}-${ch}-${payload.count}Q-${(payload.seed % 9000) + 1000}`;
}

export function decodeQuizCode(code: string): SharedQuizPayload | null {
  const match = code.trim().toUpperCase().match(/^PSMA-([IC])(8|9|10|11|12)-([A-Z0-9]{1,8})-(\d{1,2})Q-(\d{4})$/);
  if (!match) return null;
  return {
    board: match[1] === 'C' ? 'CBSE' : 'ICSE',
    grade: match[2] as GradeLevel,
    chapter: match[3],
    count: Math.max(1, Math.min(25, Number(match[4]))),
    seed: Number(match[5]),
  };
}

/**
 * Feature #63: Exam Countdown Readiness Calculator.
 */
export function computeExamReadiness(params: {
  examDateIso: string;
  overallAccuracy: number;
  solvedCount: number;
  targetSolved?: number;
  nowMs?: number;
}): { daysRemaining: number; readinessPercent: number; dailyTargetSums: number } {
  const now = params.nowMs ?? Date.now();
  const examMs = Date.parse(params.examDateIso);
  const daysRemaining = Number.isFinite(examMs)
    ? Math.max(1, Math.ceil((examMs - now) / 86_400_000))
    : 30;
  const target = params.targetSolved ?? 60;
  const volumeScore = Math.min(100, Math.round((params.solvedCount / target) * 100));
  const readinessPercent = Math.min(
    100,
    Math.round(params.overallAccuracy * 0.65 + volumeScore * 0.35)
  );
  const remainingSums = Math.max(5, target - params.solvedCount);
  const dailyTargetSums = Math.max(3, Math.ceil(remainingSums / daysRemaining));
  return { daysRemaining, readinessPercent, dailyTargetSums };
}

/**
 * Feature #64: Formula-to-Problem Reverse Match pairs.
 */
export interface ReverseMatchQuestion {
  id: string;
  wordProblem: string;
  correctFormula: string;
  options: string[];
}

export const REVERSE_MATCH_BANK: ReverseMatchQuestion[] = [
  {
    id: 'rm_1',
    wordProblem: 'Riya deposits ₹800 every month for 2 years in a bank paying 9% p.a. Find the interest earned at maturity.',
    correctFormula: 'I = P × [n(n+1)/24] × (r/100)',
    options: ['I = P × [n(n+1)/24] × (r/100)', 'A = P(1 + r/100)ⁿ', 'Sₙ = (n/2)[2a + (n−1)d]', 'SI = (P × R × T) / 100'],
  },
  {
    id: 'rm_2',
    wordProblem: 'Find the coordinates of the point dividing the join of A(−1, 7) and B(4, −3) internally in the ratio 2 : 3.',
    correctFormula: '((m₁x₂ + m₂x₁)/(m₁+m₂), (m₁y₂ + m₂y₁)/(m₁+m₂))',
    options: ['√((x₂−x₁)² + (y₂−y₁)²)', '((m₁x₂ + m₂x₁)/(m₁+m₂), (m₁y₂ + m₂y₁)/(m₁+m₂))', '(y₂ − y₁) / (x₂ − x₁)', 'y − y₁ = m(x − x₁)'],
  },
  {
    id: 'rm_3',
    wordProblem: 'A triangular park has sides 13 m, 14 m, and 15 m. Find the cost of turfing it at ₹25 per m².',
    correctFormula: 'Area = √(s(s−a)(s−b)(s−c))',
    options: ['Area = ½ × base × height', 'Area = √(s(s−a)(s−b)(s−c))', 'Area = (√3/4)a²', 'Area = πr²'],
  },
  {
    id: 'rm_4',
    wordProblem: 'From the top of a 60 m cliff, the angles of depression of two boats on the same side are 30° and 60°. Find the distance between them.',
    correctFormula: 'd = h(cot α − cot β)',
    options: ['sin²θ + cos²θ = 1', 'd = h(cot α − cot β)', 'a/sin A = b/sin B', 'l = √(r² + h²)'],
  },
];

/**
 * Feature #95: Deterministic Daily Problem of the Day (POTD) per standard.
 */
export interface DailyPotdItem {
  dateKey: string;
  grade: GradeLevel;
  title: string;
  chapter: string;
  question: string;
  hint: string;
  answer: string;
  xpBonus: number;
}

const POTD_POOL: Record<GradeLevel, Array<Omit<DailyPotdItem, 'dateKey' | 'grade' | 'xpBonus'>>> = {
  '8': [
    { title: 'Exponent Cascade', chapter: 'Indices', question: 'Find x if 2^(x+1) + 2^x = 48.', hint: 'Factor out 2^x from the left side: 2^x(2 + 1) = 48.', answer: 'x = 4' },
    { title: 'Smart Factorisation', chapter: 'Factorisation', question: 'Factorise completely: x⁴ − 16.', hint: 'Apply difference of squares twice: (x² − 4)(x² + 4).', answer: '(x − 2)(x + 2)(x² + 4)' },
  ],
  '9': [
    { title: 'Conjugate Power Trick', chapter: 'Surds', question: 'If x = 2 + √3, find the value of x + 1/x.', hint: 'Since 2² − (√3)² = 1, 1/x is simply 2 − √3.', answer: '4' },
    { title: 'Heron Exact Area', chapter: 'Mensuration', question: 'Find the area of a triangle with sides 13 cm, 14 cm, and 15 cm.', hint: 'Semi-perimeter s = 21; compute √(21 × 8 × 7 × 6).', answer: '84 cm²' },
  ],
  '10': [
    { title: 'Discriminant Equal Roots', chapter: 'Quadratic Equations', question: 'For what positive value of k does x² − kx + 9 = 0 have equal roots?', hint: 'Set k² − 4(1)(9) = 0.', answer: 'k = 6' },
    { title: 'Trig Identity Sprint', chapter: 'Trigonometry', question: 'If sin θ + cos θ = √2, find the value of sin θ · cos θ.', hint: 'Square both sides and apply sin²θ + cos²θ = 1.', answer: '1/2' },
  ],
  '11': [
    { title: 'Imaginary Power Cycle', chapter: 'Complex Numbers', question: 'Evaluate i⁹ + i¹⁹ where i = √(−1).', hint: 'Reduce exponents modulo 4: i¹ + i³ = i − i.', answer: '0' },
    { title: 'Geometric Mean Bridge', chapter: 'AP & GP', question: 'Find the positive geometric mean between 4 and 36.', hint: 'GM = √(a × b).', answer: '12' },
  ],
  '12': [
    { title: 'King’s Symmetry Integral', chapter: 'Definite Integrals', question: 'Evaluate ∫₀^(π/2) [√sin x / (√sin x + √cos x)] dx.', hint: 'Replace x with π/2 − x and add both integrals.', answer: 'π / 4' },
    { title: 'Determinant Zero Trick', chapter: 'Matrices & Determinants', question: 'If a 3×3 matrix A has |A| = 5, find |2A|.', hint: 'For an n×n matrix, |kA| = kⁿ|A|.', answer: '40' },
  ],
};

export function getDailyPotd(grade: GradeLevel, date: Date = new Date()): DailyPotdItem {
  const dateKey = date.toISOString().slice(0, 10);
  const pool = POTD_POOL[grade] || POTD_POOL['10'];
  const daySeed = date.getUTCFullYear() * 372 + date.getUTCMonth() * 31 + date.getUTCDate();
  const chosen = pool[daySeed % pool.length];
  return {
    ...chosen,
    dateKey,
    grade,
    xpBonus: 75,
  };
}

/**
 * Feature #96: Chapter Mastery Skill Tree (Standards 8 -> 12).
 */
export interface SkillTreeNode {
  id: string;
  label: string;
  grade: GradeLevel;
  prerequisiteIds: string[];
  matchKeywords: RegExp;
}

export const MASTERY_SKILL_TREE: SkillTreeNode[] = [
  { id: 'n_rational', label: 'Rational & Surds', grade: '8', prerequisiteIds: [], matchKeywords: /rational|surd|number/i },
  { id: 'n_algebra', label: 'Expansions & Factoring', grade: '9', prerequisiteIds: ['n_rational'], matchKeywords: /expansion|factor|polynomial|algebra/i },
  { id: 'n_commercial', label: 'GST, Banking & CI', grade: '10', prerequisiteIds: ['n_rational'], matchKeywords: /gst|bank|compound|commercial|share/i },
  { id: 'n_quad', label: 'Quadratic Equations', grade: '10', prerequisiteIds: ['n_algebra'], matchKeywords: /quadratic/i },
  { id: 'n_trig', label: 'Trigonometry & Heights', grade: '10', prerequisiteIds: ['n_algebra'], matchKeywords: /trig|height/i },
  { id: 'n_coord', label: 'Coordinate & Matrices', grade: '10', prerequisiteIds: ['n_algebra'], matchKeywords: /coord|matri|locus/i },
  { id: 'n_complex', label: 'Complex & Sequences', grade: '11', prerequisiteIds: ['n_quad'], matchKeywords: /complex|ap|gp|progression|sequence/i },
  { id: 'n_calculus', label: 'Calculus & Vectors', grade: '12', prerequisiteIds: ['n_trig', 'n_coord'], matchKeywords: /calculus|deriv|integr|limit|vector|lpp/i },
];

export function evaluateSkillTreeNodes(attempts: AttemptEntry[]) {
  return MASTERY_SKILL_TREE.map((node) => {
    const matched = attempts.filter((a) => node.matchKeywords.test(a.chapter));
    const correct = matched.filter((a) => a.isCorrect).length;
    const accuracy = matched.length > 0 ? Math.round((correct / matched.length) * 100) : 0;
    const status: 'mastered' | 'in-progress' | 'unlocked' =
      matched.length >= 1 && accuracy >= 75
        ? 'mastered'
        : matched.length > 0
          ? 'in-progress'
          : 'unlocked';
    return {
      ...node,
      attemptsCount: matched.length,
      accuracy,
      status,
    };
  });
}

/**
 * Feature #58: Time-per-question pacing telemetry per chapter.
 */
export function computeChapterPacing(attempts: AttemptEntry[]) {
  const byChapter = new Map<string, { totalSec: number; count: number; correct: number }>();
  for (const att of attempts) {
    const cur = byChapter.get(att.chapter) || { totalSec: 0, count: 0, correct: 0 };
    cur.totalSec += att.timeSpentSec;
    cur.count += 1;
    if (att.isCorrect) cur.correct += 1;
    byChapter.set(att.chapter, cur);
  }
  return Array.from(byChapter.entries()).map(([chapter, stats]) => {
    const avgSec = Math.round(stats.totalSec / stats.count);
    const budgetSec = 50;
    return {
      chapter,
      avgSec,
      budgetSec,
      accuracy: Math.round((stats.correct / stats.count) * 100),
      paceLabel: avgSec <= budgetSec ? 'On Pace' : 'Slow — Practice Speed',
    };
  });
}
