import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentScreen() {
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome, {profile?.first_name}!</Text>
      <Text style={styles.subtitle}>Your daily habits will show up here next.</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#dc2626', borderRadius: 8, padding: 14, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
