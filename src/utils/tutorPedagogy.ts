import type { CurriculumBoard, GradeLevel } from './adaptiveEngine';

export type TutorPersona =
  | 'friendly-coach'
  | 'strict-examiner'
  | 'olympiad-mentor'
  | 'rapid-revision';

export type BilingualLanguage =
  | 'English'
  | 'Hinglish'
  | 'Hindi'
  | 'Marathi'
  | 'Tamil'
  | 'Gujarati';

export interface TutorPedagogyConfig {
  socraticMode: boolean;
  socraticHintLevel: 1 | 2 | 3;
  showMarkingScheme: boolean;
  showAlternativeMethods: boolean;
  speedTrickMode: boolean;
  eliStuckMode: boolean;
  bilingualLanguage: BilingualLanguage;
  persona: TutorPersona;
  crossThreadMemory: string;
}

export const DEFAULT_PEDAGOGY_CONFIG: TutorPedagogyConfig = {
  socraticMode: false,
  socraticHintLevel: 1,
  showMarkingScheme: false,
  showAlternativeMethods: false,
  speedTrickMode: false,
  eliStuckMode: false,
  bilingualLanguage: 'English',
  persona: 'friendly-coach',
  crossThreadMemory: '',
};

/**
 * Composes non-intrusive pedagogical instructions onto a student prompt
 * so the live Gemini tutor adapts its explanation style dynamically (#1–#5, #9, #10, #15, #75).
 */
export function buildPedagogyPromptPrefix(
  config: TutorPedagogyConfig,
  board: CurriculumBoard,
  grade: GradeLevel
): string {
  const directives: string[] = [];

  if (config.persona === 'strict-examiner') {
    directives.push(`Adopt a Strict ${board} Board Examiner tone: demand exact step justifications and final units.`);
  } else if (config.persona === 'olympiad-mentor') {
    directives.push('Adopt an Olympiad Mentor tone: highlight invariant ideas, symmetry, and elegant insights.');
  } else if (config.persona === 'rapid-revision') {
    directives.push('Adopt a Rapid Revision tone: keep explanations ultra-crisp, formula-first, and high-yield.');
  }

  if (config.socraticMode) {
    const stageDesc =
      config.socraticHintLevel === 1
        ? 'Give ONLY Hint 1 (the governing formula/concept and a guiding question). Do NOT give the final numeric answer yet.'
        : config.socraticHintLevel === 2
          ? 'Give Hint 2 (show the first algebraic setup step and ask the student to complete the next step). Do NOT give the final numeric answer yet.'
          : 'Give Hint 3 (walk up to the penultimate equation so only the final simplification remains for the student).';
    directives.push(`Socratic Hint Ladder Level ${config.socraticHintLevel}/3: ${stageDesc}`);
  }

  if (config.showMarkingScheme) {
    directives.push(`Annotate each major step with ${board} Class ${grade} board marking scheme tags like [M1], [A1], [B1].`);
  }

  if (config.showAlternativeMethods) {
    directives.push('After the primary method, also show a brief "Alternative Method" using a second valid syllabus technique.');
  }

  if (config.speedTrickMode) {
    directives.push('Include a concise "30-Second MCQ / Exam Speed Trick" section at the end.');
  }

  if (config.eliStuckMode) {
    directives.push('Explain like I am stuck: break down each algebraic jump in plain everyday intuition with a small concrete number check.');
  }

  if (config.bilingualLanguage !== 'English') {
    directives.push(
      `Explain conversationally in ${config.bilingualLanguage} while keeping all mathematical terms, theorem names, and LaTeX notation in standard English.`
    );
  }

  if (config.crossThreadMemory.trim()) {
    directives.push(`Student memory note to gently keep in mind: ${config.crossThreadMemory.trim().slice(0, 220)}.`);
  }

  if (directives.length === 0) return '';
  return `[Tutor Mode Instructions: ${directives.join(' ')}]\n`;
}

/**
 * Feature #8: Automatic Common Trap Warning detector for syllabus pitfalls.
 */
