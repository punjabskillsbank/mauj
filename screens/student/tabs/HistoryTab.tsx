import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { computeCompletionStats, type LogWithTask } from '../../../utils/stats';
import { getRelevantTasks } from '../../../utils/matrix';
import type { Task } from '../../../types/database';
import HabitMatrix from '../../../components/HabitMatrix';

export default function HistoryTab() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogWithTask[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!profile) return;
    setError(null);

    const [logsResult, tasksResult] = await Promise.all([
      // RLS already scopes this to student_id = auth.uid(), so there's no
      // need to add an .eq('student_id', ...) filter — a student physically
      // cannot fetch anyone else's rows here even if they tried.
      supabase.from('daily_logs').select('*, task:tasks(id, title, type)').order('date', { ascending: false }),
      supabase.from('tasks').select('*').eq('is_active', true),
    ]);

    if (logsResult.error) {
      setError(logsResult.error.message);
    } else if (logsResult.data) {
      setLogs(logsResult.data as unknown as LogWithTask[]);
    }
    if (tasksResult.data) setActiveTasks(tasksResult.data as Task[]);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const stats = computeCompletionStats(logs);
  const relevantTasks = getRelevantTasks(activeTasks, logs);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadHistory();
          }}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

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

      {relevantTasks.length === 0 ? (
        <Text style={styles.emptyText}>
          No history yet. Log some habits on the Today tab to see them here.
        </Text>
      ) : (
        <HabitMatrix tasks={relevantTasks} logs={logs} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
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
  emptyText: { textAlign: 'center', color: '#999', marginTop: 24 },
});
