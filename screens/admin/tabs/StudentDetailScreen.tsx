import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import type { Profile, Task } from '../../../types/database';
import { computeCompletionStats, type LogWithTask } from '../../../utils/stats';
import { getRelevantTasks } from '../../../utils/matrix';
import { getLocalDateString } from '../../../utils/date';
import HabitMatrix from '../../../components/HabitMatrix';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'StudentDetail'>;

export default function StudentDetailScreen({ route }: Props) {
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

  const stats = computeCompletionStats(logs);
  const relevantTasks = getRelevantTasks(activeTasks, logs);
  const todayLogs = logs.filter((log) => log.date === today);
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

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.completionPercent}%</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.daysActive}</Text>
          <Text style={styles.statLabel}>Days Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>

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

      <Text style={styles.sectionTitle}>History</Text>
      {relevantTasks.length === 0 ? (
        <Text style={styles.emptyText}>No history yet.</Text>
      ) : (
        <HabitMatrix tasks={relevantTasks} logs={logs} />
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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#4f46e5' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  emptyText: { color: '#999', marginBottom: 16 },
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