export interface CommonTrapWarning {
  id: string;
  title: string;
  warning: string;
}

export function detectCommonMathTraps(text: string): CommonTrapWarning[] {
  const lower = text.toLowerCase();
  const traps: CommonTrapWarning[] = [];

  if (/x\^2|quadratic|square root|√|sqrt|discriminant/.test(lower)) {
    traps.push({
      id: 'plus-minus',
      title: 'Check both ± roots',
      warning: 'When taking a square root of an equation (e.g., x² = 9), remember both +3 and −3 unless geometry/length rejects negatives.',
    });
  }
  if (/sin|cos|tan|sec|cosec|cot|trig|angle|radian/.test(lower)) {
    traps.push({
      id: 'deg-rad',
      title: 'Degrees vs. Radians & Domain',
      warning: 'Confirm whether θ is in degrees or radians, and avoid dividing both sides by sin θ or cos θ without checking when it equals 0.',
    });
  }
  if (/log|logarithm|ln/.test(lower)) {
    traps.push({
      id: 'log-domain',
      title: 'Logarithm Domain & Base',
      warning: 'Arguments of logarithms must be strictly positive (> 0), and base b must satisfy b > 0, b ≠ 1. Reject extraneous negative roots.',
    });
  }
  if (/inequalit|<=|>=|<|>|linear programming/.test(lower)) {
    traps.push({
      id: 'ineq-flip',
      title: 'Sign Flip on Negative Multiplication',
      warning: 'Multiplying or dividing an inequality by a negative number reverses the inequality sign (< becomes >).',
    });
  }
  if (/compound interest|half-yearly|quarterly|gst|recurring deposit/.test(lower)) {
    traps.push({
      id: 'ci-compounding',
      title: 'Compounding Period Conversion',
      warning: 'For half-yearly compounding, halve the rate (R/2) and double the periods (2n); for quarterly, use R/4 and 4n.',
    });
  }
  if (/surface area|volume|cylinder|cone|sphere|frustum|mensuration/.test(lower)) {
    traps.push({
      id: 'radius-diameter',
      title: 'Radius vs. Diameter & Units',
      warning: 'Double-check whether the problem gives diameter (divide by 2 for r!) and keep cm vs m consistent before squaring or cubing.',
    });
  }
  if (/derivative|differentiate|integral|integrate|calculus/.test(lower)) {
    traps.push({
      id: 'calculus-chain-c',
      title: 'Chain Rule & Constant + C',
      warning: 'Always multiply by the inner derivative in Chain Rule, and never omit + C in indefinite integrals.',
    });
  }
  if (/matrix|matrices|determinant/.test(lower)) {
    traps.push({
      id: 'matrix-order',
      title: 'Matrix Multiplication is Non-Commutative',
      warning: 'AB ≠ BA in general; always verify inner dimensions (m×n)(n×p) match before multiplying.',
    });
  }

  return traps.slice(0, 3);
}

/**
 * Feature #6: Generates a randomized "Twin Problem" from the active topic/question.
 */
