export type GoalCategory = 'Health' | 'Finance' | 'Learning' | 'Relationships' | 'Career' | 'Personal' | string;

export type RepeatFrequency = 'Never' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';

export interface CustomRepeatConfig {
  frequency: number;
  unit: 'Day' | 'Week' | 'Month' | 'Year';
  weekDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  endOption: 'Never' | 'OnDate' | 'AfterOccurrences';
  endDate?: string; // YYYY-MM-DD
  occurrences?: number;
}

export type WithId<T> = T & { id: string };

export type JournalMood = 'Great' | 'Good' | 'Okay' | 'Hard';

export type JournalEntry = {
  id: string;
  content: string;
  date: string; // "YYYY-MM-DD"
  createdAt: string; // ISO String
  goalId?: string;
  goalTitle?: string;
  mood?: JournalMood;
  progress?: number; // 0-100 self-reported progress for this entry
};

// A Goal is now a "Plan"
export type Goal = {
  userId: string;
  title: string;
  category: GoalCategory;
  progress: number; // 0-100
  archived?: boolean;
  createdAt: string; // ISO String
  startDate?: string; // "YYYY-MM-DD"
  targetDate?: string; // "YYYY-MM-DD"
  linkedPlanId?: string; // For habits linked to a parent plan
  notes?: JournalEntry[];
};

export type HabitStage = 'Intention' | 'Experimentation' | 'Repetition' | 'Automaticity' | 'Identity';

export const HABIT_THRESHOLDS = {
    Intention: 0,
    Experimentation: 1,
    Repetition: 7,
    Automaticity: 21,
    Identity: 66
};

// A "System" is a planned, time-blocked activity for a specific day, linked to a goal.
export type System = {
  goalId: string;
  goalTitle: string;
  userId: string;
  title: string; // The activity description
  date: string; // "YYYY-MM-DD"
  isCompleted: boolean;
  successPercentage: number; // 0-100
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  linkedApp?: string; // URL
  createdAt: string;
  repeat?: RepeatFrequency;
  alarm?: boolean;
  notificationId?: string;
}

// A "Task" is a one-off to-do item for a specific day.
export type Task = {
  userId: string;
  goalId?: string; // Tasks are now optionally linked to goals
  title: string;
  date: string; // "YYYY-MM-DD"
  isCompleted: boolean;
  successPercentage: number; // 0-100
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  notes?: string;
  linkedApp?: string; // URL
  createdAt: string;
  repeat?: RepeatFrequency;
  alarm?: boolean;
  notificationId?: string;
}

export type ProgressLog = {
  date: string; // "YYYY-MM-DD"
  successPercentage: number;
  goalId: string;
  systemId?: string;
  taskId?: string;
}
