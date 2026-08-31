import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import type { Task, TaskType } from '../../../types/database';

export default function HabitManagementTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('boolean');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (!fetchError && data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTask = async () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Enter a habit title.');
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('tasks').insert({
      title: trimmed,
      type,
      is_active: true,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle('');
    loadTasks();
  };

  // "Removing" a habit sets is_active = false rather than deleting the row.
  // Deleting would cascade-delete every daily_logs entry that references it
  // (we set `on delete cascade`), wiping historical data. Soft-deleting
  // keeps history intact while hiding it from students' daily log screen.
  const toggleActive = async (task: Task) => {
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ is_active: !task.is_active })
      .eq('id', task.id);
    if (!updateError) loadTasks();
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
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Habit title (e.g. Drink water)"
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'boolean' && styles.typeButtonActive]}
            onPress={() => setType('boolean')}
          >
            <Text style={[styles.typeButtonText, type === 'boolean' && styles.typeButtonTextActive]}>
              Yes / No
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'duration' && styles.typeButtonActive]}
            onPress={() => setType('duration')}
          >
            <Text style={[styles.typeButtonText, type === 'duration' && styles.typeButtonTextActive]}>
              Duration
            </Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>Add Habit</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No habits yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, !item.is_active && styles.rowTitleInactive]}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta}>{item.type === 'boolean' ? 'Yes / No' : 'Duration'}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                item.is_active ? styles.deactivateButton : styles.activateButton,
              ]}
              onPress={() => toggleActive(item)}
            >
              <Text style={styles.toggleButtonText}>{item.is_active ? 'Remove' : 'Restore'}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  typeButton: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#4f46e5' },
  typeButtonText: { color: '#4f46e5', fontWeight: '600' },
  typeButtonTextActive: { color: '#fff' },
  error: { color: '#dc2626', marginBottom: 8 },
  addButton: { backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: 24 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowTitleInactive: { color: '#999', textDecorationLine: 'line-through' },
  rowMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  toggleButton: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  deactivateButton: { backgroundColor: '#fee2e2' },
  activateButton: { backgroundColor: '#d1fae5' },
  toggleButtonText: { fontSize: 13, fontWeight: '600', color: '#333' },
});