export function generateTwinProblem(question: string, grade: GradeLevel): string {
  const lower = question.toLowerCase();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  if (/rationali|surd|√|sqrt/.test(lower)) {
    const a = pick([2, 3, 4, 5]);
    const b = pick([2, 3, 5, 7]);
    return `Rationalize the denominator of 1 / (${a} + √${b}) and simplify.`;
  }
  if (/quadratic|x\^2|roots|discriminant/.test(lower)) {
    const r1 = pick([2, 3, 4, -2, -3]);
    const r2 = pick([1, 5, -4, 6]);
    const b = -(r1 + r2);
    const c = r1 * r2;
    const bStr = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
    const cStr = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
    return `Solve the quadratic equation x^2 ${bStr} ${cStr} = 0 and verify the sum and product of roots.`;
  }
  if (/compound interest|principal|amount/.test(lower)) {
    const p = pick([8000, 10000, 15000, 20000]);
    const r = pick([5, 8, 10, 12]);
    const t = pick([2, 3]);
    return `Calculate the Compound Interest on ₹${p} at ${r}% per annum for ${t} years compounded annually.`;
  }
  if (/sin|cos|tan|trig/.test(lower)) {
    const angle = pick([30, 45, 60]);
    return `Evaluate sin²(${angle}°) + 2cos²(${angle}°) + tan(${angle}°) without using a calculator.`;
  }
  if (/cylinder|cone|sphere|volume|surface area/.test(lower)) {
    const r = pick([3.5, 7, 14]);
    const h = pick([10, 12, 15, 24]);
    return `Find the curved surface area and volume of a right circular cylinder with radius ${r} cm and height ${h} cm (take π = 22/7).`;
  }
  if (/derivative|differentiate|integral/.test(lower)) {
    const a = pick([2, 3, 4, 5]);
    const b = pick([3, 5, 7]);
    return `Differentiate f(x) = ${a}x^3 - ${b}x^2 + 4x - 9 with respect to x and evaluate f'(2).`;
  }
  if (/distance|midpoint|slope|coordinate/.test(lower)) {
    const x1 = pick([-3, -2, 1, 2]);
    const y1 = pick([1, 2, 4]);
    const x2 = x1 + pick([3, 4, 6]);
    const y2 = y1 + pick([4, 3, 8]);
    return `Find the distance, midpoint, and slope of the line segment joining A(${x1}, ${y1}) and B(${x2}, ${y2}).`;
  }

  return `Create a fresh Standard ${grade} practice twin problem similar to: "${question.slice(0, 90)}" with different numbers, and let me solve it first.`;
}

/**
 * Feature #7: Safe, zero-eval numeric-probe algebraic step verifier.
 * Parses single-variable algebraic expressions (in x) or equations (LHS = RHS)
 * and checks whether consecutive lines in a student's derivation remain equivalent.
 */
