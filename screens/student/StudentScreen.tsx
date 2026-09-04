import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getFriendlyDateLabel } from '../../utils/date';
import TodayTab from './tabs/TodayTab';
import HistoryTab from './tabs/HistoryTab';

type TabKey = 'today' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'history', label: 'History' },
];

export default function StudentScreen() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Hi, {profile?.first_name}!</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'today' ? getFriendlyDateLabel() : 'Your progress so far'}
          </Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'history' && <HistoryTab />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  signOut: { color: '#dc2626', fontWeight: '600' },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tabButton: { flex: 1, padding: 14, alignItems: 'center' },
  tabLabel: { color: '#999', fontWeight: '600' },
  tabLabelActive: { color: '#4f46e5' },
});
