import React, { useState } from 'react';
import { Award, Trophy, CheckCircle2, Lock, Flame } from 'lucide-react';
import {
  GamificationBadge,
  LeaderboardStudent,
  GradeLevel,
} from '../utils/adaptiveEngine';

interface GamificationHubProps {
  totalXp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  levelProgressPercent: number;
  streakDays: number;
  currentGrade: GradeLevel;
  badges: GamificationBadge[];
  leaderboard: LeaderboardStudent[];
}

export const GamificationHub: React.FC<GamificationHubProps> = ({
  totalXp,
  level,
  currentLevelXp,
  nextLevelXp,
  levelProgressPercent,
  streakDays,
  currentGrade,
  badges,
  leaderboard,
}) => {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'same_grade'>('all');

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const visibleLeaderboard =
    scopeFilter === 'all'
      ? leaderboard
      : leaderboard.filter((s) => s.grade === currentGrade);

  const currentUserRank =
    leaderboard.findIndex((s) => s.isCurrentUser) + 1;

  return (
    <section aria-labelledby="gamification-heading" className="space-y-6">
      {/* Level, XP & Streak Hero Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>Academy Mastery League</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>Rank #{currentUserRank} Overall</span>
            </div>
            <h2 id="gamification-heading" className="text-xl font-bold text-slate-900 dark:text-white">
              Level {level} Scholar · <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">{totalXp} XP</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Solve adaptive Selina sums, complete scheduled study sessions, and master 3D spatial labs to unlock milestone badges.
            </p>
          </div>

          {/* Level XP Progress Bar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Progress to Level {level + 1}
              </span>
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {currentLevelXp} / {nextLevelXp} XP ({levelProgressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-600 transition-all duration-300"
                style={{ width: `${levelProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Milestone Tally */}
          <div className="lg:col-span-3 flex items-center justify-end gap-4 font-mono tabular-nums">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 text-center">
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1">
                <Award className="w-4 h-4 text-amber-500" />
                <span>{unlockedCount}/{badges.length}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Badges</span>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 text-center">
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>{streakDays}d</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Streak</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Split: Milestone Badges (7 cols) + Academy Leaderboard (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Milestone Badges Grid */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Curriculum Milestone Badges
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Earned automatically as your accuracy, ELO rating, and chapter mastery grow
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
              {unlockedCount} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-lg border p-4 space-y-2.5 transition-colors ${
                  badge.unlocked
                    ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {badge.unlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {badge.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-sky-600 dark:text-sky-400 font-semibold">
                    +{badge.xpReward} XP
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {badge.description}
                </p>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{badge.unlocked ? '● UNLOCKED' : 'In Progress'}</span>
                    <span>{badge.criteriaText}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        badge.unlocked ? 'bg-emerald-600' : 'bg-sky-600'
                      }`}
                      style={{ width: `${badge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Academy Friendly Competition Leaderboard */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Academy Leaderboard
              </h3>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scopeFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All Standards
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('same_grade')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  scopeFilter === 'same_grade'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Std {currentGrade} Only
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleLeaderboard.map((student, index) => (
              <div
                key={student.id}
                className={`py-3 px-3 rounded-lg flex items-center justify-between gap-3 ${
                  student.isCurrentUser
                    ? 'bg-sky-50/90 dark:bg-sky-950/40 border border-sky-500/30'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-xs font-mono tabular-nums font-bold text-slate-500 dark:text-slate-400">
                    #{index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {student.name} {student.isCurrentUser ? '(You)' : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Std {student.grade} {student.board} · {student.badgesCount} Badges · {student.streakDays}d Streak
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs sm:text-sm font-bold text-sky-600 dark:text-sky-400">
                    {student.xp} XP
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {student.adaptiveRating} ELO
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
