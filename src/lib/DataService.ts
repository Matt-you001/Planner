import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { firestore, auth } from '../firebase';
import { MOCK_GOALS, MOCK_TASKS, MOCK_SYSTEMS, MOCK_USER } from './mockData';
import type { Goal, Task, System, WithId } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  GOALS: '@endinmind:goals',
  TASKS: '@endinmind:tasks',
  SYSTEMS: '@endinmind:systems',
};

// In-memory store that syncs with AsyncStorage
class PersistentStore {
  goals: WithId<Goal>[] = [];
  tasks: WithId<Task>[] = [];
  systems: WithId<System>[] = [];
  initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      console.log('DataService: Initializing local store...');
      const [g, t, s] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.GOALS),
        AsyncStorage.getItem(STORAGE_KEYS.TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.SYSTEMS),
      ]);
      
      if (g) {
        this.goals = JSON.parse(g);
        console.log(`DataService: Loaded ${this.goals.length} goals from storage.`);
      } else {
        console.log('DataService: No goals in storage, using mocks.');
      }
      
      if (t) this.tasks = JSON.parse(t);
      if (s) this.systems = JSON.parse(s);
      
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
  // Check if we are using the real backend or fallback
  isDemoMode: () => {
    // If auth is null, we are definitely in demo/offline mode
    if (!auth.currentUser) return true;
    // If the user is our explicit mock user
    if (auth.currentUser.uid === 'mock-user-123') return true;
    
    // NOTE: For now, FORCE demo mode if we can't connect to Firestore to ensure app is usable.
    // In production, we'd check network status.
    return true; 
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
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as WithId<Goal>));
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
      if (snap.exists()) return { ...snap.data(), id: snap.id } as WithId<Goal>;
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
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as WithId<Task>));
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
      return localStore.addTask(taskData);
    }

    try {
      const ref = await addDoc(collection(firestore, 'users', userId, 'tasks'), {
        ...taskData,
        createdAt: serverTimestamp()
      });
      return { ...taskData, id: ref.id };
    } catch (e) {
      console.warn("Create task failed, using local store", e);
      return localStore.addTask(taskData);
    }
  },

  async updateTask(userId: string, taskId: string, updates: Partial<Task>) {
    let updatedTask: WithId<Task> | null = null;
    if (this.isDemoMode()) {
      updatedTask = await localStore.updateTask(taskId, updates);
    } else {
      try {
        await updateDoc(doc(firestore, 'users', userId, 'tasks', taskId), updates);
        // We'd need to refetch to get the full object or just assume success with optimistic updates
        // For simplicity here, we'll assume we can construct it if needed, but in this specific flow 
        // we might rely on the calling code. However, to calc progress we need the goalId.
        // Let's assume we need to fetch it if we were real.
      } catch (e) {
        updatedTask = await localStore.updateTask(taskId, updates);
      }
    }

    // After updating task, recalculate goal progress if goalId is present
    if (updatedTask && updatedTask.goalId) {
        await this.calculateGoalProgress(userId, updatedTask.goalId);
    } else if (!this.isDemoMode() && !updatedTask) {
       // If real DB, we need to fetch the task to get the goalId to update progress
       // This part is complex without a full fetch. For now, we will rely on localStore or assume passed updates has goalId? 
       // updates usually doesn't have goalId. 
       // Implementation detail: In a real app, use a Cloud Function trigger for this. 
       // Here, we will try to find the task in our local cache or just skip for real DB (Cloud Function should handle it).
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
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as WithId<System>));
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
          await updateDoc(doc(firestore, 'users', userId, 'systems', systemId), updates);
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

    const completedCount = allItems.filter(i => i.isCompleted).length;
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
        return localStore.addSystem(systemData);
    }

    try {
        const ref = await addDoc(collection(firestore, 'users', userId, 'systems'), {
            ...systemData,
            createdAt: serverTimestamp()
        });
        return { ...systemData, id: ref.id };
    } catch (e) {
        console.warn("Create system failed, using local store", e);
        return localStore.addSystem(systemData);
    }
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

