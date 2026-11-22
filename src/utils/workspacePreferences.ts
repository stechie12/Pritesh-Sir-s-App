import type { CurriculumBoard, GradeLevel } from './adaptiveEngine';
import type { PerformanceModeSetting } from './performanceMode';

export type FluentAccentKey = 'cobalt' | 'emerald' | 'amethyst' | 'amber' | 'rose';
export type MicaBackdropKey = 'bloom' | 'aurora' | 'warm-paper' | 'minimal';
export type ReadingDensity = 'comfortable' | 'compact' | 'spacious';

export interface CustomShortcutMap {
  openStudio: string;
  openFormulas: string;
  toggleScratchpad: string;
  toggleZen: string;
}

export interface StudentProfileSlot {
  id: string;
  name: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  dailyGoalSums: number;
  dailyGoalMinutes: number;
}

export interface SavedInsightItem {
  id: string;
  title: string;
  content: string;
  chapter: string;
  createdAt: string;
}

export interface RevisionNoteItem {
  id: string;
  title: string;
  chapter: string;
  body: string;
  updatedAt: string;
}

export interface EscalatedDoubtItem {
  id: string;
  question: string;
  chapter: string;
  noteForTeacher: string;
  status: 'Queued for Pritesh Sir' | 'Reviewed';
  createdAt: string;
}

export interface RecentActivityItem {
  id: string;
  label: string;
  hubTab: string;
  focusKey: string;
  timestamp: number;
}

export interface WorkspacePreferences {
  accent: FluentAccentKey;
  backdrop: MicaBackdropKey;
  zenMode: boolean;
  density: ReadingDensity;
  dyslexiaMode: boolean;
  lowGpuMode: boolean;
  performanceMode: PerformanceModeSetting;
  presentationMode: boolean;
  pipFormulaVisible: boolean;
  pipFormulaText: string;
  splitPaneRatio: number; // 35..65 %
  ttsRate: number; // 0.75..1.5
  ttsAccent: 'en-IN' | 'en-US' | 'en-GB';
  pushToTalkEnabled: boolean;
  streakFreezeTokens: number;
  examDateIso: string;
  shortcuts: CustomShortcutMap;
  activeProfileId: string;
  profiles: StudentProfileSlot[];
}

export const ACCENT_PALETTES: Record<
  FluentAccentKey,
  { label: string; hex: string; softHex: string; unlockRequirement?: string }
> = {
  cobalt: { label: 'Cobalt Blue', hex: '#0078d4', softHex: '#60cdff' },
  emerald: { label: 'Emerald Mint', hex: '#059669', softHex: '#34d399' },
  amethyst: { label: 'Amethyst Violet', hex: '#7c3aed', softHex: '#a78bfa' },
  amber: { label: 'Warm Amber', hex: '#d97706', softHex: '#fbbf24' },
  rose: { label: 'Rose Quartz', hex: '#e11d48', softHex: '#fb7185' },
};

export const DEFAULT_WORKSPACE_PREFS: WorkspacePreferences = {
  accent: 'cobalt',
  backdrop: 'bloom',
  zenMode: false,
  density: 'comfortable',
  dyslexiaMode: false,
  lowGpuMode: false,
  performanceMode: 'auto',
  presentationMode: false,
  pipFormulaVisible: false,
  pipFormulaText: 'Quadratic Formula: x = (−b ± √(b² − 4ac)) / (2a)  ·  sin²θ + cos²θ = 1',
  splitPaneRatio: 50,
  ttsRate: 1.0,
  ttsAccent: 'en-IN',
  pushToTalkEnabled: false,
  streakFreezeTokens: 2,
  examDateIso: new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10),
  shortcuts: {
    openStudio: 'Alt+S',
    openFormulas: 'Alt+F',
    toggleScratchpad: 'Alt+D',
    toggleZen: 'Alt+Z',
  },
  activeProfileId: 'profile_primary',
  profiles: [
    {
      id: 'profile_primary',
      name: 'Shivesh (Std 9 ICSE)',
      grade: '9',
      board: 'ICSE',
      dailyGoalSums: 8,
      dailyGoalMinutes: 30,
    },
    {
      id: 'profile_sibling',
      name: 'Board Prep (Std 10 ICSE)',
      grade: '10',
      board: 'ICSE',
      dailyGoalSums: 12,
      dailyGoalMinutes: 45,
    },
  ],
};

