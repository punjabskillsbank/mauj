import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart } from 'react-native-gifted-charts';
import { supabase } from '../../../lib/supabase';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import type { Profile, Task } from '../../../types/database';
import type { LogWithTask } from '../../../utils/stats';
import { getRelevantTasks } from '../../../utils/matrix';
import { computeHabitStats, getHabitStartDate } from '../../../utils/habitStats';
import { getLocalDateString } from '../../../utils/date';
import HabitMatrix from '../../../components/HabitMatrix';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'StudentDetail'>;

export default function StudentDetailScreen({ route, navigation }: Props) {
  const { studentId } = route.params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getLocalDateString();

  const loadData = useCallback(async () => {
    setError(null);
    const [profileResult, tasksResult, logsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).single(),
      supabase.from('tasks').select('*').eq('is_active', true),
      // Embeds the related `tasks` row for each log via the task_id foreign
      // key, so we get the title/type in one round trip instead of a
      // second query + manual lookup.
      supabase
        .from('daily_logs')
        .select('*, task:tasks(id, title, type)')
        .eq('student_id', studentId)
        .order('date', { ascending: false }),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
      setLoading(false);
      return;
    }
    setProfile(profileResult.data as Profile);
    if (tasksResult.data) setActiveTasks(tasksResult.data as Task[]);
    if (logsResult.data) setLogs(logsResult.data as unknown as LogWithTask[]);
    setLoading(false);
  }, [studentId]);

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

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Student not found.'}</Text>
      </View>
    );
  }

  const relevantTasks = getRelevantTasks(activeTasks, logs);
  const todayLogs = logs.filter((log) => log.date === today);

  // One entry per habit — done/total days since whichever came later, the
  // habit being created or the student joining — sorted so the
  // most-completed habit is first, both in the ranked list and (since
  // gifted-charts renders stacks in data order) the chart itself.
  const habitComparisons = relevantTasks
    .map((task) => {
      const habitStartDate = getHabitStartDate(task.created_at, profile.created_at);
      const habitStats = computeHabitStats(logs, task.id, task.type, habitStartDate);
      return { task, habitStats };
    })
    .sort((a, b) => b.habitStats.totalCompleted - a.habitStats.totalCompleted);

  const maxDaysSinceStart = habitComparisons.reduce(
    (max, { habitStats }) => Math.max(max, habitStats.totalDaysSinceStart),
    1
  );
  // Numeric labels (not habit titles) keep the x-axis short and
  // horizontal so nothing gets clipped or rotated into illegibility — the
  // numbered list rendered right below the chart is the "legend" mapping
  // each number back to a habit name.
  const stackData = habitComparisons.map(({ habitStats }, index) => ({
    stacks: [
      { value: habitStats.totalCompleted, color: '#059669' },
      { value: habitStats.totalDaysSinceStart - habitStats.totalCompleted, color: '#e5e7eb' },
    ],
    label: String(index + 1),
  }));
  const joinedDate = new Date(profile.created_at).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>
        {profile.first_name} {profile.last_name}
      </Text>
      <Text style={styles.email}>{profile.email}</Text>
      <Text style={styles.joined}>Joined {joinedDate}</Text>

      <Text style={styles.sectionTitle}>Today</Text>
      {activeTasks.length === 0 ? (
        <Text style={styles.emptyText}>No active habits.</Text>
      ) : (
        activeTasks.map((task) => {
          const log = todayLogs.find((l) => l.task_id === task.id);
          const done = log?.completed ?? false;
          return (
            <View key={task.id} style={styles.todayRow}>
              <Text style={styles.todayTitle}>{task.title}</Text>
              <Text style={[styles.todayStatus, done && styles.todayStatusDone]}>
                {task.type === 'boolean'
                  ? done
                    ? 'Done'
                    : 'Not done'
                  : `${log?.duration_minutes ?? 0} min`}
              </Text>
            </View>
          );
        })
      )}

      {habitComparisons.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Habit Comparison</Text>
          <View style={styles.chartCard}>
            <BarChart
              stackData={stackData}
              barWidth={28}
              spacing={20}
              maxValue={maxDaysSinceStart}
              noOfSections={4}
              height={160}
              xAxisLabelTextStyle={styles.chartAxisLabel}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.legendSwatchDone]} />
                <Text style={styles.legendText}>Done</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, styles.legendSwatchMissed]} />
                <Text style={styles.legendText}>Missed</Text>
              </View>
            </View>
          </View>
          {habitComparisons.map(({ task, habitStats }, index) => (
            <View key={task.id} style={styles.comparisonRow}>
              <Text style={styles.comparisonTitle} numberOfLines={1}>
                {index + 1}. {task.title}
              </Text>
              <Text style={styles.comparisonValue}>
                {habitStats.totalCompleted}/{habitStats.totalDaysSinceStart} days (
                {habitStats.completionPercent}%)
              </Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>History</Text>
      {relevantTasks.length === 0 ? (
        <Text style={styles.emptyText}>No history yet.</Text>
      ) : (
        <HabitMatrix
          tasks={relevantTasks}
          logs={logs}
          onPressTask={(task) =>
            navigation.navigate('HabitDetail', {
              studentId,
              studentName: `${profile.first_name} ${profile.last_name}`,
              taskId: task.id,
              taskTitle: task.title,
              taskType: task.type,
              taskCreatedAt: task.created_at,
              studentJoinedAt: profile.created_at,
            })
          }
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  error: { color: '#dc2626', textAlign: 'center', padding: 16 },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginTop: 2 },
  joined: { fontSize: 13, color: '#999', marginTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  emptyText: { color: '#999', marginBottom: 16 },
  chartCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 24,
    marginBottom: 12,
  },
  chartAxisLabel: { fontSize: 10, color: '#666' },
  legend: { flexDirection: 'row', marginTop: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: 6 },
  legendSwatchDone: { backgroundColor: '#059669' },
  legendSwatchMissed: { backgroundColor: '#e5e7eb' },
  legendText: { fontSize: 12, color: '#666' },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  comparisonTitle: { fontSize: 13, color: '#333', flex: 1, marginRight: 8 },
  comparisonValue: { fontSize: 13, color: '#666', fontWeight: '600' },
  todayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  todayTitle: { fontSize: 14, color: '#333' },
  todayStatus: { fontSize: 13, color: '#999', fontWeight: '600' },
  todayStatusDone: { color: '#059669' },
});