function safeEvaluateSingleVarExpr(rawExpr: string, xVal: number): number | null {
  let expr = rawExpr
    .trim()
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');

  if (!expr) return null;
  // Insert implicit multiplication: 2x -> 2*x, 2(x+1) -> 2*(x+1), )x -> )*x, )( -> )*(
  expr = expr
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/([a-zA-Z)])(\d)/g, '$1*$2')
    .replace(/\)\(/g, ')*(')
    .replace(/x\(/gi, 'x*(');

  // Whitelist strictly digits, x, operators, parentheses, decimal point, and ^
  if (!/^[0-9xX+\-*/^().]+$/.test(expr)) return null;

  // Recursive descent parser (safe — zero eval / Function!)
  let pos = 0;
  const peek = () => expr[pos] || '';
  const consume = () => expr[pos++] || '';

  function parseExpression(): number {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  function parseTerm(): number {
    let val = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const rhs = parsePower();
      val = op === '*' ? val * rhs : val / rhs;
    }
    return val;
  }

  function parsePower(): number {
    let base = parseUnary();
    if (peek() === '^') {
      consume();
      const exp = parsePower();
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (peek() === '(') {
      consume();
      const val = parseExpression();
      if (peek() !== ')') return Number.NaN;
      consume();
      return val;
    }
    if (peek() === 'x' || peek() === 'X') {
      consume();
      return xVal;
    }
    let numStr = '';
    while (/[0-9.]/.test(peek())) {
      numStr += consume();
    }
    if (!numStr) return Number.NaN;
    return Number.parseFloat(numStr);
  }

  const result = parseExpression();
  if (pos !== expr.length || !Number.isFinite(result)) return null;
  return result;
}

export interface StepVerificationRow {
  lineNumber: number;
  text: string;
  status: 'base' | 'valid' | 'mismatch' | 'unparsed';
  note: string;
}

export function verifyAlgebraicSteps(rawInput: string): StepVerificationRow[] {
  const lines = rawInput
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const probes = [-2.3, -0.7, 0.5, 1.7, 3.1];
  const evaluateLineResidual = (line: string, x: number): number | null => {
    const parts = line.split('=');
    if (parts.length === 1) {
      return safeEvaluateSingleVarExpr(parts[0], x);
    }
    if (parts.length === 2) {
      const lhs = safeEvaluateSingleVarExpr(parts[0], x);
      const rhs = safeEvaluateSingleVarExpr(parts[1], x);
      if (lhs === null || rhs === null) return null;
      return lhs - rhs;
    }
    return null;
  };

  const results: StepVerificationRow[] = [];
  let prevLine: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const probeVals = probes.map((p) => evaluateLineResidual(line, p));
    const parsedOk = probeVals.every((v) => v !== null);

    if (!parsedOk) {
      results.push({
        lineNumber: i + 1,
        text: line,
        status: 'unparsed',
        note: 'Use variable x, numbers, +, -, *, /, ^, (), and optional =.',
      });
      continue;
    }

    if (prevLine === null) {
      results.push({
        lineNumber: i + 1,
        text: line,
        status: 'base',
        note: 'Starting expression / equation parsed cleanly.',
      });
      prevLine = line;
      continue;
    }

    const prevVals = probes.map((p) => evaluateLineResidual(prevLine!, p) as number);
    const currVals = probeVals as number[];
    const isEquation = line.includes('=') && prevLine.includes('=');

    let equivalent = false;
    if (!isEquation) {
      equivalent = probes.every((_, idx) => Math.abs(prevVals[idx] - currVals[idx]) < 1e-6);
    } else {
      // Equations A=B and kA=kB are equivalent if residual ratio is a constant non-zero scalar k
      const ratios: number[] = [];
      let zeroMismatch = false;
      for (let idx = 0; idx < probes.length; idx++) {
        const a = prevVals[idx];
        const b = currVals[idx];
        if (Math.abs(a) < 1e-7 && Math.abs(b) < 1e-7) continue;
        if (Math.abs(a) < 1e-7 || Math.abs(b) < 1e-7) {
          zeroMismatch = true;
          break;
        }
        ratios.push(b / a);
      }
      if (!zeroMismatch && ratios.length > 0) {
        const ref = ratios[0];
        equivalent = ratios.every((r) => Math.abs(r - ref) < 1e-5);
      } else if (!zeroMismatch && ratios.length === 0) {
        equivalent = true;
      }
    }

    results.push({
      lineNumber: i + 1,
      text: line,
      status: equivalent ? 'valid' : 'mismatch',
      note: equivalent
        ? 'Algebraically equivalent to the previous step.'
        : 'Step diverges from previous line — re-check signs, coefficients, or operations.',
    });
    prevLine = line;
  }

  return results;
}

/**
 * Feature #11: Interactive Two-Column Geometry Proof Builder templates & theorem bank.
 */
export interface ProofStepTemplate {
  statement: string;
  correctReason: string;
  options: string[];
}

export interface GeometryProofTemplate {
  id: string;
  title: string;
  grade: GradeLevel;
  given: string;
  toProve: string;
  steps: ProofStepTemplate[];
}

