import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../types/database';
import type { LogWithTask } from '../utils/stats';
import { buildDateRange, getCellState } from '../utils/matrix';
import { getLocalDateString } from '../utils/date';

interface Props {
  tasks: Task[];
  logs: LogWithTask[];
}

const CELL_SIZE = 36;
const CELL_GAP = 6;
const ROW_HEIGHT = CELL_SIZE + CELL_GAP;
const LABEL_WIDTH = 120;
const HEADER_HEIGHT = 28;
const HEADER_MARGIN_BOTTOM = 6;

function formatColumnHeader(dateStr: string): { weekday: string; day: string } {
  const date = new Date(`${dateStr}T00:00:00`);
  return {
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(date.getDate()),
  };
}

// Loop Habit Tracker-style grid: habits as frozen rows on the left, days as
// horizontally scrollable columns on the right, docked to "today" by
// default. Used identically by the Student's own History tab and the
// Admin's per-student detail screen.
export default function HabitMatrix({ tasks, logs }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  if (tasks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No habits to show yet.</Text>
      </View>
    );
  }

  const today = getLocalDateString();
  const earliestLogDate = logs.reduce<string | null>((earliest, log) => {
    if (!earliest || log.date < earliest) return log.date;
    return earliest;
  }, null);
  // If there's no history at all yet, just show today as a single column
  // rather than an empty/confusing range.
  const startDate = earliestLogDate && earliestLogDate < today ? earliestLogDate : today;
  const dates = buildDateRange(startDate, today);

  return (
    <View>
      <View style={styles.matrixRow}>
        {/* Frozen label column — does not participate in the horizontal
            scroll below, so habit names stay put while dates scroll. */}
        <View style={styles.labelColumn}>
          <View style={styles.headerSpacer} />
          {tasks.map((task) => (
            <View key={task.id} style={styles.labelCell}>
              <Text style={styles.labelText} numberOfLines={1}>
                {task.title}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Defaults the view to the most recent ~7 days (the rightmost
          // columns), matching "today docked on the right" like Loop.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View style={styles.headerRow}>
              {dates.map((date) => {
                const { weekday, day } = formatColumnHeader(date);
                return (
                  <View key={date} style={styles.headerCell}>
                    <Text style={styles.headerWeekday}>{weekday}</Text>
                    <Text style={styles.headerDay}>{day}</Text>
                  </View>
                );
              })}
            </View>

            {tasks.map((task) => (
              <View key={task.id} style={styles.dataRow}>
                {dates.map((date) => {
                  const state = getCellState(logs, task.id, date);
                  return (
                    <View
                      key={date}
                      style={[
                        styles.cell,
                        state === 'done' && styles.cellDone,
                        state === 'missed' && styles.cellMissed,
                        state === 'none' && styles.cellNone,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellDone]} />
          <Text style={styles.legendText}>Done</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellMissed]} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.cellNone]} />
          <Text style={styles.legendText}>No data</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  matrixRow: { flexDirection: 'row' },
  emptyContainer: { paddingVertical: 24 },
  emptyText: { textAlign: 'center', color: '#999' },
  labelColumn: { width: LABEL_WIDTH },
  headerSpacer: { height: HEADER_HEIGHT + HEADER_MARGIN_BOTTOM },
  labelCell: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingRight: 8,
  },
  labelText: { fontSize: 13, fontWeight: '600', color: '#333' },
  headerRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    marginBottom: HEADER_MARGIN_BOTTOM,
  },
  headerCell: {
    width: CELL_SIZE,
    marginRight: CELL_GAP,
    alignItems: 'center',
  },
  headerWeekday: { fontSize: 10, color: '#999' },
  headerDay: { fontSize: 12, fontWeight: '600', color: '#666' },
  dataRow: { flexDirection: 'row', height: ROW_HEIGHT },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    marginRight: CELL_GAP,
    borderRadius: 6,
  },
  cellDone: { backgroundColor: '#059669' },
  cellMissed: { backgroundColor: '#e5e7eb' },
  cellNone: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f0f0' },
  legend: { flexDirection: 'row', marginTop: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#666' },
});
