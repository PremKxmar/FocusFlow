export type View = 'LOGIN' | 'SIGNUP' | 'ONBOARDING' | 'DASHBOARD' | 'TASKS' | 'ANALYTICS' | 'INSIGHTS' | 'ML_INSIGHTS' | 'NOVEL_INSIGHTS' | 'FOCUS' | 'REPORTS' | 'CHATBOT' | 'WELLNESS' | 'TEAM' | 'SETTINGS' | 'PROFILE';

export type ProductivityLevel = 'Low' | 'Medium' | 'High';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskCategory = 'Work' | 'Personal' | 'Study' | 'Health' | 'Urgent';

export interface Task {
  id: string;
  title: string;
  deadline: string;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  progress: number;
  is_overdue?: boolean;
}

export interface ActivityData {
  time: string;
  productive: number;
  distracted: number;
}

export interface MLForecast {
  nextDayWorkload: number; // 0-100
  completionProbability: number; // 0-100
  bestFocusWindow: string;
  distractionTrigger: string;
  trend: 'Up' | 'Down' | 'Stable';
}

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  style: 'Balanced' | 'High-focus' | 'Flexible';
  goals: string[];
}
