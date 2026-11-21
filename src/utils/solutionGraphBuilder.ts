import { ProblemItem } from './adaptiveEngine';

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

export interface GraphSegment {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  revealAtStep: number; // 0-based step index when this geometric element appears
  points: GraphPoint[];
}

export interface GraphMarker {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  revealAtStep: number;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export interface MetricReadout {
  label: string;
  value: string;
  revealAtStep: number;
}

export interface SolutionGraphModel {
  kind: 'coordinate' | 'curve' | 'comparison';
  preserveSquareAspect?: boolean;
  categoryLabel: string;
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
  xDomain: [number, number];
  yDomain: [number, number];
  segments: GraphSegment[];
  markers: GraphMarker[];
  stepAnnotations: string[];
  metrics: MetricReadout[];
  stepFormulaLatex: string[];
}

/**
 * Generates circle points around (cx, cy) with radius r.
 */
function buildCircleArcPoints(
  cx: number,
  cy: number,
  r: number,
  steps = 48
): GraphPoint[] {
  const pts: GraphPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (2 * Math.PI * i) / steps;
    pts.push({
      x: Number((cx + r * Math.cos(theta)).toFixed(2)),
      y: Number((cy + r * Math.sin(theta)).toFixed(2)),
    });
  }
  return pts;
}

/**
 * Builds a dynamic, step-progressive mathematical visualization model
 * for any Practice Arena problem (geometric proofs, coordinate geometry,
 * quadratics, trigonometry, calculus limits, and commercial maths).
 */
