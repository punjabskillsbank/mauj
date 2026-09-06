import type { TaskType } from '../types/database';
import { daysBetween, type LogWithTask } from './stats';
import { getLocalDateString } from './date';

export interface HabitStats {
  habitStartDate: string;
  totalDaysSinceStart: number;
  totalCompleted: number;
  completionPercent: number;
  currentStreak: number;
  longestStreak: number;
  last7CompletionPercent: number;
  last30CompletionPercent: number;
  // Duration-only extras — undefined for boolean habits.
  totalMinutes?: number;
  avgMinutesPerDay?: number;
  bestDayMinutes?: number;
}

// The first day a habit could actually have been logged by this student —
// whichever came later: the admin creating the task, or the student
// joining. Everything before this date is out of scope for "since day
// one" stats (the habit simply didn't exist for this student yet).
export function getHabitStartDate(taskCreatedAt: string, studentJoinedAt: string): string {
  const taskDate = getLocalDateString(new Date(taskCreatedAt));
  const joinedDate = getLocalDateString(new Date(studentJoinedAt));
  return taskDate > joinedDate ? taskDate : joinedDate;
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() - days);
  return getLocalDateString(date);
}

// Percent of days completed within [windowStart, today] out of the total
// calendar days in that window — a missing log counts against the
// student, matching the app's binary done/missed model.
function windowCompletionPercent(habitLogs: LogWithTask[], windowStart: string, today: string): number {
  const totalDays = daysBetween(today, windowStart) + 1;
  if (totalDays <= 0) return 0;
  const completedInWindow = habitLogs.filter(
    (log) => log.completed && log.date >= windowStart && log.date <= today
  ).length;
  return Math.round((completedInWindow / totalDays) * 100);
}

// Computes every stat shown on the per-habit detail screen (and the
// habit-comparison chart) for one student + habit combination. `logs` may
// contain entries for other tasks too — this filters down to `taskId`
// internally so callers can simply pass whatever they already fetched.
export function computeHabitStats(
  logs: LogWithTask[],
  taskId: string,
  taskType: TaskType,
  habitStartDate: string
): HabitStats {
  const habitLogs = logs.filter((log) => log.task_id === taskId);
  const today = getLocalDateString();

  // +1 because both endpoints are inclusive (e.g. starting and ending on
  // the same day is 1 day, not 0).
  const totalDaysSinceStart = Math.max(daysBetween(today, habitStartDate) + 1, 1);
  const totalCompleted = habitLogs.filter((log) => log.completed).length;
  const completionPercent = Math.round((totalCompleted / totalDaysSinceStart) * 100);

  const last7WindowStart = maxDateString(habitStartDate, subtractDays(today, 6));
  const last30WindowStart = maxDateString(habitStartDate, subtractDays(today, 29));
  const last7CompletionPercent = windowCompletionPercent(habitLogs, last7WindowStart, today);
  const last30CompletionPercent = windowCompletionPercent(habitLogs, last30WindowStart, today);

  // Longest streak: walk forward through logged rows (oldest first),
  // growing a run while each log is completed and exactly 1 calendar day
  // after the previous one counted; any gap (missing day) or an explicit
  // miss resets the run. A missing day already breaks this the same way a
  // miss does, since the date gap won't be exactly 1.
  const ascending = [...habitLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  let longestStreak = 0;
  let runLength = 0;
  let previousRunDate: string | null = null;
  for (const log of ascending) {
    if (!log.completed) {
      runLength = 0;
      previousRunDate = null;
      continue;
    }
    if (previousRunDate !== null && daysBetween(log.date, previousRunDate) === 1) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    previousRunDate = log.date;
    longestStreak = Math.max(longestStreak, runLength);
  }

  // Current streak: walk backward from the most recent logged day, same
  // "any gap breaks it" rule.
  const descending = [...ascending].reverse();
  let currentStreak = 0;
  let previousDate: string | null = null;
  for (const log of descending) {
    if (!log.completed) break;
    if (previousDate !== null && daysBetween(previousDate, log.date) !== 1) break;
    currentStreak += 1;
    previousDate = log.date;
  }

  const stats: HabitStats = {
    habitStartDate,
    totalDaysSinceStart,
    totalCompleted,
    completionPercent,
    currentStreak,
    longestStreak,
    last7CompletionPercent,
    last30CompletionPercent,
  };

  if (taskType === 'duration') {
    const minutesLogged = habitLogs.map((log) => log.duration_minutes ?? 0);
    const totalMinutes = minutesLogged.reduce((sum, minutes) => sum + minutes, 0);
    stats.totalMinutes = totalMinutes;
    stats.avgMinutesPerDay = Math.round(totalMinutes / totalDaysSinceStart);
    stats.bestDayMinutes = minutesLogged.length > 0 ? Math.max(...minutesLogged) : 0;
  }

  return stats;
}

function maxDateString(a: string, b: string): string {
  return a > b ? a : b;
}
