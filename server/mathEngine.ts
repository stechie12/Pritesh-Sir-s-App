import { create, all } from 'mathjs';
import type {
  CurriculumBoard,
  GradeLevel,
  StudentIntent,
  TutorResponsePayload,
} from './types.ts';

const math = create(all);

// Sandboxed mathjs evaluation — disable dangerous overrides & giant allocation vectors
math.import(
  {
    import: function () {
      throw new Error('Function import is disabled in sandboxed mathjs');
    },
    createUnit: function () {
      throw new Error('Function createUnit is disabled in sandboxed mathjs');
    },
    range: function () {
      throw new Error('Function range is disabled in sandboxed mathjs');
    },
    ones: function () {
      throw new Error('Function ones is disabled in sandboxed mathjs');
    },
    zeros: function () {
      throw new Error('Function zeros is disabled in sandboxed mathjs');
    },
    identity: function () {
      throw new Error('Function identity is disabled in sandboxed mathjs');
    },
  },
  { override: true }
);

export const sandboxedMath = math;

/**
 * Rejects pathological math expressions (deeply nested parentheses or exponent towers)
 * before passing them to mathjs to prevent CPU or memory exhaustion.
 */
export function assertSafeMathExpression(expr: string): void {
  if (!expr || expr.length > 200) {
    throw new Error('Expression exceeds safe length limit.');
  }
  let depth = 0;
  let maxDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(' || ch === '[') {
      depth += 1;
      if (depth > maxDepth) maxDepth = depth;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
      if (depth < 0) throw new Error('Unbalanced brackets in expression.');
    }
  }
  if (maxDepth > 16) {
    throw new Error('Expression nesting depth exceeds safe limit.');
  }
  if (/\^\s*\d+\s*\^\s*\d+/.test(expr)) {
    throw new Error('Chained exponent towers are disabled for safety.');
  }
  const bigExp = expr.match(/\^\s*(\d+)/);
  if (bigExp && Number(bigExp[1]) > 50) {
    throw new Error('Exponent magnitude exceeds safe evaluation limit.');
  }
}

/**
 * Evaluates a math expression safely and optionally checks equivalence against an expected expression.
 */
export function verifyMathExpression(
  expression: string,
  expected?: string
): {
  valid: boolean;
  normalized: string;
  value?: string;
  equivalent?: boolean;
  error?: string;
} {
  try {
    const normalized = normalizeTrigExpressionForMathJs(expression.trim());
    assertSafeMathExpression(normalized);
    const val = math.evaluate(normalized);
    const formatted =
      typeof val === 'number' && Number.isFinite(val)
        ? String(Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6)))
        : math.format(val, { precision: 6 });

    if (expected !== undefined && expected.trim()) {
      const normExpected = normalizeTrigExpressionForMathJs(expected.trim());
      assertSafeMathExpression(normExpected);
      const expVal = math.evaluate(normExpected);
      let equivalent = false;
      if (typeof val === 'number' && typeof expVal === 'number') {
        equivalent = Math.abs(val - expVal) < 1e-6;
      } else {
        equivalent = math.format(val, { precision: 6 }) === math.format(expVal, { precision: 6 });
      }
      return { valid: true, normalized, value: formatted, equivalent };
    }

    return { valid: true, normalized, value: formatted };
  } catch (err) {
    return {
      valid: false,
      normalized: expression.trim(),
      error: err instanceof Error ? err.message : 'Unable to evaluate expression.',
    };
  }
}

/**
 * Normalizes international locale numbers, Unicode operators, and degree trigonometric expressions
 * into valid mathjs syntax.
 */
export function normalizeTrigExpressionForMathJs(rawExpr: string): string {
  return rawExpr
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\bcosec\b/gi, 'csc')
    .replace(
      /\b(sin|cos|tan|cot|sec|csc)\s*\^\s*(\d+)\s*\(?\s*(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?\s*\)?/gi,
      '($1($3 deg)^$2)'
    )
    .replace(
      /\b(sin|cos|tan|cot|sec|csc)\s*\(\s*(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?\s*\)/gi,
      '$1($2 deg)'
    )
    .replace(
      /\b(sin|cos|tan|cot|sec|csc)\s+(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?\b/gi,
      '$1($2 deg)'
    );
}

/**
 * Detects curriculum grade, board, and whether a natural language message should summon a tool tab.
 */
export function analyzeStudentIntent(
  question: string,
  currentGrade: GradeLevel,
  currentBoard: CurriculumBoard
): StudentIntent {
  const q = question.toLowerCase();

  let detectedGrade: GradeLevel = currentGrade;
  const gradeMatch =
    q.match(/\b(?:grade|class|std|standard)\s*(8|9|10|11|12)\b/i) ||
    q.match(/\b(8|9|10|11|12)(?:th|st|nd|rd)\s*(?:grade|class|std|standard)?\b/i);
  if (gradeMatch) {
    detectedGrade = gradeMatch[1] as GradeLevel;
  }

  let detectedBoard: CurriculumBoard = currentBoard;
  if (/\b(?:cbse|ncert)\b/i.test(q)) {
    detectedBoard = 'CBSE';
  } else if (/\b(?:icse|selina)\b/i.test(q)) {
    detectedBoard = 'ICSE';
  }

  let summonTool: StudentIntent['summonTool'] = null;
  let labMode: StudentIntent['labMode'];

  if (
    /\b(?:3d|spatial\s+lab|3d\s+lab|3d\s+model|3d\s+view|3d\s+cone|3d\s+cylinder|3d\s+sphere|sightline\s+3d)\b/i.test(
      q
    )
  ) {
    summonTool = 'lab';
    if (/\b(?:quadratic|parabola|x\^2|x²|roots|discriminant)\b/i.test(q)) {
      labMode = 'quadratic';
    } else if (/\b(?:lighthouse|sightline|depression|elevation|trig|distance)\b/i.test(q)) {
      labMode = 'trigonometry';
    } else {
      labMode = 'mensuration3d';
    }
  } else if (/\b(?:planner|schedule|timetable|routine|study plan|deadline|reminder)\b/i.test(q)) {
    summonTool = 'planner';
  } else if (/\b(?:practice|quiz|mock test|mcq|test me|give me a sum|problem bank)\b/i.test(q)) {
    summonTool = 'practice';
  } else if (/\b(?:leaderboard|badge|xp|progress|report|parent|rank|league)\b/i.test(q)) {
    summonTool = 'dashboard';
  }

  return { detectedGrade, detectedBoard, summonTool, labMode };
}

/**
 * Pre-computes embedded trigonometric sub-expressions via sandboxed mathjs to ground LLM answers.
 */
export function buildMathJsPipelineContext(question: string): {
  mathJsFact: string | null;
  traceLine: string | null;
} {
  try {
    const normalized = normalizeTrigExpressionForMathJs(question);
    const trigMatch = normalized.match(
      /\b(?:sin|cos|tan|cot|sec|csc)\([0-9.\s+-]+deg\)(?:\s*[+\-*/^]\s*(?:sin|cos|tan|cot|sec|csc)\([0-9.\s+-]+deg\)|\s*\^\s*\d+)*/i
    );
    if (trigMatch) {
      const val = math.evaluate(trigMatch[0]);
      if (typeof val === 'number' && Number.isFinite(val)) {
        const cleanVal = Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6));
        return {
          mathJsFact: `Verified mathjs computation: ${trigMatch[0]} = ${cleanVal}`,
          traceLine: `mathjs Engine verified: ${trigMatch[0]} = ${cleanVal}`,
        };
      }
    }
  } catch {
    // Ignore non-math prompts
  }
  return { mathJsFact: null, traceLine: null };
}

/**
 * Slices a deterministic chat response cleanly past the already-rendered partial prefix on resume.
 */
export function sliceResumedReply(fullText: string, partialContent: string): string {
  if (!partialContent.trim()) return fullText;
  const anchor = partialContent.slice(-48);
  const anchorIdx = anchor ? fullText.indexOf(anchor) : -1;
  if (anchorIdx !== -1) {
    const remainder = fullText.slice(anchorIdx + anchor.length).trimStart();
    if (remainder) {
      return remainder;
    }
  }
  return fullText;
}

/**
 * Comprehensive deterministic symbolic & numerical math engine.
 * Returns `chatReply: '__NEEDS_LIVE_LLM__'` for open-ended questions so they route to Gemini / AI.
 */
