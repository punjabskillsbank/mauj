import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StudentManagementTab from '../screens/admin/tabs/StudentManagementTab';
import StudentDetailScreen from '../screens/admin/tabs/StudentDetailScreen';

export type AdminStudentsStackParamList = {
  StudentList: undefined;
  StudentDetail: { studentId: string; studentName: string };
};

const Stack = createNativeStackNavigator<AdminStudentsStackParamList>();

// A small nested stack scoped to just the "Students" tab of AdminScreen —
// this gives us a native back button / header for the list -> detail drill
// down without affecting the Admin's outer Students/Habits/Dashboard tab
// bar, which lives outside this navigator entirely.
export default function AdminStudentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* No header here — AdminScreen's own header + tab bar already give
          this screen context, so a second "Students" bar would just be
          redundant vertical space. */}
      <Stack.Screen name="StudentList" component={StudentManagementTab} />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailScreen}
        options={({ route }) => ({ headerShown: true, title: route.params.studentName })}
      />
    </Stack.Navigator>
  );
}
