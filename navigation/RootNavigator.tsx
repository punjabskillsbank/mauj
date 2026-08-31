import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import StudentScreen from '../screens/student/StudentScreen';
import AdminScreen from '../screens/admin/AdminScreen';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, profile, loading, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  // Rare edge case: a session exists but we couldn't load its profile row
  // (e.g. network hiccup). Better to show a clear recovery option than a
  // blank or broken screen.
  if (session && !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {profileError ?? 'Could not load your profile.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={signOut}>
          <Text style={styles.retryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session || !profile ? (
        <AuthNavigator />
      ) : profile.role === 'admin' ? (
        <AdminScreen />
      ) : (
        <StudentScreen />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorText: { color: '#dc2626', textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, paddingHorizontal: 24 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
