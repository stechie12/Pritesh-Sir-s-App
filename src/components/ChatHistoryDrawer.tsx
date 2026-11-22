import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  History,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ChatThread,
  formatRelativeThreadTime,
  searchAndSortThreads,
} from '../utils/chatHistory';

export interface ChatHistoryDrawerProps {
  isOpen: boolean;
  threads: ChatThread[];
  activeThreadId: string | null;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread: (threadId: string, nextTitle: string) => void;
  onTogglePinThread: (threadId: string) => void;
  onClearAllThreads: () => void;
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  isOpen,
  threads,
  activeThreadId,
  onClose,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onRenameThread,
  onTogglePinThread,
  onClearAllThreads,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<'all' | 'pinned' | 'Midterm' | 'Doubt for Sir' | 'Hard'>('all');
  const [threadTags, setThreadTags] = useState<Record<string, string>>(() => {
    try {
      const raw = window.localStorage.getItem('selina_chat_tags_v1');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const cycleThreadTag = (threadId: string) => {
    const order = ['', 'Midterm', 'Doubt for Sir', 'Hard'];
    const current = threadTags[threadId] || '';
    const next = order[(order.indexOf(current) + 1) % order.length];
    const updated = { ...threadTags };
    if (next) updated[threadId] = next;
    else delete updated[threadId];
    setThreadTags(updated);
    try {
      window.localStorage.setItem('selina_chat_tags_v1', JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setConfirmClearAll(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, editingId, onClose]);

  const visibleThreads = useMemo(() => {
    const base = searchAndSortThreads(threads, searchQuery);
    if (activeFolder === 'all') return base;
    if (activeFolder === 'pinned') return base.filter((t) => t.pinned);
    return base.filter((t) => threadTags[t.id] === activeFolder);
  }, [threads, searchQuery, activeFolder, threadTags]);

  if (!isOpen) return null;

  const commitRename = (threadId: string) => {
    const trimmed = editDraft.trim();
    if (trimmed) {
      onRenameThread(threadId, trimmed);
    }
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-md"
      onClick={onClose}
      data-testid="chat-history-backdrop"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Chat History"
        data-testid="chat-history-drawer"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm h-full fluent-glass-panel border-r flex flex-col min-w-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-slate-200/70 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-sky-500 shrink-0" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate font-display">
              Chat History
            </h2>
            <span className="text-xs text-slate-400" aria-hidden="true">·</span>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {threads.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat history"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat + Search */}
        <div className="p-3 space-y-2.5 border-b border-slate-200/70 dark:border-white/10 shrink-0">
          <button
            type="button"
            data-testid="history-new-chat-btn"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl fluent-primary-btn text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              name="chat-history-search-no-autofill"
              autoComplete="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past chats..."
              aria-label="Search past chats"
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.05] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* #66 Chat Folder / Tag Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(['all', 'pinned', 'Midterm', 'Doubt for Sir', 'Hard'] as const).map((folder) => (
              <button
                key={folder}
                type="button"
                onClick={() => setActiveFolder(folder)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeFolder === folder
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/10'
                }`}
              >
                {folder === 'all' ? 'All' : folder === 'pinned' ? 'Pinned' : folder}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {visibleThreads.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <MessageSquare className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {searchQuery.trim() ? 'No matching conversations' : 'No saved chats yet'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {searchQuery.trim()
                  ? 'Try searching for a different topic, formula, or standard.'
                  : 'Your conversations with Pritesh Sir are automatically saved here so you can revisit them anytime.'}
              </p>
            </div>
          ) : (
            visibleThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              const isEditing = editingId === thread.id;
              const turnCount = thread.messages.length;

              return (
                <div
                  key={thread.id}
                  data-testid="chat-history-item"
                  className={`group rounded-xl border transition-colors ${
                    isActive
                      ? 'border-sky-500/40 bg-sky-500/12 dark:bg-sky-500/15'
                      : 'border-transparent hover:bg-white/65 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {isEditing ? (
                    <div className="p-2.5 flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(thread.id);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        aria-label={`Rename chat ${thread.title}`}
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-sky-500 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(thread.id)}
                        aria-label="Save chat title"
                        className="p-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel rename"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-1 p-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectThread(thread.id);
                          onClose();
                        }}
                        className="flex-1 min-w-0 text-left space-y-1 focus:outline-none"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {thread.pinned && (
                            <Pin className="w-3 h-3 text-amber-500 shrink-0" aria-label="Pinned" />
                          )}
                          <span
                            className={`text-xs font-medium truncate ${
                              isActive
                                ? 'text-sky-700 dark:text-sky-300'
                                : 'text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            {thread.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums flex-wrap">
                          <span>
                            {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Std {thread.grade} {thread.board}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeThreadTime(thread.updatedAt)}</span>
                          {threadTags[thread.id] && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-sky-600 dark:text-sky-400 font-sans font-medium">
                                {threadTags[thread.id]}
                              </span>
                            </>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => cycleThreadTag(thread.id)}
                          aria-label={`Tag chat "${thread.title}"`}
                          title={threadTags[thread.id] ? `Tag: ${threadTags[thread.id]} (click to cycle)` : 'Add folder tag'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            threadTags[thread.id]
                              ? 'text-sky-500 hover:bg-sky-500/10'
                              : 'text-slate-400 hover:text-sky-500 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePinThread(thread.id)}
                          aria-label={thread.pinned ? `Unpin chat "${thread.title}"` : `Pin chat "${thread.title}"`}
                          title={thread.pinned ? 'Unpin chat' : 'Pin chat'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            thread.pinned
                              ? 'text-amber-500 hover:bg-amber-500/10'
                              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(thread.id);
                            setEditDraft(thread.title);
                          }}
                          aria-label={`Rename chat "${thread.title}"`}
                          title="Rename chat"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteThread(thread.id)}
                          aria-label={`Delete chat "${thread.title}"`}
                          title="Delete chat"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {threads.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
            {confirmClearAll ? (
              <>
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  Clear all {threads.length} chats?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllThreads();
                      setConfirmClearAll(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Saved locally &amp; synced on sign-in
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="text-[11px] text-slate-500 hover:text-rose-500 transition-colors"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