export const GEOMETRY_PROOF_TEMPLATES: GeometryProofTemplate[] = [
  {
    id: 'isosceles-base-angles',
    title: 'Angles Opposite Equal Sides of a Triangle are Equal',
    grade: '9',
    given: 'ΔABC with AB = AC and AD bisecting ∠BAC (D on BC).',
    toProve: '∠B = ∠C',
    steps: [
      {
        statement: 'AB = AC',
        correctReason: 'Given',
        options: ['Given', 'CPCTC', 'Reflexive Property', 'Alternate Interior Angles'],
      },
      {
        statement: '∠BAD = ∠CAD',
        correctReason: 'AD is the angle bisector of ∠BAC',
        options: ['AD is the angle bisector of ∠BAC', 'Vertically Opposite Angles', 'SAS Congruence', 'Linear Pair'],
      },
      {
        statement: 'AD = AD',
        correctReason: 'Common side (Reflexive Property)',
        options: ['Given', 'Common side (Reflexive Property)', 'Midpoint Theorem', 'CPCTC'],
      },
      {
        statement: 'ΔABD ≅ ΔACD',
        correctReason: 'SAS Congruence Criterion',
        options: ['SSS Congruence Criterion', 'SAS Congruence Criterion', 'RHS Congruence Criterion', 'AA Similarity'],
      },
      {
        statement: '∠B = ∠C',
        correctReason: 'Corresponding Parts of Congruent Triangles (CPCTC)',
        options: ['Angle Sum Property', 'Corresponding Parts of Congruent Triangles (CPCTC)', 'Exterior Angle Theorem', 'Converse of Midpoint Theorem'],
      },
    ],
  },
  {
    id: 'tangent-equal-length',
    title: 'Tangents from an External Point to a Circle are Equal',
    grade: '10',
    given: 'Circle with centre O; PA and PB are tangents from external point P.',
    toProve: 'PA = PB',
    steps: [
      {
        statement: '∠OAP = ∠OBP = 90°',
        correctReason: 'Radius is perpendicular to tangent at point of contact',
        options: ['Radius is perpendicular to tangent at point of contact', 'Alternate Segment Theorem', 'Angles in Same Segment', 'Linear Pair'],
      },
      {
        statement: 'OA = OB',
        correctReason: 'Radii of the same circle',
        options: ['Given', 'Radii of the same circle', 'Common Hypotenuse', 'CPCTC'],
      },
      {
        statement: 'OP = OP',
        correctReason: 'Common hypotenuse',
        options: ['Radii of the same circle', 'Common hypotenuse', 'Pythagoras Theorem', 'SAS Congruence'],
      },
      {
        statement: 'ΔOAP ≅ ΔOBP',
        correctReason: 'RHS Congruence Criterion',
        options: ['SAS Congruence Criterion', 'ASA Congruence Criterion', 'RHS Congruence Criterion', 'AA Similarity'],
      },
      {
        statement: 'PA = PB',
        correctReason: 'Corresponding Parts of Congruent Triangles (CPCTC)',
        options: ['Corresponding Parts of Congruent Triangles (CPCTC)', 'Chord Bisector Theorem', 'Tangent-Secant Theorem', 'Midpoint Theorem'],
      },
    ],
  },
  {
    id: 'angle-in-semicircle',
    title: 'Angle in a Semicircle is a Right Angle (90°)',
    grade: '10',
    given: 'Circle with centre O, diameter AOB, and point C on the circumference.',
    toProve: '∠ACB = 90°',
    steps: [
      {
        statement: '∠AOB = 180°',
        correctReason: 'AOB is a straight line (diameter)',
        options: ['AOB is a straight line (diameter)', 'Angle Sum Property', 'Cyclic Quadrilateral', 'Given'],
      },
      {
        statement: '∠AOB = 2 × ∠ACB',
        correctReason: 'Angle at centre is double the angle at circumference',
        options: ['Alternate Segment Theorem', 'Angle at centre is double the angle at circumference', 'Angles in Same Segment', 'CPCTC'],
      },
      {
        statement: '∠ACB = 180° / 2 = 90°',
        correctReason: 'Substitution and division by 2',
        options: ['Substitution and division by 2', 'Pythagoras Theorem', 'RHS Congruence', 'Linear Pair'],
      },
    ],
  },
];

/**
 * Feature #13: ICSE Selina Concise & CBSE NCERT Textbook Exercise Navigator.
 */
export interface TextbookExerciseEntry {
  board: CurriculumBoard;
  grade: GradeLevel;
  book: string;
  chapter: string;
  exercises: string[];
  starterPrompt: string;
}

