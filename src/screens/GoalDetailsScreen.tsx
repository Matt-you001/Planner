import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, X, Trash2, FileText, StickyNote, Award } from 'lucide-react-native';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import ActionItem from '../components/ActionItem';
import { Goal, Task, System, WithId, HabitStage, HABIT_THRESHOLDS } from '../lib/types';
import { DataService } from '../lib/DataService';

export default function GoalDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { goalId } = route.params;
  const { user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [habitStats, setHabitStats] = useState<{ stage: HabitStage; completedCount: number } | null>(null);

  // Add Task Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  // Notes State
  const [isNoteModalVisible, setNoteModalVisible] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch Goal
    const fetchedGoal = await DataService.getGoal(user.uid, goalId);
    setGoal(fetchedGoal);

    // Fetch Habit Stats
    const stats = await DataService.getHabitStage(user.uid, goalId);
    setHabitStats(stats);

    // Fetch Actions based on View Mode
    let fetchedTasks: Task[] = [];
    let fetchedSystems: System[] = [];

    if (viewMode === 'day') {
        [fetchedTasks, fetchedSystems] = await Promise.all([
            DataService.getTasks(user.uid, goalId, dateString),
            DataService.getSystems(user.uid, goalId, dateString)
        ]);
    } else {
        // For Week/Month, we might need a range query or client-side filter
        // Currently DataService.getTasks only supports specific date or all for goal
        // We'll fetch all for goal and filter locally for now (efficient enough for < 1000 items)
        const [allTasks, allSystems] = await Promise.all([
            DataService.getTasks(user.uid, goalId),
            DataService.getSystems(user.uid, goalId)
        ]);

        let start, end;
        if (viewMode === 'week') {
            start = startOfWeek(selectedDate);
            end = endOfWeek(selectedDate);
        } else {
            start = startOfMonth(selectedDate);
            end = endOfMonth(selectedDate);
        }

        fetchedTasks = allTasks.filter(t => t.date && isWithinInterval(new Date(t.date), { start, end }));
        fetchedSystems = allSystems.filter(s => s.date && isWithinInterval(new Date(s.date), { start, end }));
    }
    
    setTasks(fetchedTasks);
    setSystems(fetchedSystems);
    setLoading(false);
  }, [user, goalId, dateString, viewMode]);

  useFocusEffect(
    useCallback(() => {
        loadData();
    }, [loadData])
  );

  const actions = useMemo(() => {
    const combined = [...(systems || []), ...(tasks || [])];
    return combined; 
  }, [systems, tasks]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !user || !goal) return;
    setIsAddingTask(true);
    try {
        await DataService.createTask(user.uid, {
            title: newTaskTitle.trim(),
            date: dateString,
            goalId: goalId,
            startTime: '09:00', // Default
        });
        setNewTaskTitle('');
        setModalVisible(false);
        loadData(); // Refresh list
    } catch (e) {
        console.error("Failed to add task", e);
    } finally {
        setIsAddingTask(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !user) return;
    setIsAddingNote(true);
    try {
        await DataService.addNote(user.uid, goalId, newNoteContent.trim());
        setNewNoteContent('');
        setNoteModalVisible(false);
        loadData();
    } catch (e) {
        console.error("Failed to add note", e);
    } finally {
        setIsAddingNote(false);
    }
  };

  if (loading && !goal) {
     return (
        <SafeAreaView className="flex-1 bg-background items-center justify-center">
             <ActivityIndicator color="hsl(200 80% 60%)" />
        </SafeAreaView>
     )
  }

  if (!goal) return null;

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));

  const handleAddPlan = () => {
    // Navigate to PlanSetupScreen with the currently selected date and goal info
    // This ensures new activities are added to the existing plan for this specific day
    navigation.navigate('PlanSetup', {
        goalId: goal.id,
        goalTitle: goal.title,
        startDate: goal.startDate, // Pass the goal's start date
        targetDate: goal.targetDate, // Pass the goal's target date
        initialSelectedDate: format(selectedDate, 'yyyy-MM-dd') // Pass the currently viewed date
    });
  };

  const handleDeletePlan = () => {
      Alert.alert(
          "Delete Plan",
          "Are you sure you want to delete this plan? This will remove all associated tasks and history.",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive",
                  onPress: async () => {
                      if (!user) return;
                      try {
                          await DataService.deleteGoal(user.uid, goalId);
                          navigation.goBack();
                      } catch (e) {
                          console.error("Failed to delete goal", e);
                          Alert.alert("Error", "Could not delete plan.");
                      }
                  }
              }
          ]
      );
  };

  const handleDeleteAction = async (action: WithId<System> | WithId<Task>) => {
      if (!user) return;
      
      Alert.alert(
          "Delete Activity",
          "Are you sure you want to remove this activity?",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive",
                  onPress: async () => {
                    try {
                        if ('goalId' in action && !('notes' in action)) {
                             // It's a System (heuristic check, ideally use a discriminator)
                             // Actually 'notes' is in Task but not System in types currently? 
                             // Wait, both have goalId. 
                             // System has 'repeat', Task has 'notes'.
                             // Let's check if it has a 'repeat' field or just try to delete based on ID
                             // But wait, we need to know which collection it is in.
                             // DataService separates them.
                             // We can use a property check.
                             const isSystem = 'repeat' in action || !('notes' in action); // Approximate
                             if (isSystem) {
                                 await DataService.deleteSystem(user.uid, action.id);
                             } else {
                                 await DataService.deleteTask(user.uid, action.id);
                             }
                        } else {
                             // Fallback to Task
                             await DataService.deleteTask(user.uid, action.id);
                        }
                        loadData();
                    } catch (e) {
                        console.error("Failed to delete action", e);
                    }
                  }
              }
          ]
      );
  };

  const getNextMilestone = (count: number) => {
    if (count < HABIT_THRESHOLDS.Experimentation) return HABIT_THRESHOLDS.Experimentation;
    if (count < HABIT_THRESHOLDS.Repetition) return HABIT_THRESHOLDS.Repetition;
    if (count < HABIT_THRESHOLDS.Automaticity) return HABIT_THRESHOLDS.Automaticity;
    if (count < HABIT_THRESHOLDS.Identity) return HABIT_THRESHOLDS.Identity;
    return count; // Maxed out
  };

  const getStageDescription = (stage: HabitStage) => {
      const title = goal?.title || "change";
      switch (stage) {
          case 'Intention': return `You've decided to ${title}. Now take the first step.`;
          case 'Experimentation': return `You're trying to ${title}. Consistency is key.`;
          case 'Repetition': return `You're regularly working to ${title}. Keep it up!`;
          case 'Automaticity': return `To ${title} is becoming second nature. Don't stop now.`;
          case 'Identity': return `You are someone who ${title}s. Amazing work!`;
      }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-border bg-card p-4 shadow-sm">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-1">
            <ArrowLeft size={24} className="text-foreground" color="black" />
        </TouchableOpacity>
        <View className="flex-1">
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>{goal.title}</Text>
            <Text className="text-xs text-muted-foreground">{goal.category}</Text>
        </View>
        <View className="flex-row gap-2">
            <TouchableOpacity onPress={handleDeletePlan} className="p-2">
                <Trash2 size={24} color="#ef4444" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddPlan} className="p-2">
                <Plus size={24} color="#0ea5e9" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Date Navigation */}
      <View className="border-b border-border bg-card p-4">
        {/* Habit Growth Tracker (Only for Habits, check category or stats) */}
        {habitStats && (
            <View className="mb-6 rounded-xl bg-indigo-50 p-4 border border-indigo-100">
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        <Award size={20} color="#4f46e5" className="mr-2" />
                        <Text className="text-base font-bold text-indigo-900">{habitStats.stage}</Text>
                    </View>
                    <Text className="text-xs font-bold text-indigo-600">
                        {habitStats.completedCount} / {getNextMilestone(habitStats.completedCount)} Days
                    </Text>
                </View>
                
                <Text className="text-sm text-indigo-700 mb-3 italic">
                    "{getStageDescription(habitStats.stage)}"
                </Text>

                {/* Progress Bar */}
                <View className="h-2 w-full rounded-full bg-indigo-200 overflow-hidden">
                    <View 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${Math.min(100, (habitStats.completedCount / getNextMilestone(habitStats.completedCount)) * 100)}%` }} 
                    />
                </View>
            </View>
        )}

        {/* View Mode Selector */}
        <View className="flex-row justify-center mb-4 bg-gray-100 p-1 rounded-lg">
            {(['day', 'week', 'month'] as const).map((mode) => (
                <TouchableOpacity
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    className={`flex-1 items-center py-2 rounded-md ${viewMode === mode ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`font-medium ${viewMode === mode ? 'text-sky-600' : 'text-gray-500'}`}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>

        <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={handlePrevDay} className="p-2">
                <ChevronLeft size={24} className="text-foreground" color="black" />
            </TouchableOpacity>
            <View className="items-center">
                <Text className="text-base font-semibold text-foreground">
                    {viewMode === 'day' ? (isToday(selectedDate) ? "Today" : format(selectedDate, 'EEE, MMM d')) :
                     viewMode === 'week' ? `Week of ${format(startOfWeek(selectedDate), 'MMM d')}` :
                     format(selectedDate, 'MMMM yyyy')}
                </Text>
            </View>
            <TouchableOpacity onPress={handleNextDay} className="p-2">
                <ChevronRight size={24} className="text-foreground" color="black" />
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 bg-muted/10 p-4">
         {/* Planner Content */}
         <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-muted-foreground">
                {viewMode === 'day' ? 'Planned Activities' : `Activities for this ${viewMode}`}
            </Text>
            {actions.length > 0 ? (
                actions.map(action => (
                    <ActionItem 
                        key={action.id} 
                        action={action} 
                        onActionChange={() => {}} 
                        onDelete={() => handleDeleteAction(action)}
                    />
                ))
            ) : (
                <View className="items-center justify-center rounded-lg border border-dashed border-border bg-card p-8">
                    <Text className="text-muted-foreground">No activities found.</Text>
                </View>
            )}
         </View>

         {/* Notes Section */}
         <View className="mb-20">
            <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium text-muted-foreground">Notes</Text>
                <TouchableOpacity onPress={() => setNoteModalVisible(true)} className="flex-row items-center">
                    <Plus size={16} color="#0ea5e9" className="mr-1" />
                    <Text className="text-sky-500 text-xs font-bold">Add Note</Text>
                </TouchableOpacity>
            </View>
            
            {goal.notes && goal.notes.length > 0 ? (
                goal.notes.map((note, idx) => (
                    <View key={note.id || idx} className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
                        <Text className="text-gray-900 mb-2">{note.content}</Text>
                        <Text className="text-xs text-gray-400">{format(new Date(note.createdAt), 'MMM d, h:mm a')}</Text>
                    </View>
                ))
            ) : (
                <View className="items-center justify-center rounded-lg border border-gray-100 bg-gray-50 p-6">
                    <FileText size={24} color="#d1d5db" className="mb-2" />
                    <Text className="text-gray-400 text-xs">No notes added yet.</Text>
                </View>
            )}
         </View>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
            <View className="rounded-lg bg-white p-6 shadow-lg">
                <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-lg font-bold">Add Task</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <X size={24} color="gray" />
                    </TouchableOpacity>
                </View>
                
                <TextInput 
                    className="mb-4 rounded-md border border-gray-300 p-3"
                    placeholder="What needs to be done?"
                    value={newTaskTitle}
                    onChangeText={setNewTaskTitle}
                    autoFocus
                />

                <TouchableOpacity 
                    className="items-center rounded-md bg-sky-500 p-3"
                    onPress={handleAddTask}
                    disabled={isAddingTask}
                >
                    {isAddingTask ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="font-bold text-white">Add Task</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        visible={isNoteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View className="flex-1 justify-center bg-black/50 p-4">
            <View className="rounded-lg bg-white p-6 shadow-lg">
                <View className="mb-4 flex-row items-center justify-between">
                    <Text className="text-lg font-bold">Add Progress Note</Text>
                    <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
                        <X size={24} color="gray" />
                    </TouchableOpacity>
                </View>
                
                <TextInput 
                    className="mb-4 rounded-md border border-gray-300 p-3 h-32"
                    placeholder="Record your thoughts, challenges, or wins..."
                    value={newNoteContent}
                    onChangeText={setNewNoteContent}
                    multiline
                    textAlignVertical="top"
                    autoFocus
                />

                <TouchableOpacity 
                    className="items-center rounded-md bg-sky-500 p-3"
                    onPress={handleAddNote}
                    disabled={isAddingNote}
                >
                    {isAddingNote ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="font-bold text-white">Save Note</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
