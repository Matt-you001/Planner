import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { firestore, auth } from '../firebase';
import type { Goal, Task, System, WithId, JournalEntry, JournalMood } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  GOALS: '@endinmind:goals',
  TASKS: '@endinmind:tasks',
  SYSTEMS: '@endinmind:systems',
  JOURNALS: '@endinmind:journals',
};

import { HABIT_THRESHOLDS, HabitStage } from './types';
import * as Notifications from 'expo-notifications';

const toIsoString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
};

const normalizeGoal = (id: string, data: any): WithId<Goal> => ({
  ...data,
  id,
  createdAt: toIsoString(data.createdAt) || new Date().toISOString(),
  startDate: typeof data.startDate === 'string' ? data.startDate : toIsoString(data.startDate)?.split('T')[0],
  targetDate: typeof data.targetDate === 'string' ? data.targetDate : toIsoString(data.targetDate)?.split('T')[0],
  notes: Array.isArray(data.notes) ? data.notes : undefined,
});

const normalizeTask = (id: string, data: any): WithId<Task> => ({
  ...data,
  id,
  createdAt: toIsoString(data.createdAt) || new Date().toISOString(),
});

const normalizeSystem = (id: string, data: any): WithId<System> => ({
  ...data,
  id,
  createdAt: toIsoString(data.createdAt) || new Date().toISOString(),
});

const normalizeJournalEntry = (id: string, data: any): JournalEntry => ({
  id,
  content: data.content || '',
  date: typeof data.date === 'string' ? data.date : (toIsoString(data.date)?.split('T')[0] || new Date().toISOString().split('T')[0]),
  createdAt: toIsoString(data.createdAt) || new Date().toISOString(),
  goalId: data.goalId,
  goalTitle: data.goalTitle,
  mood: data.mood,
  progress: typeof data.progress === 'number' ? data.progress : undefined,
});

// In-memory store that syncs with AsyncStorage
class PersistentStore {
  goals: WithId<Goal>[] = [];
  tasks: WithId<Task>[] = [];
  systems: WithId<System>[] = [];
  journals: JournalEntry[] = [];
  initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      console.log('DataService: Initializing local store...');
      const [g, t, s, j] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GOALS),
        AsyncStorage.getItem(STORAGE_KEYS.TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.SYSTEMS),
        AsyncStorage.getItem(STORAGE_KEYS.JOURNALS),
      ]);
      
      if (g) {
        this.goals = JSON.parse(g);
        console.log(`DataService: Loaded ${this.goals.length} goals from storage.`);
      } else {
        console.log('DataService: No goals in storage, using mocks.');
      }
      
      if (t) this.tasks = JSON.parse(t);
      if (s) this.systems = JSON.parse(s);
      if (j) this.journals = JSON.parse(j);
      
      this.initialized = true;
    } catch (e) {
      console.warn("Failed to load local storage", e);
    }
  }

  async save() {
    try {
      console.log('DataService: Saving to storage...');
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(this.goals)),
        AsyncStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.tasks)),
        AsyncStorage.setItem(STORAGE_KEYS.SYSTEMS, JSON.stringify(this.systems)),
        AsyncStorage.setItem(STORAGE_KEYS.JOURNALS, JSON.stringify(this.journals)),
      ]);
      console.log('DataService: Save complete.');
    } catch (e) {
      console.warn("Failed to save local storage", e);
    }
  }

  async addGoal(goal: Omit<Goal, 'id'>) {
    await this.init();
    const newGoal = { ...goal, id: `local-g-${Date.now()}` };
    this.goals.unshift(newGoal);
    await this.save();
    return newGoal;
  }

  async addTask(task: Omit<Task, 'id'>) {
    await this.init();
    const newTask = { ...task, id: `local-t-${Date.now()}` };
    this.tasks.push(newTask);
    await this.save();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>) {
    await this.init();
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      await this.save();
      return this.tasks[index];
    }
    return null;
  }

  async updateSystem(id: string, updates: Partial<System>) {
    await this.init();
    const index = this.systems.findIndex(s => s.id === id);
    if (index !== -1) {
      this.systems[index] = { ...this.systems[index], ...updates };
      await this.save();
      return this.systems[index];
    }
    return null;
  }

  async addSystem(system: Omit<System, 'id'>) {
    await this.init();
    const newSystem = { ...system, id: `local-s-${Date.now()}` };
    this.systems.push(newSystem);
    await this.save();
    return newSystem;
  }

  async addNote(note: JournalEntry) {
    await this.init();
    this.journals.unshift(note);
    await this.save();
  }

  async deleteGoal(id: string) {
    await this.init();
    this.goals = this.goals.filter(g => g.id !== id);
    // Cascade delete tasks and systems
    this.tasks = this.tasks.filter(t => t.goalId !== id);
    this.systems = this.systems.filter(s => s.goalId !== id);
    await this.save();
  }

  async deleteTask(id: string) {
    await this.init();
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.save();
  }

  async deleteSystem(id: string) {
    await this.init();
    this.systems = this.systems.filter(s => s.id !== id);
    await this.save();
  }
}

