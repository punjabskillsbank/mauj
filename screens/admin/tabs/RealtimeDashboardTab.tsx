import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { supabase } from '../../../lib/supabase';
import type { DailyLog, Profile, Task } from '../../../types/database';
import { getLocalDateString } from '../../../utils/date';

interface FeedItem {
  id: string;
  studentName: string;
  taskTitle: string;
  detail: string;
  timestamp: number;
}

export default function RealtimeDashboardTab() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs mirror the state so the realtime callback (registered once, in the
  // effect below) can always read the LATEST students/tasks lists without
  // needing to re-subscribe every time they change.
  const studentsRef = useRef<Profile[]>([]);
  const tasksRef = useRef<Task[]>([]);
  studentsRef.current = students;
  tasksRef.current = tasks;

  const today = getLocalDateString();

  const loadAll = useCallback(async () => {
    const [studentsResult, tasksResult, logsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('tasks').select('*').eq('is_active', true),
      supabase
        .from('daily_logs')
        .select('*')
        .eq('date', today)
        .order('created_at', { ascending: false }),
    ]);

    if (studentsResult.data) setStudents(studentsResult.data as Profile[]);
    if (tasksResult.data) setTasks(tasksResult.data as Task[]);
    if (logsResult.data) setLogs(logsResult.data as DailyLog[]);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    loadAll();

    // One subscription drives two things: (1) re-fetching the completion
    // stats so the pie/bar charts stay accurate, and (2) appending a
    // human-readable line to the live activity feed using the changed row
    // straight from the WebSocket payload — no extra round-trip needed.
    const channel = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, (payload) => {
        loadAll();

        const row = (payload.new ?? payload.old) as DailyLog | undefined;
        if (!row) return;

        const student = studentsRef.current.find((s) => s.id === row.student_id);
        const task = tasksRef.current.find((t) => t.id === row.task_id);
        if (!student || !task) return;

        const detail =
          task.type === 'boolean'
            ? row.completed
              ? 'marked as done'
              : 'marked as not done'
            : `logged ${row.duration_minutes ?? 0} min`;

        setFeed((prev) =>
          [
            {
              id: `${row.id}-${Date.now()}`,
              studentName: `${student.first_name} ${student.last_name}`,
              taskTitle: task.title,
              detail,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 30)
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const totalPossible = students.length * tasks.length;
  const totalCompleted = logs.filter(
    (log) => log.completed && tasks.some((t) => t.id === log.task_id)
  ).length;
  const completionPercent =
    totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  const pieData = [
    { value: completionPercent, color: '#4f46e5' },
    { value: Math.max(100 - completionPercent, 0), color: '#e5e7eb' },
  ];

  const barData = students.map((student) => {
    const studentCompleted = logs.filter(
      (log) => log.student_id === student.id && log.completed && tasks.some((t) => t.id === log.task_id)
    ).length;
    const percent = tasks.length > 0 ? Math.round((studentCompleted / tasks.length) * 100) : 0;
    return {
      value: percent,
      label: student.first_name,
      frontColor: '#4f46e5',
    };
  });

  return (
    <FlatList
      data={feed}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Today&apos;s Completion</Text>
            {tasks.length > 0 && students.length > 0 ? (
              <View style={styles.metricRow}>
                <PieChart
                  donut
                  radius={60}
                  innerRadius={42}
                  data={pieData}
                  centerLabelComponent={() => (
                    <Text style={styles.pieCenterText}>{completionPercent}%</Text>
                  )}
                />
                <View style={styles.metricStats}>
                  <Text style={styles.metricStatValue}>{totalCompleted}</Text>
                  <Text style={styles.metricStatLabel}>of {totalPossible} tasks completed</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>Add students and habits to see metrics.</Text>
            )}
          </View>

          {barData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.metricLabel}>Student Progress</Text>
              <BarChart
                data={barData}
                barWidth={28}
                spacing={20}
                roundedTop
                maxValue={100}
                noOfSections={4}
                yAxisLabelSuffix="%"
                height={160}
              />
            </View>
          )}

          <Text style={styles.feedTitle}>Live Activity</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.emptyText}>No activity yet today.</Text>}
      renderItem={({ item }) => (
        <View style={styles.feedRow}>
          <Text style={styles.feedText}>
            <Text style={styles.feedName}>{item.studentName}</Text> {item.detail} for{' '}
            <Text style={styles.feedTask}>{item.taskTitle}</Text>
          </Text>
          <Text style={styles.feedTime}>
            {new Date(item.timestamp).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  metricCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  metricLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12, color: '#333' },
  metricRow: { flexDirection: 'row', alignItems: 'center' },
  pieCenterText: { fontSize: 14, fontWeight: '700' },
  metricStats: { marginLeft: 20 },
  metricStatValue: { fontSize: 28, fontWeight: '700', color: '#4f46e5' },
  metricStatLabel: { fontSize: 13, color: '#666' },
  chartCard: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  feedTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  feedRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedText: { fontSize: 14, color: '#333', flex: 1, marginRight: 8 },
  feedName: { fontWeight: '700' },
  feedTask: { fontWeight: '600' },
  feedTime: { fontSize: 12, color: '#999' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 8 },
});
