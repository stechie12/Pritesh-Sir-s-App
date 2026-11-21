export type GradeLevel = '8' | '9' | '10' | '11' | '12';
export type CurriculumBoard = 'ICSE' | 'CBSE';
export type StudyPace = 'Foundation-First' | 'Balanced' | 'Intensive';
export type PlannerFeedbackMode = 'normal' | 'need_more_time' | 'ready_for_harder';

export interface WebSearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ResumeContext {
  originalQuestion: string;
  partialContent: string;
}

export interface TutorResponsePayload {
  responseType: 'chat' | 'math';
  chatReply?: string;
  suggestedPrompts?: string[];
  conceptTitle: string;
  prerequisiteRecap: string;
  steps: string[];
  finalAnswer: string;
  examTip: string;
  webSources?: WebSearchSource[];
}

export interface StudentIntent {
  detectedGrade: GradeLevel;
  detectedBoard: CurriculumBoard;
  summonTool: 'lab' | 'practice' | 'planner' | 'dashboard' | null;
  labMode?: 'mensuration3d' | 'quadratic' | 'trigonometry';
}

export interface ValidatedDoubtRequest {
  question: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  topic: string;
  model: string;
  history: HistoryTurn[];
  enableWebSearch: boolean;
  imageBase64?: string;
  imageMimeType: string;
  resumeContext: ResumeContext | null;
}

export interface ValidatedTtsRequest {
  text: string;
}

export interface ValidatedLessonPlanRequest {
  grade: GradeLevel;
  board: CurriculumBoard;
  weakTopics: string[];
  adaptiveRating: number;
}

export interface ValidatedStudyPlannerRequest {
  grade: GradeLevel;
  board: CurriculumBoard;
  pace: StudyPace;
  weakTopics: string[];
  feedbackMode: PlannerFeedbackMode;
  daysUntilMock: number;
}

export interface LessonPlanModule {
  stage: string;
  topic: string;
  durationMin: number;
  objective: string;
  keyFormula: string;
}

export interface LessonPlanResponse {
  summary: string;
  dailyGoalMinutes: number;
  modules: LessonPlanModule[];
}
