export type Role = 'admin' | 'student';
export type TaskType = 'boolean' | 'duration';
export type InvitationStatus = 'pending' | 'registered';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  is_active: boolean;
  created_at: string;
}

export interface DailyLog {
  id: string;
  student_id: string;
  task_id: string;
  date: string;
  completed: boolean;
  duration_minutes: number | null;
  created_at: string;
}
