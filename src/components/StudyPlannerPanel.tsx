import React, { useState } from 'react';
import {
  Calendar,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  CurriculumBoard,
  GradeLevel,
  StudySessionTask,
} from '../utils/adaptiveEngine';

interface StudyPlannerPanelProps {
  grade: GradeLevel;
  board: CurriculumBoard;
  adaptiveRating: number;
  weakTopics: string[];
  pace: 'Foundation-First' | 'Balanced' | 'Intensive';
  feedbackMode: 'normal' | 'need_more_time' | 'ready_for_harder';
  daysUntilMock: number;
  tasks: StudySessionTask[];
  onChangePace: (pace: 'Foundation-First' | 'Balanced' | 'Intensive') => void;
  onChangeFeedbackMode: (mode: 'normal' | 'need_more_time' | 'ready_for_harder') => void;
  onChangeDaysUntilMock: (days: number) => void;
  onToggleTaskComplete: (taskId: string) => void;
  onToggleTaskReminder: (taskId: string) => void;
  onAddCustomTask: (task: StudySessionTask) => void;
}

export const StudyPlannerPanel: React.FC<StudyPlannerPanelProps> = ({
  grade,
  board,
  adaptiveRating,
  weakTopics,
  pace,
  feedbackMode,
  daysUntilMock,
  tasks,
  onChangePace,
  onChangeFeedbackMode,
  onChangeDaysUntilMock,
  onToggleTaskComplete,
  onToggleTaskReminder,
  onAddCustomTask,
}) => {
  const [aiCoachNote, setAiCoachNote] = useState<string>(
    `Dynamic schedule calibrated for Standard ${grade} (${board}) · Prioritizing ${
      weakTopics[0] || 'Trigonometry & Algebra'
    } before your upcoming mock assessment in ${daysUntilMock} days.`
  );
  const [isSyncingAI, setIsSyncingAI] = useState(false);

  // Custom task / deadline form state
  const [customTitle, setCustomTitle] = useState('');
  const [customChapter, setCustomChapter] = useState('Ch 5 · Quadratic Equations');
  const [customDeadline, setCustomDeadline] = useState('Due Tomorrow · 07:00 PM');
  const [customDuration, setCustomDuration] = useState(30);
  const [formError, setFormError] = useState<string | null>(null);

  const handleRecalibrateWithAI = async (
    nextPace = pace,
    nextFeedback = feedbackMode,
    nextDays = daysUntilMock
  ) => {
    setIsSyncingAI(true);
    try {
      const res = await fetch('/api/tutor/study-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          board,
          pace: nextPace,
          weakTopics,
          feedbackMode: nextFeedback,
          daysUntilMock: nextDays,
        }),
      });
      const data = await res.json();
      if (data.aiCoachNote) {
        setAiCoachNote(data.aiCoachNote);
      }
    } catch {
      setAiCoachNote(
        `Adaptive schedule updated for Standard ${grade} (${board}) (${nextPace} pace · ${nextDays} days to mock test).`
      );
    } finally {
      setIsSyncingAI(false);
    }
  };

  const handleAddDeadlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTitle.trim();
    if (!trimmed) {
      setFormError('Please enter a study session or assignment title before adding.');
      return;
    }
    setFormError(null);

    const newTask: StudySessionTask = {
      id: `custom_task_${Date.now()}`,
      dayLabel: 'Custom Scheduled Slot',
      timeSlot: '06:15 PM – 06:45 PM',
      title: trimmed,
      chapter: customChapter,
      type: 'Selina Drill',
      durationMin: Number(customDuration) || 30,
      deadlineLabel: customDeadline.trim() || 'Due Tomorrow',
      reminderActive: true,
      completed: false,
      xpValue: 50,
    };

    onAddCustomTask(newTask);
    setCustomTitle('');
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const activeRemindersCount = tasks.filter((t) => t.reminderActive && !t.completed).length;

  return (
    <section aria-labelledby="study-planner-heading" className="space-y-6">
      {/* Header & AI Recalibration Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 id="study-planner-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            AI-Powered Dynamic Study Planner &amp; Intelligent Reminders
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Automatically adapts session duration, prerequisite recaps, and mock test prep to your real-time accuracy ({adaptiveRating} ELO).
          </p>
        </div>

        <button
          type="button"
          disabled={isSyncingAI}
          onClick={() => handleRecalibrateWithAI(pace, feedbackMode, daysUntilMock)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAI ? 'animate-spin' : ''}`} />
          <span>{isSyncingAI ? 'Adapting Schedule...' : 'AI Recalibrate Schedule'}</span>
        </button>
      </div>

      {/* Top Adaptive Pace, Mock Countdown & Student Feedback Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Sliders className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Real-Time Pace &amp; Student Feedback Adaptation</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {completedCount}/{tasks.length} Sessions Completed · {activeRemindersCount} Active Reminders
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Learning Pace Selector */}
            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Learning Pace Profile
              </span>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['Foundation-First', 'Balanced', 'Intensive'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChangePace(p);
                      handleRecalibrateWithAI(p, feedbackMode, daysUntilMock);
                    }}
                    className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      pace === p
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming Mock Test Countdown Slider */}
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                <label htmlFor="mock-countdown-slider">Upcoming Mock Test Window</label>
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                  In {daysUntilMock} Days
                </span>
              </div>
              <input
                id="mock-countdown-slider"
                type="range"
                min={1}
                max={14}
                value={daysUntilMock}
                onChange={(e) => onChangeDaysUntilMock(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>
          </div>

          {/* Student Real-Time Feedback Triggers */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              How does today’s workload feel? (Adapts session durations &amp; difficulty immediately)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onChangeFeedbackMode('need_more_time');
                  handleRecalibrateWithAI(pace, 'need_more_time', daysUntilMock);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  feedbackMode === 'need_more_time'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Need More Prerequisite Time (+10m/session)
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeFeedbackMode('normal');
                  handleRecalibrateWithAI(pace, 'normal', daysUntilMock);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  feedbackMode === 'normal'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Pace is Optimal
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeFeedbackMode('ready_for_harder');
                  handleRecalibrateWithAI(pace, 'ready_for_harder', daysUntilMock);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  feedbackMode === 'ready_for_harder'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Ready for Challenging Board HOTS
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 p-3.5 text-xs text-slate-700 dark:text-slate-300">
            <strong className="text-sky-700 dark:text-sky-400">Sir’s AI Planner Note: </strong>
            {aiCoachNote}
          </div>
        </div>

        {/* Add Custom Assignment / Reminder Form */}
        <form
          onSubmit={handleAddDeadlineSubmit}
          className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3.5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Schedule Assignment or Reminder</span>
            </div>

            <div>
              <label htmlFor="custom-task-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assignment / Revision Goal
              </label>
              <input
                id="custom-task-title"
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g., Complete Selina Ex 22(B) Q.1–10"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="custom-task-deadline" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reminder Window
                </label>
                <input
                  id="custom-task-deadline"
                  type="text"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="custom-task-duration" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration (min)
                </label>
                <input
                  id="custom-task-duration"
                  type="number"
                  min={10}
                  max={120}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="custom-task-chapter" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Chapter
              </label>
              <select
                id="custom-task-chapter"
                value={customChapter}
                onChange={(e) => setCustomChapter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Ch 5 · Quadratic Equations">Ch 5 · Quadratic Equations</option>
                <option value="Ch 1 · Goods and Services Tax (GST)">Ch 1 · Goods and Services Tax (GST)</option>
                <option value="Ch 21 · Trigonometrical Identities">Ch 21 · Trigonometrical Identities</option>
                <option value="Ch 22 · Heights and Distances">Ch 22 · Heights and Distances</option>
                <option value="Ch 20 · Cylinder, Cone and Sphere">Ch 20 · Cylinder, Cone and Sphere</option>
              </select>
            </div>

            {formError && <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scheduled Session (+50 XP)</span>
          </button>
        </form>
      </div>

      {/* Dynamic Study Timeline & Intelligent Reminder Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-xl border p-5 transition-colors flex flex-col justify-between gap-4 ${
              task.completed
                ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {task.dayLabel} · <span className="font-mono tabular-nums">{task.timeSlot}</span>
                </span>
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                  +{task.xpValue} XP
                </span>
              </div>

              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {task.title}
              </h3>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span>{task.chapter}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>{task.type}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span className="font-mono tabular-nums inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {task.durationMin} mins
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {task.deadlineLabel}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleTaskReminder(task.id)}
                  aria-label={`Toggle reminder for ${task.title}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    task.reminderActive
                      ? 'border-sky-500/30 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {task.reminderActive ? (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>Reminder On</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-3.5 h-3.5" />
                      <span>Muted</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleTaskComplete(task.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    task.completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{task.completed ? 'Completed' : 'Mark Complete'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
