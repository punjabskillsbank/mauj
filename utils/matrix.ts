import type { Task } from '../types/database';
import type { LogWithTask } from './stats';
import { getLocalDateString } from './date';

export type CellState = 'done' | 'missed' | 'none';

// Inclusive array of "YYYY-MM-DD" strings from startDate through endDate,
// oldest first — this becomes the column order for the matrix (past on the
// left, today on the right, like Loop's own habit rows).
export function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(getLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

// Union of currently-active tasks and every task referenced by a log,
// deduped by id — a brand-new habit with zero logs still gets a row, and a
// since-removed habit with historical data still shows up.
export function getRelevantTasks(activeTasks: Task[], logs: LogWithTask[]): Task[] {
  const byId = new Map<string, Task>();
  for (const task of activeTasks) {
    byId.set(task.id, task);
  }
  for (const log of logs) {
    if (!byId.has(log.task_id)) {
      // The embedded `task` on a log only carries id/title/type (see
      // LogWithTask), which is all the matrix needs to render a row for a
      // task that's no longer active.
      byId.set(log.task_id, { ...log.task, is_active: false, created_at: log.created_at });
    }
  }
  return Array.from(byId.values());
}

export function getCellState(logs: LogWithTask[], taskId: string, date: string): CellState {
  const log = logs.find((l) => l.task_id === taskId && l.date === date);
  if (!log) return 'none';

  // `completed` is already the right signal for both task types — the
  // Today/History save logic sets it to `duration_minutes > 0` for
  // duration tasks at write time, so we don't need to branch on task.type
  // here at all.
  return log.completed ? 'done' : 'missed';
}
