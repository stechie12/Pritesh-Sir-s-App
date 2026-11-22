import type { TutorMessage } from '../components/DoubtTutorPanel';
import type { GradeLevel, CurriculumBoard } from './adaptiveEngine';
import { readVersionedStorage, writeVersionedStorage } from './storageSafety';
import { parseAiVisualizerDirective, sanitizeVisualizerSpec } from './visualizerDetector';

export interface ChatThread {
  id: string;
  title: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  /** Stored newest-first to match DoubtTutorPanel's `messages` convention */
  messages: TutorMessage[];
}

export interface CloudDoubtSummary {
  id: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  topic: string;
  question: string;
  answer: string;
  createdAtMs: number;
}

export const CHAT_HISTORY_STORAGE_KEY = 'psma_chat_threads';
export const CHAT_HISTORY_STORAGE_VERSION = 1;
export const ACTIVE_THREAD_STORAGE_KEY = 'psma_active_chat_thread_id';
export const MAX_STORED_THREADS = 40;
export const MAX_MESSAGES_PER_THREAD = 50;

export function deriveThreadTitle(question: string): string {
  const cleaned = question
    .replace(/\s+/g, ' ')
    .replace(/[#*_`]/g, '')
    .trim();
  if (!cleaned) return 'Untitled Math Chat';
  if (cleaned.length <= 54) return cleaned;
  return `${cleaned.slice(0, 51).trimEnd()}...`;
}

export function createChatThread(
  grade: GradeLevel,
  board: CurriculumBoard,
  firstMessage?: TutorMessage,
  now = Date.now()
): ChatThread {
  const id = `chat_${now}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    title: firstMessage ? deriveThreadTitle(firstMessage.question) : 'New Math Chat',
    grade,
    board,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    messages: firstMessage ? [firstMessage] : [],
  };
}

export function upsertMessageInThreads(
  threads: ChatThread[],
  activeThreadId: string | null,
  msg: TutorMessage,
  grade: GradeLevel,
  board: CurriculumBoard,
  now = Date.now()
): { threads: ChatThread[]; activeThreadId: string } {
  const existing = activeThreadId
    ? threads.find((t) => t.id === activeThreadId)
    : undefined;

  if (!existing) {
    const created = createChatThread(grade, board, msg, now);
    const nextThreads = [created, ...threads].slice(0, MAX_STORED_THREADS);
    return { threads: nextThreads, activeThreadId: created.id };
  }

  const nextMessages = [msg, ...existing.messages].slice(0, MAX_MESSAGES_PER_THREAD);
  const shouldSetTitle =
    existing.messages.length === 0 || existing.title === 'New Math Chat' || existing.title === 'Untitled Math Chat';

  const updated: ChatThread = {
    ...existing,
    title: shouldSetTitle ? deriveThreadTitle(msg.question) : existing.title,
    grade,
    board,
    updatedAt: now,
    messages: nextMessages,
  };

  const nextThreads = [
    updated,
    ...threads.filter((t) => t.id !== existing.id),
  ].slice(0, MAX_STORED_THREADS);

  return { threads: nextThreads, activeThreadId: existing.id };
}

export function updateMessageInThreads(
  threads: ChatThread[],
  activeThreadId: string | null,
  messageId: string,
  updater: (prev: TutorMessage) => TutorMessage,
  now = Date.now()
): ChatThread[] {
  return threads.map((thread) => {
    if (activeThreadId && thread.id !== activeThreadId) {
      // Fallback: check if message exists in another thread only if activeThreadId didn't match
      if (!thread.messages.some((m) => m.id === messageId)) return thread;
    }
    let changed = false;
    const nextMessages = thread.messages.map((m) => {
      if (m.id === messageId) {
        changed = true;
        return updater(m);
      }
      return m;
    });
    if (!changed) return thread;
    return {
      ...thread,
      updatedAt: now,
      messages: nextMessages,
    };
  });
}

export function deleteThreadById(
  threads: ChatThread[],
  threadId: string,
  activeThreadId: string | null
): { threads: ChatThread[]; activeThreadId: string | null } {
  const nextThreads = threads.filter((t) => t.id !== threadId);
  const nextActive = activeThreadId === threadId ? null : activeThreadId;
  return { threads: nextThreads, activeThreadId: nextActive };
}

export function renameThreadById(
  threads: ChatThread[],
  threadId: string,
  newTitle: string,
  now = Date.now()
): ChatThread[] {
  const trimmed = newTitle.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!trimmed) return threads;
  return threads.map((t) =>
    t.id === threadId ? { ...t, title: trimmed, updatedAt: now } : t
  );
}

export function togglePinThreadById(
  threads: ChatThread[],
  threadId: string
): ChatThread[] {
  return threads.map((t) =>
    t.id === threadId ? { ...t, pinned: !t.pinned } : t
  );
}

export function searchAndSortThreads(
  threads: ChatThread[],
  query: string
): ChatThread[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? threads.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (`std ${t.grade} ${t.board}`.toLowerCase().includes(q)) return true;
        return t.messages.some((m) =>
          `${m.question} ${m.conceptTitle} ${m.chatReply || ''} ${m.finalAnswer}`
            .toLowerCase()
            .includes(q)
        );
      })
    : threads;

  return [...filtered].sort((a, b) => {
    const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinDiff !== 0) return pinDiff;
    return b.updatedAt - a.updatedAt;
  });
}

export function formatRelativeThreadTime(timestampMs: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const d = new Date(timestampMs);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sanitizeMessageForStorage(msg: TutorMessage): TutorMessage {
  const parsedReply = msg.chatReply ? parseAiVisualizerDirective(msg.chatReply) : null;
  const cleanSpec = sanitizeVisualizerSpec(msg.visualizerSpec) ?? parsedReply?.spec ?? null;
  return {
    ...msg,
    question: (msg.question || '').slice(0, 2000),
    chatReply: parsedReply ? parsedReply.cleanText.slice(0, 12000) : undefined,
    visualizerSpec: cleanSpec,
    prerequisiteRecap: (msg.prerequisiteRecap || '').slice(0, 1000),
    steps: Array.isArray(msg.steps)
      ? msg.steps.slice(0, 20).map((s) => String(s).slice(0, 1500))
      : [],
    finalAnswer: (msg.finalAnswer || '').slice(0, 1200),
    examTip: (msg.examTip || '').slice(0, 800),
    thoughtText:
      typeof msg.thoughtText === 'string' && msg.thoughtText.trim()
        ? msg.thoughtText.slice(0, 8000)
        : undefined,
    thinkingTrace: Array.isArray(msg.thinkingTrace)
      ? msg.thinkingTrace.slice(0, 10).map((s) => String(s).slice(0, 300))
      : undefined,
  };
}

export function sanitizeThreadsForStorage(threads: ChatThread[]): ChatThread[] {
  return threads
    .filter((t) => t && typeof t.id === 'string' && Array.isArray(t.messages) && t.messages.length > 0)
    .slice(0, MAX_STORED_THREADS)
    .map((t) => ({
      id: t.id,
      title: String(t.title || 'Untitled Math Chat').slice(0, 80),
      grade: t.grade,
      board: t.board,
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || Date.now(),
      pinned: Boolean(t.pinned),
      messages: t.messages.slice(0, MAX_MESSAGES_PER_THREAD).map(sanitizeMessageForStorage),
    }));
}

export function loadStoredChatThreads(): ChatThread[] {
  const raw = readVersionedStorage<ChatThread[]>(
    CHAT_HISTORY_STORAGE_KEY,
    CHAT_HISTORY_STORAGE_VERSION,
    []
  );
  if (!Array.isArray(raw)) return [];
  return sanitizeThreadsForStorage(raw);
}

export function persistChatThreads(threads: ChatThread[]): boolean {
  const sanitized = sanitizeThreadsForStorage(threads);
  // Try full save first; if quota exceeded, progressively trim oldest threads
  if (writeVersionedStorage(CHAT_HISTORY_STORAGE_KEY, CHAT_HISTORY_STORAGE_VERSION, sanitized)) {
    return true;
  }
  const trimmed = sanitized.slice(0, Math.max(5, Math.floor(sanitized.length / 2)));
  return writeVersionedStorage(CHAT_HISTORY_STORAGE_KEY, CHAT_HISTORY_STORAGE_VERSION, trimmed);
}

export function mergeCloudDoubtsIntoThreads(
  localThreads: ChatThread[],
  cloudDoubts: CloudDoubtSummary[]
): ChatThread[] {
  if (!cloudDoubts.length) return localThreads;

  const existingMsgIds = new Set<string>();
  for (const t of localThreads) {
    for (const m of t.messages) {
      existingMsgIds.add(m.id);
    }
  }

  const additions: ChatThread[] = [];
  for (const doubt of cloudDoubts) {
    if (existingMsgIds.has(doubt.id)) continue;
    const msg: TutorMessage = {
      id: doubt.id,
      question: doubt.question,
      responseType: 'chat',
      chatReply: doubt.answer,
      conceptTitle: doubt.topic || `${doubt.board} Grade ${doubt.grade} Saved Doubt`,
      prerequisiteRecap: '',
      steps: [],
      finalAnswer: '',
      examTip: '',
      timestamp: new Date(doubt.createdAtMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      savedToCloud: true,
    };
    additions.push({
      id: `cloud_${doubt.id}`,
      title: deriveThreadTitle(doubt.question),
      grade: doubt.grade,
      board: doubt.board,
      createdAt: doubt.createdAtMs,
      updatedAt: doubt.createdAtMs,
      pinned: false,
      messages: [msg],
    });
  }

  if (additions.length === 0) return localThreads;
  return searchAndSortThreads([...localThreads, ...additions], '').slice(0, MAX_STORED_THREADS);
}
