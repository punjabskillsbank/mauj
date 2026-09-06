import type { DailyLog, Task } from '../types/database';

export interface LogWithTask extends DailyLog {
  task: Pick<Task, 'id' | 'title' | 'type'>;
}

export interface DateGroup {
  date: string;
  entries: LogWithTask[];
}

// Groups a flat list of logs (in any order) into one entry per calendar
// date, sorted most-recent-first — computeCompletionStats() below walks
// this shape to compute the current streak.
export function groupLogsByDate(logs: LogWithTask[]): DateGroup[] {
  const byDate = new Map<string, LogWithTask[]>();
  for (const log of logs) {
    const existing = byDate.get(log.date);
    if (existing) {
      existing.push(log);
    } else {
      byDate.set(log.date, [log]);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface CompletionStats {
  completionPercent: number;
  daysActive: number;
  currentStreak: number;
}

// Difference in whole calendar days between two "YYYY-MM-DD" strings.
// Exported so other date-diffing helpers (e.g. utils/habitStats.ts) don't
// have to duplicate this logic.
export function daysBetween(laterDate: string, earlierDate: string): number {
  const later = new Date(`${laterDate}T00:00:00`);
  const earlier = new Date(`${earlierDate}T00:00:00`);
  return Math.round((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCompletionStats(logs: LogWithTask[]): CompletionStats {
  if (logs.length === 0) {
    return { completionPercent: 0, daysActive: 0, currentStreak: 0 };
  }

  // Based on entries the student actually interacted with — we don't
  // synthesize "missed" rows for tasks that were simply never touched,
  // since no row exists for those at all.
  const completedCount = logs.filter((log) => log.completed).length;
  const completionPercent = Math.round((completedCount / logs.length) * 100);

  const dateGroups = groupLogsByDate(logs); // already sorted most-recent-first
  const daysActive = dateGroups.length;

  // Walk backward from the most recent active day. Each day counts toward
  // the streak only if it (a) has at least one completed log, and (b) is
  // exactly one calendar day before the previous day counted — a calendar
  // gap of any size breaks the streak.
  let currentStreak = 0;
  let previousDate: string | null = null;
  for (const group of dateGroups) {
    const hasCompleted = group.entries.some((entry) => entry.completed);
    if (!hasCompleted) break;
    if (previousDate !== null && daysBetween(previousDate, group.date) !== 1) break;
    currentStreak += 1;
    previousDate = group.date;
  }

  return { completionPercent, daysActive, currentStreak };
}
