/**
 * Canonical registry of all 100 implemented features across 9 categories,
 * powering the 100-Feature Studio Explorer and Ctrl+K Global Command Palette.
 */

export type FeatureCategory =
  | 'AI Tutoring & Pedagogy'
  | 'Interactive Simulations'
  | 'Scratchpad & Input'
  | 'Voice & Audio'
  | 'Exam Prep & Practice'
  | 'Notes & Organization'
  | 'Fluent UI & Accessibility'
  | 'Parent, Teacher & Classroom'
  | 'Motivation & Gamification';

export type PowerHubTab =
  | 'directory'
  | 'pedagogy'
  | 'simulations'
  | 'exam'
  | 'voice'
  | 'notes'
  | 'appearance'
  | 'classroom'
  | 'arena';

export interface SuiteFeatureItem {
  id: number;
  title: string;
  category: FeatureCategory;
  summary: string;
  hubTab: PowerHubTab;
  focusKey: string;
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  'AI Tutoring & Pedagogy',
  'Interactive Simulations',
  'Scratchpad & Input',
  'Voice & Audio',
  'Exam Prep & Practice',
  'Notes & Organization',
  'Fluent UI & Accessibility',
  'Parent, Teacher & Classroom',
  'Motivation & Gamification',
];

export const HUNDRED_FEATURES_CATALOG: SuiteFeatureItem[] = [
  // 1. AI Tutoring & Pedagogy (1–15)
  { id: 1, title: 'Socratic Hint Ladder', category: 'AI Tutoring & Pedagogy', summary: '3 progressive hints (Formula -> First Step -> Check) before revealing the full solution.', hubTab: 'pedagogy', focusKey: 'socratic' },
  { id: 2, title: 'Step-by-Step Mistake Finder', category: 'AI Tutoring & Pedagogy', summary: 'Paste or scan written steps to pinpoint the exact line where an algebra or sign error started.', hubTab: 'pedagogy', focusKey: 'mistake-finder' },
  { id: 3, title: "Explain Like I'm Stuck (ELI-Stuck)", category: 'AI Tutoring & Pedagogy', summary: 'Re-explain any AI step in simpler everyday language with concrete number analogies.', hubTab: 'pedagogy', focusKey: 'eli-stuck' },
  { id: 4, title: 'Alternative Method Switcher', category: 'AI Tutoring & Pedagogy', summary: 'Compare 2–3 board-approved solution methods side by side for the same problem.', hubTab: 'pedagogy', focusKey: 'alt-methods' },
  { id: 5, title: 'ICSE / CBSE Marking Scheme Breakdown', category: 'AI Tutoring & Pedagogy', summary: 'Annotate every step with M1, A1, and B1 board marking points so no step marks are lost.', hubTab: 'pedagogy', focusKey: 'marking-scheme' },
  { id: 6, title: 'Follow-Up Twin Problem', category: 'AI Tutoring & Pedagogy', summary: 'Generate a randomized twin problem immediately after any solved doubt to confirm mastery.', hubTab: 'pedagogy', focusKey: 'twin-problem' },
  { id: 7, title: 'Live Equation Step Verifier', category: 'AI Tutoring & Pedagogy', summary: 'Type each algebraic derivation line and verify mathematical equivalence in real time.', hubTab: 'pedagogy', focusKey: 'step-verifier' },
  { id: 8, title: 'Common Trap Warnings', category: 'AI Tutoring & Pedagogy', summary: 'Automatic syllabus trap alerts for ± roots, extraneous solutions, and degree/radian slips.', hubTab: 'pedagogy', focusKey: 'trap-warnings' },
  { id: 9, title: 'Bilingual Math Mode', category: 'AI Tutoring & Pedagogy', summary: 'Explain in English, Hinglish, Hindi, Marathi, Tamil, or Gujarati while keeping board math notation.', hubTab: 'pedagogy', focusKey: 'bilingual' },
  { id: 10, title: 'Exam-Time Speed Trick Mode', category: 'AI Tutoring & Pedagogy', summary: '30-second MCQ shortcut strategy alongside full descriptive board working.', hubTab: 'pedagogy', focusKey: 'speed-trick' },
  { id: 11, title: 'Multi-Turn Geometry Proof Builder', category: 'AI Tutoring & Pedagogy', summary: 'Interactive Statement | Reason two-column proof trainer with theorem validation.', hubTab: 'pedagogy', focusKey: 'proof-builder' },
  { id: 12, title: 'Auto-Generated Worked Examples Sheet', category: 'AI Tutoring & Pedagogy', summary: 'Turn any tutoring thread into a clean printable KaTeX worked-examples sheet.', hubTab: 'notes', focusKey: 'worked-sheet' },
  { id: 13, title: 'Textbook Exercise Navigator', category: 'AI Tutoring & Pedagogy', summary: 'Browse exact ICSE Selina Concise & NCERT chapters and exercises for Standards 8–12.', hubTab: 'pedagogy', focusKey: 'textbook-nav' },
  { id: 14, title: 'Prerequisite Gap Detector', category: 'AI Tutoring & Pedagogy', summary: 'Trace struggles in Std 10–12 topics back to specific Std 8–9 bridge concepts.', hubTab: 'pedagogy', focusKey: 'prereq-gap' },
  { id: 15, title: 'Custom Tutor Persona & Pace Selector', category: 'AI Tutoring & Pedagogy', summary: 'Switch tutor style between Board Examiner, Friendly Coach, Olympiad Mentor, and Rapid Revision.', hubTab: 'pedagogy', focusKey: 'persona' },

  // 2. Interactive Simulations (16–30)
  { id: 16, title: '3D Solid Cross-Section Slicer', category: 'Interactive Simulations', summary: 'Slice cones, cylinders, spheres, and frustums with a live cutting plane.', hubTab: 'simulations', focusKey: 'slicer' },
  { id: 17, title: 'Interactive Net Unfolder', category: 'Interactive Simulations', summary: 'Smoothly unfold cubes, cylinders, cones, and pyramids into 2D nets to verify TSA vs CSA.', hubTab: 'simulations', focusKey: 'net-unfolder' },
  { id: 18, title: 'Unit Circle & Trig Wave Synchronizer', category: 'Interactive Simulations', summary: 'Drag angle θ on the unit circle and watch sin, cos, and tan waves trace synchronously.', hubTab: 'simulations', focusKey: 'unit-circle' },
  { id: 19, title: 'Multi-Function Interactive Grapher', category: 'Interactive Simulations', summary: 'Plot simultaneous curves with live parameter sliders (a, b, c) and root/intersection readouts.', hubTab: 'simulations', focusKey: 'grapher' },
  { id: 20, title: '2D Geometric Construction Compass', category: 'Interactive Simulations', summary: 'Step through interactive compass-and-straightedge bisectors, tangents, and circumcircles.', hubTab: 'simulations', focusKey: 'construction' },
  { id: 21, title: 'Vector & 3D Plane Sandbox', category: 'Interactive Simulations', summary: 'Manipulate 3D vectors to inspect dot product, cross product magnitude, angle, and projection.', hubTab: 'simulations', focusKey: 'vectors' },
  { id: 22, title: 'Matrix Transformation Visualizer', category: 'Interactive Simulations', summary: 'Apply 2×2 reflection, rotation, shear, and scaling matrices and observe determinant area live.', hubTab: 'simulations', focusKey: 'matrix' },
  { id: 23, title: 'Probability & Monte Carlo Simulator', category: 'Interactive Simulations', summary: 'Simulate 10 to 10,000 dice, coin, or card trials comparing experimental vs theoretical odds.', hubTab: 'simulations', focusKey: 'probability' },
  { id: 24, title: 'Statistics Histogram & Ogive Builder', category: 'Interactive Simulations', summary: 'Enter grouped class frequencies to plot cumulative ogive curves and read median/quartiles.', hubTab: 'simulations', focusKey: 'ogive' },
  { id: 25, title: 'Linear Programming Feasible Region', category: 'Interactive Simulations', summary: 'Shade constraint inequalities and sweep Z = ax + by across corner points to find optima.', hubTab: 'simulations', focusKey: 'lpp' },
  { id: 26, title: 'Complex Number Argand Plane Lab', category: 'Interactive Simulations', summary: 'Drag z = a + bi to explore modulus, argument, conjugate, and De Moivre powers.', hubTab: 'simulations', focusKey: 'argand' },
  { id: 27, title: 'Riemann Sum & Definite Integral Lab', category: 'Interactive Simulations', summary: 'Adjust rectangle count n and rule (Left/Right/Midpoint/Trapezoid) to approach exact area.', hubTab: 'simulations', focusKey: 'riemann' },
  { id: 28, title: 'Locus & Reflection Sandbox', category: 'Interactive Simulations', summary: 'Reflect polygons across x-axis, y-axis, origin, and y = x with invariant point highlights.', hubTab: 'simulations', focusKey: 'locus' },
  { id: 29, title: 'GST, Banking RD & Shares Simulator', category: 'Interactive Simulations', summary: 'Interactive ICSE Commercial Maths calculator for CGST/SGST, RD passbook, and dividend yield.', hubTab: 'simulations', focusKey: 'commercial' },
  { id: 30, title: 'Save & Share Simulation Presets', category: 'Interactive Simulations', summary: 'Bookmark custom simulation parameter presets and reload them in one click.', hubTab: 'simulations', focusKey: 'sim-presets' },

  // 3. Scratchpad & Input (31–42)
  { id: 31, title: 'Handwriting-to-LaTeX Recognition', category: 'Scratchpad & Input', summary: 'Convert sketched scratchpad equations directly into editable math in the tutor composer.', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },
  { id: 32, title: 'Multi-Page Digital Notebook Papers', category: 'Scratchpad & Input', summary: 'Switch scratchpad pages and paper styles (Blank, Grid, Dot-Matrix, Graph, Isometric).', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },
  { id: 33, title: 'Shape Auto-Snap on Scratchpad', category: 'Scratchpad & Input', summary: 'Insert crisp snapped lines, triangles, circles, and coordinate axes onto the drawing board.', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },
  { id: 34, title: 'Split-Screen Scratchpad + AI Tutor', category: 'Scratchpad & Input', summary: 'Dock the scratchpad right alongside the chat so you can work out steps while reading.', hubTab: 'appearance', focusKey: 'split-scratchpad' },
  { id: 35, title: 'Check My Rough Work (Canvas to AI)', category: 'Scratchpad & Input', summary: 'Send your rough scratchpad working directly to the tutor for line-by-line review.', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },
  { id: 36, title: 'Scratchpad Stroke Replay Playback', category: 'Scratchpad & Input', summary: 'Replay your written solution strokes step by step to review geometry or algebra work.', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },
  { id: 37, title: 'Smart Visual Math Keyboard Bar', category: 'Scratchpad & Input', summary: 'Insert fractions, roots, trig, integrals, matrices, and Greek symbols with live preview.', hubTab: 'pedagogy', focusKey: 'math-pad' },
  { id: 38, title: 'Multi-Image Batch Doubt Upload', category: 'Scratchpad & Input', summary: 'Attach up to 4 worksheet or textbook photos in a single question queue.', hubTab: 'pedagogy', focusKey: 'batch-upload' },
  { id: 39, title: 'Photo Contrast & Crop Presets', category: 'Scratchpad & Input', summary: 'Auto-enhance chalkboard/notebook scan clarity before submitting to the vision tutor.', hubTab: 'pedagogy', focusKey: 'batch-upload' },
  { id: 40, title: 'Clipboard Paste-Image (Ctrl+V)', category: 'Scratchpad & Input', summary: 'Paste screenshots directly from clipboard into the math chat composer.', hubTab: 'pedagogy', focusKey: 'clipboard-paste' },
  { id: 41, title: 'LaTeX Snippet Autocomplete', category: 'Scratchpad & Input', summary: 'Type shortcuts like /frac, /sqrt, /quad, /int to expand formatted math templates instantly.', hubTab: 'pedagogy', focusKey: 'latex-autocomplete' },
  { id: 42, title: 'Voice-to-Scratchpad Quick Diagram', category: 'Scratchpad & Input', summary: 'Speak diagram commands (right triangle, circle, parabola) to auto-sketch starter figures.', hubTab: 'pedagogy', focusKey: 'scratchpad-launch' },

  // 4. Voice & Audio (43–50)
  { id: 43, title: 'Hands-Free Oral Rapid-Fire Quiz', category: 'Voice & Audio', summary: 'Voice-driven mental math and formula drill where the tutor asks questions aloud.', hubTab: 'voice', focusKey: 'oral-quiz' },
  { id: 44, title: 'Adjustable Speech Speed & Accent', category: 'Voice & Audio', summary: 'Tune TTS narration speed from 0.75× to 1.5× and pick Indian English or neutral voice.', hubTab: 'voice', focusKey: 'tts-controls' },
  { id: 45, title: 'Synchronized Audio Step Highlighting', category: 'Voice & Audio', summary: 'Highlights active explanation sentences while the tutor reads the solution aloud.', hubTab: 'voice', focusKey: 'tts-controls' },
  { id: 46, title: 'Podcast-Style Chapter Audio Summaries', category: 'Voice & Audio', summary: 'Listen to concise spoken chapter briefings with key formulas and board exam pointers.', hubTab: 'voice', focusKey: 'audio-summary' },
  { id: 47, title: 'Push-to-Talk Spacebar Shortcut', category: 'Voice & Audio', summary: 'Hold Space outside text inputs (when enabled) to dictate a doubt and release to pause.', hubTab: 'voice', focusKey: 'ptt' },
  { id: 48, title: 'Spoken Math KaTeX Preview', category: 'Voice & Audio', summary: 'See dictated speech rendered as crisp KaTeX math live before sending.', hubTab: 'voice', focusKey: 'tts-controls' },
  { id: 49, title: 'Math Symbol Pronunciation Tutor', category: 'Voice & Audio', summary: 'Tap any Greek letter or math symbol (θ, φ, Σ, Δ, ∫) to hear proper pronunciation & meaning.', hubTab: 'voice', focusKey: 'pronunciation' },
  { id: 50, title: 'Ambient Focus Soundscapes', category: 'Voice & Audio', summary: 'Built-in Web Audio rain, brown noise, and quiet library soundscapes with volume slider.', hubTab: 'voice', focusKey: 'soundscape' },

  // 5. Exam Prep & Practice (51–65)
  { id: 51, title: 'Full-Length Timed Board Mock Papers', category: 'Exam Prep & Practice', summary: 'Simulated ICSE/CBSE Section A (compulsory) + Section B (choice) timed exam papers.', hubTab: 'exam', focusKey: 'mock-paper' },
  { id: 52, title: "Previous 10 Years' Board Question Bank", category: 'Exam Prep & Practice', summary: 'Filter board-pattern questions by year, chapter, mark weightage, and difficulty tier.', hubTab: 'exam', focusKey: 'past-papers' },
  { id: 53, title: 'Printable Question Paper Generator', category: 'Exam Prep & Practice', summary: 'Build custom chapter-selected worksheets with toggleable answer key for printing.', hubTab: 'exam', focusKey: 'paper-generator' },
  { id: 54, title: 'Error Notebook (Mistake Vault)', category: 'Exam Prep & Practice', summary: 'Automatically collect missed questions with Careless / Concept / Formula / Time root tags.', hubTab: 'exam', focusKey: 'mistake-vault' },
  { id: 55, title: 'Spaced Repetition Flashcards (SM-2)', category: 'Exam Prep & Practice', summary: 'Daily SM-2 adaptive interval flashcards for formulas, identities, and theorems.', hubTab: 'exam', focusKey: 'flashcards' },
  { id: 56, title: '60-Second Mental Math Sprint', category: 'Exam Prep & Practice', summary: 'Fast-paced timed drill covering squares, cubes, percentages, and fraction shortcuts.', hubTab: 'exam', focusKey: 'mental-sprint' },
  { id: 57, title: 'CBSE Assertion-Reason & Case-Study Drill', category: 'Exam Prep & Practice', summary: 'Competency-based Assertion/Reason and real-world Case-Study practice sets.', hubTab: 'exam', focusKey: 'assertion-reason' },
  { id: 58, title: 'Time-Per-Question Pacing Telemetry', category: 'Exam Prep & Practice', summary: 'Compare average solve time per chapter against board exam minute budgets.', hubTab: 'exam', focusKey: 'pacing' },
  { id: 59, title: 'Confidence-Weighted Blind-Spot Detector', category: 'Exam Prep & Practice', summary: 'Highlights high-confidence wrong answers where subtle misconceptions hide.', hubTab: 'exam', focusKey: 'pacing' },
  { id: 60, title: 'Adaptive Diagnostic Placement Test', category: 'Exam Prep & Practice', summary: 'Quick multi-chapter diagnostic that maps your starting strengths and weak chapters.', hubTab: 'exam', focusKey: 'diagnostic' },
  { id: 61, title: 'Custom Quiz Code Sharing', category: 'Exam Prep & Practice', summary: 'Encode any chapter quiz into a compact shareable code for classmates to attempt.', hubTab: 'exam', focusKey: 'quiz-share' },
  { id: 62, title: 'Show-Your-Work Rubric Self-Grader', category: 'Exam Prep & Practice', summary: 'Grade paper solutions step-by-step against official M1/A1 rubrics for honest partial credit.', hubTab: 'exam', focusKey: 'rubric-grader' },
  { id: 63, title: 'Exam Countdown Readiness Gauge', category: 'Exam Prep & Practice', summary: 'Set your exam date to calculate daily target sums and overall syllabus readiness %.', hubTab: 'exam', focusKey: 'countdown' },
  { id: 64, title: 'Formula-to-Problem Reverse Match', category: 'Exam Prep & Practice', summary: 'Train instant problem recognition by matching word problems to their governing formula.', hubTab: 'exam', focusKey: 'reverse-match' },
  { id: 65, title: 'Weekly Chapter Boss Challenge', category: 'Exam Prep & Practice', summary: '5-question multi-concept boss set blending two syllabus chapters together.', hubTab: 'exam', focusKey: 'boss-challenge' },

  // 6. Notes & Organization (66–75)
  { id: 66, title: 'Chat Folders & Chapter Tagging', category: 'Notes & Organization', summary: 'Tag chat history threads as Midterm, Doubt for Sir, Hard, or Revision and filter cleanly.', hubTab: 'notes', focusKey: 'folders' },
  { id: 67, title: 'Pin Specific AI Replies (Saved Insights)', category: 'Notes & Organization', summary: 'Save individual AI explanations and formulas to a searchable Saved Insights wall.', hubTab: 'notes', focusKey: 'insights' },
  { id: 68, title: 'Global Fuzzy Search (Ctrl+K)', category: 'Notes & Organization', summary: 'Search all 100 features, chats, formulas, chapters, and simulations from one command bar.', hubTab: 'directory', focusKey: 'search' },
  { id: 69, title: 'Markdown + LaTeX Revision Notes Editor', category: 'Notes & Organization', summary: 'Write and organize personal revision notes with one-click Send-to-Notes from any reply.', hubTab: 'notes', focusKey: 'notes-editor' },
  { id: 70, title: 'Pocket Formula Cheat-Sheet Builder', category: 'Notes & Organization', summary: 'Curate your toughest 15 formulas into a compact 1-page printable pre-exam cheat sheet.', hubTab: 'notes', focusKey: 'cheat-sheet' },
  { id: 71, title: 'Auto-Summarize Long Chat Threads', category: 'Notes & Organization', summary: 'Distill multi-turn tutoring chats into concise bullet takeaways and formulas used.', hubTab: 'notes', focusKey: 'thread-summary' },
  { id: 72, title: 'Offline Queue & Sync Manager', category: 'Notes & Organization', summary: 'Track queued offline attempts/notes and sync cleanly whenever connectivity resumes.', hubTab: 'notes', focusKey: 'backup' },
  { id: 73, title: 'Export / Import Full Study Backup (JSON)', category: 'Notes & Organization', summary: 'Download or restore a complete JSON archive of chats, notes, bookmarks, and progress.', hubTab: 'notes', focusKey: 'backup' },
  { id: 74, title: 'Recently Viewed Quick-Resume Bar', category: 'Notes & Organization', summary: 'Jump straight back into your last opened simulation, note, chapter, or mock test.', hubTab: 'notes', focusKey: 'quick-resume' },
  { id: 75, title: 'Cross-Thread Tutor Context Memory', category: 'Notes & Organization', summary: 'Opt-in memory notes (e.g. watch negative signs) injected automatically into future doubts.', hubTab: 'notes', focusKey: 'tutor-memory' },

  // 7. Fluent UI & Accessibility (76–85)
  { id: 76, title: 'Windows 11 Accent Color Picker', category: 'Fluent UI & Accessibility', summary: 'Switch global Fluent glass accent palettes: Cobalt, Emerald, Amethyst, Amber, or Rose.', hubTab: 'appearance', focusKey: 'accent' },
  { id: 77, title: 'Dynamic Mica Backdrop Gallery', category: 'Fluent UI & Accessibility', summary: 'Choose subtle Windows 11 Bloom, Aurora Slate, Warm Paper, or Pure Solid surfaces.', hubTab: 'appearance', focusKey: 'backdrop' },
  { id: 78, title: 'Focus / Zen Distraction-Free Mode', category: 'Fluent UI & Accessibility', summary: 'Collapse top chrome for pure full-viewport problem solving and calm study focus.', hubTab: 'appearance', focusKey: 'zen' },
  { id: 79, title: 'Compact vs Spacious Reading Density', category: 'Fluent UI & Accessibility', summary: 'Toggle between compact exam-prep density and airy large-text reading spacing.', hubTab: 'appearance', focusKey: 'density' },
  { id: 80, title: 'Dyslexia-Friendly Reading Mode', category: 'Fluent UI & Accessibility', summary: 'Enable wider letter/word spacing, generous line-height, and warm low-glare reading tint.', hubTab: 'appearance', focusKey: 'dyslexia' },
  { id: 81, title: 'KaTeX Equation Click-to-Zoom', category: 'Fluent UI & Accessibility', summary: 'Click any rendered math expression in chat to inspect it magnified with symbol breakdown.', hubTab: 'appearance', focusKey: 'equation-zoom' },
  { id: 82, title: 'Resizable Split Panes', category: 'Fluent UI & Accessibility', summary: 'Adjust split-screen width ratio smoothly between Tutor Chat and Scratchpad / Tools.', hubTab: 'appearance', focusKey: 'split-ratio' },
  { id: 83, title: 'Picture-in-Picture Mini Formula Bar', category: 'Fluent UI & Accessibility', summary: 'Pin a compact floating formula card on screen while solving sums in the workspace.', hubTab: 'appearance', focusKey: 'pip-formula' },
  { id: 84, title: 'Custom Keyboard Shortcuts Remapper', category: 'Fluent UI & Accessibility', summary: 'Customize your preferred hotkeys for Studio, Formulas, Scratchpad, Voice, and Zen Mode.', hubTab: 'appearance', focusKey: 'shortcuts' },
  { id: 85, title: 'Reduced-Motion & Low-GPU Glass Toggle', category: 'Fluent UI & Accessibility', summary: 'Disable heavy backdrop blur and animations for smooth 60fps on budget phones and laptops.', hubTab: 'appearance', focusKey: 'low-gpu' },

  // 8. Parent, Teacher & Classroom (86–94)
  { id: 86, title: 'Weekly Parent Progress Digest', category: 'Parent, Teacher & Classroom', summary: 'Shareable weekly summary card showing mastery gains, study time, and top 3 focus chapters.', hubTab: 'classroom', focusKey: 'parent-digest' },
  { id: 87, title: 'Teacher Assignment Code Creator', category: 'Parent, Teacher & Classroom', summary: 'Bundle 5–15 chapter sums with a due date into a shareable class assignment code.', hubTab: 'classroom', focusKey: 'assignments' },
  { id: 88, title: 'Class Mastery Heatmap', category: 'Parent, Teacher & Classroom', summary: 'Visual grid comparing cohort accuracy across every syllabus chapter to spot group gaps.', hubTab: 'classroom', focusKey: 'class-heatmap' },
  { id: 89, title: 'Doubt Escalation ("Ask Pritesh Sir")', category: 'Parent, Teacher & Classroom', summary: 'Flag tough doubts into a teacher review queue with timestamped context and priority notes.', hubTab: 'classroom', focusKey: 'escalate' },
  { id: 90, title: '12-Week Study Consistency Heatmap', category: 'Parent, Teacher & Classroom', summary: 'Calendar activity grid visualizing daily minutes studied and sums solved over 84 days.', hubTab: 'classroom', focusKey: 'consistency' },
  { id: 91, title: 'Daily Goal & Screen-Time Contract', category: 'Parent, Teacher & Classroom', summary: 'Set realistic daily sum and minute targets with live progress rings.', hubTab: 'classroom', focusKey: 'goal-contract' },
  { id: 92, title: 'Multi-Student Profile Switcher', category: 'Parent, Teacher & Classroom', summary: 'Switch effortlessly between sibling profiles (e.g. Std 8 & Std 10) on a shared device.', hubTab: 'classroom', focusKey: 'profiles' },
  { id: 93, title: 'Printable Report Card Export', category: 'Parent, Teacher & Classroom', summary: 'Generate a formatted printable mastery certificate and syllabus report card.', hubTab: 'classroom', focusKey: 'report-card' },
  { id: 94, title: 'Live Classroom Presentation Mode', category: 'Parent, Teacher & Classroom', summary: 'High-contrast large-scale projector layout for smartboards and live tuition demos.', hubTab: 'classroom', focusKey: 'presentation' },

  // 9. Motivation & Gamification (95–100)
  { id: 95, title: 'Daily Problem of the Day (POTD)', category: 'Motivation & Gamification', summary: 'One fresh board-calibrated brain-teaser per standard every day with bonus XP.', hubTab: 'arena', focusKey: 'potd' },
  { id: 96, title: 'Chapter Mastery Skill Tree (Std 8–12)', category: 'Motivation & Gamification', summary: 'Interactive prerequisite tree showing how mastery unlocks advanced senior chapters.', hubTab: 'arena', focusKey: 'skill-tree' },
  { id: 97, title: 'Integrated Pomodoro Math Timer', category: 'Motivation & Gamification', summary: '25/5 and 50/10 focused sprint timer awarding bonus XP upon clean completion.', hubTab: 'arena', focusKey: 'pomodoro' },
  { id: 98, title: 'Friendly 1v1 Speed Math Duel', category: 'Motivation & Gamification', summary: 'Compete in a 5-question timed duel against a classmate or paced ghost challenger.', hubTab: 'arena', focusKey: 'duel' },
  { id: 99, title: 'Streak Freeze & Weekend Grace Tokens', category: 'Motivation & Gamification', summary: 'Protect multi-day study streaks during exam breaks using earned freeze tokens.', hubTab: 'arena', focusKey: 'streak-freeze' },
  { id: 100, title: 'Milestone Badges & Unlockable Themes', category: 'Motivation & Gamification', summary: 'Track achievement milestones and unlock special Windows 11 Fluent accent palettes.', hubTab: 'arena', focusKey: 'milestones' },
];