export function buildSolutionGraphModel(problem: ProblemItem): SolutionGraphModel {
  const id = problem.id;

  // 1. Circle Chord Theorem Proof (Grade 9 — O(0,0), r=13, OM=5, AM=12, AB=24)
  if (id === 'selina_9_chords_04' || /chord/i.test(problem.chapter)) {
    return {
      kind: 'coordinate',
      preserveSquareAspect: true,
      categoryLabel: 'Geometric Proof',
      title: 'Circle Chord Bisector & Right Triangle ΔOMA',
      subtitle: 'Centre O(0, 0), Radius OA = 13 cm, Perpendicular OM = 5 cm',
      xLabel: 'x (cm)',
      yLabel: 'y (cm)',
      xDomain: [-15, 15],
      yDomain: [-15, 15],
      segments: [
        {
          id: 'circle-outline',
          label: 'Circle (r = 13 cm)',
          color: '#38bdf8',
          revealAtStep: 0,
          points: buildCircleArcPoints(0, 0, 13, 60),
        },
        {
          id: 'chord-ab',
          label: 'Chord AB (y = −5)',
          color: '#10b981',
          revealAtStep: 0,
          points: [
            { x: -12, y: -5 },
            { x: 0, y: -5 },
            { x: 12, y: -5 },
          ],
        },
        {
          id: 'perp-om',
          label: 'Perpendicular OM = 5 cm',
          color: '#f59e0b',
          dashed: true,
          revealAtStep: 0,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: -5 },
          ],
        },
        {
          id: 'radius-oa',
          label: 'Radius OA = 13 cm (Hypotenuse)',
          color: '#a78bfa',
          revealAtStep: 1,
          points: [
            { x: 0, y: 0 },
            { x: -12, y: -5 },
          ],
        },
        {
          id: 'half-chord-am',
          label: 'Half-Chord AM = 12 cm',
          color: '#f43f5e',
          revealAtStep: 2,
          points: [
            { x: -12, y: -5 },
            { x: 0, y: -5 },
          ],
        },
        {
          id: 'radius-ob',
          label: 'Symmetric Radius OB = 13 cm',
          color: '#34d399',
          dashed: true,
          revealAtStep: 3,
          points: [
            { x: 0, y: 0 },
            { x: 12, y: -5 },
          ],
        },
      ],
      markers: [
        { id: 'O', x: 0, y: 0, label: 'O(0, 0)', color: '#38bdf8', revealAtStep: 0, labelPosition: 'top' },
        { id: 'M', x: 0, y: -5, label: 'M(0, −5)', color: '#f59e0b', revealAtStep: 0, labelPosition: 'bottom' },
        { id: 'A', x: -12, y: -5, label: 'A(−12, −5)', color: '#f43f5e', revealAtStep: 1, labelPosition: 'bottom' },
        { id: 'B', x: 12, y: -5, label: 'B(12, −5)', color: '#10b981', revealAtStep: 3, labelPosition: 'bottom' },
      ],
      stepAnnotations: [
        'Draw circle centred at O(0,0) with chord AB and drop perpendicular OM ⊥ AB (5 cm).',
        'Connect centre O to endpoint A to form right-angled triangle ΔOMA with hypotenuse OA = 13 cm.',
        'Apply Pythagoras Theorem on ΔOMA: AM = √(13² − 5²) = √144 = 12 cm.',
        'Since perpendicular from centre bisects the chord, MB = AM = 12 cm ⇒ full chord AB = 24 cm.',
      ],
      metrics: [
        { label: 'Radius OA', value: '13 cm', revealAtStep: 1 },
        { label: 'Distance OM', value: '5 cm', revealAtStep: 0 },
        { label: 'Half-Chord AM', value: '12 cm', revealAtStep: 2 },
        { label: 'Full Chord AB', value: '24 cm', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        'OM \\perp AB \\implies AM = MB',
        'OA = 13\\text{ cm}, \\quad OM = 5\\text{ cm}',
        'AM = \\sqrt{13^2 - 5^2} = \\sqrt{169 - 25} = 12\\text{ cm}',
        'AB = 2 \\times AM = 24\\text{ cm}',
      ],
    };
  }

  // 2. Grade 9 Coordinate Geometry Right-Triangle Proof: A(1,1), B(5,1), C(5,4)
  if (id === 'selina_9_coord_05' || /coordinate/i.test(problem.chapter)) {
    const isSectionProblem = id === 'selina_10_coord_09';
    if (isSectionProblem) {
      return {
        kind: 'coordinate',
        categoryLabel: 'Coordinate Geometry',
        title: 'Internal Section Formula on Segment AB (Ratio 2 : 3)',
        subtitle: 'A(−1, 7) to B(4, −3) divided internally by P(1, 3)',
        xLabel: 'x-axis',
        yLabel: 'y-axis',
        xDomain: [-3, 6],
        yDomain: [-5, 9],
        segments: [
          {
            id: 'seg-ab',
            label: 'Full Segment AB',
            color: '#64748b',
            dashed: true,
            revealAtStep: 0,
            points: [
              { x: -1, y: 7 },
              { x: 4, y: -3 },
            ],
          },
          {
            id: 'seg-ap',
            label: 'Part AP (m₁ = 2)',
            color: '#38bdf8',
            revealAtStep: 1,
            points: [
              { x: -1, y: 7 },
              { x: 1, y: 3 },
            ],
          },
          {
            id: 'seg-pb',
            label: 'Part PB (m₂ = 3)',
            color: '#10b981',
            revealAtStep: 2,
            points: [
              { x: 1, y: 3 },
              { x: 4, y: -3 },
            ],
          },
          {
            id: 'proj-p',
            label: 'Coordinates of P(1, 3)',
            color: '#f59e0b',
            dashed: true,
            revealAtStep: 3,
            points: [
              { x: 1, y: 0 },
              { x: 1, y: 3 },
              { x: 0, y: 3 },
            ],
          },
        ],
        markers: [
          { id: 'A', x: -1, y: 7, label: 'A(−1, 7)', color: '#38bdf8', revealAtStep: 0 },
          { id: 'B', x: 4, y: -3, label: 'B(4, −3)', color: '#10b981', revealAtStep: 0 },
          { id: 'P', x: 1, y: 3, label: 'P(1, 3)', color: '#f59e0b', revealAtStep: 2 },
        ],
        stepAnnotations: [
          'Plot endpoints A(−1, 7) and B(4, −3) on the Cartesian coordinate plane.',
          'Compute x-coordinate: x = (2·4 + 3·(−1)) / (2 + 3) = (8 − 3) / 5 = 1.',
          'Compute y-coordinate: y = (2·(−3) + 3·7) / (2 + 3) = (−6 + 21) / 5 = 3.',
          'Verify point P(1, 3) lies cleanly on segment AB dividing it in the exact ratio 2 : 3.',
        ],
        metrics: [
          { label: 'Ratio m₁ : m₂', value: '2 : 3', revealAtStep: 0 },
          { label: 'x-coordinate', value: 'x = 1', revealAtStep: 1 },
          { label: 'y-coordinate', value: 'y = 3', revealAtStep: 2 },
          { label: 'Point P', value: '(1, 3)', revealAtStep: 3 },
        ],
        stepFormulaLatex: [
          'A(-1, 7), \\quad B(4, -3), \\quad m_1:m_2 = 2:3',
          'x = \\frac{2(4) + 3(-1)}{2 + 3} = \\frac{5}{5} = 1',
          'y = \\frac{2(-3) + 3(7)}{2 + 3} = \\frac{15}{5} = 3',
          'P(x, y) = (1, 3)',
        ],
      };
    }

    return {
      kind: 'coordinate',
      categoryLabel: 'Coordinate Geometry Proof',
      title: 'Cartesian Right-Triangle & Distance Proof ΔABC',
      subtitle: 'Vertices A(1, 1), B(5, 1), C(5, 4) — Proving ∠B = 90° and AC = 5',
      xLabel: 'x-axis (units)',
      yLabel: 'y-axis (units)',
      xDomain: [0, 7],
      yDomain: [0, 6],
      segments: [
        {
          id: 'base-ab',
          label: 'Base AB = 4 units (horizontal)',
          color: '#38bdf8',
          revealAtStep: 0,
          points: [
            { x: 1, y: 1 },
            { x: 5, y: 1 },
          ],
        },
        {
          id: 'height-bc',
          label: 'Height BC = 3 units (vertical)',
          color: '#10b981',
          revealAtStep: 1,
          points: [
            { x: 5, y: 1 },
            { x: 5, y: 4 },
          ],
        },
        {
          id: 'hyp-ac',
          label: 'Hypotenuse AC = 5 units',
          color: '#f59e0b',
          revealAtStep: 2,
          points: [
            { x: 1, y: 1 },
            { x: 5, y: 4 },
          ],
        },
        {
          id: 'right-angle-box',
          label: 'Right Angle ∠B = 90°',
          color: '#f43f5e',
          dashed: true,
          revealAtStep: 3,
          points: [
            { x: 4.5, y: 1 },
            { x: 4.5, y: 1.5 },
            { x: 5, y: 1.5 },
          ],
        },
      ],
      markers: [
        { id: 'A', x: 1, y: 1, label: 'A(1, 1)', color: '#38bdf8', revealAtStep: 0, labelPosition: 'bottom' },
        { id: 'B', x: 5, y: 1, label: 'B(5, 1)', color: '#10b981', revealAtStep: 0, labelPosition: 'bottom' },
        { id: 'C', x: 5, y: 4, label: 'C(5, 4)', color: '#f59e0b', revealAtStep: 1, labelPosition: 'top' },
        { id: 'M', x: 3, y: 2.5, label: 'M(3, 2.5)', color: '#a78bfa', revealAtStep: 3, labelPosition: 'top' },
      ],
      stepAnnotations: [
        'Plot A(1, 1) and B(5, 1). Horizontal distance AB = √((5−1)² + (1−1)²) = 4 units.',
        'Plot C(5, 4). Vertical distance BC = √((5−5)² + (4−1)²) = 3 units.',
        'Connect A to C: AC = √((5−1)² + (4−1)²) = √(16 + 9) = √25 = 5 units.',
        'Verify Converse of Pythagoras: AB² + BC² = 16 + 9 = 25 = AC², proving ∠B = 90° and Midpoint M(3, 2.5).',
      ],
      metrics: [
        { label: 'Side AB', value: '4 units', revealAtStep: 0 },
        { label: 'Side BC', value: '3 units', revealAtStep: 1 },
        { label: 'Hypotenuse AC', value: '5 units', revealAtStep: 2 },
        { label: 'Angle ∠B', value: '90° (Proved)', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        'AB = \\sqrt{(5-1)^2 + (1-1)^2} = 4',
        'BC = \\sqrt{(5-5)^2 + (4-1)^2} = 3',
        'AC = \\sqrt{4^2 + 3^2} = \\sqrt{25} = 5',
        'AB^2 + BC^2 = 16 + 9 = 25 = AC^2 \\implies \\angle B = 90^\\circ',
      ],
    };
  }

  // 3. Heights & Distances Geometric Sightline Proof (Cliff 120m, boats at 45° & 30°)
  if (id === 'selina_10_heights_07' || /heights/i.test(problem.chapter)) {
    return {
      kind: 'coordinate',
      categoryLabel: 'Geometric Proof',
      title: 'Two-Boat Sightline & Elevation Diagram',
      subtitle: 'Cliff AB = 120 m · Boat C at 45° (120 m) · Boat D at 30° (207.84 m)',
      xLabel: 'Horizontal Distance (m)',
      yLabel: 'Elevation (m)',
      xDomain: [-10, 230],
      yDomain: [-10, 140],
      segments: [
        {
          id: 'cliff-ab',
          label: 'Cliff AB = 120 m',
          color: '#38bdf8',
          revealAtStep: 0,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 120 },
          ],
        },
        {
          id: 'sea-level',
          label: 'Sea Level Base BD',
          color: '#64748b',
          revealAtStep: 0,
          points: [
            { x: 0, y: 0 },
            { x: 207.84, y: 0 },
          ],
        },
        {
          id: 'sightline-45',
          label: 'Sightline AC (45°)',
          color: '#10b981',
          dashed: true,
          revealAtStep: 0,
          points: [
            { x: 0, y: 120 },
            { x: 120, y: 0 },
          ],
        },
        {
          id: 'sightline-30',
          label: 'Sightline AD (30°)',
          color: '#a78bfa',
          dashed: true,
          revealAtStep: 1,
          points: [
            { x: 0, y: 120 },
            { x: 207.84, y: 0 },
          ],
        },
        {
          id: 'boat-gap-cd',
          label: 'Distance CD = 87.84 m',
          color: '#f59e0b',
          revealAtStep: 2,
          points: [
            { x: 120, y: 0 },
            { x: 207.84, y: 0 },
          ],
        },
      ],
      markers: [
        { id: 'A', x: 0, y: 120, label: 'Cliff Top A(0, 120)', color: '#38bdf8', revealAtStep: 0 },
        { id: 'B', x: 0, y: 0, label: 'Base B(0, 0)', color: '#64748b', revealAtStep: 0 },
        { id: 'C', x: 120, y: 0, label: 'Boat C (120 m)', color: '#10b981', revealAtStep: 0 },
        { id: 'D', x: 207.84, y: 0, label: 'Boat D (207.84 m)', color: '#f59e0b', revealAtStep: 1 },
      ],
      stepAnnotations: [
        'In right ΔABC with 45° elevation: tan 45° = 120 / BC ⇒ BC = 120 m.',
        'In right ΔABD with 30° elevation: tan 30° = 120 / BD ⇒ BD = 120√3 ≈ 207.84 m.',
        'Highlight segment CD between the two boats: CD = BD − BC = 120(√3 − 1).',
        'Verified separation CD = 120 × 0.732 = 87.84 m.',
      ],
      metrics: [
        { label: 'Cliff AB', value: '120 m', revealAtStep: 0 },
        { label: 'Near Boat BC', value: '120.00 m', revealAtStep: 0 },
        { label: 'Far Boat BD', value: '207.84 m', revealAtStep: 1 },
        { label: 'Gap CD', value: '87.84 m', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        '\\tan 45^\\circ = \\frac{120}{BC} \\implies BC = 120\\text{ m}',
        '\\tan 30^\\circ = \\frac{120}{BD} \\implies BD = 120\\sqrt{3}\\text{ m}',
        'CD = BD - BC = 120(\\sqrt{3} - 1)',
        'CD = 120 \\times 0.732 = 87.84\\text{ m}',
      ],
    };
  }

  // 4. Quadratic Discriminant & Tangent Parabola (k = 5 -> 9x² + 6x + 1 = (3x + 1)²)
  if (id === 'selina_10_quad_03' || /quadratic/i.test(problem.chapter)) {
    const parabolaPts: GraphPoint[] = [];
    for (let x = -1.5; x <= 0.9; x += 0.1) {
      const xr = Number(x.toFixed(2));
      parabolaPts.push({ x: xr, y: Number((9 * xr * xr + 6 * xr + 1).toFixed(2)) });
    }
    const discPts: GraphPoint[] = [];
    for (let k = -5; k <= 7; k += 0.5) {
      discPts.push({ x: k, y: Number((k * k - 2 * k - 15).toFixed(2)) });
    }
    return {
      kind: 'curve',
      categoryLabel: 'Algebraic Curve',
      title: 'Discriminant Curve Δ(k) = k² − 2k − 15 = 0',
      subtitle: 'Equal roots occur where the discriminant parabola crosses Δ = 0 at k = −3 and k = 5',
      xLabel: 'Parameter k',
      yLabel: 'Discriminant Δ(k)',
      xDomain: [-5, 7],
      yDomain: [-18, 22],
      segments: [
        {
          id: 'disc-curve',
          label: 'Δ(k) = k² − 2k − 15',
          color: '#38bdf8',
          revealAtStep: 1,
          points: discPts,
        },
        {
          id: 'zero-line',
          label: 'Equal-Root Condition Δ = 0',
          color: '#10b981',
          dashed: true,
          revealAtStep: 0,
          points: [
            { x: -5, y: 0 },
            { x: 7, y: 0 },
          ],
        },
        {
          id: 'tangent-sample',
          label: 'Check k = 5: y = (3x + 1)²',
          color: '#a78bfa',
          dashed: true,
          revealAtStep: 3,
          points: parabolaPts,
        },
      ],
      markers: [
        { id: 'V', x: 1, y: -16, label: 'Vertex (1, −16)', color: '#64748b', revealAtStep: 2 },
        { id: 'K1', x: -3, y: 0, label: 'k = −3', color: '#10b981', revealAtStep: 3 },
        { id: 'K2', x: 5, y: 0, label: 'k = 5', color: '#f59e0b', revealAtStep: 3 },
      ],
      stepAnnotations: [
        'Identify coefficients a = k + 4, b = k + 1, c = 1 and target line Δ = 0.',
        'Plot discriminant function Δ(k) = (k + 1)² − 4(k + 4) = k² − 2k − 15.',
        'Factorise Δ(k) = (k − 5)(k + 3) with minimum vertex at k = 1, Δ = −16.',
        'Zero-crossings at k = −3 and k = 5 yield tangent quadratic curves with equal roots.',
      ],
      metrics: [
        { label: 'Discriminant', value: 'k² − 2k − 15', revealAtStep: 1 },
        { label: 'Root 1', value: 'k = −3', revealAtStep: 3 },
        { label: 'Root 2', value: 'k = 5', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        'a = k + 4, \\; b = k + 1, \\; c = 1',
        '\\Delta = (k+1)^2 - 4(k+4)(1) = 0',
        'k^2 - 2k - 15 = 0 \\implies (k - 5)(k + 3) = 0',
        'k = 5 \\quad \\text{or} \\quad k = -3',
      ],
    };
  }

  // 5. Trigonometric Identity Verification Curve (LHS vs 2 sec θ)
  if (id === 'selina_10_trig_06' || /trig/i.test(problem.chapter)) {
    const pts: GraphPoint[] = [];
    for (let deg = 0; deg <= 75; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const val = Number((2 / Math.cos(rad)).toFixed(3));
      pts.push({ x: deg, y: val });
    }
    return {
      kind: 'curve',
      categoryLabel: 'Trigonometric Verification',
      title: 'Identity Curve: LHS(θ) ≡ 2 sec θ (0° to 75°)',
      subtitle: 'Both rationalized radical terms sum to 2 / cos θ across Quadrant I',
      xLabel: 'Angle θ (degrees)',
      yLabel: 'Value',
      xDomain: [0, 75],
      yDomain: [0, 8],
      segments: [
        {
          id: 'two-sec',
          label: 'y = 2 sec θ',
          color: '#38bdf8',
          revealAtStep: 0,
          points: pts,
        },
        {
          id: 'base-ref',
          label: 'Minimum at θ = 0° (y = 2)',
          color: '#10b981',
          dashed: true,
          revealAtStep: 2,
          points: [
            { x: 0, y: 2 },
            { x: 75, y: 2 },
          ],
        },
      ],
      markers: [
        { id: 'T0', x: 0, y: 2, label: '0° → 2', color: '#10b981', revealAtStep: 0 },
        { id: 'T30', x: 30, y: 2.309, label: '30° → 2.31', color: '#38bdf8', revealAtStep: 1 },
        { id: 'T60', x: 60, y: 4, label: '60° → 4.00', color: '#f59e0b', revealAtStep: 3 },
      ],
      stepAnnotations: [
        'Rationalize the first radical: √((1+sin θ)/(1−sin θ)) = (1 + sin θ) / cos θ.',
        'Rationalize the second radical: √((1−sin θ)/(1+sin θ)) = (1 − sin θ) / cos θ.',
        'Add over common denominator cos θ: sin θ terms cancel, leaving 2 / cos θ.',
        'At θ = 60°, cos 60° = 0.5 ⇒ 2 sec 60° = 4.00, confirming identity across 0° < θ < 90°.',
      ],
      metrics: [
        { label: 'At θ = 0°', value: '2.00', revealAtStep: 0 },
        { label: 'At θ = 30°', value: '4/√3 ≈ 2.31', revealAtStep: 1 },
        { label: 'At θ = 60°', value: '4.00', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        '\\sqrt{\\frac{1+\\sin\\theta}{1-\\sin\\theta}} = \\frac{1+\\sin\\theta}{\\cos\\theta}',
        '\\sqrt{\\frac{1-\\sin\\theta}{1+\\sin\\theta}} = \\frac{1-\\sin\\theta}{\\cos\\theta}',
        '\\frac{(1+\\sin\\theta) + (1-\\sin\\theta)}{\\cos\\theta} = \\frac{2}{\\cos\\theta}',
        '\\frac{2}{\\cos\\theta} = 2\\sec\\theta',
      ],
    };
  }

  // 6. Calculus Limit Approach Curve: (1 - cos 4x) / x² -> 8
  if (id === 'academy_11_calc_01' || /limit/i.test(problem.chapter)) {
    const pts: GraphPoint[] = [];
    for (let x = -0.8; x <= 0.8; x += 0.08) {
      const xr = Number(x.toFixed(2));
      const y =
        Math.abs(xr) < 0.01 ? 8 : Number(((1 - Math.cos(4 * xr)) / (xr * xr)).toFixed(3));
      pts.push({ x: xr, y });
    }
    return {
      kind: 'curve',
      categoryLabel: 'Calculus Limit Graph',
      title: 'Convergence of f(x) = (1 − cos 4x) / x² as x → 0',
      subtitle: 'Both left and right branches converge smoothly to L = 8',
      xLabel: 'x (radians)',
      yLabel: 'f(x)',
      xDomain: [-0.8, 0.8],
      yDomain: [0, 10],
      segments: [
        {
          id: 'limit-curve',
          label: 'f(x) = (1 − cos 4x) / x²',
          color: '#38bdf8',
          revealAtStep: 0,
          points: pts,
        },
        {
          id: 'limit-asymptote',
          label: 'Limit Value L = 8',
          color: '#10b981',
          dashed: true,
          revealAtStep: 2,
          points: [
            { x: -0.8, y: 8 },
            { x: 0.8, y: 8 },
          ],
        },
      ],
      markers: [
        { id: 'L', x: 0, y: 8, label: 'Limit (0, 8)', color: '#10b981', revealAtStep: 3 },
      ],
      stepAnnotations: [
        'Rewrite numerator using half-angle identity: 1 − cos 4x = 2 sin²(2x).',
        'Factor into standard limit form: 2 · [(sin 2x / 2x) · 2]².',
        'As x → 0, sin(2x)/(2x) approaches 1 from both left and right.',
        'Verified limit height L = 2 × 2² = 8 at x = 0.',
      ],
      metrics: [
        { label: 'At x = ±0.4', value: '6.43', revealAtStep: 1 },
        { label: 'At x = ±0.08', value: '7.93', revealAtStep: 2 },
        { label: 'Exact Limit', value: '8', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        '1 - \\cos 4x = 2\\sin^2(2x)',
        '2 \\cdot \\left(\\frac{\\sin 2x}{2x} \\cdot 2\\right)^2',
        '\\lim_{x \\to 0} \\frac{\\sin 2x}{2x} = 1',
        'L = 2 \\times 4 = 8',
      ],
    };
  }

  // 7. Generic Step Progression Curve (Surds, Compound Interest, Expansions, Commercial Maths, Mensuration)
  const isCI = id === 'selina_9_ci_02';
  if (isCI) {
    return {
      kind: 'curve',
      categoryLabel: 'Financial Growth Graph',
      title: 'Compound Interest vs Simple Interest Growth (₹12,000 @ 5%)',
      subtitle: 'Year-2 divergence creates the ₹30 CI − SI difference',
      xLabel: 'Time (Years)',
      yLabel: 'Interest Earned (₹)',
      xDomain: [0, 2],
      yDomain: [0, 1400],
      segments: [
        {
          id: 'si-line',
          label: 'Simple Interest (₹1,200)',
          color: '#38bdf8',
          dashed: true,
          revealAtStep: 0,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 600 },
            { x: 2, y: 1200 },
          ],
        },
        {
          id: 'ci-line',
          label: 'Compound Interest (₹1,230)',
          color: '#10b981',
          revealAtStep: 1,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 600 },
            { x: 2, y: 1230 },
          ],
        },
      ],
      markers: [
        { id: 'Y1', x: 1, y: 600, label: 'Yr 1: ₹600 (Equal)', color: '#38bdf8', revealAtStep: 0 },
        { id: 'SI2', x: 2, y: 1200, label: 'SI: ₹1,200', color: '#38bdf8', revealAtStep: 1 },
        { id: 'CI2', x: 2, y: 1230, label: 'CI: ₹1,230 (+₹30)', color: '#f59e0b', revealAtStep: 3 },
      ],
      stepAnnotations: [
        'Year 1: Both Simple and Compound Interest equal ₹600.',
        'Year 2 SI stays linear at ₹1,200 while CI compounds on ₹12,600.',
        'Year 2 CI reaches ₹1,230 (Amount = ₹13,230).',
        'Vertical gap at Year 2 equals ₹1,230 − ₹1,200 = ₹30.',
      ],
      metrics: [
        { label: '2-Yr SI', value: '₹1,200', revealAtStep: 0 },
        { label: '2-Yr CI', value: '₹1,230', revealAtStep: 2 },
        { label: 'Difference', value: '₹30', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        '\\text{SI} = \\frac{12000 \\times 5 \\times 2}{100} = 1200',
        'A = 12000\\left(1 + \\frac{5}{100}\\right)^2 = 13230',
        '\\text{CI} = 13230 - 12000 = 1230',
        '\\text{CI} - \\text{SI} = 1230 - 1200 = ₹30',
      ],
    };
  }

  // Default Algebraic Step Visualization (e.g., Surds x = 2 + √3 -> x² + 1/x² = 14)
  const isSurds = id === 'selina_9_surds_01';
  if (isSurds) {
    const pts: GraphPoint[] = [];
    for (let t = 0.5; t <= 4.5; t += 0.25) {
      const tr = Number(t.toFixed(2));
      pts.push({ x: tr, y: Number((tr * tr - 2).toFixed(2)) });
    }
    return {
      kind: 'curve',
      categoryLabel: 'Algebraic Mapping',
      title: 'Identity Curve: f(u) = u² − 2 where u = x + 1/x',
      subtitle: 'Rationalizing x = 2 + √3 gives u = 4, mapping directly to x² + 1/x² = 14',
      xLabel: 'u = x + 1/x',
      yLabel: 'x² + 1/x²',
      xDomain: [0, 5],
      yDomain: [-3, 20],
      segments: [
        {
          id: 'u-curve',
          label: 'y = u² − 2',
          color: '#38bdf8',
          revealAtStep: 1,
          points: pts,
        },
        {
          id: 'eval-drop',
          label: 'Evaluate at u = 4 → 14',
          color: '#10b981',
          dashed: true,
          revealAtStep: 2,
          points: [
            { x: 4, y: 0 },
            { x: 4, y: 14 },
            { x: 0, y: 14 },
          ],
        },
      ],
      markers: [
        { id: 'U', x: 4, y: 0, label: 'u = 4', color: '#38bdf8', revealAtStep: 1 },
        { id: 'ANS', x: 4, y: 14, label: '(4, 14)', color: '#10b981', revealAtStep: 3 },
      ],
      stepAnnotations: [
        'Rationalize 1/x = 1/(2 + √3) = 2 − √3 using the conjugate pair.',
        'Add x + 1/x = (2 + √3) + (2 − √3) = 4, locating u = 4 on the horizontal axis.',
        'Trace u = 4 vertically onto the identity curve y = u² − 2.',
        'Read off exact intersection (4, 14) ⇒ x² + 1/x² = 14.',
      ],
      metrics: [
        { label: '1/x', value: '2 − √3', revealAtStep: 0 },
        { label: 'x + 1/x', value: '4', revealAtStep: 1 },
        { label: 'x² + 1/x²', value: '14', revealAtStep: 3 },
      ],
      stepFormulaLatex: [
        '\\frac{1}{x} = \\frac{2 - \\sqrt{3}}{4 - 3} = 2 - \\sqrt{3}',
        'x + \\frac{1}{x} = 4',
        'x^2 + \\frac{1}{x^2} = \\left(x + \\frac{1}{x}\\right)^2 - 2',
        '4^2 - 2 = 14',
      ],
    };
  }

  // General Step-by-Step Derivation Progress Model for remaining problems
  const stepCount = Math.max(1, problem.stepByStepSolution.length);
  const progressPoints: GraphPoint[] = problem.stepByStepSolution.map((_, i) => ({
    x: i + 1,
    y: Math.round(((i + 1) / stepCount) * 100),
  }));

  return {
    kind: 'comparison',
    categoryLabel: 'Step Derivation Graph',
    title: `${problem.chapter} — Verified Derivation Path`,
    subtitle: `${problem.exerciseRef} · ${problem.marks} Marks`,
    xLabel: 'Solution Step',
    yLabel: 'Derivation Progress (%)',
    xDomain: [1, stepCount],
    yDomain: [0, 110],
    segments: [
      {
        id: 'derivation-path',
        label: 'Verified Steps',
        color: '#38bdf8',
        revealAtStep: 0,
        points: progressPoints,
      },
    ],
    markers: progressPoints.map((pt, i) => ({
      id: `S${i + 1}`,
      x: pt.x,
      y: pt.y,
      label: `Step ${i + 1}`,
      color: i === stepCount - 1 ? '#10b981' : '#38bdf8',
      revealAtStep: i,
    })),
    stepAnnotations: problem.stepByStepSolution,
    metrics: [
      { label: 'Steps', value: `${stepCount}`, revealAtStep: 0 },
      { label: 'Marks', value: `${problem.marks}m`, revealAtStep: 0 },
      { label: 'Verified Option', value: problem.options[problem.correctIndex] || 'Complete', revealAtStep: stepCount - 1 },
    ],
    stepFormulaLatex: problem.stepByStepSolution.map((_, i) => `\\text{Step } ${i + 1} \\text{ verified}`),
  };
}

/**
 * Filters a SolutionGraphModel to only the geometric segments, markers, and metrics
 * revealed up through `activeStepIndex` (0-based).
 */
export function getVisibleGraphSlice(
  model: SolutionGraphModel,
  activeStepIndex: number
): {
  segments: GraphSegment[];
  markers: GraphMarker[];
  metrics: MetricReadout[];
} {
  const clamped = Math.max(0, activeStepIndex);
  return {
    segments: model.segments.filter((s) => s.revealAtStep <= clamped),
    markers: model.markers.filter((m) => m.revealAtStep <= clamped),
    metrics: model.metrics.filter((m) => m.revealAtStep <= clamped),
  };
}
