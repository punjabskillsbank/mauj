import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Invitation, Profile } from '../../../types/database';

export default function StudentManagementTab() {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const [invitationsResult, studentsResult] = await Promise.all([
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student'),
    ]);

    if (!invitationsResult.error && invitationsResult.data) {
      setInvitations(invitationsResult.data as Invitation[]);
    }
    if (!studentsResult.error && studentsResult.data) {
      setStudents(studentsResult.data as Profile[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();

    // Subscribing to postgres_changes gives us the "as soon as a student
    // registers, they show up here automatically" behavior without any
    // manual refresh — Supabase pushes the change over a WebSocket the
    // instant the trigger updates these tables.
    const channel = supabase
      .channel('student-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleInvite = async () => {
    setInviteError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setInviteError('Enter an email address.');
      return;
    }
    if (!profile) return;

    setInviteSubmitting(true);
    const { error } = await supabase.from('invitations').insert({
      email: trimmed,
      invited_by: profile.id,
    });
    setInviteSubmitting(false);

    if (error) {
      // Postgres error code 23505 = unique_violation, thrown by our
      // `email text unique` constraint on the invitations table.
      setInviteError(
        error.code === '23505' ? 'This email has already been invited.' : error.message
      );
      return;
    }

    setEmail('');
    loadData();
  };

  const getStudentName = (inviteEmail: string) => {
    const match = students.find((s) => s.email === inviteEmail);
    return match ? `${match.first_name} ${match.last_name}` : null;
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
      <View style={styles.inviteRow}>
        <TextInput
          style={styles.input}
          placeholder="student@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={styles.inviteButton} onPress={handleInvite} disabled={inviteSubmitting}>
          {inviteSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.inviteButtonText}>Invite</Text>
          )}
        </TouchableOpacity>
      </View>
      {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}

      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No invitations yet.</Text>}
        renderItem={({ item }) => {
          const name = item.status === 'registered' ? getStudentName(item.email) : null;
          return (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowEmail}>{item.email}</Text>
                {name ? <Text style={styles.rowName}>{name}</Text> : null}
              </View>
              <View
                style={[
                  styles.badge,
                  item.status === 'registered' ? styles.badgeRegistered : styles.badgePending,
                ]}
              >
                <Text style={styles.badgeText}>
                  {item.status === 'registered' ? 'Registered' : 'Pending'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inviteRow: { flexDirection: 'row', marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    fontSize: 15,
  },
  inviteButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  inviteButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 8 },
  listContent: { paddingTop: 8, paddingBottom: 24 },
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
  rowEmail: { fontSize: 15, fontWeight: '600' },
  rowName: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeRegistered: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
});