export const localStore = new PersistentStore();

export const DataService = {
  async getGoalNotes(userId: string, goalId: string): Promise<JournalEntry[]> {
    if (this.isDemoMode()) {
      await localStore.init();
      const linkedJournals = localStore.journals.filter(journal => journal.goalId === goalId);
      const legacyGoalNotes = localStore.goals.find(g => g.id === goalId)?.notes || [];
      return [...linkedJournals, ...legacyGoalNotes]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    try {
      const [linkedJournalSnap, legacyNotesSnap] = await Promise.all([
        getDocs(query(
          collection(firestore, 'users', userId, 'journals'),
          where('goalId', '==', goalId),
          orderBy('createdAt', 'desc')
        )),
        getDocs(query(
          collection(firestore, 'users', userId, 'goals', goalId, 'notes'),
          orderBy('createdAt', 'desc')
        )).catch(() => ({ docs: [] as any[] }))
      ]);

      const combined = [
        ...linkedJournalSnap.docs.map(noteDoc => normalizeJournalEntry(noteDoc.id, noteDoc.data())),
        ...legacyNotesSnap.docs.map(noteDoc => normalizeJournalEntry(noteDoc.id, noteDoc.data()))
      ];

      return combined.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e) {
      console.warn("Fetch goal notes failed, using local store", e);
      await localStore.init();
      const linkedJournals = localStore.journals.filter(journal => journal.goalId === goalId);
      const legacyGoalNotes = localStore.goals.find(g => g.id === goalId)?.notes || [];
      return [...linkedJournals, ...legacyGoalNotes]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  },

  async getJournals(userId: string, date?: string): Promise<JournalEntry[]> {
    if (this.isDemoMode()) {
      await localStore.init();
      const journals = date
        ? localStore.journals.filter(journal => journal.date === date)
        : localStore.journals;
      return [...journals].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    try {
      const constraints: any[] = [];
      if (date) {
        constraints.push(where('date', '==', date));
      }
      constraints.push(orderBy('createdAt', 'desc'));

      const journalsSnap = await getDocs(query(
        collection(firestore, 'users', userId, 'journals'),
        ...constraints
      ));

      return journalsSnap.docs.map(journalDoc => normalizeJournalEntry(journalDoc.id, journalDoc.data()));
    } catch (e) {
      console.warn("Fetch journals failed, using local store", e);
      await localStore.init();
      const journals = date
        ? localStore.journals.filter(journal => journal.date === date)
        : localStore.journals;
      return [...journals].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  },

  // Check if we are using the real backend or fallback
  isDemoMode: () => {
    // If auth is null, we are definitely in demo/offline mode
    if (!auth.currentUser) return true;
    // If the user is our explicit mock user
    if (auth.currentUser.uid === 'mock-user-123') return true;

    return false; 
  },

  // Helper to schedule notification for a task/system
  async scheduleReminder(item: WithId<Task> | WithId<System>) {
    if (!item.date || !item.startTime) return;
    if (item.alarm === false) return;
    if (item.notificationId) return;

    const [hours, minutes] = item.startTime.split(':').map(Number);
    const triggerDate = new Date(item.date);
    triggerDate.setHours(hours, minutes, 0, 0);

    // If date is in past, don't schedule
    if (triggerDate.getTime() < Date.now()) return;

    const categoryId = item.linkedApp ? 'linked-app-reminder' : 'default-reminder';

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: item.title,
                body: `It's time to ${item.title}`,
                data: { linkedApp: item.linkedApp },
                categoryIdentifier: categoryId, // 'linked-app-reminder' has 'Accept' action
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE, // Explicitly set trigger type
                date: triggerDate, // Use 'date' property for specific timestamp
            },
        });
        console.log(`Scheduled reminder for ${item.title} at ${triggerDate}`);
    } catch (e) {
        console.warn("Failed to schedule notification", e);
    }
  },

  // --- GOALS ---
  
  async getGoals(userId: string): Promise<WithId<Goal>[]> {
    if (this.isDemoMode()) {
      await localStore.init();
      return [...localStore.goals]; // Return copy to force React update
    }
    try {
      const q = query(
        collection(firestore, 'users', userId, 'goals'), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const goals = snap.docs.map(d => normalizeGoal(d.id, d.data()));
      const goalsWithNotes = await Promise.all(
        goals.map(async goal => ({
          ...goal,
          notes: await this.getGoalNotes(userId, goal.id)
        }))
      );
      return goalsWithNotes;
    } catch (e) {
      console.warn("Fetch goals failed, using local store", e);
      await localStore.init();
      return [...localStore.goals];
    }
  },

  async getGoal(userId: string, goalId: string): Promise<WithId<Goal> | null> {
    if (this.isDemoMode()) {
      await localStore.init();
      return localStore.goals.find(g => g.id === goalId) || null;
    }
    try {
      const snap = await getDoc(doc(firestore, 'users', userId, 'goals', goalId));
      if (snap.exists()) {
        const goal = normalizeGoal(snap.id, snap.data());
        const notes = await this.getGoalNotes(userId, goalId);
        return { ...goal, notes };
      }
      return null;
    } catch (e) {
      await localStore.init();
      return localStore.goals.find(g => g.id === goalId) || null;
    }
  },

  async createGoal(userId: string, goal: Omit<Goal, 'id' | 'userId' | 'createdAt'>) {
    const goalData = {
      ...goal,
      userId,
      createdAt: new Date().toISOString(),
      progress: 0
    };

    if (this.isDemoMode()) {
      return localStore.addGoal(goalData);
    }

    try {
      const ref = await addDoc(collection(firestore, 'users', userId, 'goals'), {
        ...goalData,
        createdAt: serverTimestamp() // Use server timestamp for real DB
      });
      return { ...goalData, id: ref.id };
    } catch (e) {
      console.warn("Create goal failed, using local store", e);
      return localStore.addGoal(goalData);
    }
  },

  async deleteGoal(userId: string, goalId: string) {
      if (this.isDemoMode()) {
          return localStore.deleteGoal(goalId);
      }
      try {
          await deleteDoc(doc(firestore, 'users', userId, 'goals', goalId));
          // Note: In Firestore, you have to manually delete subcollections or linked documents 
          // unless you use a cloud function. For this app, we might leave orphans or try to delete them.
          // Since we query by collection group or root collection with userId, orphans might stick around 
          // but won't be fetched if we filter by goalId (which we do for goal-specific views).
          // However, we should probably try to clean up if we can fetch them.
          // For simplicity, we'll just delete the goal doc here.
      } catch (e) {
          console.warn("Delete goal failed, using local store", e);
          return localStore.deleteGoal(goalId);
      }
  },

  // --- TASKS ---

  async getTasks(userId: string, goalId?: string, date?: string): Promise<WithId<Task>[]> {
    if (this.isDemoMode()) {
      await localStore.init();
      let tasks = localStore.tasks;
      if (goalId) tasks = tasks.filter(t => t.goalId === goalId);
      if (date) tasks = tasks.filter(t => t.date === date);
      return [...tasks];
    }

    try {
      let constraints: any[] = [];
      if (goalId) constraints.push(where('goalId', '==', goalId));
      if (date) {
        constraints.push(where('date', '==', date));
        constraints.push(orderBy('createdAt')); // Only order if we filter by date to avoid index issues
      }
      
      const q = query(collection(firestore, 'users', userId, 'tasks'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => normalizeTask(d.id, d.data()));
    } catch (e) {
      console.warn("Fetch tasks failed, using local store", e);
      await localStore.init();
      let tasks = localStore.tasks;
      if (goalId) tasks = tasks.filter(t => t.goalId === goalId);
      if (date) tasks = tasks.filter(t => t.date === date);
      return [...tasks];
    }
  },

  async createTask(userId: string, task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'successPercentage' | 'isCompleted'>) {
    const taskData = {
      ...task,
      userId,
      isCompleted: false,
      successPercentage: 0,
      createdAt: new Date().toISOString()
    };

    if (this.isDemoMode()) {
      const added = await localStore.addTask(taskData);
      await this.scheduleReminder(added);
      return added;
    }

    try {
      const ref = await addDoc(collection(firestore, 'users', userId, 'tasks'), {
        ...taskData,
        createdAt: serverTimestamp()
      });
      const added = { ...taskData, id: ref.id };
      await this.scheduleReminder(added);
      return added;
    } catch (e) {
      console.warn("Create task failed, using local store", e);
      const added = await localStore.addTask(taskData);
      await this.scheduleReminder(added);
      return added;
    }
  },

  async updateTask(userId: string, taskId: string, updates: Partial<Task>) {
    let updatedTask: WithId<Task> | null = null;
    if (this.isDemoMode()) {
      updatedTask = await localStore.updateTask(taskId, updates);
    } else {
      try {
        const taskRef = doc(firestore, 'users', userId, 'tasks', taskId);
        const existingSnap = await getDoc(taskRef);
        await updateDoc(doc(firestore, 'users', userId, 'tasks', taskId), updates);
        if (existingSnap.exists()) {
          updatedTask = normalizeTask(existingSnap.id, { ...existingSnap.data(), ...updates });
        }
      } catch (e) {
        updatedTask = await localStore.updateTask(taskId, updates);
      }
    }

    // After updating task, recalculate goal progress if goalId is present
    if (updatedTask && updatedTask.goalId) {
        await this.calculateGoalProgress(userId, updatedTask.goalId);
    }

    return true;
  },

  async deleteTask(userId: string, taskId: string) {
      if (this.isDemoMode()) {
          return localStore.deleteTask(taskId);
      }
      try {
          await deleteDoc(doc(firestore, 'users', userId, 'tasks', taskId));
      } catch (e) {
          console.warn("Delete task failed, using local store", e);
          return localStore.deleteTask(taskId);
      }
  },

  // --- SYSTEMS ---

  async getSystems(userId: string, goalId?: string, date?: string): Promise<WithId<System>[]> {
    if (this.isDemoMode()) {
        await localStore.init();
        let systems = localStore.systems;
        if (goalId) systems = systems.filter(s => s.goalId === goalId);
        if (date) systems = systems.filter(s => s.date === date);
        return [...systems];
    }
    try {
        let constraints: any[] = [];
        if (goalId) constraints.push(where('goalId', '==', goalId));
        if (date) {
          constraints.push(where('date', '==', date));
          constraints.push(orderBy('createdAt')); 
        }
        
        const q = query(collection(firestore, 'users', userId, 'systems'), ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map(d => normalizeSystem(d.id, d.data()));
      } catch (e) {
        console.warn("Fetch systems failed, using local store", e);
        await localStore.init();
        let systems = localStore.systems;
        if (goalId) systems = systems.filter(s => s.goalId === goalId);
        if (date) systems = systems.filter(s => s.date === date);
        return [...systems];
      }
  },
  
  async updateSystem(userId: string, systemId: string, updates: Partial<System>) {
    let updatedSystem: WithId<System> | null = null;

    if (this.isDemoMode()) {
      updatedSystem = await localStore.updateSystem(systemId, updates);
    } else {
        try {
          const systemRef = doc(firestore, 'users', userId, 'systems', systemId);
          const existingSnap = await getDoc(systemRef);
          await updateDoc(systemRef, updates);
          if (existingSnap.exists()) {
            updatedSystem = normalizeSystem(existingSnap.id, { ...existingSnap.data(), ...updates });
          }
        } catch (e) {
          updatedSystem = await localStore.updateSystem(systemId, updates);
        }
    }

    if (updatedSystem && updatedSystem.goalId) {
        await this.calculateGoalProgress(userId, updatedSystem.goalId);
    }
    return true;
  },

  async deleteSystem(userId: string, systemId: string) {
      if (this.isDemoMode()) {
          return localStore.deleteSystem(systemId);
      }
      try {
          await deleteDoc(doc(firestore, 'users', userId, 'systems', systemId));
      } catch (e) {
          console.warn("Delete system failed, using local store", e);
          return localStore.deleteSystem(systemId);
      }
  },

  async calculateGoalProgress(userId: string, goalId: string): Promise<number> {
    // 1. Get all tasks and systems for this goal
    const [tasks, systems] = await Promise.all([
        this.getTasks(userId, goalId),
        this.getSystems(userId, goalId)
    ]);

    const allItems = [...tasks, ...systems];
    if (allItems.length === 0) return 0;

    // Fix 1: Exclude "missed" activities from "completed" count
    // "Missed" means isCompleted=true AND successPercentage < 50
    // "Done" means isCompleted=true AND successPercentage >= 50
    const completedCount = allItems.filter(i => i.isCompleted && (i.successPercentage || 0) >= 50).length;
    const progress = Math.round((completedCount / allItems.length) * 100);

    // 2. Update the goal
    if (this.isDemoMode()) {
        const goalIndex = localStore.goals.findIndex(g => g.id === goalId);
        if (goalIndex !== -1) {
            localStore.goals[goalIndex].progress = progress;
            await localStore.save();
        }
    } else {
        try {
            await updateDoc(doc(firestore, 'users', userId, 'goals', goalId), { progress });
        } catch (e) {
            console.warn("Failed to update goal progress on server", e);
        }
    }
    return progress;
  },

  async createGoalSystem(userId: string, system: Omit<System, 'id' | 'userId' | 'createdAt'>) {
    const systemData = {
        ...system,
        userId,
        createdAt: new Date().toISOString()
    };

    if (this.isDemoMode()) {
        const added = await localStore.addSystem(systemData);
        await this.scheduleReminder(added);
        return added;
    }

    try {
        const ref = await addDoc(collection(firestore, 'users', userId, 'systems'), {
            ...systemData,
            createdAt: serverTimestamp()
        });
        const added = { ...systemData, id: ref.id };
        await this.scheduleReminder(added);
        return added;
    } catch (e) {
        console.warn("Create system failed, using local store", e);
        const added = await localStore.addSystem(systemData);
        await this.scheduleReminder(added);
        return added;
    }
  },

  async addNote(
    userId: string,
    goalId: string | undefined,
    entry: { content: string; date?: string; mood?: JournalMood; progress?: number } | string
  ) {
    const linkedGoal = goalId ? await this.getGoal(userId, goalId).catch(() => null) : null;
    const noteData: Omit<JournalEntry, 'id'> = {
        content: typeof entry === 'string' ? entry : entry.content,
        date: typeof entry === 'string'
          ? new Date().toISOString().split('T')[0]
          : (entry.date || new Date().toISOString().split('T')[0]),
        createdAt: new Date().toISOString(),
        goalId,
        goalTitle: linkedGoal?.title,
        mood: typeof entry === 'string' ? undefined : entry.mood,
        progress: typeof entry === 'string' ? undefined : entry.progress
    };

    if (this.isDemoMode()) {
        const savedNote = { ...noteData, id: `note-${Date.now()}` };
        await localStore.addNote(savedNote);
        return savedNote;
    }

    try {
        const noteRef = await addDoc(collection(firestore, 'users', userId, 'journals'), {
            ...noteData,
            createdAt: serverTimestamp()
        });
        return {
          ...noteData,
          id: noteRef.id
        };
    } catch (e) {
        console.warn("Add note failed, using local store", e);
        const savedNote = { ...noteData, id: `note-${Date.now()}` };
        await localStore.addNote(savedNote);
        return savedNote;
    }
  },

  async getHabitStage(userId: string, goalId: string): Promise<{ stage: HabitStage; completedCount: number }> {
    const systems = await this.getSystems(userId, goalId);
    
    // We count unique DAYS where at least one system was completed.
    const completedSystems = systems.filter(s => s.isCompleted);
    const uniqueDays = new Set(completedSystems.map(s => s.date)).size;
    
    const count = uniqueDays; 

    let stage: HabitStage = 'Intention';
    if (count >= HABIT_THRESHOLDS.Identity) stage = 'Identity';
    else if (count >= HABIT_THRESHOLDS.Automaticity) stage = 'Automaticity';
    else if (count >= HABIT_THRESHOLDS.Repetition) stage = 'Repetition';
    else if (count >= HABIT_THRESHOLDS.Experimentation) stage = 'Experimentation';

    return { stage, completedCount: count };
  },

  async checkConflict(userId: string, date: string, startTime: string, endTime: string): Promise<boolean> {
      const [tasks, systems] = await Promise.all([
          this.getTasks(userId, undefined, date),
          this.getSystems(userId, undefined, date)
      ]);

      const allItems = [...tasks, ...systems];
      
      const newStart = parseInt(startTime.replace(':', ''));
      const newEnd = parseInt(endTime.replace(':', ''));

      return allItems.some(item => {
          if (!item.startTime || !item.endTime) return false;
          const itemStart = parseInt(item.startTime.replace(':', ''));
          const itemEnd = parseInt(item.endTime.replace(':', ''));

          // Check for overlap
          // Overlap if (StartA < EndB) and (EndA > StartB)
          return (newStart < itemEnd && newEnd > itemStart);
      });
  }
};
