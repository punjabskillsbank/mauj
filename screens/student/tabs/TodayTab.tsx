import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import type { Task } from '../../../types/database';
import { getLocalDateString } from '../../../utils/date';

interface LogRow {
  task: Task;
  completed: boolean;
  durationText: string;
  saving: boolean;
  justSaved: boolean;
}

export default function TodayTab() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = getLocalDateString();

  const loadTasksAndLogs = useCallback(async () => {
    if (!profile) return;
    setError(null);

    const [tasksResult, logsResult] = await Promise.all([
      supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('daily_logs').select('*').eq('student_id', profile.id).eq('date', today),
    ]);

    if (tasksResult.error) {
      setError(tasksResult.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const tasks = (tasksResult.data ?? []) as Task[];
    const logs = logsResult.data ?? [];

    setRows(
      tasks.map((task) => {
        const existingLog = logs.find((log) => log.task_id === task.id);
        return {
          task,
          completed: existingLog?.completed ?? false,
          durationText:
            existingLog?.duration_minutes != null ? String(existingLog.duration_minutes) : '',
          saving: false,
          justSaved: false,
        };
      })
    );
    setLoading(false);
    setRefreshing(false);
  }, [profile, today]);

  useEffect(() => {
    loadTasksAndLogs();
  }, [loadTasksAndLogs]);

  const flashSaved = (taskId: string) => {
    setRows((prev) => prev.map((r) => (r.task.id === taskId ? { ...r, justSaved: true } : r)));
    setTimeout(() => {
      setRows((prev) => prev.map((r) => (r.task.id === taskId ? { ...r, justSaved: false } : r)));
    }, 1200);
  };

  const handleToggleBoolean = async (taskId: string, value: boolean) => {
    if (!profile) return;

    setRows((prev) =>
      prev.map((r) => (r.task.id === taskId ? { ...r, completed: value, saving: true } : r))
    );

    // upsert = "insert, or update if a row already matches" — here that
    // match is the (student_id, task_id, date) unique constraint we added
    // to daily_logs in schema.sql, so each task gets exactly one row per day.
    const { error: upsertError } = await supabase
      .from('daily_logs')
      .upsert(
        { student_id: profile.id, task_id: taskId, date: today, completed: value },
        { onConflict: 'student_id,task_id,date' }
      );

    setRows((prev) =>
      prev.map((r) => (r.task.id === taskId ? { ...r, saving: false } : r))
    );

    if (upsertError) {
      setError(upsertError.message);
      // Revert on failure so the UI doesn't show a save that didn't happen.
      setRows((prev) =>
        prev.map((r) => (r.task.id === taskId ? { ...r, completed: !value } : r))
      );
    } else {
      flashSaved(taskId);
    }
  };

  const handleDurationChange = (taskId: string, text: string) => {
    // Only allow digits, so the field can't end up with something the
    // "int" column in Postgres would reject.
    const numeric = text.replace(/[^0-9]/g, '');
    setRows((prev) =>
      prev.map((r) => (r.task.id === taskId ? { ...r, durationText: numeric } : r))
    );
  };

  const handleSaveDuration = async (taskId: string) => {
    if (!profile) return;
    const row = rows.find((r) => r.task.id === taskId);
    if (!row) return;

    const minutes = parseInt(row.durationText, 10);
    const safeMinutes = Number.isNaN(minutes) ? 0 : minutes;

    setRows((prev) => prev.map((r) => (r.task.id === taskId ? { ...r, saving: true } : r)));

    const { error: upsertError } = await supabase
      .from('daily_logs')
      .upsert(
        {
          student_id: profile.id,
          task_id: taskId,
          date: today,
          duration_minutes: safeMinutes,
          completed: safeMinutes > 0,
        },
        { onConflict: 'student_id,task_id,date' }
      );

    setRows((prev) =>
      prev.map((r) =>
        r.task.id === taskId
          ? { ...r, saving: false, completed: safeMinutes > 0, durationText: String(safeMinutes) }
          : r
      )
    );

    if (upsertError) {
      setError(upsertError.message);
    } else {
      flashSaved(taskId);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.task.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTasksAndLogs();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No active habits yet. Check back once your admin adds some.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>{item.task.title}</Text>
              {item.saving ? (
                <ActivityIndicator size="small" color="#4f46e5" />
              ) : item.justSaved ? (
                <Text style={styles.savedText}>Saved</Text>
              ) : null}
            </View>

            {item.task.type === 'boolean' ? (
              <View style={styles.booleanRow}>
                <Text style={styles.booleanLabel}>{item.completed ? 'Done' : 'Not done'}</Text>
                <Switch
                  value={item.completed}
                  onValueChange={(value) => handleToggleBoolean(item.task.id, value)}
                  trackColor={{ false: '#e5e7eb', true: '#4f46e5' }}
                  thumbColor="#fff"
                  ios_backgroundColor="#e5e7eb"
                />
              </View>
            ) : (
              <View style={styles.durationRow}>
                <TextInput
                  style={styles.durationInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={item.durationText}
                  onChangeText={(text) => handleDurationChange(item.task.id, text)}
                />
                <Text style={styles.durationUnit}>minutes</Text>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => handleSaveDuration(item.task.id)}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#dc2626', textAlign: 'center', padding: 8 },
  listContent: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  savedText: { color: '#059669', fontSize: 13, fontWeight: '600' },
  booleanRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  booleanLabel: { fontSize: 14, color: '#666' },
  durationRow: { flexDirection: 'row', alignItems: 'center' },
  durationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    width: 70,
    fontSize: 16,
    textAlign: 'center',
    marginRight: 8,
  },
  durationUnit: { color: '#666', marginRight: 12 },
  saveButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 'auto',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