export const TEXTBOOK_EXERCISE_INDEX: TextbookExerciseEntry[] = [
  { board: 'ICSE', grade: '8', book: 'Selina Concise Std 8', chapter: 'Ch 1 · Rational Numbers', exercises: ['Ex 1(A)', 'Ex 1(B)', 'Ex 1(C)', 'Ex 1(D)'], starterPrompt: 'Give me 3 practice sums from ICSE Selina Std 8 Ch 1 Rational Numbers Ex 1(B) with step-by-step solutions.' },
  { board: 'ICSE', grade: '8', book: 'Selina Concise Std 8', chapter: 'Ch 13 · Factorisation', exercises: ['Ex 13(A)', 'Ex 13(B)', 'Ex 13(C)', 'Ex 13(D)'], starterPrompt: 'Walk me through middle-term splitting from ICSE Selina Std 8 Ch 13 Factorisation Ex 13(D).' },
  { board: 'ICSE', grade: '9', book: 'Selina Concise Std 9', chapter: 'Ch 1 · Rational & Irrational Numbers', exercises: ['Ex 1(A)', 'Ex 1(B)', 'Ex 1(C)', 'Ex 1(D)'], starterPrompt: 'Explain conjugate rationalization from ICSE Selina Std 9 Ch 1 Ex 1(C) with an example.' },
  { board: 'ICSE', grade: '9', book: 'Selina Concise Std 9', chapter: 'Ch 4 · Expansions', exercises: ['Ex 4(A)', 'Ex 4(B)', 'Ex 4(C)', 'Ex 4(D)'], starterPrompt: 'Teach me cubic expansion identities (a ± b)³ from ICSE Selina Std 9 Ch 4 Ex 4(B).' },
  { board: 'ICSE', grade: '9', book: 'Selina Concise Std 9', chapter: 'Ch 22 · Trigonometrical Ratios', exercises: ['Ex 22(A)', 'Ex 22(B)'], starterPrompt: 'Practice ICSE Selina Std 9 Ch 22 Trigonometrical Ratios Ex 22(A) with right triangle diagram.' },
  { board: 'ICSE', grade: '10', book: 'Selina Concise Std 10', chapter: 'Ch 1 · GST & Ch 2 · Banking (RD)', exercises: ['Ex 1(A)', 'Ex 1(B)', 'Ex 2(A)'], starterPrompt: 'Solve a board-style Recurring Deposit maturity value question from ICSE Selina Std 10 Ch 2 Ex 2(A).' },
  { board: 'ICSE', grade: '10', book: 'Selina Concise Std 10', chapter: 'Ch 5 · Quadratic Equations', exercises: ['Ex 5(A)', 'Ex 5(B)', 'Ex 5(C)', 'Ex 5(D)', 'Ex 5(E)'], starterPrompt: 'Give me an equal-roots parameter k question from ICSE Selina Std 10 Ch 5 Ex 5(C).' },
  { board: 'ICSE', grade: '10', book: 'Selina Concise Std 10', chapter: 'Ch 21 · Trigonometrical Identities', exercises: ['Ex 21(A)', 'Ex 21(B)', 'Ex 21(C)'], starterPrompt: 'Prove an ICSE Std 10 board trig identity from Selina Ch 21 Ex 21(A) using M1/A1 marking steps.' },
  { board: 'CBSE', grade: '9', book: 'NCERT Class 9', chapter: 'Ch 1 · Number Systems & Ch 2 · Polynomials', exercises: ['Ex 1.5', 'Ex 2.4', 'Ex 2.5'], starterPrompt: 'Explain Remainder & Factor Theorem from CBSE NCERT Class 9 Ch 2 Ex 2.4.' },
  { board: 'CBSE', grade: '10', book: 'NCERT Class 10', chapter: 'Ch 4 · Quadratic Equations & Ch 8 · Trig', exercises: ['Ex 4.3', 'Ex 8.4', 'Ex 9.1'], starterPrompt: 'Solve an important board identity from CBSE NCERT Class 10 Ch 8 Ex 8.4.' },
  { board: 'CBSE', grade: '11', book: 'NCERT Class 11', chapter: 'Ch 5 · Complex Numbers & Ch 13 · Limits', exercises: ['Ex 5.1', 'Ex 5.2', 'Ex 13.1', 'Ex 13.2'], starterPrompt: 'Explain polar form of complex numbers and standard trigonometric limits for Class 11.' },
  { board: 'CBSE', grade: '12', book: 'NCERT Class 12', chapter: 'Ch 5 · Continuity & Ch 7 · Integrals', exercises: ['Ex 5.5', 'Ex 7.2', 'Ex 7.6', 'Ex 12.1'], starterPrompt: 'Walk me through Integration by Parts (ILATE rule) from Class 12 NCERT Ch 7 Ex 7.6.' },
];