export function buildSmartTutorResponse(
  question: string,
  grade: string,
  board: string,
  _topic: string,
  history: Array<{ role?: string; text?: string }> = []
): TutorResponsePayload {
  const qTrim = question.trim();
  const qLower = qTrim.toLowerCase();
  const cleanWords = qLower.replace(/[^a-z0-9\s]/g, '').trim();

  // 1. Percentage calculations, e.g. "25% of 480"
  const pctMatch = qTrim.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
  if (pctMatch) {
    const p = Number(pctMatch[1]);
    const val = Number(pctMatch[2]);
    const ans = Number(((p / 100) * val).toFixed(4));
    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — Percentage Evaluation`,
      prerequisiteRecap: `To find x% of a quantity N, convert the percentage to a fraction (x / 100) and multiply by N.`,
      steps: [
        `Step 1 (Convert Percentage to Fraction): ${p}% = ${p} / 100 = ${p / 100}.`,
        `Step 2 (Multiply by Base Quantity): (${p} / 100) × ${val} = ${ans}.`,
      ],
      finalAnswer: `${p}% of ${val} = ${ans}`,
      examTip: 'Quick Mental Check: 10% is moving the decimal one place left; 5% is half of 10%.',
    };
  }

  // 2. Pure arithmetic / BODMAS expression evaluated strictly via sandboxed mathjs (zero Function/eval)
  const sanitizedBodmas = qTrim
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^');
  if (
    /^[0-9+\-*/^().\s]+$/.test(sanitizedBodmas) &&
    /[0-9]/.test(sanitizedBodmas) &&
    /[+\-*/^]/.test(sanitizedBodmas) &&
    sanitizedBodmas.length <= 120
  ) {
    try {
      const result = math.evaluate(sanitizedBodmas);
      if (typeof result === 'number' && Number.isFinite(result)) {
        const cleanResult = Math.abs(result) < 1e-12 ? 0 : Number(result.toFixed(6));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — BODMAS Numerical Evaluation`,
          prerequisiteRecap:
            'Apply BODMAS (Brackets, Orders/Exponents, Division, Multiplication, Addition, Subtraction) from left to right.',
          steps: [
            `Step 1 (Given Expression): ${qTrim}`,
            `Step 2 (Apply Order of Operations): Evaluate brackets and powers first, then multiplication/division, and finally addition/subtraction.`,
            `Step 3 (Exact Value): ${qTrim} = ${cleanResult}.`,
          ],
          finalAnswer: `${qTrim} = ${cleanResult}`,
          examTip: 'Always double-check negative signs and bracket precedence before writing the final value.',
        };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Quadratic Equation Solver: ax^2 + bx + c = 0
  const normalizedQ = qTrim.replace(/−/g, '-').replace(/²/g, '^2');
  const quadMatch = normalizedQ.match(
    /([+-]?\s*\d*)\s*x\^2\s*([+-]\s*\d*)\s*x\s*([+-]\s*\d+)\s*=\s*0/i
  );
  if (quadMatch) {
    const aRaw = quadMatch[1].replace(/\s+/g, '');
    const bRaw = quadMatch[2].replace(/\s+/g, '');
    const cRaw = quadMatch[3].replace(/\s+/g, '');
    const eqDisplay = quadMatch[0].trim();
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
    const b = bRaw === '+' ? 1 : bRaw === '-' ? -1 : Number(bRaw);
    const c = Number(cRaw);
    if (a !== 0 && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      const disc = b * b - 4 * a * c;
      const nature =
        disc > 0
          ? 'Real and Distinct (Δ > 0)'
          : disc === 0
          ? 'Real and Equal (Δ = 0)'
          : 'Complex / Imaginary (Δ < 0)';
      let rootsStr = '';
      if (disc >= 0) {
        const r1 = ((-b + Math.sqrt(disc)) / (2 * a)).toFixed(3).replace(/\.?0+$/, '');
        const r2 = ((-b - Math.sqrt(disc)) / (2 * a)).toFixed(3).replace(/\.?0+$/, '');
        rootsStr = r1 === r2 ? `x = ${r1}` : `x = ${r1} or x = ${r2}`;
      } else {
        const realPart = (-b / (2 * a)).toFixed(2);
        const imagPart = (Math.sqrt(-disc) / (2 * a)).toFixed(2);
        rootsStr = `x = ${realPart} ± ${imagPart}i`;
      }
      return {
        responseType: 'math',
        conceptTitle: `Selina Concise Grade ${grade} (${board}) — Quadratic Solver (${eqDisplay})`,
        prerequisiteRecap: `Comparing ${eqDisplay} with standard quadratic form ax² + bx + c = 0 gives a = ${a}, b = ${b}, c = ${c}.`,
        steps: [
          `Step 1 (Coefficients): Identify a = ${a}, b = ${b}, and c = ${c}.`,
          `Step 2 (Discriminant Δ = b² − 4ac): Δ = (${b})² − 4(${a})(${c}) = ${b * b} − (${4 * a * c}) = ${disc}. Nature of roots: ${nature}.`,
          `Step 3 (Quadratic Formula): x = (−(${b}) ± √${disc}) / (2 × ${a}) ⇒ ${rootsStr}.`,
        ],
        finalAnswer: `${rootsStr} (Discriminant Δ = ${disc}, Sum of roots = ${-b}/${a}, Product = ${c}/${a})`,
        examTip:
          'Verify your roots in 3 seconds using Vieta’s formulas: α + β = −b/a and αβ = c/a.',
      };
    }
  }

  // 4. Linear Equation in One Variable Solver: e.g. "3x + 7 = 22"
  const linearMatch = normalizedQ.match(
    /(?:^|\s)([+-]?\s*\d*)\s*x\s*([+-]\s*\d+)\s*=\s*([+-]?\s*\d+)(?:$|\s)/i
  );
  if (linearMatch && !normalizedQ.includes('x^2') && !normalizedQ.includes('y')) {
    const aRaw = linearMatch[1].replace(/\s+/g, '');
    const b = Number(linearMatch[2].replace(/\s+/g, ''));
    const rhs = Number(linearMatch[3].replace(/\s+/g, ''));
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
    if (a !== 0 && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(rhs)) {
      const isolatedRhs = rhs - b;
      const xVal = Number((isolatedRhs / a).toFixed(4));
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Linear Equation Solver (${linearMatch[0].trim()})`,
        prerequisiteRecap:
          'To solve ax + b = c, transpose the constant term b to the RHS (reversing its sign) and divide both sides by the coefficient a.',
        steps: [
          `Step 1 (Transpose Constant Term): ${a}x = ${rhs} ${b >= 0 ? `− ${b}` : `+ ${Math.abs(b)}`} ⇒ ${a}x = ${isolatedRhs}.`,
          `Step 2 (Divide by Coefficient of x): x = ${isolatedRhs} / ${a} = ${xVal}.`,
          `Step 3 (LHS = RHS Verification): Substitute x = ${xVal} back into LHS: ${a}(${xVal}) ${b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`} = ${rhs}. Verified!`,
        ],
        finalAnswer: `x = ${xVal}`,
        examTip: 'Always flip the sign (+ to − or − to +) when transposing a term across the "=" sign.',
      };
    }
  }

  // 5. Simultaneous Linear Equations in 2 Variables
  const simMatch = normalizedQ.match(
    /([+-]?\s*\d*)\s*x\s*([+-]\s*\d*)\s*y\s*=\s*([+-]?\s*\d+).*?([+-]?\s*\d*)\s*x\s*([+-]\s*\d*)\s*y\s*=\s*([+-]?\s*\d+)/i
  );
  if (simMatch) {
    const parseCoeff = (s: string) => {
      const clean = s.replace(/\s+/g, '');
      return clean === '' || clean === '+' ? 1 : clean === '-' ? -1 : Number(clean);
    };
    const a1 = parseCoeff(simMatch[1]);
    const b1 = parseCoeff(simMatch[2]);
    const c1 = Number(simMatch[3].replace(/\s+/g, ''));
    const a2 = parseCoeff(simMatch[4]);
    const b2 = parseCoeff(simMatch[5]);
    const c2 = Number(simMatch[6].replace(/\s+/g, ''));
    const det = a1 * b2 - a2 * b1;
    if (det !== 0) {
      const xVal = Number(((c1 * b2 - c2 * b1) / det).toFixed(4));
      const yVal = Number(((a1 * c2 - a2 * c1) / det).toFixed(4));
      return {
        responseType: 'math',
        conceptTitle: `Selina Concise Grade ${grade} (${board}) — Simultaneous Linear Equations`,
        prerequisiteRecap:
          'Solve two linear equations a₁x + b₁y = c₁ and a₂x + b₂y = c₂ by equating coefficients (Elimination) or Cramer’s determinant rule.',
        steps: [
          `Step 1 (System Setup): Equation (1): ${a1}x + (${b1})y = ${c1} · Equation (2): ${a2}x + (${b2})y = ${c2}.`,
          `Step 2 (Eliminate y): Multiply Eq (1) by ${b2} and Eq (2) by ${b1}, then subtract to get (${det})x = ${c1 * b2 - c2 * b1} ⇒ x = ${xVal}.`,
          `Step 3 (Find y): Substitute x = ${xVal} into Equation (1) to obtain y = ${yVal}.`,
        ],
        finalAnswer: `x = ${xVal}, y = ${yVal}`,
        examTip: 'Always substitute both (x, y) into the SECOND equation to verify your solution in 5 seconds.',
      };
    }
  }

  // 6. Session memory & conceptual curiosity questions
  let rememberedName: string | null = null;
  for (const h of [...history, { role: 'user', text: qTrim }]) {
    if (h.role === 'user' && h.text) {
      const m = h.text.match(/\b(?:my\s+name\s+is|call\s+me|i\s+am\s+called)\s+([a-zA-Z]{2,20})\b/i);
      if (m) rememberedName = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }
  }
  const lastUserTurn = [...history].reverse().find((h) => h.role === 'user' && h.text)?.text || '';

  if (/\b(?:my\s+name\s+is|call\s+me|i\s+am\s+called)\s+([a-zA-Z]{2,20})\b/i.test(qTrim)) {
    return {
      responseType: 'chat',
      chatReply: `Awesome to meet you, **${rememberedName}**! I've locked your name into our session memory. We're currently set to **Standard ${grade} (${board})** — tell me how your maths prep is going or throw any equation or question my way!`,
      suggestedPrompts: [
        'What is my name?',
        'Solve x^2 - 5x + 6 = 0 step by step',
        'Why is 0! equal to 1?',
      ],
      conceptTitle: `Pritesh Sir's Maths App!`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (/\b(?:what.*my\s+name|who\s+am\s+i|do\s+you\s+remember\s+my\s+name)\b/i.test(qLower)) {
    return {
      responseType: 'chat',
      chatReply: rememberedName
        ? `Of course I remember! You're **${rememberedName}**, currently working on **Standard ${grade} (${board})** mathematics with me. Ready for our next problem?`
        : `You haven't told me your name yet in this chat! Tell me *"My name is ..."* and I'll remember it across our entire session.`,
      suggestedPrompts: [
        'Solve 3x + 7 = 22',
        'Explain why we cannot divide by zero',
        'Give me a challenging trigonometry identity',
      ],
      conceptTitle: `Pritesh Sir's Maths App!`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (/0\s*!\s*=\s*1|zero\s+factorial|why\s+is\s+0\s*!/i.test(qLower)) {
    return {
      responseType: 'chat',
      chatReply: `Great question! Here are **two intuitive reasons why $0! = 1$**:\n\n1. **The Pattern Rule**: Notice that $4! = 24$, $3! = 24 / 4 = 6$, $2! = 6 / 3 = 2$, and $1! = 2 / 2 = 1$. Continuing that exact pattern one more step: **$0! = 1! / 1 = 1 / 1 = 1$**!\n2. **Combinatorics Meaning**: $n!$ is the number of ways to arrange $n$ objects. How many ways can you arrange **zero** objects on a table? Exactly **1 way** — leave the table empty!`,
      suggestedPrompts: [
        'Calculate 6!',
        'Why can we not divide by zero?',
        'Solve x^2 - 5x + 6 = 0',
      ],
      conceptTitle: `Why 0! = 1`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (/divide\s+by\s+(?:0|zero)|division\s+by\s+(?:0|zero)|\/0\b/i.test(qLower)) {
    return {
      responseType: 'chat',
      chatReply: `Why is **division by zero ($a / 0$) undefined**?\n\n1. **Inverse of Multiplication**: Saying $10 / 2 = 5$ means $5 \\times 2 = 10$. If $10 / 0 = x$, then $x \\times 0$ would have to equal $10$. But **anything times $0$ is $0$**, so no such number $x$ exists!\n2. **Approaching Zero Limit**: As the denominator gets tiny ($10 / 0.1 = 100$, $10 / 0.0001 = 100{,}000$), the value explodes toward $+\\infty$ from the right and $-\\infty$ from the left — they never meet!`,
      suggestedPrompts: [
        'Why is 0! equal to 1?',
        'Differentiate 3x^3 - 5x + 9',
        'Solve 2x + 3y = 13, 5x - 2y = 4',
      ],
      conceptTitle: `Division by Zero`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (
    /\b(?:explain\s+step\s*[123]|explain\s+simpler|eli5|why\s+did\s+we|what\s+did\s+i\s+just\s+ask|previous\s+question)\b/i.test(
      qLower
    )
  ) {
    return {
      responseType: 'chat',
      chatReply: lastUserTurn
        ? `In our last turn you asked: **"${lastUserTurn}"**.\n\nTo put **Step 2** in the simplest possible terms: after we write down the formula in Step 1, Step 2 is where we plug the given numbers into the formula and isolate the unknown variable on the left-hand side (moving constants to the right-hand side by flipping their $+$ / $-$ signs).\n\nWould you like me to give you a similar practice sum so you can try that exact step yourself?`
        : `Ask any math equation first (like \`3x + 7 = 22\` or \`x^2 - 5x + 6 = 0\`), and I can break down any step in super simple language!`,
      suggestedPrompts: [
        'Solve 4x - 11 = 25',
        'Solve x^2 - 7x + 10 = 0',
        'Give me a practice sum',
      ],
      conceptTitle: `Step-by-Step Breakdown`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  // 7. Dynamic Factorial
  const factMatch = qTrim.match(/\b(?:factorial\s+of\s+(\d+)|(\d+)\s*!)/i);
  if (factMatch) {
    const n = Number(factMatch[1] || factMatch[2]);
    if (n >= 0 && n <= 20) {
      let val = 1;
      const factors: number[] = [];
      for (let i = n; i >= 1; i--) {
        val *= i;
        factors.push(i);
      }
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Permutations & Factorial Evaluation (${n}!)`,
        prerequisiteRecap:
          'For any non-negative integer n, n! = n × (n − 1) × (n − 2) × ... × 1, and by definition 0! = 1.',
        steps: [
          `Step 1 (Expand Factorial Product): ${n}! = ${n === 0 ? '1 (by definition)' : factors.join(' × ')}.`,
          `Step 2 (Multiply Successively): ${n}! = ${val.toLocaleString('en-IN')}.`,
        ],
        finalAnswer: `${n}! = ${val.toLocaleString('en-IN')}`,
        examTip:
          'Memorize factorials up to 7! (5! = 120, 6! = 720, 7! = 5040) to save 45 seconds in Permutations & Combinations!',
      };
    }
  }

  // 8. GCD / HCF and LCM
  const gcdLcmMatch = qLower.match(/\b(gcd|hcf|lcm)\b[^0-9]*(\d+)[^0-9]+(\d+)/i);
  if (gcdLcmMatch) {
    const mode = gcdLcmMatch[1].toUpperCase();
    const a = Number(gcdLcmMatch[2]);
    const b = Number(gcdLcmMatch[3]);
    if (a > 0 && b > 0) {
      const gcdFn = (x: number, y: number): number => (y === 0 ? x : gcdFn(y, x % y));
      const hcf = gcdFn(a, b);
      const lcm = (a * b) / hcf;
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — HCF (GCD) & LCM of ${a} and ${b}`,
        prerequisiteRecap:
          'For any two positive integers a and b, Product of Numbers (a × b) = HCF(a, b) × LCM(a, b).',
        steps: [
          `Step 1 (Euclidean Division for HCF): Divide larger by smaller until remainder is 0 ⇒ HCF(${a}, ${b}) = ${hcf}.`,
          `Step 2 (Compute LCM via Product Identity): LCM(${a}, ${b}) = (${a} × ${b}) / ${hcf} = ${a * b} / ${hcf} = ${lcm}.`,
          `Step 3 (Verify Identity): HCF × LCM = ${hcf} × ${lcm} = ${hcf * lcm} = ${a} × ${b}.`,
        ],
        finalAnswer:
          mode === 'LCM'
            ? `LCM(${a}, ${b}) = ${lcm} (HCF = ${hcf})`
            : `HCF(${a}, ${b}) = ${hcf} (LCM = ${lcm})`,
        examTip: 'Always verify your HCF and LCM using HCF × LCM = Product of the two numbers.',
      };
    }
  }

  // 9. Mean, Median & Range of raw numbers
  if (/\b(mean|median|average|range|sd|standard deviation)\b/i.test(qLower)) {
    const nums = (qTrim.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length >= 3) {
      const sorted = [...nums].sort((a, b) => a - b);
      const sum = nums.reduce((acc, v) => acc + v, 0);
      const mean = Number((sum / nums.length).toFixed(4));
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 1
          ? sorted[mid]
          : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));
      const range = sorted[sorted.length - 1] - sorted[0];
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Statistics (Mean, Median & Range of Raw Data)`,
        prerequisiteRecap:
          'Arithmetic Mean x̄ = (Σxᵢ) / n. For Median, arrange observations in ascending order and locate the middle value.',
        steps: [
          `Step 1 (Arrange Data in Ascending Order, n = ${nums.length}): ${sorted.join(', ')}.`,
          `Step 2 (Calculate Arithmetic Mean x̄): x̄ = (${nums.join(' + ')}) / ${nums.length} = ${sum} / ${nums.length} = ${mean}.`,
          `Step 3 (Calculate Median & Range): Median = ${median}, Range = Max − Min = ${sorted[sorted.length - 1]} − ${sorted[0]} = ${range}.`,
        ],
        finalAnswer: `Mean (x̄) = ${mean} · Median = ${median} · Range = ${range}`,
        examTip:
          'Never forget to sort raw observations in ascending order before picking the Median — unsorted median gets 0 marks!',
      };
    }
  }

  // 10. 3D Mensuration Calculator (Cone, Cylinder, Sphere, Circle)
  if (/\b(cone|cylinder|sphere|hemisphere|circle)\b/i.test(qLower)) {
    const rMatch = qLower.match(/\b(?:r|radius)\s*(?:=|:|is|of)?\s*(\d+(?:\.\d+)?)/i);
    const hMatch = qLower.match(/\b(?:h|height)\s*(?:=|:|is|of)?\s*(\d+(?:\.\d+)?)/i);
    if (rMatch) {
      const r = Number(rMatch[1]);
      const h = hMatch ? Number(hMatch[1]) : 14;
      const pi = 22 / 7;
      if (qLower.includes('cone')) {
        const l = Number(Math.sqrt(r * r + h * h).toFixed(2));
        const csa = Number((pi * r * l).toFixed(2));
        const tsa = Number((pi * r * (l + r)).toFixed(2));
        const vol = Number(((1 / 3) * pi * r * r * h).toFixed(2));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Right Circular Cone (r = ${r}, h = ${h})`,
          prerequisiteRecap:
            'For a right circular cone, slant height l = √(r² + h²), CSA = πrl, TSA = πr(l + r), and Volume = (1/3)πr²h.',
          steps: [
            `Step 1 (Compute Slant Height l): l = √(${r}² + ${h}²) = √(${r * r} + ${h * h}) = √${r * r + h * h} = ${l} units.`,
            `Step 2 (Curved & Total Surface Area): CSA = (22/7) × ${r} × ${l} = ${csa} sq. units; TSA = (22/7) × ${r} × (${l} + ${r}) = ${tsa} sq. units.`,
            `Step 3 (Volume V): V = (1/3) × (22/7) × ${r}² × ${h} = ${vol} cubic units.`,
          ],
          finalAnswer: `l = ${l} · CSA = ${csa} · TSA = ${tsa} · Volume = ${vol}`,
          examTip: 'Use π = 22/7 whenever r or l is a multiple of 7 so the denominator 7 cancels cleanly.',
        };
      }
      if (qLower.includes('cylinder')) {
        const csa = Number((2 * pi * r * h).toFixed(2));
        const tsa = Number((2 * pi * r * (h + r)).toFixed(2));
        const vol = Number((pi * r * r * h).toFixed(2));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Right Circular Cylinder (r = ${r}, h = ${h})`,
          prerequisiteRecap:
            'For a cylinder of radius r and height h: CSA = 2πrh, TSA = 2πr(h + r), and Volume = πr²h.',
          steps: [
            `Step 1 (Curved Surface Area): CSA = 2 × (22/7) × ${r} × ${h} = ${csa} sq. units.`,
            `Step 2 (Total Surface Area): TSA = 2 × (22/7) × ${r} × (${h} + ${r}) = ${tsa} sq. units.`,
            `Step 3 (Volume V): V = (22/7) × ${r}² × ${h} = ${vol} cubic units.`,
          ],
          finalAnswer: `CSA = ${csa} · TSA = ${tsa} · Volume = ${vol}`,
          examTip: 'Always state sq. cm for area and cu. cm (cm³) for volume.',
        };
      }
      if (qLower.includes('sphere')) {
        const sa = Number((4 * pi * r * r).toFixed(2));
        const vol = Number(((4 / 3) * pi * r * r * r).toFixed(2));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Sphere Mensuration (r = ${r})`,
          prerequisiteRecap:
            'For a sphere of radius r: Surface Area = 4πr² and Volume = (4/3)πr³.',
          steps: [
            `Step 1 (Surface Area): A = 4 × (22/7) × ${r}² = ${sa} sq. units.`,
            `Step 2 (Volume V): V = (4/3) × (22/7) × ${r}³ = ${vol} cubic units.`,
          ],
          finalAnswer: `Surface Area = ${sa} · Volume = ${vol}`,
          examTip:
            'When a sphere is melted and recast into cones, equate Volumes (4/3 πR³ = n × 1/3 πr²h) and cancel π on both sides first!',
        };
      }
      if (qLower.includes('circle')) {
        const area = Number((pi * r * r).toFixed(2));
        const circ = Number((2 * pi * r).toFixed(2));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Circle Area & Circumference (r = ${r})`,
          prerequisiteRecap: 'For a circle of radius r: Circumference C = 2πr and Area A = πr².',
          steps: [
            `Step 1 (Circumference): C = 2 × (22/7) × ${r} = ${circ} units.`,
            `Step 2 (Area): A = (22/7) × ${r}² = ${area} sq. units.`,
          ],
          finalAnswer: `Circumference = ${circ} · Area = ${area}`,
          examTip:
            'Check whether the question gives diameter d or radius r; if diameter is given, halve it (r = d/2) before applying πr²!',
        };
      }
    }
  }

  // 11. Exact Trigonometric Angle Evaluator
  const trigAngleMatch = qTrim.match(
    /\b(sin|cos|tan|cot|sec|cosec|csc|sine|cosine|tangent|cotangent|secant|cosecant)\s*\(?\s*(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?\s*\)?/i
  );
  if (trigAngleMatch) {
    const rawFn = trigAngleMatch[1].toLowerCase();
    const angleDeg = Number(trigAngleMatch[2]);
    const fnMap: Record<string, 'sin' | 'cos' | 'tan' | 'cot' | 'sec' | 'cosec'> = {
      sin: 'sin',
      sine: 'sin',
      cos: 'cos',
      cosine: 'cos',
      tan: 'tan',
      tangent: 'tan',
      cot: 'cot',
      cotangent: 'cot',
      sec: 'sec',
      secant: 'sec',
      cosec: 'cosec',
      csc: 'cosec',
      cosecant: 'cosec',
    };
    const fn = fnMap[rawFn] || 'sin';
    const fullNames: Record<string, string> = {
      sin: 'Sine (sin)',
      cos: 'Cosine (cos)',
      tan: 'Tangent (tan)',
      cot: 'Cotangent (cot)',
      sec: 'Secant (sec)',
      cosec: 'Cosecant (cosec)',
    };

    const normDeg = ((angleDeg % 360) + 360) % 360;
    const rad = (angleDeg * Math.PI) / 180;
    const sinVal = Math.abs(Math.sin(rad)) < 1e-12 ? 0 : Number(Math.sin(rad).toFixed(6));
    const cosVal = Math.abs(Math.cos(rad)) < 1e-12 ? 0 : Number(Math.cos(rad).toFixed(6));

    const exactTable: Record<
      number,
      { sin: string; cos: string; tan: string; cot: string; sec: string; cosec: string }
    > = {
      0: { sin: '0', cos: '1', tan: '0', cot: 'Undefined (∞)', sec: '1', cosec: 'Undefined (∞)' },
      30: {
        sin: '1/2 (0.5)',
        cos: '√3/2 (≈ 0.866)',
        tan: '1/√3 (≈ 0.577)',
        cot: '√3 (≈ 1.732)',
        sec: '2/√3 (≈ 1.155)',
        cosec: '2',
      },
      45: {
        sin: '1/√2 (≈ 0.707)',
        cos: '1/√2 (≈ 0.707)',
        tan: '1',
        cot: '1',
        sec: '√2 (≈ 1.414)',
        cosec: '√2 (≈ 1.414)',
      },
      60: {
        sin: '√3/2 (≈ 0.866)',
        cos: '1/2 (0.5)',
        tan: '√3 (≈ 1.732)',
        cot: '1/√3 (≈ 0.577)',
        sec: '2',
        cosec: '2/√3 (≈ 1.155)',
      },
      90: { sin: '1', cos: '0', tan: 'Undefined (∞)', cot: '0', sec: 'Undefined (∞)', cosec: '1' },
      180: { sin: '0', cos: '-1', tan: '0', cot: 'Undefined (∞)', sec: '-1', cosec: 'Undefined (∞)' },
      270: { sin: '-1', cos: '0', tan: 'Undefined (∞)', cot: '0', sec: 'Undefined (∞)', cosec: '-1' },
      360: { sin: '0', cos: '1', tan: '0', cot: 'Undefined (∞)', sec: '1', cosec: 'Undefined (∞)' },
    };

    const stdEntry = exactTable[angleDeg] || exactTable[normDeg];
    let exactResult = '';
    let step2Text = '';

    if (stdEntry) {
      exactResult = stdEntry[fn];
      if (fn === 'cot') {
        step2Text = `Step 2 (Quotient Identity cot θ = cos θ / sin θ): Since cos(${angleDeg}°) = ${stdEntry.cos} and sin(${angleDeg}°) = ${stdEntry.sin}, we get cot(${angleDeg}°) = cos(${angleDeg}°) / sin(${angleDeg}°) = ${stdEntry.cos} / ${stdEntry.sin} = ${exactResult}.`;
      } else if (fn === 'tan') {
        step2Text = `Step 2 (Quotient Identity tan θ = sin θ / cos θ): Since sin(${angleDeg}°) = ${stdEntry.sin} and cos(${angleDeg}°) = ${stdEntry.cos}, we get tan(${angleDeg}°) = sin(${angleDeg}°) / cos(${angleDeg}°) = ${stdEntry.sin} / ${stdEntry.cos} = ${exactResult}.`;
      } else if (fn === 'sec') {
        step2Text = `Step 2 (Reciprocal Identity sec θ = 1 / cos θ): Since cos(${angleDeg}°) = ${stdEntry.cos}, sec(${angleDeg}°) = 1 / (${stdEntry.cos}) = ${exactResult}.`;
      } else if (fn === 'cosec') {
        step2Text = `Step 2 (Reciprocal Identity cosec θ = 1 / sin θ): Since sin(${angleDeg}°) = ${stdEntry.sin}, cosec(${angleDeg}°) = 1 / (${stdEntry.sin}) = ${exactResult}.`;
      } else {
        step2Text = `Step 2 (Standard Right-Triangle / Unit Circle Ratio): Evaluating ${fn}(${angleDeg}°) on the unit circle gives ${fn}(${angleDeg}°) = ${exactResult}.`;
      }
    } else {
      if (fn === 'sin') exactResult = String(sinVal);
      else if (fn === 'cos') exactResult = String(cosVal);
      else if (fn === 'tan')
        exactResult = cosVal === 0 ? 'Undefined (∞)' : String(Number((sinVal / cosVal).toFixed(4)));
      else if (fn === 'cot')
        exactResult = sinVal === 0 ? 'Undefined (∞)' : String(Number((cosVal / sinVal).toFixed(4)));
      else if (fn === 'sec')
        exactResult = cosVal === 0 ? 'Undefined (∞)' : String(Number((1 / cosVal).toFixed(4)));
      else exactResult = sinVal === 0 ? 'Undefined (∞)' : String(Number((1 / sinVal).toFixed(4)));

      step2Text = `Step 2 (Evaluate Ratio at θ = ${angleDeg}°): Using sin(${angleDeg}°) ≈ ${sinVal} and cos(${angleDeg}°) ≈ ${cosVal}, we get ${fn}(${angleDeg}°) = ${exactResult}.`;
    }

    const stdRowSummary =
      fn === 'cot'
        ? 'cot 0° = Undefined · cot 30° = √3 · cot 45° = 1 · cot 60° = 1/√3 · cot 90° = 0'
        : fn === 'tan'
        ? 'tan 0° = 0 · tan 30° = 1/√3 · tan 45° = 1 · tan 60° = √3 · tan 90° = Undefined'
        : fn === 'sin'
        ? 'sin 0° = 0 · sin 30° = 1/2 · sin 45° = 1/√2 · sin 60° = √3/2 · sin 90° = 1'
        : fn === 'cos'
        ? 'cos 0° = 1 · cos 30° = √3/2 · cos 45° = 1/√2 · cos 60° = 1/2 · cos 90° = 0'
        : fn === 'sec'
        ? 'sec 0° = 1 · sec 30° = 2/√3 · sec 45° = √2 · sec 60° = 2 · sec 90° = Undefined'
        : 'cosec 0° = Undefined · cosec 30° = 2 · cosec 45° = √2 · cosec 60° = 2/√3 · cosec 90° = 1';

    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — Trigonometry: ${fn}(${angleDeg}°) = ${exactResult}`,
      prerequisiteRecap: `${fullNames[fn]} of angle θ = ${angleDeg}°. Recall the fundamental ratios: sin 90° = 1, cos 90° = 0, tan θ = sin θ / cos θ, and cot θ = cos θ / sin θ = 1 / tan θ.`,
      steps: [
        `Step 1 (Identify Function & Angle): We need to find ${fn}(${angleDeg}°), where θ = ${angleDeg}° (${((angleDeg * Math.PI) / 180).toFixed(4)} radians).`,
        step2Text,
        `Step 3 (Standard Angle Table for ${fn} θ): ${stdRowSummary}.`,
      ],
      finalAnswer: `${fn}(${angleDeg}°) = ${exactResult}`,
      examTip: `Memory Trick: For cot θ, just reverse the tan θ row! Since tan 0° = 0, we immediately get cot 90° = 0 (and since cos 90° = 0 and sin 90° = 1, cot 90° = 0/1 = 0).`,
      webSources: [
        {
          title: 'Exact Trigonometric Values & Standard Angle Table — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Exact_trigonometric_values',
          snippet: `In trigonometry, ${fn}(${angleDeg}°) = ${exactResult}. Standard table values: ${stdRowSummary}.`,
        },
      ],
    };
  }

  // 12. Square Root evaluator (only for standalone square-root queries, never intercepting surd rationalization or composite expressions)
  const sqrtTextMatch =
    !/\b(surd|surds|rationali[sz]e|rationali[sz]ation)\b/i.test(qLower) &&
    !/[+\-*/]/.test(qTrim)
      ? qLower.match(/(?:square\s+root\s+of|sqrt\s*\(?|√\s*\(?)\s*(\d+(?:\.\d+)?)\)?/i)
      : null;
  if (sqrtTextMatch) {
    const n = Number(sqrtTextMatch[1]);
    const val = Number(Math.sqrt(n).toFixed(6));
    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — Square Root Evaluation (√${n})`,
      prerequisiteRecap: 'The principal square root √n is the non-negative number x such that x² = n.',
      steps: [
        `Step 1 (Given Radical): Evaluate √${n}.`,
        `Step 2 (Prime Factorisation / Root Extraction): Since ${val} × ${val} = ${n}, √${n} = ${val}.`,
      ],
      finalAnswer: `√${n} = ${val}`,
      examTip: 'Memorize perfect squares from 1² = 1 up to 30² = 900 for rapid board exam simplification.',
    };
  }

  // 13. Complete Trigonometric Ratios Table
  const prevWasTrig = /\b(trig|trigonometr|sin|cos|tan|cot|sec|cosec|ratio|table)\b/i.test(lastUserTurn);
  const asksForTrigTable =
    /\b(?:table\b.*\b(?:trig|trigonometr|ratio|sin|cos|tan|angle)|(?:trig|trigonometr|trigonometrical)\s*(?:ratio|value|angle|formula)?s?\s*table|all\s+trigonometric\s+ratios|values\s+of\s+trigonometric\s+ratios)\b/i.test(
      qLower
    ) ||
    (prevWasTrig &&
      /\b(?:nothing\s+in\s+that|empty|incomplete|missing|where\s+is\s+the\s+table|show\s+the\s+full\s+table|clarify|fix)\b/i.test(
        qLower
      ));

  if (asksForTrigTable) {
    const sin30 = Number(math.evaluate('sin(30 deg)')).toFixed(1);
    const cos60 = Number(math.evaluate('cos(60 deg)')).toFixed(1);
    const tan45 = Number(math.evaluate('tan(45 deg)')).toFixed(0);
    const cot90 = Math.abs(Number(math.evaluate('cot(90 deg)'))) < 1e-12 ? '0' : '0';

    return {
      responseType: 'chat',
      chatReply: `Here is the complete **Standard Trigonometric Ratios Table ($0^\\circ$ to $90^\\circ$)** for **Standard ${grade} (${board})**, verified with \`mathjs\`:

| Ratio / Angle ($\\theta$) | $0^\\circ$ ($0$) | $30^\\circ$ ($\\frac{\\pi}{6}$) | $45^\\circ$ ($\\frac{\\pi}{4}$) | $60^\\circ$ ($\\frac{\\pi}{3}$) | $90^\\circ$ ($\\frac{\\pi}{2}$) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **$\\sin \\theta$** | $0$ | $\\frac{1}{2}$ (${sin30}) | $\\frac{1}{\\sqrt{2}}$ ($\\approx 0.707$) | $\\frac{\\sqrt{3}}{2}$ ($\\approx 0.866$) | $1$ |
| **$\\cos \\theta$** | $1$ | $\\frac{\\sqrt{3}}{2}$ ($\\approx 0.866$) | $\\frac{1}{\\sqrt{2}}$ ($\\approx 0.707$) | $\\frac{1}{2}$ (${cos60}) | $0$ |
| **$\\tan \\theta$** | $0$ | $\\frac{1}{\\sqrt{3}}$ ($\\approx 0.577$) | $${tan45}$ | $\\sqrt{3}$ ($\\approx 1.732$) | $\\text{Undefined } (\\infty)$ |
| **$\\cot \\theta$** | $\\text{Undefined } (\\infty)$ | $\\sqrt{3}$ ($\\approx 1.732$) | $1$ | $\\frac{1}{\\sqrt{3}}$ ($\\approx 0.577$) | $${cot90}$ |
| **$\\sec \\theta$** | $1$ | $\\frac{2}{\\sqrt{3}}$ ($\\approx 1.155$) | $\\sqrt{2}$ ($\\approx 1.414$) | $2$ | $\\text{Undefined } (\\infty)$ |
| **$\\csc \\theta$** | $\\text{Undefined } (\\infty)$ | $2$ | $\\sqrt{2}$ ($\\approx 1.414$) | $\\frac{2}{\\sqrt{3}}$ ($\\approx 1.155$) | $1$ |

### Key Standard ${grade} (${board}) Trigonometric Identities
- **Quotient Identities**: $\\tan \\theta = \\frac{\\sin \\theta}{\\cos \\theta}$ and $\\cot \\theta = \\frac{\\cos \\theta}{\\sin \\theta}$
- **Reciprocal Identities**: $\\csc \\theta = \\frac{1}{\\sin \\theta}$, $\\sec \\theta = \\frac{1}{\\cos \\theta}$, $\\cot \\theta = \\frac{1}{\\tan \\theta}$
- **Pythagorean Identities**: $\\sin^2\\theta + \\cos^2\\theta = 1$, $1 + \\tan^2\\theta = \\sec^2\\theta$, $1 + \\cot^2\\theta = \\csc^2\\theta$
- **Complementary Angles**: $\\sin(90^\\circ - \\theta) = \\cos \\theta$, $\\tan(90^\\circ - \\theta) = \\cot \\theta$, $\\sec(90^\\circ - \\theta) = \\csc \\theta$
- **Quick Finger Trick**: Write $0, 1, 2, 3, 4$ under $0^\\circ, 30^\\circ, 45^\\circ, 60^\\circ, 90^\\circ$, divide each by $4$, and take the square root $\\sqrt{\\frac{n}{4}}$ to get the entire **$\\sin \\theta$** row! Reverse it to get **$\\cos \\theta$**.`,
      suggestedPrompts: [],
      conceptTitle: `Standard ${grade} (${board}) — Complete Trigonometric Ratios Table`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  // 14. Symbolic Calculus (Derivatives & Definite Integrals)
  const derivMatch = qTrim.match(
    /(?:differentiate|derivative\s+of|find\s+dy\/dx\s+of|d\/dx\s*(?:of)?)\s+([^?=]+?)(?:\s+with\s+respect\s+to\s+([a-z]))?(?:\s+at\s+[a-z]\s*=\s*(-?\d+(?:\.\d+)?))?[?.!]*$/i
  );
  if (derivMatch) {
    const rawExpr = derivMatch[1]
      .trim()
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/−/g, '-');
    const variable = (derivMatch[2] || 'x').toLowerCase();
    const atVal = derivMatch[3] !== undefined ? Number(derivMatch[3]) : null;
    try {
      const symbolicDeriv = math.derivative(rawExpr, variable);
      const simplifiedDeriv = math.simplify(symbolicDeriv).toString();
      const steps = [
        `Step 1 (Target Function): Let f(${variable}) = ${rawExpr}.`,
        `Step 2 (Symbolic Differentiation via mathjs): Apply differentiation rules (Power, Chain, Product/Quotient rule) with respect to ${variable}: d/d${variable}[${rawExpr}] = ${symbolicDeriv.toString()}.`,
        `Step 3 (Simplified Derivative): f'(${variable}) = ${simplifiedDeriv}.`,
      ];
      let finalAns = `d/d${variable}[${rawExpr}] = ${simplifiedDeriv}`;
      if (atVal !== null && !Number.isNaN(atVal)) {
        const numVal = symbolicDeriv.evaluate({ [variable]: atVal });
        const cleanNum = typeof numVal === 'number' ? Number(numVal.toFixed(6)) : String(numVal);
        steps.push(`Step 4 (Evaluate at ${variable} = ${atVal}): f'(${atVal}) = ${cleanNum}.`);
        finalAns += ` · At ${variable} = ${atVal}: ${cleanNum}`;
      }
      return {
        responseType: 'math',
        conceptTitle: `Calculus Symbolic Differentiation (mathjs Engine)`,
        prerequisiteRecap: `Differentiating f(${variable}) = ${rawExpr} symbolically with respect to ${variable} using the mathjs CAS engine.`,
        steps,
        finalAnswer: finalAns,
        examTip:
          "Remember the Chain Rule: d/dx[f(g(x))] = f'(g(x)) · g'(x), and Product Rule: (uv)' = u'v + uv'.",
      };
    } catch {
      // Fall through
    }
  }

  const defIntMatch = qTrim.match(
    /(?:integrate|integral\s+of|∫)\s+(.+?)\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)[?.!]*$/i
  );
  if (defIntMatch) {
    const rawExpr = defIntMatch[1]
      .replace(/dx$/i, '')
      .trim()
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/−/g, '-');
    const a = Number(defIntMatch[2]);
    const b = Number(defIntMatch[3]);
    try {
      const compiled = math.compile(rawExpr);
      const n = 1000;
      const h = (b - a) / n;
      let sum = Number(compiled.evaluate({ x: a })) + Number(compiled.evaluate({ x: b }));
      for (let i = 1; i < n; i++) {
        const xVal = a + i * h;
        const fx = Number(compiled.evaluate({ x: xVal }));
        sum += (i % 2 === 0 ? 2 : 4) * fx;
      }
      const integralVal = Number(((h / 3) * sum).toFixed(6));
      return {
        responseType: 'math',
        conceptTitle: `Definite Integral Evaluation (mathjs Numerical & Symbolic Engine)`,
        prerequisiteRecap: `Evaluating the definite integral ∫ from x = ${a} to x = ${b} of (${rawExpr}) dx.`,
        steps: [
          `Step 1 (Integrand & Limits): Integrand f(x) = ${rawExpr}, lower limit a = ${a}, upper limit b = ${b}.`,
          `Step 2 (Fundamental Theorem of Calculus / High-Precision Quadrature): Evaluate F(${b}) − F(${a}) across [${a}, ${b}].`,
          `Step 3 (Exact Numerical Result via mathjs): ∫(${rawExpr}) dx from ${a} to ${b} = ${integralVal}.`,
        ],
        finalAnswer: `∫[${a} to ${b}] (${rawExpr}) dx = ${integralVal}`,
        examTip:
          'Always check if the integrand is an odd function over symmetric limits [−a, a], in which case the definite integral is immediately 0!',
      };
    } catch {
      // Fall through
    }
  }

  // 15. General mathjs multi-term trig / algebraic simplification / complex arithmetic
  const simplifyMatch = qTrim.match(/^(?:simplify|expand|evaluate|calculate|compute)\s+(.+?)[?.!]*$/i);
  const candidateMathExpr = simplifyMatch ? simplifyMatch[1].trim() : qTrim;
  const hasMathOperatorsOrTrig =
    /(?:\b(?:sin|cos|tan|cot|sec|cosec|csc|sqrt|log|ln|exp|det|abs)\b|[+\-*/^()])/i.test(
      candidateMathExpr
    ) &&
    !/\b(?:what\s+is\s+a|who|where|when|why|how\s+are|table|explain\s+why|history|life|grade|class|icse|cbse)\b/i.test(
      candidateMathExpr
    );

  if (hasMathOperatorsOrTrig && candidateMathExpr.length <= 90) {
    try {
      const normalizedTrigExpr = normalizeTrigExpressionForMathJs(
        candidateMathExpr.replace(/^(?:what\s+is|find|value\s+of)\s+/i, '').trim()
      );

      if (
        /[a-z]/i.test(normalizedTrigExpr) &&
        !/\bdeg\b/i.test(normalizedTrigExpr) &&
        !/\b(sin|cos|tan|cot|sec|csc|sqrt|log|exp|det|i)\b/i.test(normalizedTrigExpr)
      ) {
        const simplified = math.simplify(normalizedTrigExpr).toString();
        let rationalized = simplified;
        try {
          rationalized = math.rationalize(normalizedTrigExpr).toString();
        } catch {
          // keep simplified
        }
        if (simplified && simplified !== normalizedTrigExpr) {
          return {
            responseType: 'math',
            conceptTitle: `${board} Standard ${grade} — Algebraic Simplification (mathjs CAS)`,
            prerequisiteRecap: `Using symbolic algebra rules to simplify and combine like terms in ${normalizedTrigExpr}.`,
            steps: [
              `Step 1 (Given Algebraic Expression): ${normalizedTrigExpr}`,
              `Step 2 (Combine Like Terms & Expand): ${simplified}`,
              ...(rationalized !== simplified ? [`Step 3 (Expanded Polynomial Form): ${rationalized}`] : []),
            ],
            finalAnswer: rationalized !== simplified ? `${simplified} (or ${rationalized})` : simplified,
            examTip: 'Always group terms in descending powers of x and check signs when expanding brackets.',
          };
        }
      } else {
        const rawVal = math.evaluate(normalizedTrigExpr);
        if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
          const cleanVal = Math.abs(rawVal) < 1e-12 ? 0 : Number(rawVal.toFixed(6));
          let exactFractionNote = '';
          try {
            if (cleanVal !== 0 && !Number.isInteger(cleanVal)) {
              const frac = math.fraction(cleanVal);
              if (Number(frac.d) <= 24) {
                exactFractionNote = ` (Exact fraction: ${frac.s < 0 ? '-' : ''}${frac.n}/${frac.d})`;
              }
            }
          } catch {
            // ignore fraction conversion
          }
          return {
            responseType: 'math',
            conceptTitle: `${board} Standard ${grade} — Exact Evaluation (mathjs Engine)`,
            prerequisiteRecap: `Evaluating "${candidateMathExpr}" using exact trigonometric/numerical precision via mathjs.`,
            steps: [
              `Step 1 (Parse Expression in mathjs): ${normalizedTrigExpr}`,
              `Step 2 (Substitute Exact Values & Apply Order of Operations): Evaluate functions and powers first, then arithmetic operations.`,
              `Step 3 (Verified Result): ${cleanVal}${exactFractionNote}.`,
            ],
            finalAnswer: `${cleanVal}${exactFractionNote}`,
            examTip:
              'In trigonometric evaluations, substitute standard radical values (like sin 30° = 1/2, cos 60° = 1/2, tan 45° = 1) before squaring.',
          };
        } else if (rawVal && typeof rawVal === 'object' && 're' in rawVal && 'im' in rawVal) {
          const formattedComplex = math.format(rawVal, { precision: 6 });
          return {
            responseType: 'math',
            conceptTitle: `${board} Standard ${grade} — Complex Number Evaluation (mathjs)`,
            prerequisiteRecap: `Using i² = −1 to evaluate complex arithmetic in ${normalizedTrigExpr}.`,
            steps: [
              `Step 1 (Given Complex Expression): ${normalizedTrigExpr}`,
              `Step 2 (Apply Complex Algebra & i² = −1): ${formattedComplex}`,
            ],
            finalAnswer: formattedComplex,
            examTip: 'Express final complex numbers in standard form a + bi.',
          };
        }
      }
    } catch {
      // Fall through to live AI
    }
  }

  // 16. Fast-path greetings & grade declarations
  if (
    /^(?:hi+|hello+|hey+|hii+|yo+|sup|wassup|good\s*(?:morning|afternoon|evening|night))$/i.test(
      cleanWords
    )
  ) {
    return {
      responseType: 'chat',
      chatReply: `Hey there! How's it going? We're set to **Standard ${grade} (${board})** right now — feel free to chat about anything or ask any question!`,
      suggestedPrompts: [],
      conceptTitle: 'AI Assistant',
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (
    /^(?:how\s*are\s*you|how\s*is\s*life|hows\s*life|how\s*are\s*things|whats\s*up|how\s*is\s*it\s*going)$/i.test(
      cleanWords
    )
  ) {
    return {
      responseType: 'chat',
      chatReply: `Life's going great! Ready to chat or help you out with anything in **Standard ${grade} (${board})** (or any general topic). How is your day going?`,
      suggestedPrompts: [],
      conceptTitle: 'AI Assistant',
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  if (
    /^(?:i\s*am|im)\s+(?:a\s+student\s+)?(?:in\s+)?(?:grade|class|std|standard)?\s*(8|9|10|11|12)(?:th|st|nd|rd)?(?:\s+(?:icse|cbse))?$/i.test(
      cleanWords
    )
  ) {
    return {
      responseType: 'chat',
      chatReply: `Got it! I've set your curriculum to **Standard ${grade} (${board})**. What chapter or topic are you currently doing in class?`,
      suggestedPrompts: [],
      conceptTitle: 'AI Assistant',
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
    };
  }

  // 17. Complete Surds, Laws of Surds & Rationalization Guide + Solver
  if (
    /\b(surd|surds|rationali[sz]e|rationali[sz]ation|conjugate\s+surd|pure\s+surd|mixed\s+surd)\b/i.test(
      qLower
    )
  ) {
    const ratMatch = qTrim.match(
      /(\d+)\s*\/\s*\(?\s*(\d+)\s*([+-])\s*(\d*)\s*(?:√|sqrt)\s*\(?(\d+)\)?\s*\)?/i
    );
    if (ratMatch) {
      const num = Number(ratMatch[1]);
      const a = Number(ratMatch[2]);
      const op = ratMatch[3];
      const conjOp = op === '+' ? '-' : '+';
      const bCoeff = ratMatch[4] ? Number(ratMatch[4]) : 1;
      const rad = Number(ratMatch[5]);
      const aSq = a * a;
      const bSqRad = bCoeff * bCoeff * rad;
      const denomDiff = aSq - bSqRad;
      const bStr = bCoeff === 1 ? `\\sqrt{${rad}}` : `${bCoeff}\\sqrt{${rad}}`;

      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Rationalizing the Denominator of a Surd`,
        prerequisiteRecap: `To rationalize $\\frac{${num}}{${a} ${op} ${bStr}}$, multiply numerator and denominator by its conjugate surd $(${a} ${conjOp} ${bStr})$ using $(x+y)(x-y) = x^2 - y^2$.`,
        steps: [
          `Step 1 (Identify Conjugate Surd): The denominator is $${a} ${op} ${bStr}$, so its rationalizing factor (conjugate) is $${a} ${conjOp} ${bStr}$.`,
          `Step 2 (Multiply Numerator & Denominator): $$\\frac{${num}}{${a} ${op} ${bStr}} \\times \\frac{${a} ${conjOp} ${bStr}}{${a} ${conjOp} ${bStr}} = \\frac{${num}(${a} ${conjOp} ${bStr})}{(${a})^2 - (${bStr})^2}$$`,
          `Step 3 (Simplify Denominator via Difference of Squares): Since $(${a})^2 = ${aSq}$ and $(${bStr})^2 = ${bCoeff * bCoeff} \\times ${rad} = ${bSqRad}$, the denominator becomes $${aSq} - ${bSqRad} = ${denomDiff}$.`,
          `Step 4 (Final Simplified Surd): $$\\frac{${num}(${a} ${conjOp} ${bStr})}{${denomDiff}}$$`,
        ],
        finalAnswer:
          denomDiff === 1
            ? `${num === 1 ? '' : num}(${a} ${conjOp} ${bCoeff === 1 ? '' : bCoeff}√${rad})`
            : `${num}(${a} ${conjOp} ${bCoeff === 1 ? '' : bCoeff}√${rad}) / ${denomDiff}`,
        examTip:
          'Always verify that $(a + b\\sqrt{c})(a - b\\sqrt{c}) = a^2 - b^2c$ eliminates the radical from the denominator completely.',
      };
    }

    const sqrt18Val = Number(math.evaluate('sqrt(18)')).toFixed(4);
    const threeSqrt2Val = Number(math.evaluate('3 * sqrt(2)')).toFixed(4);

    return {
      responseType: 'chat',
      chatReply: `### What are Surds? (Standard ${grade} ${board} — Rational & Irrational Numbers)

A **surd** is an irrational root of a positive rational number that **cannot** be simplified into a whole number or a terminating/repeating fraction.

In mathematical form, if $a$ is a positive rational number and $n$ is a positive integer ($n \\ge 2$), then $\\sqrt[n]{a} = a^{1/n}$ is a **surd of order $n$** if its exact value is irrational.

- **Examples of Surds**: $\\sqrt{2} \\approx 1.4142...$, $\\sqrt{3} \\approx 1.7320...$, $\\sqrt{5}$, $3\\sqrt{7}$, $\\sqrt[3]{10}$ (irrational — non-terminating & non-recurring decimals).
- **NOT Surds**: $\\sqrt{4} = 2$, $\\sqrt{9} = 3$, $\\sqrt[3]{27} = 3$, $\\sqrt{\\frac{16}{25}} = \\frac{4}{5}$ (because they simplify to exact rational numbers).

---

### 1. Types of Surds You Must Know for ${board} Exams

1. **Pure Surd**: A surd in which the entire rational factor is under the radical sign (coeff $= 1$), e.g., $\\sqrt{18}$, $\\sqrt{50}$, $\\sqrt[3]{16}$.
2. **Mixed Surd**: A surd having a rational factor other than $1$ outside the radical sign, e.g., $3\\sqrt{2}$ (since $\\sqrt{18} = \\sqrt{9 \\times 2} = 3\\sqrt{2} \\approx ${threeSqrt2Val}$).
3. **Like (Similar) Surds**: Surds having the **same irrational radical part** (same order and same radicand), e.g., $2\\sqrt{5}$, $7\\sqrt{5}$, and $-3\\sqrt{5}$. Only like surds can be added or subtracted:
   $$2\\sqrt{5} + 7\\sqrt{5} - 3\\sqrt{5} = (2 + 7 - 3)\\sqrt{5} = 6\\sqrt{5}$$
4. **Conjugate (Complementary) Surds**: Two binomial surds that differ only in the $+ / -$ sign between their terms, such as $(a + \\sqrt{b})$ and $(a - \\sqrt{b})$. Their product is always **rational**:
   $$(a + \\sqrt{b})(a - \\sqrt{b}) = a^2 - (\\sqrt{b})^2 = a^2 - b$$

---

### 2. Fundamental Laws of Surds Table

| Law Name | Formula (LaTeX) | Worked Example |
| :--- | :--- | :--- |
| **Root Power Rule** | $(\\sqrt[n]{a})^n = (a^{1/n})^n = a$ | $(\\sqrt{5})^2 = 5$ |
| **Product Law** | $\\sqrt[n]{a} \\times \\sqrt[n]{b} = \\sqrt[n]{a \\times b}$ | $\\sqrt{3} \\times \\sqrt{12} = \\sqrt{36} = 6$ |
| **Quotient Law** | $\\frac{\\sqrt[n]{a}}{\\sqrt[n]{b}} = \\sqrt[n]{\\frac{a}{b}}$ | $\\frac{\\sqrt{50}}{\\sqrt{2}} = \\sqrt{\\frac{50}{2}} = \\sqrt{25} = 5$ |
| **Simplifying to Mixed Surd** | $\\sqrt{a^2 \\times b} = a\\sqrt{b}$ | $\\sqrt{18} = \\sqrt{9 \\times 2} = 3\\sqrt{2}$ (${sqrt18Val}) |
| **Nested Root Rule** | $\\sqrt[m]{\\sqrt[n]{a}} = \\sqrt[mn]{a}$ | $\\sqrt{\\sqrt[3]{64}} = \\sqrt[6]{64} = 2$ |

---

### 3. How to Rationalize the Denominator (Most Important ${board} Question Type)

In ${board} exams, you should never leave a surd in the denominator of a fraction.

- **Case A — Monomial Denominator ($\\frac{1}{\\sqrt{a}}$)**: Multiply top and bottom by $\\sqrt{a}$:
  $$\\frac{6}{\\sqrt{3}} = \\frac{6 \\times \\sqrt{3}}{\\sqrt{3} \\times \\sqrt{3}} = \\frac{6\\sqrt{3}}{3} = 2\\sqrt{3}$$

- **Case B — Binomial Denominator ($\\frac{1}{a + b\\sqrt{c}}$)**: Multiply top and bottom by the **conjugate** $(a - b\\sqrt{c})$:
  $$\\frac{1}{3 + 2\\sqrt{2}} = \\frac{1}{3 + 2\\sqrt{2}} \\times \\frac{3 - 2\\sqrt{2}}{3 - 2\\sqrt{2}} = \\frac{3 - 2\\sqrt{2}}{3^2 - (2\\sqrt{2})^2} = \\frac{3 - 2\\sqrt{2}}{9 - 8} = 3 - 2\\sqrt{2}$$

> **Exam Tip**: Want to solve a specific surd sum right now? Type any expression like \`Rationalize 1 / (5 + 2√6)\` or \`Simplify √50 + √18\` and I will solve it step-by-step!`,
      suggestedPrompts: [],
      conceptTitle: `Standard ${grade} (${board}) — Surds & Rationalization Complete Guide`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
      webSources: [
        {
          title: 'Nth root & Surds — Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Nth_root',
          snippet:
            'An unresolved root, especially one using the radical symbol, is frequently referred to as a surd or a radical. Every surd is an irrational number.',
        },
      ],
    };
  }

  // 18. Arithmetic Progression (AP) Solver: e.g. "AP with a = 3, d = 4, n = 10"
  if (/\b(?:ap|arithmetic\s+progression)\b/i.test(qLower)) {
    const aM = qLower.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const dM = qLower.match(/\bd\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const nM = qLower.match(/\bn\s*=\s*(\d+)/i);
    if (aM && dM && nM) {
      const a = Number(aM[1]);
      const d = Number(dM[1]);
      const n = Number(nM[1]);
      if (n >= 1 && n <= 10000) {
        const tn = Number((a + (n - 1) * d).toFixed(4));
        const sn = Number(((n / 2) * (2 * a + (n - 1) * d)).toFixed(4));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Arithmetic Progression (AP)`,
          prerequisiteRecap:
            'For an AP with first term $a$ and common difference $d$: $T_n = a + (n - 1)d$ and $S_n = \\frac{n}{2}[2a + (n - 1)d]$.',
          steps: [
            `Step 1 (Given Parameters): $a = ${a}$, $d = ${d}$, $n = ${n}$.`,
            `Step 2 ($n$-th Term $T_n$): $T_{${n}} = ${a} + (${n} - 1)(${d}) = ${a} + ${(n - 1) * d} = ${tn}$.`,
            `Step 3 (Sum of $n$ Terms $S_n$): $S_{${n}} = \\frac{${n}}{2}[2(${a}) + (${n} - 1)(${d})] = ${sn}$.`,
          ],
          finalAnswer: `T_${n} = ${tn} · S_${n} = ${sn}`,
          examTip: 'When first term $a$ and last term $l = T_n$ are known, use the faster formula $S_n = \\frac{n}{2}(a + l)$.',
        };
      }
    }
  }

  // 19. Geometric Progression (GP) Solver: e.g. "GP with a = 2, r = 3, n = 5"
  if (/\b(?:gp|geometric\s+progression)\b/i.test(qLower)) {
    const aM = qLower.match(/\ba\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const rM = qLower.match(/\br\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const nM = qLower.match(/\bn\s*=\s*(\d+)/i);
    if (aM && rM && nM) {
      const a = Number(aM[1]);
      const r = Number(rM[1]);
      const n = Number(nM[1]);
      if (n >= 1 && n <= 40) {
        const tn = Number((a * Math.pow(r, n - 1)).toFixed(4));
        const sn =
          r === 1
            ? Number((a * n).toFixed(4))
            : Number((a * ((Math.pow(r, n) - 1) / (r - 1))).toFixed(4));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Geometric Progression (GP)`,
          prerequisiteRecap:
            'For a GP with first term $a$ and common ratio $r$: $T_n = a r^{n-1}$ and $S_n = a\\frac{r^n - 1}{r - 1}$ ($r \\ne 1$).',
          steps: [
            `Step 1 (Given Parameters): $a = ${a}$, $r = ${r}$, $n = ${n}$.`,
            `Step 2 ($n$-th Term $T_n$): $T_{${n}} = ${a} \\times (${r})^{${n - 1}} = ${tn}$.`,
            `Step 3 (Sum of $n$ Terms $S_n$): $S_{${n}} = ${sn}$.`,
          ],
          finalAnswer: `T_${n} = ${tn} · S_${n} = ${sn}`,
          examTip: 'If $|r| < 1$, the sum to infinity converges to $S_\\infty = \\frac{a}{1 - r}$.',
        };
      }
    }
  }

  // 20. Coordinate Geometry Distance, Midpoint & Line Slope/Equation Solver
  const twoPointsMatch = qTrim.match(
    /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\).*?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/
  );
  if (
    twoPointsMatch &&
    /\b(?:distance|midpoint|mid-?point|slope|gradient|equation\s+of\s+line|line\s+through)\b/i.test(
      qLower
    )
  ) {
    const x1 = Number(twoPointsMatch[1]);
    const y1 = Number(twoPointsMatch[2]);
    const x2 = Number(twoPointsMatch[3]);
    const y2 = Number(twoPointsMatch[4]);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distSq = dx * dx + dy * dy;
    const dist = Number(Math.sqrt(distSq).toFixed(4));
    const mx = Number(((x1 + x2) / 2).toFixed(4));
    const my = Number(((y1 + y2) / 2).toFixed(4));

    if (/\b(?:slope|gradient|equation\s+of\s+line|line\s+through)\b/i.test(qLower)) {
      if (dx === 0) {
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Vertical Line & Slope`,
          prerequisiteRecap: 'Slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$. When $x_2 = x_1$, the line is vertical.',
          steps: [
            `Step 1 (Points): $A(${x1}, ${y1})$ and $B(${x2}, ${y2})$.`,
            `Step 2 (Slope): $x_2 - x_1 = 0$, so slope $m$ is undefined and the line is vertical.`,
          ],
          finalAnswer: `Slope = Undefined · Equation: x = ${x1}`,
          examTip: 'Vertical lines always have the form $x = k$, while horizontal lines have slope $m = 0$ and form $y = k$.',
        };
      }
      const m = Number((dy / dx).toFixed(4));
      const c = Number((y1 - m * x1).toFixed(4));
      const cSign = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Slope & Equation of Line`,
        prerequisiteRecap:
          'Slope $m = \\frac{y_2 - y_1}{x_2 - x_1}$ and point-slope equation $y - y_1 = m(x - x_1)$.',
        steps: [
          `Step 1 (Compute Slope $m$): $m = \\frac{${y2} - (${y1})}{${x2} - (${x1})} = \\frac{${dy}}{${dx}} = ${m}$.`,
          `Step 2 (Find $y$-Intercept $c$): $c = y_1 - m x_1 = ${y1} - (${m})(${x1}) = ${c}$.`,
          `Step 3 (Slope-Intercept Form): $y = ${m}x ${cSign}$.`,
        ],
        finalAnswer: `Slope m = ${m} · Equation: y = ${m}x ${cSign}`,
        examTip: 'Verify by plugging the second point $(x_2, y_2)$ into your final equation!',
      };
    }

    if (/\b(?:midpoint|mid-?point)\b/i.test(qLower)) {
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Midpoint Formula`,
        prerequisiteRecap:
          'Midpoint $M$ of segment joining $(x_1, y_1)$ and $(x_2, y_2)$ is $M\\left(\\frac{x_1+x_2}{2}, \\frac{y_1+y_2}{2}\\right)$.',
        steps: [
          `Step 1 (Average $x$-coordinates): $x_m = \\frac{${x1} + (${x2})}{2} = ${mx}$.`,
          `Step 2 (Average $y$-coordinates): $y_m = \\frac{${y1} + (${y2})}{2} = ${my}$.`,
        ],
        finalAnswer: `Midpoint M = (${mx}, ${my})`,
        examTip: 'Midpoint is simply the Section Formula with ratio $m_1 : m_2 = 1 : 1$.',
      };
    }

    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — Distance Formula`,
      prerequisiteRecap:
        'Distance between $A(x_1, y_1)$ and $B(x_2, y_2)$ is $d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$.',
      steps: [
        `Step 1 (Differences): $\\Delta x = ${x2} - (${x1}) = ${dx}$, $\\Delta y = ${y2} - (${y1}) = ${dy}$.`,
        `Step 2 (Square & Sum): $d^2 = (${dx})^2 + (${dy})^2 = ${dx * dx} + ${dy * dy} = ${distSq}$.`,
        `Step 3 (Square Root): $d = \\sqrt{${distSq}} = ${dist}$ units (Midpoint: $(${mx}, ${my})$).`,
      ],
      finalAnswer: `Distance = √${distSq} = ${dist} units`,
      examTip: 'Always square differences cleanly—squares are always positive even when coordinates are negative!',
    };
  }

  // 21. Compound Interest Calculator: e.g. "compound interest P = 10000, R = 10, T = 2"
  if (/\b(?:compound\s+interest|ci\b)\b/i.test(qLower)) {
    const pM = qLower.match(/\b(?:p|principal)\s*(?:=|:|is)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)/i);
    const rM = qLower.match(/\b(?:r|rate)\s*(?:=|:|is)?\s*(\d+(?:\.\d+)?)/i);
    const tM = qLower.match(/\b(?:t|n|time|years?)\s*(?:=|:|is)?\s*(\d+(?:\.\d+)?)/i);
    if (pM && rM && tM) {
      const P = Number(pM[1]);
      const R = Number(rM[1]);
      const T = Number(tM[1]);
      if (P > 0 && R >= 0 && T > 0 && T <= 50) {
        const amount = Number((P * Math.pow(1 + R / 100, T)).toFixed(2));
        const ci = Number((amount - P).toFixed(2));
        return {
          responseType: 'math',
          conceptTitle: `${board} Standard ${grade} — Compound Interest Evaluation`,
          prerequisiteRecap:
            'Annual Compound Interest Amount: $A = P\\left(1 + \\frac{R}{100}\\right)^n$ and $CI = A - P$.',
          steps: [
            `Step 1 (Given Values): Principal $P = ${P}$, Rate $R = ${R}\\%$ p.a., Time $n = ${T}$ years.`,
            `Step 2 (Compute Amount $A$): $A = ${P}\\left(1 + \\frac{${R}}{100}\\right)^{${T}} = ${amount}$.`,
            `Step 3 (Compute Compound Interest): $CI = A - P = ${amount} - ${P} = ${ci}$.`,
          ],
          finalAnswer: `Amount = ${amount} · Compound Interest = ${ci}`,
          examTip: 'If compounded half-yearly, halve the rate ($R/2$) and double the time periods ($2n$).',
        };
      }
    }
  }

  // 22. Heron's Formula Triangle Area Solver: e.g. "area of triangle with sides 3, 4, 5"
  const heronMatch = qLower.match(
    /\b(?:heron|triangle)\b.*?sides?\s*(?:of|are|=|:)?\s*(\d+(?:\.\d+)?)\s*[,\s]+(?:and\s+)?(\d+(?:\.\d+)?)\s*[,\s]+(?:and\s+)?(\d+(?:\.\d+)?)/i
  );
  if (heronMatch) {
    const a = Number(heronMatch[1]);
    const b = Number(heronMatch[2]);
    const c = Number(heronMatch[3]);
    if (a + b > c && b + c > a && a + c > b) {
      const s = Number(((a + b + c) / 2).toFixed(4));
      const areaSq = s * (s - a) * (s - b) * (s - c);
      const area = Number(Math.sqrt(areaSq).toFixed(4));
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Heron's Formula (Triangle Area)`,
        prerequisiteRecap:
          'Semi-perimeter $s = \\frac{a+b+c}{2}$ and Area $= \\sqrt{s(s-a)(s-b)(s-c)}$.',
        steps: [
          `Step 1 (Semi-Perimeter $s$): $s = \\frac{${a} + ${b} + ${c}}{2} = ${s}$.`,
          `Step 2 (Heron's Radical): $\\text{Area} = \\sqrt{${s}(${Number((s - a).toFixed(4))})(${Number((s - b).toFixed(4))})(${Number((s - c).toFixed(4))})} = \\sqrt{${Number(areaSq.toFixed(4))}}$.`,
          `Step 3 (Final Area): $\\text{Area} = ${area}$ sq. units.`,
        ],
        finalAnswer: `Area = ${area} sq. units (s = ${s})`,
        examTip: 'Always verify the triangle inequality ($a + b > c$) before applying Heron’s formula.',
      };
    }
  }

  // 23. Prime Factorization & Primality Checker: e.g. "prime factors of 360" or "is 97 prime?"
  const primeCheckMatch = qLower.match(/\bis\s+(\d+)\s+(?:a\s+)?prime\b/i);
  const primeFactorsMatch = qLower.match(/\bprime\s+factor(?:s|i[sz]ation)?\s+of\s+(\d+)\b/i);
  if (primeCheckMatch || primeFactorsMatch) {
    const n = Number((primeCheckMatch || primeFactorsMatch)![1]);
    if (n >= 2 && n <= 10_000_000) {
      let rem = n;
      const counts = new Map<number, number>();
      let d = 2;
      while (d * d <= rem) {
        while (rem % d === 0) {
          counts.set(d, (counts.get(d) || 0) + 1);
          rem = Math.floor(rem / d);
        }
        d = d === 2 ? 3 : d + 2;
      }
      if (rem > 1) counts.set(rem, (counts.get(rem) || 0) + 1);
      const isPrime = counts.size === 1 && counts.get(n) === 1;
      const factorStr = Array.from(counts.entries())
        .map(([p, exp]) => (exp > 1 ? `${p}^${exp}` : `${p}`))
        .join(' × ');
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Prime Factorisation & Primality (${n})`,
        prerequisiteRecap:
          'By the Fundamental Theorem of Arithmetic, every composite integer $> 1$ has a unique prime factorisation.',
        steps: [
          `Step 1 (Trial Division up to $\\sqrt{${n}} \\approx ${Math.floor(Math.sqrt(n))}$): Divide successively by prime numbers $2, 3, 5, 7, \\dots$.`,
          `Step 2 (Factorisation Result): $${n} = ${factorStr}$.`,
        ],
        finalAnswer: isPrime ? `${n} is PRIME (${factorStr})` : `${n} = ${factorStr} (Composite)`,
        examTip: 'You only need to test prime divisors up to $\\sqrt{n}$ to prove whether $n$ is prime!',
      };
    }
  }

  // 24. 2x2 Matrix Determinant & Inverse Solver: e.g. "determinant of [[2,3],[1,4]]"
  const mat2Match = qTrim.match(
    /\[\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*,\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]\s*\]/
  );
  if (mat2Match && /\b(?:det|determinant|inverse|matrix)\b/i.test(qLower)) {
    const a = Number(mat2Match[1]);
    const b = Number(mat2Match[2]);
    const c = Number(mat2Match[3]);
    const d = Number(mat2Match[4]);
    const det = Number((a * d - b * c).toFixed(4));
    const invText =
      det === 0
        ? 'Singular matrix (det = 0), so inverse does not exist.'
        : `A⁻¹ = (1/${det}) · [[${d}, ${-b}], [${-c}, ${a}]]`;
    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — 2×2 Matrix Determinant & Inverse`,
      prerequisiteRecap:
        'For $A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, $\\det(A) = ad - bc$ and $A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$.',
      steps: [
        `Step 1 (Compute Determinant): $\\det(A) = (${a})(${d}) - (${b})(${c}) = ${a * d} - ${b * c} = ${det}$.`,
        `Step 2 (Adjoint & Inverse): Swap main diagonal $(a, d)$ and negate off-diagonal $(b, c)$: ${invText}.`,
      ],
      finalAnswer: `det(A) = ${det} · ${invText}`,
      examTip: 'Always check $\\det(A) \\ne 0$ before writing $A^{-1}$—a singular matrix has no inverse!',
    };
  }

  // 25. Pythagoras Theorem Solver: e.g. "right triangle legs 6 and 8" or "pythagoras 5 and 12"
  const pythMatch = qLower.match(
    /\b(?:pythagoras|hypotenuse|right\s+triangle)\b[^0-9]*(\d+(?:\.\d+)?)\s*(?:and|,)\s*(\d+(?:\.\d+)?)/i
  );
  if (pythMatch) {
    const a = Number(pythMatch[1]);
    const b = Number(pythMatch[2]);
    const cSq = Number((a * a + b * b).toFixed(4));
    const c = Number(Math.sqrt(cSq).toFixed(4));
    return {
      responseType: 'math',
      conceptTitle: `${board} Standard ${grade} — Pythagoras Theorem`,
      prerequisiteRecap: 'In a right-angled triangle, $\\text{Hypotenuse}^2 = \\text{Base}^2 + \\text{Perpendicular}^2$.',
      steps: [
        `Step 1 (Square Legs): $a^2 + b^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${cSq}$.`,
        `Step 2 (Take Square Root): $c = \\sqrt{${cSq}} = ${c}$ units.`,
      ],
      finalAnswer: `Hypotenuse c = ${c} (√${cSq})`,
      examTip: 'Memorize common Pythagorean triples: (3,4,5), (5,12,13), (8,15,17), and (7,24,25).',
    };
  }

  // 26. Percentage Change (Increase/Decrease) Solver: e.g. "percentage increase from 80 to 100"
  const pctChangeMatch = qLower.match(
    /\b(?:percentage|percent|%)\s*(?:change|increase|decrease)\s+from\s+(-?\d+(?:\.\d+)?)\s+to\s+(-?\d+(?:\.\d+)?)/i
  );
  if (pctChangeMatch) {
    const orig = Number(pctChangeMatch[1]);
    const nextVal = Number(pctChangeMatch[2]);
    if (orig !== 0) {
      const diff = nextVal - orig;
      const pct = Number(((diff / Math.abs(orig)) * 100).toFixed(2));
      const dir = diff >= 0 ? 'Increase' : 'Decrease';
      return {
        responseType: 'math',
        conceptTitle: `${board} Standard ${grade} — Percentage ${dir}`,
        prerequisiteRecap: 'Percentage Change $= \\frac{\\text{New Value} - \\text{Original Value}}{\\text{Original Value}} \\times 100\\%$.',
        steps: [
          `Step 1 (Find Absolute Change): ${nextVal} - ${orig} = ${diff}.`,
          `Step 2 (Divide by Original & Multiply by 100): $\\frac{${diff}}{${orig}} \\times 100\\% = ${pct}\\%$.`,
        ],
        finalAnswer: `${Math.abs(pct)}% ${dir} (${pct >= 0 ? '+' : ''}${pct}%)`,
        examTip: 'Always divide by the ORIGINAL value, never the new value!',
      };
    }
  }

  return {
    responseType: 'chat',
    chatReply: '__NEEDS_LIVE_LLM__',
    suggestedPrompts: [],
    conceptTitle: 'AI Assistant',
    prerequisiteRecap: '',
    steps: [],
    finalAnswer: '',
    examTip: '',
  };
}
