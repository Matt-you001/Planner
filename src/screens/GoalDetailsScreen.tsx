import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, X, Trash2 } from 'lucide-react-native';
import ActionItem from '../components/ActionItem';
import type { Goal, Task, System, WithId } from '../lib/types';
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

  // Add Task Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    // Fetch Goal
    const fetchedGoal = await DataService.getGoal(user.uid, goalId);
    setGoal(fetchedGoal);

    // Fetch Actions for Date
    const [fetchedTasks, fetchedSystems] = await Promise.all([
        DataService.getTasks(user.uid, goalId, dateString),
        DataService.getSystems(user.uid, goalId, dateString)
    ]);
    
    setTasks(fetchedTasks);
    setSystems(fetchedSystems);
    setLoading(false);
  }, [user, goalId, dateString]);

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
      <View className="flex-row items-center justify-between border-b border-border bg-card p-4">
         <TouchableOpacity onPress={handlePrevDay} className="p-2">
            <ChevronLeft size={24} className="text-foreground" color="black" />
         </TouchableOpacity>
         <View className="items-center">
            <Text className="text-base font-semibold text-foreground">
                {isToday(selectedDate) ? "Today" : format(selectedDate, 'EEE, MMM d')}
            </Text>
         </View>
         <TouchableOpacity onPress={handleNextDay} className="p-2">
            <ChevronRight size={24} className="text-foreground" color="black" />
         </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 bg-muted/10 p-4">
         {/* Planner Content */}
         <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-muted-foreground">Planned Activities</Text>
            {actions.length > 0 ? (
                actions.map(action => (
                    <ActionItem 
                        key={action.id} 
                        action={action} 
                        onActionChange={() => {}} // TODO: Implement update via DataService
                        onDelete={() => handleDeleteAction(action)}
                    />
                ))
            ) : (
                <View className="items-center justify-center rounded-lg border border-dashed border-border bg-card p-8">
                    <Text className="text-muted-foreground">No activities planned for this day.</Text>
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
    </SafeAreaView>
  );
}
