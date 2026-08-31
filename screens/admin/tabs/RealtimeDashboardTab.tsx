import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function RealtimeDashboardTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Live completion feed and charts are coming in the next step.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { color: '#666', textAlign: 'center' },
});