/**
 * Feature #71: Auto-Summarizes a list of chat messages into key bullets & detected formulas.
 */
export function summarizeChatThread(
  messages: Array<{ question: string; chatReply?: string; conceptTitle?: string; finalAnswer?: string }>
): { bullets: string[]; formulas: string[] } {
  if (messages.length === 0) {
    return { bullets: ['No messages in this chat thread yet.'], formulas: [] };
  }
  const bullets = messages.slice(0, 5).map((m, idx) => {
    const q = m.question.trim().slice(0, 75);
    const ans = m.finalAnswer
      ? `Answer: ${m.finalAnswer.slice(0, 60)}`
      : (m.chatReply || m.conceptTitle || 'Explained step-by-step')
          .replace(/\s+/g, ' ')
          .slice(0, 85);
    return `${idx + 1}. ${q} — ${ans}`;
  });

  const formulaSet = new Set<string>();
  const formulaRegex = /(\$\$[^$]+\$\$|\$[^$\n]{3,60}\$|[a-zA-Z0-9²³]+\s*=\s*[^.,;\n]{3,40})/g;
  for (const m of messages) {
    const combined = `${m.chatReply || ''} ${m.finalAnswer || ''}`;
    const matches = combined.match(formulaRegex) || [];
    for (const f of matches) {
      const clean = f.replace(/\$/g, '').trim();
      if (clean.length >= 4 && clean.length <= 60) {
        formulaSet.add(clean);
      }
      if (formulaSet.size >= 6) break;
    }
  }

  return { bullets, formulas: Array.from(formulaSet) };
}

/**
 * Feature #73: Full JSON Study Backup builder & schema validator.
 */
export interface StudyBackupPayload {
  schemaVersion: 1;
  exportedAt: string;
  prefs: WorkspacePreferences;
  notes: RevisionNoteItem[];
  insights: SavedInsightItem[];
  escalations: EscalatedDoubtItem[];
}

export function buildStudyBackupJson(data: Omit<StudyBackupPayload, 'schemaVersion' | 'exportedAt'>): string {
  const payload: StudyBackupPayload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseStudyBackupJson(raw: string): StudyBackupPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StudyBackupPayload>;
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.prefs) return null;
    return {
      schemaVersion: 1,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      prefs: { ...DEFAULT_WORKSPACE_PREFS, ...parsed.prefs },
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      escalations: Array.isArray(parsed.escalations) ? parsed.escalations : [],
    };
  } catch {
    return null;
  }
}

/**
 * Feature #87: Teacher Assignment Code Encoder / Decoder.
 */
export interface TeacherAssignment {
  code: string;
  title: string;
  board: CurriculumBoard;
  grade: GradeLevel;
  chapter: string;
  problemCount: number;
  dueDate: string;
}

export function createTeacherAssignmentCode(input: Omit<TeacherAssignment, 'code'>): TeacherAssignment {
  const b = input.board === 'CBSE' ? 'C' : 'I';
  const slug = input.chapter.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'MATH';
  const dueShort = input.dueDate.replace(/-/g, '').slice(4, 8) || '1231';
  const code = `HW-${b}${input.grade}-${slug}-${input.problemCount}P-${dueShort}`;
  return { ...input, code };
}

/**
 * Feature #90: Build 12-week (84-day) Study Consistency Heatmap cells from attempts.
 */
export function buildConsistencyHeatmap(
  attempts: Array<{ timestamp: string }>,
  today: Date = new Date()
): Array<{ dateKey: string; count: number; level: 0 | 1 | 2 | 3 }> {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    const key = (a.timestamp || '').slice(0, 10);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const cells: Array<{ dateKey: string; count: number; level: 0 | 1 | 2 | 3 }> = [];
  for (let offset = 83; offset >= 0; offset--) {
    const d = new Date(today.getTime() - offset * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const c = counts.get(key) || 0;
    const level: 0 | 1 | 2 | 3 = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : 3;
    cells.push({ dateKey: key, count: c, level });
  }
  return cells;
}