/**
 * Feature #14: Prerequisite Gap Detector mapping senior weak chapters to foundational skills.
 */
export interface PrerequisiteBridge {
  targetTopic: string;
  missingFoundation: string;
  foundationGrade: GradeLevel;
  microRefresherPrompt: string;
}

export function detectPrerequisiteBridges(weakTopics: string[]): PrerequisiteBridge[] {
  const catalog: Array<{ match: RegExp; bridge: PrerequisiteBridge }> = [
    {
      match: /trig/i,
      bridge: {
        targetTopic: 'Trigonometrical Identities & Heights',
        missingFoundation: 'Pythagoras Theorem & Algebraic Conjugates (a+b)(a−b)',
        foundationGrade: '9',
        microRefresherPrompt: 'Give me a 2-minute Std 9 prerequisite refresher on Pythagoras ratios and conjugate multiplication before I retry Trig Identities.',
      },
    },
    {
      match: /quadratic/i,
      bridge: {
        targetTopic: 'Quadratic Equations & Nature of Roots',
        missingFoundation: 'Middle-Term Factorisation & Surd Simplification',
        foundationGrade: '8',
        microRefresherPrompt: 'Give me a quick 2-minute refresher on splitting the middle term and simplifying √(b²−4ac) surds.',
      },
    },
    {
      match: /calculus|derivative|integral|limit/i,
      bridge: {
        targetTopic: 'Calculus (Derivatives & Integrals)',
        missingFoundation: 'Laws of Indices, Slope of Secant & Trig Identities',
        foundationGrade: '10',
        microRefresherPrompt: 'Refresh laws of negative/fractional exponents and basic trig double-angle formulas needed for Calculus.',
      },
    },
    {
      match: /circle|geometry|proof/i,
      bridge: {
        targetTopic: 'Circle Theorems & Tangents',
        missingFoundation: 'Triangle Congruence (SAS/RHS) & Isosceles Triangle Angles',
        foundationGrade: '9',
        microRefresherPrompt: 'Give me a crisp 2-minute bridge review of SAS/RHS triangle congruence used inside Circle Theorem proofs.',
      },
    },
    {
      match: /gst|banking|compound|commercial|shares/i,
      bridge: {
        targetTopic: 'Commercial Mathematics (GST, RD, CI)',
        missingFoundation: 'Percentage Change, Ratio & Unitary Method',
        foundationGrade: '8',
        microRefresherPrompt: 'Refresh percentage increase/decrease and compound rate conversions in 2 minutes.',
      },
    },
    {
      match: /matri|coordinate|vector/i,
      bridge: {
        targetTopic: 'Coordinate Geometry & Matrices',
        missingFoundation: 'Linear Equations in Two Variables & Signed Integer Arithmetic',
        foundationGrade: '8',
        microRefresherPrompt: 'Give me a quick refresher on simultaneous linear equations and coordinate quadrant signs.',
      },
    },
  ];

  const found: PrerequisiteBridge[] = [];
  for (const topic of weakTopics) {
    for (const entry of catalog) {
      if (entry.match.test(topic) && !found.some((f) => f.targetTopic === entry.bridge.targetTopic)) {
        found.push(entry.bridge);
      }
    }
  }
  if (found.length === 0) {
    return [catalog[0].bridge, catalog[1].bridge];
  }
  return found.slice(0, 4);
}
