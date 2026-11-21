import React, { useState } from 'react';
import { Download, Search, RefreshCw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import {
  AttemptEntry,
  ChapterMasteryItem,
  GradeLevel,
  CurriculumBoard,
} from '../utils/adaptiveEngine';
import { ChapterMasteryRadarChart } from './ChapterMasteryRadarChart';

export interface LessonPlanModule {
  stage: string;
  topic: string;
  durationMin: number;
  objective: string;
  keyFormula: string;
}

interface ParentTeacherDashboardProps {
  studentName: string;
  grade: GradeLevel;
  board: CurriculumBoard;
  adaptiveRating: number;
  solvedCount: number;
  overallAccuracy: number;
  streakDays: number;
  chapters: ChapterMasteryItem[];
  weakTopics: string[];
  attempts: AttemptEntry[];
  lessonPlan: {
    summary: string;
    dailyGoalMinutes: number;
    modules: LessonPlanModule[];
  };
  isRefreshingPlan: boolean;
  onRegeneratePlan: () => Promise<void>;
  darkMode?: boolean;
  onFocusWeakTopics?: () => void;
}

export const ParentTeacherDashboard: React.FC<ParentTeacherDashboardProps> = ({
  studentName,
  grade,
  board,
  adaptiveRating,
  solvedCount,
  overallAccuracy,
  streakDays,
  chapters,
  weakTopics,
  attempts,
  lessonPlan,
  isRefreshingPlan,
  onRegeneratePlan,
  darkMode = true,
  onFocusWeakTopics,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Mastered' | 'Developing' | 'Needs Review'>('all');

  const filteredChapters = chapters.filter((item) => {
    const matchesSearch = item.chapter.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.masteryStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const header = 'Chapter,Attempted Sums,Correct Sums,Accuracy %,Mastery Status\n';
    const rows = chapters
      .map(
        (c) =>
          `"${c.chapter.replace(/"/g, '""')}",${c.attempted},${c.correct},${c.accuracyPercent}%,${c.masteryStatus}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Selina_Academy_Report_Class_${grade}_${board}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="parent-dashboard-heading" className="space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 id="parent-dashboard-heading" className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Parent &amp; Academy Sir Mastery Report
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time diagnostic analytics for {studentName} · Standard {grade} ({board}) · Daily Progress &amp; Chapter Retention
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Parent CSV Report</span>
          </button>
        </div>
      </div>

      {/* 4-Column Tabular KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Adaptive Mastery Rating</span>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {adaptiveRating} ELO
          </div>
          <span className="mt-1 block text-xs text-emerald-600 dark:text-emerald-400">
            ● Calibrated to {adaptiveRating >= 1480 ? 'Challenging HOTS' : adaptiveRating >= 1240 ? 'Board Standard' : 'Foundation'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Overall Solution Accuracy</span>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {overallAccuracy}%
          </div>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Across {solvedCount} graded sums
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Active Study Streak</span>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {streakDays} Days
          </div>
          <span className="mt-1 block text-xs text-sky-600 dark:text-sky-400">
            Daily Target: {lessonPlan.dailyGoalMinutes} mins/day
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Priority Focus Chapters</span>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white truncate">
            {weakTopics.join(' · ') || 'All Chapters Nominal'}
          </div>
          <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
            Recommended for next recap drill
          </span>
        </div>
      </div>

      {/* Chapter-Wise Mastery vs. Adaptive Rating Radar Chart */}
      <ChapterMasteryRadarChart
        chapters={chapters}
        adaptiveRating={adaptiveRating}
        grade={grade}
        board={board}
        darkMode={darkMode}
        onFocusWeakTopics={onFocusWeakTopics}
      />

      {/* Personalized Adaptive Lesson Plan Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              AI-Calibrated Daily Lesson Plan ({board} Class {grade})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{lessonPlan.summary}</p>
          </div>
          <button
            type="button"
            disabled={isRefreshingPlan}
            onClick={onRegeneratePlan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPlan ? 'animate-spin' : ''}`} />
            <span>{isRefreshingPlan ? 'Recalibrating Plan...' : 'Recalibrate Lesson Plan'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessonPlan.modules.map((mod, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-sky-700 dark:text-sky-400">{mod.stage}</span>
                <span className="font-mono tabular-nums inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {mod.durationMin} min
                </span>
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{mod.topic}</div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{mod.objective}</p>
              <div className="pt-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                Formula Focus: {mod.keyFormula}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chapter-by-Chapter Mastery Data Grid with Search & Filter */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Chapter-by-Chapter Mastery Matrix
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Filter chapters by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chapter..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(['all', 'Mastered', 'Developing', 'Needs Review'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === status
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {status === 'all' ? 'All Chapters' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-medium">Chapter Name</th>
                <th className="py-2.5 px-3 font-medium text-right">Sums Attempted</th>
                <th className="py-2.5 px-3 font-medium text-right">Correct</th>
                <th className="py-2.5 px-3 font-medium text-right">Accuracy</th>
                <th className="py-2.5 px-3 font-medium">Mastery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredChapters.map((item) => (
                <tr key={item.chapter} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {item.chapter}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {item.attempted}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {item.correct}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {item.attempted > 0 ? `${item.accuracyPercent}%` : '—'}
                  </td>
                  <td className="py-3 px-3">
                    {item.masteryStatus === 'Mastered' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mastered (≥80%)</span>
                      </span>
                    )}
                    {item.masteryStatus === 'Developing' && (
                      <span className="text-sky-700 dark:text-sky-400 font-medium">
                        ● Developing Mastery
                      </span>
                    )}
                    {item.masteryStatus === 'Needs Review' && (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Needs Concept Recap</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Graded Attempts Log */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Recent Daily Practice &amp; Mock Test Log
        </h3>
        {attempts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No sums attempted in this session yet. Solve a problem in the Adaptive Practice Arena to populate real-time telemetry.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {attempts.slice(0, 6).map((att) => (
              <div key={att.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{att.chapter}</span>
                  <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Class {att.grade} {att.board} · {att.difficulty}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono tabular-nums shrink-0">
                  <span className="text-slate-500 dark:text-slate-400">{att.timeSpentSec}s</span>
                  <span
                    className={
                      att.isCorrect
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    {att.isCorrect ? `✓ Correct (+${att.ratingDelta} ELO)` : `✗ Review (${att.ratingDelta} ELO)`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
