import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Global Navigation',
    items: [
      { keys: 'Ctrl / ⌘ + K', description: 'Open Command Palette' },
      { keys: 'S', description: 'Toggle Interactive Simulations Library' },
      { keys: 'F', description: 'Toggle Interactive Formula Reference' },
      { keys: '?', description: 'Show or hide Keyboard Shortcuts' },
      { keys: 'Esc', description: 'Close active drawer or modal' },
    ],
  },
  {
    title: 'Practice Arena',
    items: [
      { keys: '1–4 or A–D', description: 'Select answer option A, B, C, or D' },
      { keys: 'Enter', description: 'Verify selected answer' },
      { keys: 'N', description: 'Jump to next smart problem' },
      { keys: 'B', description: 'Bookmark or unbookmark active sum' },
      { keys: 'H', description: 'Toggle Prerequisite Concept Recap' },
    ],
  },
  {
    title: 'Formula Reference Drawer',
    items: [
      { keys: '/', description: 'Focus formula search input' },
      { keys: 'Esc', description: 'Close formula drawer' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        data-testid="keyboard-shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border fluent-glass-panel overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[75vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {group.title}
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-lg overflow-hidden">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between gap-4 px-3 py-2 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                    <kbd className="font-mono text-[11px] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shrink-0">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
