import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import { computeHabitStats, getHabitStartDate } from '../../../utils/habitStats';
import type { LogWithTask } from '../../../utils/stats';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'HabitDetail'>;

export default function HabitDetailScreen({ route }: Props) {
  const { studentId, studentName, taskId, taskType, taskCreatedAt, studentJoinedAt } = route.params;
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    // Scoped to just this student + habit — independent of whatever
    // StudentDetailScreen already has loaded, so this screen works fine
    // even if navigated to directly.
    const { data, error: fetchError } = await supabase
      .from('daily_logs')
      .select('*, task:tasks(id, title, type)')
      .eq('student_id', studentId)
      .eq('task_id', taskId)
      .order('date', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else if (data) {
      setLogs(data as unknown as LogWithTask[]);
    }
    setLoading(false);
  }, [studentId, taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const habitStartDate = getHabitStartDate(taskCreatedAt, studentJoinedAt);
  const stats = computeHabitStats(logs, taskId, taskType, habitStartDate);
  const sinceLabel = new Date(`${stats.habitStartDate}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>for {studentName}</Text>

      <Text style={styles.sectionTitle}>Lifetime</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.completionPercent}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.longestStreak}</Text>
          <Text style={styles.statLabel}>Longest Streak</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {stats.totalCompleted}/{stats.totalDaysSinceStart}
          </Text>
          <Text style={styles.statLabel}>Days Done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, styles.statValueSmall]}>{sinceLabel}</Text>
          <Text style={styles.statLabel}>Since</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Trend</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.last7CompletionPercent}%</Text>
          <Text style={styles.statLabel}>Last 7 Days</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.last30CompletionPercent}%</Text>
          <Text style={styles.statLabel}>Last 30 Days</Text>
        </View>
      </View>

      {taskType === 'duration' ? (
        <>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalMinutes}</Text>
              <Text style={styles.statLabel}>Total Minutes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.avgMinutesPerDay}</Text>
              <Text style={styles.statLabel}>Avg Min/Day</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.bestDayMinutes}</Text>
              <Text style={styles.statLabel}>Best Day</Text>
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  error: { color: '#dc2626', textAlign: 'center', padding: 16 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  emptyText: { color: '#999' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#4f46e5' },
  statValueSmall: { fontSize: 13 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2, textAlign: 'center' },
});
